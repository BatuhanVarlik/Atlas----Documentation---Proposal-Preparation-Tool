/* eslint-disable no-console */
// APV Hemisan teklif Word şablonlarını (.docx) sıfırdan üretir, logoyu gömer,
// docxtemplater placeholder'larıyla doldurur, render-test eder ve DocumentTemplate
// olarak (aktif) kaydeder. Çalıştırma:
//   $env:DATABASE_URL="..."; npx tsx scripts/build-word-templates.ts
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { prisma } from '../lib/prisma';
import { extractPlaceholders, dotNotationParser } from '../lib/docx/renderTemplate';

// ---------- Renk paleti ----------
const NAVY = '1B2A52';
const RED = 'E2231A';
const HEADER_FILL = '1B2A52';
const ZEBRA_FILL = 'F1F5F9';
const BORDER = 'D9D9D9';
const CONTENT_W = 9600; // twips

// ---------- OOXML yardımcıları ----------
function run(text: string, o: { bold?: boolean; sz?: number; color?: string; italic?: boolean } = {}) {
  const sz = o.sz ?? 20;
  const rpr: string[] = [];
  if (o.bold) rpr.push('<w:b/>');
  if (o.italic) rpr.push('<w:i/>');
  if (o.color) rpr.push(`<w:color w:val="${o.color}"/>`);
  rpr.push(`<w:sz w:val="${sz}"/>`, `<w:szCs w:val="${sz}"/>`);
  return `<w:r><w:rPr>${rpr.join('')}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function para(inner: string, o: { align?: string; before?: number; after?: number } = {}) {
  const ppr: string[] = [];
  if (o.align) ppr.push(`<w:jc w:val="${o.align}"/>`);
  ppr.push(`<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 60}"/>`);
  return `<w:p><w:pPr>${ppr.join('')}</w:pPr>${inner}</w:p>`;
}

function spacer(after = 120) {
  return `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr></w:p>`;
}

function heading(text: string) {
  return para(run(text, { bold: true, sz: 24, color: NAVY }), { before: 160, after: 80 });
}

function cell(
  text: string,
  o: { w: number; bold?: boolean; fill?: string; color?: string; align?: string; sz?: number } = { w: 1000 },
) {
  const tcpr = [`<w:tcW w:w="${o.w}" w:type="dxa"/>`];
  if (o.fill) tcpr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>`);
  tcpr.push('<w:vAlign w:val="center"/>');
  const p = para(run(text, { bold: o.bold, sz: o.sz ?? 18, color: o.color }), { align: o.align, after: 0 });
  return `<w:tc><w:tcPr>${tcpr.join('')}</w:tcPr>${p}</w:tc>`;
}

function rowXml(cells: string) {
  return `<w:tr>${cells}</w:tr>`;
}

function table(grid: number[], rows: string) {
  const borders = (['top', 'left', 'bottom', 'right', 'insideH', 'insideV'] as const)
    .map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="${BORDER}"/>`)
    .join('');
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/>` +
    `<w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    `${rows}</w:tbl>` +
    spacer(80)
  );
}

/** Etiket/değer 2 sütunlu bilgi tablosu */
function infoTable(pairs: Array<[string, string]>) {
  const grid = [3000, 6600];
  const rows = pairs
    .map(([label, value]) =>
      rowXml(
        cell(label, { w: grid[0], bold: true, fill: ZEBRA_FILL }) +
          cell(value, { w: grid[1] }),
      ),
    )
    .join('');
  return table(grid, rows);
}

function logoParagraph() {
  // 177x57 px -> EMU (×9525)
  const cx = 177 * 9525;
  const cy = 57 * 9525;
  const drawing =
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="HemisanLogo"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="HemisanLogo"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing>`;
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r>${drawing}</w:r></w:p>`;
}

