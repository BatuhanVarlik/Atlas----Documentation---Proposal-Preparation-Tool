// Şematik (P&ID) diyagramı sunucu tarafında SVG'ye render eder, sharp ile PNG'ye
// rasterize eder ve Word belgesine gömmek için DrawingML paragraf XML'i üretir.
import React from 'react';
import sharp from 'sharp';
import { MilkReceptionSchematic } from '@/components/milk-reception/MilkReceptionSchematic';
import { ModuleSchematic } from '@/components/module-builder/ModuleSchematic';
import { CipSchematic, type CipTankType } from '@/components/cip-builder/CipSchematic';
import { calculatePipeDiameter } from '@/lib/calc/pipeDiameter';
import { selectDN } from '@/lib/calc/selectDN';
import { calculateModule } from '@/lib/calc/moduleCalculator';
import { calculateCipLine, calculateCipModule } from '@/lib/calc/cipCalculator';

export const DIAGRAM_REL_ID = 'rIdDiagram1';
export const DIAGRAM_FILENAME = 'diagram1.png';

const CONTENT_WIDTH_TWIPS = 9600; // şablon tablolarıyla aynı genişlik
const EMU_PER_TWIP = 635;
const RASTER_SCALE = 2; // netlik için 2x

export interface DiagramResult {
  png: Buffer;
  drawingXml: string; // {@diagramXml} yerine geçecek <w:p> bloğu
}

// Next.js, uygulama grafiğinde 'react-dom/server' statik importunu yasaklar. Bu kod
// yalnızca Node API route'unda (sunucu) çalıştığından, sunucu CJS bundle'ındaki gerçek
// Node `require`'ını eval ile alıp runtime'da yükleriz; webpack bu importu görmez/analiz etmez.
function renderToStaticMarkup(element: React.ReactElement): string {
  // eslint-disable-next-line no-eval
  const req = eval('require') as (id: string) => unknown;
  const mod = req('react-dom/server') as typeof import('react-dom/server');
  return mod.renderToStaticMarkup(element);
}

