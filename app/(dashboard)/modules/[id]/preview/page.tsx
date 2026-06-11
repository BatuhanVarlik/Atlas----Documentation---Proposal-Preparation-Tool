import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { calculateModule } from '@/lib/calc/moduleCalculator';
import { formatDate } from '@/lib/utils';
import { buildValveLineItemsForModule, type ModulePricingContext } from '@/lib/pricing/moduleValves';
import type { CatalogValveType, ControlUnit } from '@/lib/pricing/valveMatcher';
import { ModuleSchematic } from '@/components/module-builder/ModuleSchematic';
import { buildStorageInstrumentItems, summarizeStorageInstruments } from '@/lib/pricing/storageInstruments';
import { getCustomPricingItems } from '@/lib/pricing/customCatalogServer';
import { EditablePricingCard, type PricingRowView } from '@/components/pricing/EditablePricingCard';
import { createRowKeyer } from '@/lib/pricing/rowKey';

type Props = { params: Promise<{ id: string }> };

const PRODUCT_LABELS: Record<string, string> = {
  HYGIENIC: 'Hijyenik',
  ULTRA_HYGIENIC: 'Ultrahijyenik',
};

const CONTROL_UNIT_LABELS: Record<string, string> = {
  NONE: 'Yok',
  AS_I: 'AS-i',
  DC: 'DC',
};

const WATER_INLET_LABELS: Record<string, string> = {
  SW_CIP42: 'SW-CIP 42',
  SD42: 'SD 42',
};

const CIP_RETURN_VALVE_LABELS: Record<string, string> = {
  SW_CIP41: 'SW CIP41',
  SD41: 'SD41',
};

const FIXED_FILLING_VALVES = 3;