function documentXml(body: string) {
  const sect =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document ' +
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<w:body>${body}${sect}</w:body></w:document>`
  );
}

function totalPriceBlock() {
  // Sadece Total Price
  return (
    para(run('TOPLAM FİYAT', { bold: true, sz: 22, color: NAVY }), { before: 200, after: 40 }) +
    para(run('{pricing.totalPrice} {pricing.currency}', { bold: true, sz: 44, color: RED }), { after: 40 })
  );
}

/** Navy başlıklı (Kategori | Adet) tek özet tablosu — sabit satırlar, sağa yaslı adetler */
function summaryTable(pairs: Array<[string, string]>) {
  const grid = [7000, 2600];
  const header = rowXml(
    cell('Kategori', { w: grid[0], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
      cell('Adet', { w: grid[1], bold: true, fill: HEADER_FILL, color: 'FFFFFF', align: 'right' }),
  );
  const body = pairs
    .map(([label, val]) => rowXml(cell(label, { w: grid[0], bold: true }) + cell(val, { w: grid[1], align: 'right' })))
    .join('');
  return table(grid, header + body);
}

/** Bilgi tablosunun altına gömülecek şematik diyagram bölümü (hasDiagram varsa) */
function diagramSection() {
  const open = para(run('{#hasDiagram}Şematik Diyagram', { bold: true, sz: 24, color: NAVY }), { before: 160, after: 80 });
  const img = para(run('{@diagramXml}'), { after: 0 });
  const close = para(run('{/hasDiagram}'), { after: 0 });
  return open + img + close;
}

// ---------- Süt Alım şablonu ----------
function milkReceptionBody() {
  let b = logoParagraph();
  b += para(run('SÜT ALIM MODÜLÜ — TEKLİF ÖZETİ', { bold: true, sz: 30, color: NAVY }), { after: 20 });
  b += para(run('{module.name}', { bold: true, sz: 24, color: RED }), { after: 120 });

  b += infoTable([
    ['Müşteri', '{module.customerName}'],
    ['Proje Kodu', '{module.projectCode}'],
    ['Standart', '{module.standard}'],
    ['Vana Kontrol Ünitesi', '{module.controlUnit}'],
    ['Hat Sayısı', '{totals.lineCount}'],
    ['Tarih', '{module.createdDate}'],
    ['Hazırlayan', '{creator.name}'],
  ]);

  b += diagramSection();

  b += heading('Girdi Değerleri — Süt Alım Hatları');
  {
    const grid = [600, 2400, 1700, 1500, 1400, 2000];
    const head = rowXml(
      cell('#', { w: grid[0], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Hat', { w: grid[1], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Kapasite (L/h)', { w: grid[2], bold: true, fill: HEADER_FILL, color: 'FFFFFF', align: 'right' }) +
        cell('Basınç (Bar)', { w: grid[3], bold: true, fill: HEADER_FILL, color: 'FFFFFF', align: 'right' }) +
        cell('Hesaplanan DN', { w: grid[4], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Pompa', { w: grid[5], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }),
    );
    const loop = rowXml(
      cell('{#receptionLines}{sira}', { w: grid[0] }) +
        cell('{name}', { w: grid[1] }) +
        cell('{capacity}', { w: grid[2], align: 'right' }) +
        cell('{pressure}', { w: grid[3], align: 'right' }) +
        cell('{dn}', { w: grid[4] }) +
        cell('{pumpModel}{/receptionLines}', { w: grid[5] }),
    );
    b += table(grid, head + loop);
  }

  // Tanker CIP (opsiyonel)
  b += '{#showTankerCip}';
  b += heading('Tanker CIP İstasyonu');
  b += infoTable([
    ['Kapasite (L/h)', '{tankerCip.capacity}'],
    ['Basınç (Bar)', '{tankerCip.pressure}'],
    ['Hesaplanan CIP Çapı', '{tankerCip.dn}'],
    ['Pompa', '{tankerCip.pumpModel}'],
  ]);
  b += '{/showTankerCip}';

  b += heading('Özet Sayımlar');
  b += summaryTable([
    ['Hat Sayısı', '{totals.lineCount}'],
    ['Vana Sayısı', '{valveCount}'],
    ['Enstrüman / Ekipman Sayısı', '{otherCount}'],
    ['Toplam Kalem', '{itemCount}'],
  ]);

  b += totalPriceBlock();
  return b;
}

// ---------- Depolama şablonu ----------
function storageBody() {
  let b = logoParagraph();
  b += para(run('RAW MILK STORAGE — TEKLİF ÖZETİ', { bold: true, sz: 30, color: NAVY }), { after: 20 });
  b += para(run('{module.name}', { bold: true, sz: 24, color: RED }), { after: 120 });

  b += infoTable([
    ['Müşteri', '{module.customerName}'],
    ['Proje Kodu', '{module.projectCode}'],
    ['Standart', '{module.standard}'],
    ['Ürün Tipi', '{module.productTypeLabel}'],
    ['Vana Tipi', '{module.valveType}'],
    ['Kontrol Ünitesi', '{module.controlUnit}'],
    ['Seçilen Boru Çapı', '{calc.selectedDN}'],
    ['Tarih', '{module.createdDate}'],
    ['Hazırlayan', '{creator.name}'],
  ]);

  b += diagramSection();

  b += heading('Girdi Değerleri — Dolum Hatları');
  {
    const grid = [600, 3400, 2600, 1500, 1500];
    const head = rowXml(
      cell('#', { w: grid[0], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Hat', { w: grid[1], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Kapasite (L/h)', { w: grid[2], bold: true, fill: HEADER_FILL, color: 'FFFFFF', align: 'right' }) +
        cell('Vana Tipi', { w: grid[3], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Seçilen DN', { w: grid[4], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }),
    );
    const loop = rowXml(
      cell('{#fillingLines}{sira}', { w: grid[0] }) +
        cell('{name}', { w: grid[1] }) +
        cell('{capacity}', { w: grid[2], align: 'right' }) +
        cell('{valveType}', { w: grid[3] }) +
        cell('{selectedDN}{/fillingLines}', { w: grid[4] }),
    );
    b += table(grid, head + loop);
  }

  b += heading('Girdi Değerleri — Boşaltım Hatları');
  {
    const grid = [600, 2600, 1900, 1300, 1800, 1400];
    const head = rowXml(
      cell('#', { w: grid[0], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Hat', { w: grid[1], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Kapasite (L/h)', { w: grid[2], bold: true, fill: HEADER_FILL, color: 'FFFFFF', align: 'right' }) +
        cell('Basınç (Bar)', { w: grid[3], bold: true, fill: HEADER_FILL, color: 'FFFFFF', align: 'right' }) +
        cell('Pompa', { w: grid[4], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Flow Meter DN', { w: grid[5], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }),
    );
    const loop = rowXml(
      cell('{#dischargeLines}{sira}', { w: grid[0] }) +
        cell('{name}', { w: grid[1] }) +
        cell('{capacity}', { w: grid[2], align: 'right' }) +
        cell('{pressure}', { w: grid[3], align: 'right' }) +
        cell('{pumpModel}', { w: grid[4] }) +
        cell('{flowMeterDN}{/dischargeLines}', { w: grid[5] }),
    );
    b += table(grid, head + loop);
  }

  b += heading('Girdi Değerleri — Tanklar');
  {
    const grid = [600, 3200, 2400, 3400];
    const head = rowXml(
      cell('#', { w: grid[0], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Tank', { w: grid[1], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }) +
        cell('Hacim (L)', { w: grid[2], bold: true, fill: HEADER_FILL, color: 'FFFFFF', align: 'right' }) +
        cell('Sensörler', { w: grid[3], bold: true, fill: HEADER_FILL, color: 'FFFFFF' }),
    );
    const loop = rowXml(
      cell('{#tanks}{sira}', { w: grid[0] }) +
        cell('{name}', { w: grid[1] }) +
        cell('{volume}', { w: grid[2], align: 'right' }) +
        cell('{sensors}{/tanks}', { w: grid[3] }),
    );
    b += table(grid, head + loop);
  }

  b += heading('Özet Sayımlar');
  b += summaryTable([
    ['Dolum Hattı Sayısı', '{fillingLineCount}'],
    ['Boşaltım Hattı Sayısı', '{dischargeLineCount}'],
    ['Tank Sayısı', '{tankCount}'],
    ['Vana Sayısı', '{valveCount}'],
    ['Enstrüman / Ekipman Sayısı', '{otherCount}'],
    ['Toplam Kalem', '{itemCount}'],
  ]);

  b += totalPriceBlock();
  return b;
}

// ---------- .docx paketi ----------
function assembleDocx(body: string, logo: Buffer): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/hemisan-logo.png"/>' +
      '</Relationships>',
  );
  zip.file('word/media/hemisan-logo.png', logo);
  zip.file('word/document.xml', documentXml(body));
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

// ---------- Render-test (placeholder eksiği / bozuk XML yakalar) ----------
function renderTest(buffer: Buffer, context: unknown, label: string) {
  const zip = new PizZip(buffer);
  // Üretimle (renderTemplateWithMedia) AYNI parser/nullGetter — aksi halde nokta-notasyonlu
  // placeholder'lar testte sessizce boş çözülür ve gerçek bir hatayı yakalamaz.
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: dotNotationParser,
    nullGetter: () => '',
  });
  doc.render(context as Record<string, unknown>);
  doc.getZip().generate({ type: 'nodebuffer' });
  console.log(`  ✓ render-test geçti: ${label}`);
}

const milkMock = {
  module: {
    name: 'Test Süt Alım', customerName: 'ABC Süt', projectCode: 'PRJ-001',
    standard: 'DIN', controlUnit: 'AS-i', createdDate: '01.06.2026',
    fixedSmallSize: 'DN25', waterInletSize: 'DN65',
  },
  creator: { name: 'Tester' },
  receptionLines: [
    { sira: 1, name: 'Reception 1', capacity: '30.000', pressure: '3', dn: 'DN65', innerDiameter: '66', pumpModel: 'W+ 30/...', pumpKw: '5,5', pumpImpellerSize: '160', filterUnitCount: 2, filterUnitLabel: '', pressureMeter: 'Manometer', hasMilkClarifier: 'Yok', clarifierBypassValve: '—', hasPhe: 'Var', pheCapacity: '30.000', pheIceWaterTempSensor: 'PT100', pheIceWaterPressureMeter: 'Manometer', hasSamplingValve: 'Var', samplingValve: 'Manuel' },
  ],
  showTankerCip: true,
  tankerCip: { enabled: true, label: 'Var', capacity: '20.000', pressure: '2', dn: 'DN50', pumpModel: 'W+ 20/...', pumpKw: '4', pumpImpellerSize: '140' },
  totals: { lineCount: 1, filterUnitTotal: 2, clarifierCount: 0, pheCount: 1, samplingCount: 1 },
  valveCount: 12, otherCount: 9, itemCount: 21,
  counts: [{ category: 'Vanalar', count: 12 }, { category: 'Sensörler', count: 1 }, { category: 'Ölçüm', count: 1 }],
  pricing: { currency: 'EUR', multiplier: '1,20', subtotal: '10.000,00', totalPrice: '12.000,00' },
  hasDiagram: true, diagramXml: '<w:p><w:r><w:t>DIAGRAM</w:t></w:r></w:p>',
};

const storageMock = {
  module: {
    name: 'Test Storage', customerName: 'ABC Süt', projectCode: 'PRJ-002', standard: 'SMS',
    productTypeLabel: 'Hijyenik', valveType: 'SDE44', controlUnit: 'AS-i',
    cipReturnValve: 'SW CIP41', cipInletValve: 'SW CIP41', waterInletValve: 'Yok',
    tankCipInletValve: 'Yok', tankCipInletDiameter: '—', drainValveFixed: 'SW41', leakageValveFixed: 'ESV',
    createdDate: '01.06.2026',
  },
  creator: { name: 'Tester' },
  calc: { selectedDN: '51 SMS (2")', selectedInner: '48.5', selectedOuter: '51', drainValveSize: '38 SMS (1"1/2)', cipReturnSize: '51 SMS (2")', tankDrainValveSize: '1"' },
  fillingLines: [{ sira: 1, name: 'Filling 1', capacity: '25.000', valveType: 'SDE44', controlUnit: 'AS-i', selectedDN: '51 SMS (2")', drainValveSize: '38 SMS', drainValveFixed: 'SW41', leakageValveFixed: 'ESV', cipReturnValve: 'SW CIP41', fixedValveCount: 3 }],
  dischargeLines: [{ sira: 1, name: 'Pasteurizer 1', capacity: '20.000', pressure: '3', valveType: 'SDE44', controlUnit: 'AS-i', pumpModel: 'W+ 20/...', pumpKw: '4', pumpImpellerSize: '140', hasPT: 'Var', hasFlowMeter: 'Var', flowMeterDN: '38 SMS (1"1/2)', waterInletType: 'Yok', selectedDN: '51 SMS (2")', drainValveSize: '38 SMS', cipInletValve: 'SW CIP41', leakageValveFixed: 'ESV', waterInletValve: 'Yok', fixedValveCount: 2 }],
  tanks: [{ sira: 1, name: 'RMT 1', volume: '80.000', sensors: 'LSH, LSL, TT', samplingValve: 'Manuel', proximitySwitch: 'Var', agitatorLabel: 'Var (5.5 kW, 30 rpm, Yan)', cipBall: 'Döner', cipInletAgitator: 'Var', cipInletManhole: 'Var', tankOutletValve: 'Aktüatörlü — Kelebek', cipReturnPump: 'Yok', drainValveSize: '1"', cipValveSize: '51 SMS (2")', checkValveSize: '51 SMS (2")' }],
  fillingLineCount: 1, dischargeLineCount: 1, tankCount: 1,
  valveCount: 18, otherCount: 11, itemCount: 29,
  counts: [{ category: 'Vanalar', count: 18 }, { category: 'Tank Sensörleri', count: 5 }, { category: 'Ölçüm', count: 2 }],
  pricing: { currency: 'EUR', multiplier: '1,15', subtotal: '20.000,00', totalPrice: '23.000,00' },
  hasDiagram: true, diagramXml: '<w:p><w:r><w:t>DIAGRAM</w:t></w:r></w:p>',
};

async function upsertTemplate(opts: { name: string; description: string; filename: string; buffer: Buffer; moduleType: string }) {
  const placeholders = extractPlaceholders(opts.buffer);
  const existing = await prisma.documentTemplate.findFirst({ where: { name: opts.name } });
  const data = {
    name: opts.name,
    description: opts.description,
    filename: opts.filename,
    filepath: `templates/${opts.filename}`,
    placeholders,
    moduleType: opts.moduleType,
    isActive: true,
  };
  if (existing) {
    await prisma.documentTemplate.update({ where: { id: existing.id }, data });
    console.log(`  ✓ Güncellendi: ${opts.name} (${placeholders.length} placeholder)`);
  } else {
    await prisma.documentTemplate.create({ data });
    console.log(`  ✓ Oluşturuldu: ${opts.name} (${placeholders.length} placeholder)`);
  }
}

async function main() {
  const root = process.cwd();
  const logo = fs.readFileSync(path.join(root, 'public', 'hemisan-logo.png'));
  const outDir = path.join(root, 'data', 'templates');
  fs.mkdirSync(outDir, { recursive: true });

  // Süt Alım
  const milkBuf = assembleDocx(milkReceptionBody(), logo);
  renderTest(milkBuf, milkMock, 'Süt Alım');
  const milkFile = 'apv-teklif-sut-alim.docx';
  fs.writeFileSync(path.join(outDir, milkFile), milkBuf);

  // Depolama
  const storageBuf = assembleDocx(storageBody(), logo);
  renderTest(storageBuf, storageMock, 'Depolama');
  const storageFile = 'apv-teklif-depolama.docx';
  fs.writeFileSync(path.join(outDir, storageFile), storageBuf);

  await upsertTemplate({
    name: 'APV Hemisan Teklif Şablonu (Süt Alım)',
    description: 'Logo, girdi değerleri (kapasite/basınç), özet sayımlar ve toplam fiyat.',
    filename: milkFile, buffer: milkBuf, moduleType: 'MILK_RECEPTION',
  });
  await upsertTemplate({
    name: 'APV Hemisan Teklif Şablonu (Depolama)',
    description: 'Logo, girdi değerleri (kapasite/basınç/hacim), özet sayımlar ve toplam fiyat.',
    filename: storageFile, buffer: storageBuf, moduleType: 'STORAGE',
  });

  await prisma.$disconnect();
  console.log('\nTamamlandı. Şablonlar data/templates altına yazıldı ve aktif kaydedildi.');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