/** Tam bir <svg> dizesini PNG'ye çevirir; viewBox'tan en-boy oranını alır */
async function svgToPng(fullMarkup: string): Promise<{ png: Buffer; widthEmu: number; heightEmu: number }> {
  const match = fullMarkup.match(/<svg[\s\S]*<\/svg>/);
  let svg = match ? match[0] : fullMarkup;
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const w = vb ? Math.round(parseFloat(vb[1])) : 1000;
  const h = vb ? Math.round(parseFloat(vb[2])) : 600;
  // sharp/librsvg için xmlns + açık boyut gerekir
  if (!/xmlns=/.test(svg)) {
    svg = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `);
  }
  const png = await sharp(Buffer.from(svg), { density: 96 * RASTER_SCALE })
    .resize({ width: w * RASTER_SCALE })
    .png()
    .toBuffer();

  const widthEmu = CONTENT_WIDTH_TWIPS * EMU_PER_TWIP;
  const heightEmu = Math.round((widthEmu * h) / w);
  return { png, widthEmu, heightEmu };
}

function drawingParagraph(
  widthEmu: number,
  heightEmu: number,
  opts: { pageBreakAfter?: boolean } = {},
): string {
  const image =
    '<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:drawing>' +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="2" name="Diyagram"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="2" name="Diyagram"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${DIAGRAM_REL_ID}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

  // Sonraki içeriği yeni sayfada başlatmak için boş bir taşıyıcı paragrafa pageBreakBefore
  // konur. Sabit <w:br w:type="page"/> (ve boş satırlar) görsel sayfayı doldurduğunda
  // taşma yapıp araya boş bir sayfa ekliyordu; pageBreakBefore bu yan etkiyi yapmaz.
  const pageBreak = opts.pageBreakAfter
    ? '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>'
    : '';

  return image + pageBreak;
}

// ============ Süt Alım diyagramı ============

interface MRLine {
  id: string;
  name: string;
  capacity: number;
  pumpModel: string | null;
  pumpKw: number | null;
  filterUnitCount: number;
  pressureMeterType: string;
  hasMilkClarifier: boolean;
  clarifierBypassValveType: string | null;
  hasPhe: boolean;
  pheCapacity: number | null;
  pheIceWaterTempSensorType: string | null;
  pheIceWaterPressureMeterType: string | null;
  hasSamplingValve: boolean;
  samplingValveType: string | null;
}
interface MRModuleForDiagram {
  standard: string;
  hasTankerCip: boolean;
  tankerCipCapacity: number | null;
  tankerCipPressure: number | null;
  tankerCipPumpModel: string | null;
  receptionLines: MRLine[];
}

export async function renderMilkReceptionDiagram(module: MRModuleForDiagram): Promise<DiagramResult | null> {
  if (module.receptionLines.length === 0 && !module.hasTankerCip) return null;
  const standard = module.standard as 'DIN' | 'SMS';

  const lineCalcs = module.receptionLines.map((l) => {
    if (!l.capacity || l.capacity <= 0) return { id: l.id, dn: null as string | null, inner: 0 };
    const d = calculatePipeDiameter({ capacityLh: l.capacity, velocity: 2.0 });
    try {
      const s = selectDN(d.diameterMm, standard);
      return { id: l.id, dn: s.dn, inner: s.inner };
    } catch {
      return { id: l.id, dn: null, inner: 0 };
    }
  });
  const largest = [...lineCalcs].filter((c) => c.dn).sort((a, b) => b.inner - a.inner)[0]?.dn ?? '—';

  // Tanker CIP çapı — önizlemeyle aynı şekilde hesapla (V=2.0), aksi halde doc diyagramında boş kalır.
  let tankerCipDn: string | null = null;
  if (module.hasTankerCip && module.tankerCipCapacity && module.tankerCipCapacity > 0) {
    const d = calculatePipeDiameter({ capacityLh: module.tankerCipCapacity, velocity: 2.0 });
    try {
      tankerCipDn = selectDN(d.diameterMm, standard).dn;
    } catch {
      tankerCipDn = null;
    }
  }

  const props = {
    standard,
    waterInletSize: largest,
    lines: module.receptionLines.map((l) => ({
      name: l.name,
      capacity: l.capacity,
      dn: lineCalcs.find((c) => c.id === l.id)?.dn ?? null,
      pumpModel: l.pumpModel,
      pumpKw: l.pumpKw,
      filterUnitCount: l.filterUnitCount,
      pressureMeterType: l.pressureMeterType,
      hasMilkClarifier: l.hasMilkClarifier,
      clarifierBypassValveType: l.clarifierBypassValveType,
      hasPhe: l.hasPhe,
      pheCapacity: l.pheCapacity,
      pheIceWaterTempSensorType: l.pheIceWaterTempSensorType,
      pheIceWaterPressureMeterType: l.pheIceWaterPressureMeterType,
      hasSamplingValve: l.hasSamplingValve,
      samplingValveType: l.samplingValveType,
    })),
    tankerCip: module.hasTankerCip
      ? { capacity: module.tankerCipCapacity, pressure: module.tankerCipPressure, hasPump: !!module.tankerCipPumpModel, dn: tankerCipDn }
      : null,
  } as React.ComponentProps<typeof MilkReceptionSchematic>;

  // Render/raster hatası tüm belge üretimini düşürmesin — diyagram opsiyoneldir.
  try {
    const markup = renderToStaticMarkup(React.createElement(MilkReceptionSchematic, props));
    const { png, widthEmu, heightEmu } = await svgToPng(markup);
    return { png, drawingXml: drawingParagraph(widthEmu, heightEmu) };
  } catch (e) {
    console.error('Süt Alım diyagramı üretilemedi, atlanıyor:', e);
    return null;
  }
}

// ============ Depolama diyagramı ============

interface StorageLine { id: string; name: string; capacity: number; connectedTankCount: number; pumpModel?: string | null }
interface StorageModuleForDiagram {
  standard: string;
  waterInletValveType: string | null;
  tankCipReturnManifoldExists: boolean;
  tankCipReturnLineCount: number;
  tankCipReturnPumpModel: string | null;
  tanks: Array<{
    name: string;
    volume: number;
    hasAgitator?: boolean;
    hasLSH?: boolean;
    hasLSM?: boolean;
    hasLSL?: boolean;
    hasTT?: boolean;
    hasPT?: boolean;
  }>;
  valveCluster: { fillingLines: StorageLine[]; dischargeLines: StorageLine[] } | null;
}

export async function renderStorageDiagram(module: StorageModuleForDiagram): Promise<DiagramResult | null> {
  const fl = module.valveCluster?.fillingLines ?? [];
  const dl = module.valveCluster?.dischargeLines ?? [];
  if (module.tanks.length === 0 && fl.length === 0 && dl.length === 0) return null;

  const standard = module.standard as 'DIN' | 'SMS';
  const hasLines = fl.length > 0 || dl.length > 0;
  const FIXED_FILLING = 3;
  const FIXED_DISCHARGE = module.waterInletValveType ? 3 : 2;

  // Hesap (kapasite tabloyu aşarsa selectDN fırlatabilir) + render/raster — diyagram opsiyonel
  // olduğundan herhangi bir hata tüm belge üretimini düşürmemeli.
  try {
    const calc = hasLines
      ? calculateModule({
          standard,
          fillingLines: fl.map((l) => ({ id: l.id, capacity: l.capacity })),
          dischargeLines: dl.map((l) => ({ id: l.id, capacity: l.capacity, hasFlowMeter: false })),
        })
      : null;

    const props = {
      tanks: module.tanks.map((t) => ({
        name: t.name,
        volume: t.volume,
        hasAgitator: t.hasAgitator,
        hasLSH: t.hasLSH,
        hasLSM: t.hasLSM,
        hasLSL: t.hasLSL,
        hasTT: t.hasTT,
        hasPT: t.hasPT,
      })),
      fillingLines: fl.map((l) => ({ name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount })),
      dischargeLines: dl.map((l) => ({ name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount, hasPump: !!l.pumpModel })),
      fixedFillingValves: FIXED_FILLING,
      fixedDischargeValves: FIXED_DISCHARGE,
      selectedDN: calc?.selectedDN.dn,
      tankCipReturn:
        module.tanks.length > 0
          ? { manifoldExists: module.tankCipReturnManifoldExists, lineCount: module.tankCipReturnLineCount, hasPump: !!module.tankCipReturnPumpModel }
          : null,
    } as React.ComponentProps<typeof ModuleSchematic>;

    const markup = renderToStaticMarkup(React.createElement(ModuleSchematic, props));
    const { png, widthEmu, heightEmu } = await svgToPng(markup);
    // Diyagram satır-içi; sayfa kırma YOK. PRICING kendi pageBreakBefore'u ile yeni sayfaya
    // geçer (burada da kırarsak iki kırılma → aralarda boş sayfa olur).
    return { png, drawingXml: drawingParagraph(widthEmu, heightEmu) };
  } catch (e) {
    console.error('Depolama diyagramı üretilemedi, atlanıyor:', e);
    return null;
  }
}

// ============ CIP diyagramı ============

interface CipLineForDiagram {
  id: string;
  lineKind: 'DISCHARGE' | 'RETURN';
  name: string;
  capacity: number;
  pumpModel: string | null;
  pumpKw: number | null;
}
interface CipModuleForDiagram {
  standard: string;
  systemType: 'FORWARD' | 'CIRCULATED';
  tanks: Array<{ tankType: string; capacity: number }>;
  lines: CipLineForDiagram[];
}

const CIP_TANK_LABELS: Record<string, string> = {
  CAUSTIC: 'Caustic', ACID: 'Acid', HOT_WATER: 'Hot Water',
  RECOVERY: 'Recovery', FRESH_WATER: 'Fresh Water',
};

export async function renderCipDiagram(module: CipModuleForDiagram): Promise<DiagramResult | null> {
  if (module.tanks.length === 0 && module.lines.length === 0) return null;
  const standard = module.standard as 'DIN' | 'SMS';

  try {
    const moduleCalc = calculateCipModule({
      standard,
      lines: module.lines.map((l) => ({ id: l.id, lineKind: l.lineKind, capacityLh: l.capacity })),
    });
    const lineDn = (l: CipLineForDiagram): string | null => {
      if (!l.capacity || l.capacity <= 0) return null;
      return calculateCipLine(l.capacity, l.lineKind, standard).selectedDN?.dn ?? null;
    };
    const toLine = (l: CipLineForDiagram) => ({
      name: l.name,
      capacity: l.capacity,
      dn: lineDn(l),
      pumpModel: l.pumpModel,
      pumpKw: l.pumpKw,
    });

    const props = {
      standard,
      systemType: module.systemType,
      selectedDN: moduleCalc.selectedDN?.dn ?? null,
      tanks: module.tanks.map((t) => ({
        tankType: t.tankType as CipTankType,
        label: CIP_TANK_LABELS[t.tankType] ?? t.tankType,
        capacity: t.capacity,
      })),
      dischargeLines: module.lines.filter((l) => l.lineKind === 'DISCHARGE').map(toLine),
      returnLines: module.lines.filter((l) => l.lineKind === 'RETURN').map(toLine),
    } as React.ComponentProps<typeof CipSchematic>;

    const markup = renderToStaticMarkup(React.createElement(CipSchematic, props));
    const { png, widthEmu, heightEmu } = await svgToPng(markup);
    return { png, drawingXml: drawingParagraph(widthEmu, heightEmu) };
  } catch (e) {
    console.error('CIP diyagramı üretilemedi, atlanıyor:', e);
    return null;
  }
}