export default async function ModulePreviewPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const moduleData = await prisma.module.findUnique({
    where: { id },
    include: {
      creator: { select: { name: true } },
      valveCluster: {
        include: {
          fillingLines: { orderBy: { order: 'asc' } },
          dischargeLines: { orderBy: { order: 'asc' } },
        },
      },
      tanks: { orderBy: { order: 'asc' } },
    },
  });

  if (!moduleData) notFound();
  if (user.role === 'MEMBER' && moduleData.creatorId !== user.id) notFound();

  const fl = moduleData.valveCluster?.fillingLines ?? [];
  const dl = moduleData.valveCluster?.dischargeLines ?? [];
  const hasLines = fl.length > 0 || dl.length > 0;
  const hasWaterInlet = !!moduleData.waterInletValveType;
  const FIXED_DISCHARGE_VALVES = hasWaterInlet ? 3 : 2;
  const flTotalValves = fl.reduce((sum, l) => sum + (l.connectedTankCount ?? 0) + FIXED_FILLING_VALVES, 0);
  const dlTotalValves = dl.reduce((sum, l) => sum + (l.connectedTankCount ?? 0) + FIXED_DISCHARGE_VALVES, 0);
  const cipReturnValveLabel = moduleData.cipReturnValveType
    ? (CIP_RETURN_VALVE_LABELS[moduleData.cipReturnValveType] ?? moduleData.cipReturnValveType)
    : '—';
  const waterInletValveLabel = moduleData.waterInletValveType
    ? (WATER_INLET_LABELS[moduleData.waterInletValveType] ?? moduleData.waterInletValveType)
    : 'Yok';
  const tankCipInletLabel = moduleData.tankCipInletValveType
    ? `${moduleData.tankCipInletValveType}${moduleData.tankCipInletDiameter ? ` — ${moduleData.tankCipInletDiameter}` : ''}`
    : 'Yok';

  const calc = hasLines
    ? calculateModule({
        standard: moduleData.standard as 'DIN' | 'SMS',
        fillingLines: fl.map((l) => ({ id: l.id, capacity: l.capacity })),
        dischargeLines: dl.map((l) => ({ id: l.id, capacity: l.capacity, hasFlowMeter: l.hasFlowMeter })),
      })
    : null;

  // === Vana Fiyatlandırma ===
  const valveItems = (moduleData.valveType && hasLines)
    ? buildValveLineItemsForModule({
        standard: moduleData.standard as 'DIN' | 'SMS',
        valveType: moduleData.valveType as CatalogValveType,
        controlUnit: (moduleData.valveControlUnit ?? 'AS_I') as ControlUnit,
        cipReturnValveType: (moduleData.cipReturnValveType ?? 'SW_CIP41') as 'SWCIP41' | 'SD41',
        waterInletValveType: moduleData.waterInletValveType as 'SWCIP42' | 'SD42' | null,
        tankCipInlet: moduleData.tankCipInletValveType && moduleData.tankCipInletDiameter ? {
          type: moduleData.tankCipInletValveType as 'SW43' | 'SW44',
          diameter: moduleData.tankCipInletDiameter,
        } : null,
        tankCipReturn: {
          manifoldExists: moduleData.tankCipReturnManifoldExists,
          lineCount: moduleData.tankCipReturnLineCount,
          tankCount: moduleData.tanks.length,
        },
        fillingLines: fl.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount })),
        dischargeLines: dl.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount })),
      } as ModulePricingContext)
    : [];

  // Vana özet listesi (tür+çap bazında toplam adet)
  const valveSummary = (() => {
    const map = new Map<string, { valveType: string; size: string; quantity: number }>();
    for (const it of valveItems) {
      const key = `${it.valveType}|${it.size}`;
      const cur = map.get(key);
      if (cur) cur.quantity += it.quantity;
      else map.set(key, { valveType: it.valveType, size: it.size, quantity: it.quantity });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.valveType.localeCompare(b.valveType) || a.size.localeCompare(b.size),
    );
  })();
  const valveSummaryTotal = valveSummary.reduce((s, x) => s + x.quantity, 0);

  // Tank CIP Dönüş sabit çaplar
  const tankCipPipeSize = calc?.selectedDN.dn ?? '—';
  const tankCipDrainSize = calc?.drainValveSize ?? '—';
  const valveTotalNet = valveItems.reduce((s, i) => s + i.totalNet, 0);
  const valveMatchedCount = valveItems.filter((i) => i.matched).length;

  // === Diğer Ekipmanlar ===
  type EquipmentRow = { category: string; name: string; spec: string; quantity: number };
  const equipment: EquipmentRow[] = [];
  const tanks = moduleData.tanks;
  const lineSize = calc?.selectedDN.dn ?? '—';

  // ---- Tank sensörleri ----
  if (tanks.length > 0) {
    const lshCount = tanks.filter((t) => t.hasLSH).length;
    const lsmCount = tanks.filter((t) => t.hasLSM).length;
    const lslCount = tanks.filter((t) => t.hasLSL).length;
    const ttCount  = tanks.filter((t) => t.hasTT).length;
    const ptCount  = tanks.filter((t) => t.hasPT).length;
    const proxCount = tanks.filter((t) => t.hasProximitySwitch).length;
    if (lshCount > 0) equipment.push({ category: 'Tank Sensörleri', name: 'LSH (Yüksek seviye)', spec: '—', quantity: lshCount });
    if (lsmCount > 0) equipment.push({ category: 'Tank Sensörleri', name: 'LSM (Orta seviye)', spec: '—', quantity: lsmCount });
    if (lslCount > 0) equipment.push({ category: 'Tank Sensörleri', name: 'LSL (Düşük seviye)', spec: '—', quantity: lslCount });
    if (ttCount > 0)  equipment.push({ category: 'Tank Sensörleri', name: 'TT (Sıcaklık transmitter)', spec: '—', quantity: ttCount });
    if (ptCount > 0)  equipment.push({ category: 'Tank Sensörleri', name: 'PT (Basınç transmitter)', spec: '—', quantity: ptCount });
    if (proxCount > 0) equipment.push({ category: 'Tank Sensörleri', name: 'Proximity Switch', spec: '—', quantity: proxCount });

    // ---- Agitatorler ----
    const agitatedTanks = tanks.filter((t) => t.hasAgitator);
    for (const t of agitatedTanks) {
      const spec = `${t.agitatorMotorKw ?? '?'} kW · ${t.agitatorRpm ?? '?'} rpm · ${t.agitatorPosition === 'TOP' ? 'Üst' : 'Yan'}`;
      equipment.push({ category: 'Agitator', name: `Agitator — ${t.name}`, spec, quantity: 1 });
    }

    // ---- CIP Ball ----
    const cipBallStatic = tanks.filter((t) => t.cipBall === 'STATIC').length;
    const cipBallRotary = tanks.filter((t) => t.cipBall === 'ROTARY').length;
    if (cipBallStatic > 0) equipment.push({ category: 'CIP Ball', name: 'CIP Ball (Statik)', spec: 'Tank içi', quantity: cipBallStatic });
    if (cipBallRotary > 0) equipment.push({ category: 'CIP Ball', name: 'CIP Ball (Döner)', spec: 'Tank içi', quantity: cipBallRotary });

    // ---- Tank başına CIP return pump ----
    for (const t of tanks) {
      if (t.cipReturnPumpModel) {
        const spec = `${t.cipReturnPumpModel}${t.cipReturnPumpKw != null ? ` · ${t.cipReturnPumpKw}kW` : ''}${t.cipReturnPumpImpellerSize != null ? ` · ⌀${t.cipReturnPumpImpellerSize}mm` : ''}`;
        equipment.push({ category: 'Pompalar', name: `CIP Dönüş Pompası — ${t.name}`, spec, quantity: 1 });
      }
    }
  }

  // ---- Discharge hatları: pompalar + FM + PT ----
  for (const line of dl) {
    if (line.pumpModel) {
      const spec = `${line.pumpModel}${line.pumpKw != null ? ` · ${line.pumpKw}kW` : ''}${line.pumpImpellerSize != null ? ` · ⌀${line.pumpImpellerSize}mm` : ''}`;
      equipment.push({ category: 'Pompalar', name: `Boşaltım Pompası — ${line.name}`, spec, quantity: 1 });
    }
  }
  const flowMeterLines = dl.filter((l) => l.hasFlowMeter);
  if (flowMeterLines.length > 0) {
    // Çap bazında grupla
    const fmGroups = new Map<string, number>();
    for (const l of flowMeterLines) {
      const fmResult = calc?.flowMeterResults.find((r) => r.lineId === l.id);
      const size = fmResult?.selectedDN.dn ?? lineSize;
      fmGroups.set(size, (fmGroups.get(size) ?? 0) + 1);
    }
    fmGroups.forEach((count, size) => {
      equipment.push({ category: 'Ölçüm', name: 'Flow Meter (electromagnetic)', spec: size, quantity: count });
    });
  }
  const ptLines = dl.filter((l) => l.hasPressureTransmitter).length;
  if (ptLines > 0) {
    equipment.push({ category: 'Ölçüm', name: 'Pressure Transmitter (hat üzeri)', spec: 'Boşaltım hattı', quantity: ptLines });
  }

  // ---- Tank CIP Dönüş Pompası (modül seviyesi) ----
  if (moduleData.tankCipReturnPumpModel) {
    const spec = `${moduleData.tankCipReturnPumpModel}${moduleData.tankCipReturnPumpKw != null ? ` · ${moduleData.tankCipReturnPumpKw}kW` : ''}${moduleData.tankCipReturnPumpImpellerSize != null ? ` · ⌀${moduleData.tankCipReturnPumpImpellerSize}mm` : ''}`;
    equipment.push({ category: 'Pompalar', name: 'Tank CIP Dönüş Pompası (modül)', spec, quantity: 1 });
  }

  const equipmentTotal = equipment.reduce((s, e) => s + e.quantity, 0);

  // === Enstrüman Fiyatlandırma ===
  const customItems = await getCustomPricingItems();
  const instrumentRows = (moduleData.tanks.length > 0 || dl.length > 0)
    ? buildStorageInstrumentItems({
        standard: moduleData.standard as 'DIN' | 'SMS',
        selectedDN: calc?.selectedDN.dn ?? null,
        tanks: moduleData.tanks.map((t) => ({
          name: t.name,
          hasLSH: t.hasLSH,
          hasLSM: t.hasLSM,
          hasLSL: t.hasLSL,
          hasTT: t.hasTT,
          hasPT: t.hasPT,
          hasProximitySwitch: t.hasProximitySwitch,
          hasAgitator: t.hasAgitator,
          agitatorMotorKw: t.agitatorMotorKw,
          cipBall: t.cipBall as 'STATIC' | 'ROTARY',
          cipReturnPumpModel: t.cipReturnPumpModel,
        })),
        dischargeLines: dl.map((l) => {
          const fmResult = calc?.flowMeterResults.find((r) => r.lineId === l.id);
          return {
            name: l.name,
            hasFlowMeter: l.hasFlowMeter,
            flowMeterSize: l.hasFlowMeter ? (fmResult?.selectedDN.dn ?? calc?.selectedDN.dn ?? null) : null,
            hasPressureTransmitter: l.hasPressureTransmitter,
            pumpModel: l.pumpModel,
          };
        }),
        tankCipReturnPumpModel: moduleData.tankCipReturnPumpModel,
        customItems,
      })
    : [];
  const instrumentSummary = summarizeStorageInstruments(instrumentRows);

  return (
    <div className="max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-5">
        <Link href="/modules" className="hover:text-slate-900">Modüller</Link>
        <span>/</span>
        <Link href={`/modules/${moduleData.id}`} className="hover:text-slate-900">{moduleData.name}</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Önizleme</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Modül Özeti</h1>
        <div className="flex gap-2">
          <Link
            href={`/modules/${moduleData.id}`}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            ← Düzenlemeye Dön
          </Link>
        </div>
      </div>

      {/* Modül Bilgileri */}
      <Collapsible title="Modül Bilgileri" subtitle={moduleData.name}>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Modül Adı" value={moduleData.name} />
          <Row label="Müşteri" value={moduleData.customerName ?? '—'} />
          <Row label="Proje Kodu" value={moduleData.projectCode ?? '—'} mono />
          <Row label="Standart" value={moduleData.standard} />
          <Row label="Ürün Tipi" value={PRODUCT_LABELS[moduleData.productType] ?? moduleData.productType} />
          <Row
            label="Vana Tipi"
            value={moduleData.valveType ? `${moduleData.valveType}${calc ? ` — Çap: ${calc.selectedDN.dn}` : ''}` : '—'}
          />
          <Row label="Kontrol Ünitesi" value={moduleData.valveControlUnit ? (CONTROL_UNIT_LABELS[moduleData.valveControlUnit] ?? moduleData.valveControlUnit) : '—'} />
          <Row
            label="CIP Giriş/Dönüş Vana Tipi"
            value={`${cipReturnValveLabel}${calc ? ` — Çap: ${calc.cipReturnSize}` : ''}`}
          />
          <Row
            label="Su Giriş Vanası Tipi"
            value={moduleData.waterInletValveType ? `${waterInletValveLabel}${calc ? ` — Çap: ${calc.selectedDN.dn}` : ''}` : 'Yok'}
          />
          <Row label="Tank CIP Inlet Vanası" value={tankCipInletLabel} />
          <Row label="Oluşturan" value={moduleData.creator.name} />
          <Row label="Tarih" value={formatDate(moduleData.createdAt)} />
        </div>
      </Collapsible>

      {/* Şematik Diyagram */}
      {(hasLines || moduleData.tanks.length > 0) && (
        <Collapsible title="Şematik Diyagram" subtitle="Vana / Pompa / Hat görünümü" defaultOpen>
          <ModuleSchematic
            tanks={moduleData.tanks.map((t) => ({
              name: t.name,
              volume: t.volume,
              hasAgitator: t.hasAgitator,
              hasLSH: t.hasLSH,
              hasLSM: t.hasLSM,
              hasLSL: t.hasLSL,
              hasTT: t.hasTT,
              hasPT: t.hasPT,
            }))}
            fillingLines={fl.map((l) => ({
              name: l.name,
              capacity: l.capacity,
              connectedTankCount: l.connectedTankCount,
            }))}
            dischargeLines={dl.map((l) => ({
              name: l.name,
              capacity: l.capacity,
              connectedTankCount: l.connectedTankCount,
              hasPump: !!l.pumpModel,
            }))}
            fixedFillingValves={FIXED_FILLING_VALVES}
            fixedDischargeValves={FIXED_DISCHARGE_VALVES}
            selectedDN={calc?.selectedDN.dn}
            tankCipReturn={
              moduleData.tanks.length > 0
                ? {
                    manifoldExists: moduleData.tankCipReturnManifoldExists,
                    lineCount: moduleData.tankCipReturnLineCount,
                    hasPump: !!moduleData.tankCipReturnPumpModel,
                  }
                : null
            }
          />
        </Collapsible>
      )}

      {/* Sabit Vana Grubu (her hatta uygulanır) */}
      {hasLines && (
        <Collapsible title="Hatlara Sabit Eklenen Vana Grupları">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">Dolum Hatları (+{FIXED_FILLING_VALVES} / hat)</p>
              <div className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-700">Drain Vanası <strong className="text-slate-800">SW41</strong></span>
                  <span className="text-slate-800 font-mono text-[11px]">Çap: {calc?.drainValveSize ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-700">Leakage Vanası <strong className="text-slate-800">ESV</strong></span>
                  <span className="text-slate-800 font-mono text-[11px]">Çap: 25 mm (sabit)</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-700">CIP Dönüş Vanası <strong className="text-slate-800">{cipReturnValveLabel}</strong></span>
                  <span className="text-slate-800 font-mono text-[11px]">Çap: {calc?.cipReturnSize ?? '—'}</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">Boşaltım Hatları (+{FIXED_DISCHARGE_VALVES} / hat)</p>
              <div className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-700">CIP Giriş Vanası <strong className="text-slate-800">{cipReturnValveLabel}</strong></span>
                  <span className="text-slate-800 font-mono text-[11px]">Çap: {calc?.cipReturnSize ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-700">Leakage Vana <strong className="text-slate-800">ESV</strong></span>
                  <span className="text-slate-800 font-mono text-[11px]">Çap: 25 mm (sabit)</span>
                </div>
                {hasWaterInlet ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-700">Su Giriş Vanası <strong className="text-slate-800">{waterInletValveLabel}</strong></span>
                    <span className="text-slate-800 font-mono text-[11px]">Çap: {calc?.selectedDN.dn ?? '—'}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">Su Giriş Vanası seçilmediği için hesaba dahil edilmez.</p>
                )}
              </div>
            </div>
          </div>
          {moduleData.tankCipInletValveType && (
            <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm">
              <p className="text-xs font-semibold text-slate-700 mb-1">Tank CIP Inlet Vanası</p>
              <div className="flex gap-4 text-slate-800">
                <span><strong>{moduleData.tankCipInletValveType}</strong></span>
                {moduleData.tankCipInletDiameter && <span>Çap: <strong>{moduleData.tankCipInletDiameter}</strong></span>}
              </div>
            </div>
          )}
        </Collapsible>
      )}

      {/* Kullanılacak Vanalar (tür + adet + çap) */}
      {valveSummary.length > 0 && (
        <Collapsible title="Kullanılacak Vanalar" subtitle={`${valveSummaryTotal} adet`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Vana Tipi</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Çap</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-700 w-24">Adet</th>
                </tr>
              </thead>
              <tbody>
                {valveSummary.map((v, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-semibold text-slate-800">{v.valveType}</td>
                    <td className="py-2 px-3 font-mono text-slate-700">{v.size}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-800 font-semibold">{v.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td colSpan={2} className="py-2 px-3 text-right text-xs font-semibold text-slate-700">Toplam</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{valveSummaryTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Collapsible>
      )}

      {/* Fiyatlandırma (vanalar + enstrümanlar tek tabloda) */}
      {(valveItems.length > 0 || instrumentRows.length > 0) && (() => {
        const keyer = createRowKeyer();
        const rows: PricingRowView[] = [
          ...valveItems.map((it) => {
            const parts: string[] = [];
            if (it.context) parts.push(it.context);
            if (it.matchedItem) parts.push(`${it.matchedItem.eqNo} · ${it.matchedItem.techSpec.slice(0, 70)}`);
            else if (it.reason) parts.push(it.reason);
            return {
              key: keyer('Vanalar', it.description, it.size),
              category: 'Vanalar',
              description: it.description,
              subText: parts.join(' — ') || undefined,
              size: it.size,
              quantity: it.quantity,
              unitListPrice: it.matched ? it.unitPrice : null,
              baseUnitNet: it.matched ? it.unitNetPrice : null,
            };
          }),
          ...instrumentRows.map((r) => ({
            key: keyer(r.category, r.description, r.size),
            category: r.category,
            description: r.description,
            subText: r.matchedItem
              ? `${r.matchedItem.eqNo} · ${r.matchedItem.techSpec.slice(0, 70)}`
              : r.reason,
            size: r.size,
            quantity: r.quantity,
            unitListPrice: r.matched ? r.unitPrice : null,
            baseUnitNet: r.matched ? r.unitNetPrice : null,
          })),
        ];
        const matched =
          valveItems.filter((i) => i.matched).length + instrumentRows.filter((r) => r.matched).length;

        return (
          <EditablePricingCard
            saveUrl={`/api/modules/${moduleData.id}/pricing`}
            rows={rows}
            initialOverrides={(moduleData.priceOverrides as Record<string, number> | null) ?? {}}
            initialMultiplier={moduleData.priceMultiplier ?? 1}
            matchedCount={matched}
            footerNote={
              <>
                Net birim fiyat = Liste × (1 − İskonto). Katalogda eşleşmeyen ürünler (W+ serisi pompalar vb.) otomatik
                fiyatlanmaz — <strong>Düzenle</strong> ile elle fiyat girilebilir. Kaydedilen fiyatlar ve çarpan bu modül
                için kalıcıdır.
              </>
            }
          />
        );
      })()}

      {/* Dolum Hatları */}
      {fl.length > 0 && (
        <Collapsible title="Dolum Hatları" subtitle={`${fl.length} adet`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-medium text-slate-600">#</th>
                <th className="text-left py-2 font-medium text-slate-600">İsim</th>
                <th className="text-left py-2 font-medium text-slate-600">Kapasite</th>
                <th className="text-left py-2 font-medium text-slate-600">Seçilen DN</th>
                <th className="text-left py-2 font-medium text-slate-600">Drain Valve</th>
                <th className="text-left py-2 font-medium text-slate-600">Vana Tipi</th>
                <th className="text-left py-2 font-medium text-slate-600">Kontrol</th>
                <th className="text-left py-2 font-medium text-slate-600">Tank Sayısı</th>
                <th className="text-left py-2 font-medium text-slate-600">Vana Sayısı</th>
                <th className="text-left py-2 font-medium text-slate-600">Leakage Chamber</th>
              </tr>
            </thead>
            <tbody>
              {fl.map((line, i) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2.5 text-slate-400">{i + 1}</td>
                  <td className="py-2.5 font-medium text-slate-800">{line.name}</td>
                  <td className="py-2.5 text-slate-700">{line.capacity.toLocaleString('tr-TR')} L/h</td>
                  <td className="py-2.5 text-slate-700 font-mono">{calc?.selectedDN.dn ?? '—'}</td>
                  <td className="py-2.5 text-slate-600">{calc?.drainValveSize ?? '—'}</td>
                  <td className="py-2.5 text-slate-700">{line.valveType}</td>
                  <td className="py-2.5 text-slate-600">{CONTROL_UNIT_LABELS[line.valveControlUnit] ?? line.valveControlUnit}</td>
                  <td className="py-2.5 text-slate-700">{line.connectedTankCount}</td>
                  <td className="py-2.5 text-slate-800 font-semibold">{line.connectedTankCount + FIXED_FILLING_VALVES} <span className="text-[10px] text-slate-400 font-normal">({line.connectedTankCount}+{FIXED_FILLING_VALVES})</span></td>
                  <td className="py-2.5 text-slate-500">25 mm (Sabit)</td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td colSpan={8} className="py-2 text-right text-xs font-medium text-slate-600">Toplam Vana:</td>
                <td className="py-2 font-bold text-slate-900">{flTotalValves}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">
            CIP Return Boru = {calc?.cipReturnSize ?? '—'} (boru ile aynı) · Her dolum hattına sabit: Drain <strong>SW41</strong> + Leakage <strong>ESV</strong> + CIP Dönüş <strong>{cipReturnValveLabel}</strong>
          </p>
        </Collapsible>
      )}

      {/* Boşaltım Hatları */}
      {dl.length > 0 && (
        <Collapsible title="Boşaltım Hatları" subtitle={`${dl.length} adet`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-medium text-slate-600">#</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">İsim</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Kapasite</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Basınç</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Seçilen DN</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Vana Tipi</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Kontrol</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Tank</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Vana Sayısı</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Pompa</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">PT</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">FM</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Flow Meter DN</th>
                </tr>
              </thead>
              <tbody>
                {dl.map((line, i) => {
                  const fmResult = calc?.flowMeterResults.find((r) => r.lineId === line.id);
                  const pumpStr = line.pumpModel
                    ? `${line.pumpModel}${line.pumpKw != null ? ` · ${line.pumpKw} kW` : ''}${line.pumpImpellerSize != null ? ` · ⌀${line.pumpImpellerSize}` : ''}`
                    : '—';
                  return (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="py-2.5 px-2 text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-2 font-medium text-slate-800">{line.name}</td>
                      <td className="py-2.5 px-2 text-slate-700">{line.capacity.toLocaleString('tr-TR')} L/h</td>
                      <td className="py-2.5 px-2 text-slate-700">{line.pressure} Bar</td>
                      <td className="py-2.5 px-2 text-slate-700 font-mono">{calc?.selectedDN.dn ?? '—'}</td>
                      <td className="py-2.5 px-2 text-slate-700">{line.valveType}</td>
                      <td className="py-2.5 px-2 text-slate-600">{CONTROL_UNIT_LABELS[line.valveControlUnit] ?? line.valveControlUnit}</td>
                      <td className="py-2.5 px-2 text-slate-700">{line.connectedTankCount}</td>
                      <td className="py-2.5 px-2 text-slate-800 font-semibold">{line.connectedTankCount + FIXED_DISCHARGE_VALVES} <span className="text-[10px] text-slate-400 font-normal">({line.connectedTankCount}+{FIXED_DISCHARGE_VALVES})</span></td>
                      <td className="py-2.5 px-2 text-slate-600 text-xs">{pumpStr}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{line.hasPressureTransmitter ? 'Var' : '—'}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{line.hasFlowMeter ? 'Var' : '—'}</td>
                      <td className="py-2.5 px-2 text-slate-700 font-mono">{line.hasFlowMeter ? (fmResult?.selectedDN.dn ?? '—') : '—'}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50">
                  <td colSpan={8} className="py-2 px-2 text-right text-xs font-medium text-slate-600">Toplam Vana:</td>
                  <td className="py-2 px-2 font-bold text-slate-900">{dlTotalValves}</td>
                  <td colSpan={4}></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Her boşaltım hattına sabit (+{FIXED_DISCHARGE_VALVES}): CIP Giriş <strong>{cipReturnValveLabel}</strong> + Leakage <strong>ESV</strong>
            {hasWaterInlet && <> + Su Giriş <strong>{waterInletValveLabel}</strong></>} · Leakage Chamber 25 mm sabit
          </p>
        </Collapsible>
      )}

      {/* Tanklar */}
      {moduleData.tanks.length > 0 && (
        <Collapsible title="Tanklar" subtitle={`${moduleData.tanks.length} adet`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-medium text-slate-600">#</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">İsim</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Hacim</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Sensörler</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Sampling</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Prox.</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Agitator</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">CIP Ball</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">CIP Inlet (Ag/Mh)</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Outlet Vana</th>
                </tr>
              </thead>
              <tbody>
                {moduleData.tanks.map((tank, i) => {
                  const sensorFlags: Array<[boolean, string]> = [
                    [tank.hasLSH, 'LSH'], [tank.hasLSM, 'LSM'], [tank.hasLSL, 'LSL'],
                    [tank.hasTT, 'TT'], [tank.hasPT, 'PT'],
                  ];
                  const sensors = sensorFlags.filter(([v]) => v).map(([, label]) => label).join(', ') || '—';

                  const subTypeLabels: Record<string, string> = {
                    BUTTERFLY: 'Kelebek',
                    SINGLE_SEAT: 'Single Seat',
                    SINGLE_SEAT_TANK: 'Single Seat Tank',
                    SW_CIP_TANK: 'SW CIP Tank',
                    SD_TANK: 'SD Tank',
                    D_TANK: 'D Tank',
                  };
                  let outletValveLabel = 'Yok';
                  if (tank.hasTankOutletValve) {
                    if (tank.tankOutletValveType === 'WITH_ACTUATOR') {
                      const sub = subTypeLabels[tank.tankOutletValveSubType ?? 'BUTTERFLY'] ?? 'Kelebek';
                      outletValveLabel = `Aktüatörlü — ${sub}`;
                    } else {
                      outletValveLabel = 'Manuel — Kelebek';
                    }
                  }
                  const agitatorStr = tank.hasAgitator
                    ? `${tank.agitatorMotorKw ?? '?'} kW · ${tank.agitatorRpm ?? '?'} rpm · ${tank.agitatorPosition === 'SIDE' ? 'Yan' : 'Üst'}`
                    : 'Yok';
                  const cipInletStr = `${tank.hasCipInletForAgitator ? 'Var' : '—'} / ${tank.hasCipInletForManhole ? 'Var' : '—'}`;
                  return (
                    <tr key={tank.id} className="border-b border-slate-100">
                      <td className="py-2.5 px-2 text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-2 font-medium text-slate-800">{tank.name}</td>
                      <td className="py-2.5 px-2 text-slate-700">{tank.volume.toLocaleString('tr-TR')} L</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{sensors}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{tank.samplingValve === 'MANUAL' ? 'Manuel' : 'Aktüatörlü'}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{tank.hasProximitySwitch ? 'Var' : '—'}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{agitatorStr}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{tank.cipBall === 'STATIC' ? 'Statik' : 'Döner'}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{cipInletStr}</td>
                      <td className="py-2.5 px-2 text-slate-700 text-xs">{outletValveLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Collapsible>
      )}

      {/* Tank CIP Dönüş — Tanklardan bağımsız */}
      {moduleData.tanks.length > 0 && (
        <Collapsible
          title="Tank CIP Dönüş"
          subtitle={
            moduleData.tankCipReturnManifoldExists
              ? 'Manifoldda mevcut'
              : `${moduleData.tankCipReturnLineCount} hat × ${moduleData.tanks.length} tank`
          }
        >
          {moduleData.tankCipReturnManifoldExists ? (
            <p className="text-sm text-slate-700 italic">
              Manifoldda mevcut CIP Dönüş Hattı kullanılacak — ek ekipman gerekmiyor.
            </p>
          ) : (
            <>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Ekipman özeti ({moduleData.tankCipReturnLineCount} hat · {moduleData.tanks.length} tank)
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-slate-700">
                      CIP Vanası <strong className="text-slate-800">SW41</strong>
                      <span className="ml-2 text-[11px] text-slate-500">
                        × {moduleData.tankCipReturnLineCount * moduleData.tanks.length} adet (hat × tank)
                      </span>
                    </span>
                    <span className="text-slate-800 font-mono text-[11px]">Çap: {tankCipPipeSize}</span>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-slate-700">
                      Drain Vanası <strong className="text-slate-800">SW41</strong>
                      <span className="ml-2 text-[11px] text-slate-500">
                        × {moduleData.tankCipReturnLineCount} adet (hat başına)
                      </span>
                    </span>
                    <span className="text-slate-800 font-mono text-[11px]">Çap: {tankCipDrainSize}</span>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-slate-700">
                      Check Valve
                      <span className="ml-2 text-[11px] text-slate-500">
                        × {moduleData.tankCipReturnLineCount} adet (hat başına)
                      </span>
                    </span>
                    <span className="text-slate-800 font-mono text-[11px]">Çap: {tankCipPipeSize}</span>
                  </div>
                </div>
              </div>
              {moduleData.tankCipReturnPumpModel && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm">
                  <p className="text-xs font-semibold text-slate-700 mb-1">CIP Dönüş Pompası</p>
                  <div className="flex flex-wrap gap-4 text-slate-800">
                    <span>Model: <strong>{moduleData.tankCipReturnPumpModel}</strong></span>
                    {moduleData.tankCipReturnPumpKw != null && (
                      <span>kW: <strong>{moduleData.tankCipReturnPumpKw}</strong></span>
                    )}
                    {moduleData.tankCipReturnPumpImpellerSize != null && (
                      <span>Çark: <strong>{moduleData.tankCipReturnPumpImpellerSize} mm</strong></span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </Collapsible>
      )}

      {/* Diğer Ekipmanlar */}
      {equipment.length > 0 && (
        <Collapsible title="Diğer Ekipmanlar" subtitle={`${equipmentTotal} adet`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700 w-32">Kategori</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Ekipman</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Açıklama / Model</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-700 w-24">Adet</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800">{e.name}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{e.spec}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">{e.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td colSpan={3} className="py-2 px-3 text-right text-xs font-semibold text-slate-700">Toplam</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{equipmentTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Vanalar bu listede yer almaz — onlar için <strong>Kullanılacak Vanalar</strong> kartına bakın. Burada sensörler, agitator, CIP ball, pompalar ve ölçüm cihazları listelenir.
          </p>
        </Collapsible>
      )}

      {!hasLines && moduleData.tanks.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Henüz teknik veri girilmemiş. Valve Cluster ve Tank bilgilerini ekleyin.
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className={`text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

interface CollapsibleProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Collapsible({ title, subtitle, badge, children, defaultOpen = false }: CollapsibleProps) {
  return (
    <details {...(defaultOpen ? { open: true } : {})} className="group bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
      <summary className="cursor-pointer select-none px-6 py-4 flex items-center justify-between hover:bg-slate-50 list-none">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</span>
          {subtitle && <span className="ml-3 text-xs text-slate-500">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-3">
          {badge}
          <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </summary>
      <div className="px-6 pb-6 pt-1">
        {children}
      </div>
    </details>
  );
}
