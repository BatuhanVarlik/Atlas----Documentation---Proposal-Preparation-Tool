import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { calculateModule } from '@/lib/calc/moduleCalculator';
import { formatDate, formatNumberTR } from '@/lib/utils';
import { buildValveLineItemsForModule, type ModulePricingContext } from '@/lib/pricing/moduleValves';
import type { CatalogValveType, ControlUnit } from '@/lib/pricing/valveMatcher';

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
        fillingLines: fl.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount })),
        dischargeLines: dl.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount })),
      } as ModulePricingContext)
    : [];
  const valveTotalNet = valveItems.reduce((s, i) => s + i.totalNet, 0);
  const valveMatchedCount = valveItems.filter((i) => i.matched).length;

  return (
    <div className="max-w-4xl">
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
          <Row label="Vana Tipi" value={moduleData.valveType ?? '—'} />
          <Row label="Kontrol Ünitesi" value={moduleData.valveControlUnit ? (CONTROL_UNIT_LABELS[moduleData.valveControlUnit] ?? moduleData.valveControlUnit) : '—'} />
          <Row label="CIP Giriş/Dönüş Vana Tipi" value={cipReturnValveLabel} />
          <Row label="Su Giriş Vanası Tipi" value={waterInletValveLabel} />
          <Row label="Tank CIP Inlet Vanası" value={tankCipInletLabel} />
          <Row label="Oluşturan" value={moduleData.creator.name} />
          <Row label="Tarih" value={formatDate(moduleData.createdAt)} />
        </div>
      </Collapsible>

      {/* Sabit Vana Grubu (her hatta uygulanır) */}
      {hasLines && (
        <Collapsible variant="amber" title="Hatlara Sabit Eklenen Vana Grupları">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white/60 rounded-lg p-3 border border-amber-200/60">
              <p className="text-xs font-semibold text-amber-800 mb-2">Dolum Hatları (+{FIXED_FILLING_VALVES} / hat)</p>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-amber-700">Drain Vanası</span><span className="font-semibold text-amber-900">SW41</span></div>
                <div className="flex justify-between"><span className="text-amber-700">Leakage Vanası</span><span className="font-semibold text-amber-900">ESV</span></div>
                <div className="flex justify-between"><span className="text-amber-700">CIP Dönüş Vanası</span><span className="font-semibold text-amber-900">{cipReturnValveLabel}</span></div>
              </div>
            </div>
            <div className="bg-white/60 rounded-lg p-3 border border-amber-200/60">
              <p className="text-xs font-semibold text-amber-800 mb-2">Boşaltım Hatları (+{FIXED_DISCHARGE_VALVES} / hat)</p>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-amber-700">CIP Giriş Vanası</span><span className="font-semibold text-amber-900">{cipReturnValveLabel}</span></div>
                <div className="flex justify-between"><span className="text-amber-700">Leakage Vana</span><span className="font-semibold text-amber-900">ESV</span></div>
                {hasWaterInlet ? (
                  <div className="flex justify-between"><span className="text-amber-700">Su Giriş Vanası</span><span className="font-semibold text-amber-900">{waterInletValveLabel}</span></div>
                ) : (
                  <p className="text-[11px] text-amber-700/70 italic">Su Giriş Vanası seçilmediği için hesaba dahil edilmez.</p>
                )}
              </div>
            </div>
          </div>
          {moduleData.tankCipInletValveType && (
            <div className="mt-3 bg-white/60 rounded-lg p-3 border border-amber-200/60 text-sm">
              <p className="text-xs font-semibold text-amber-800 mb-1">Tank CIP Inlet Vanası</p>
              <div className="flex gap-4 text-amber-900">
                <span><strong>{moduleData.tankCipInletValveType}</strong></span>
                {moduleData.tankCipInletDiameter && <span>Çap: <strong>{moduleData.tankCipInletDiameter}</strong></span>}
              </div>
            </div>
          )}
        </Collapsible>
      )}

      {/* Hesaplanan Değerler */}
      {calc && (
        <Collapsible variant="blue" title="Hesaplanan Boru Çapları" subtitle={calc.selectedDN.dn}>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <CalcCard label="Seçilen DN" value={calc.selectedDN.dn} />
            <CalcCard label="İç Çap" value={`${calc.selectedDN.inner} mm`} />
            <CalcCard label="Dış Çap" value={`${calc.selectedDN.outer} mm`} />
            <CalcCard label="Drain Valve" value={calc.drainValveSize} />
            <CalcCard label="CIP Return" value={calc.cipReturnSize} />
            <CalcCard label="Tank Drain Valve" value={calc.tankDrainValveSize} />
          </div>
        </Collapsible>
      )}

      {/* Vana Fiyatlandırma */}
      {valveItems.length > 0 && (
        <Collapsible
          title="Vana Fiyatlandırma"
          subtitle={`${valveMatchedCount} / ${valveItems.length} eşleşti`}
          badge={
            <span className="text-base font-bold text-emerald-700 font-mono">
              {formatNumberTR(valveTotalNet, { decimals: 2 })} EUR
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">Bağlam</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">Vana</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">Çap</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-16">Adet</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-32">Birim Liste</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-16">İsk.</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-32">Birim Net</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-32">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {valveItems.map((it, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${!it.matched ? 'bg-amber-50/40' : ''}`}>
                    <td className="py-2 px-3 text-xs text-slate-500">{it.context}</td>
                    <td className="py-2 px-3 text-slate-800">
                      <div>{it.description}</div>
                      {it.matchedItem && (
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{it.matchedItem.eqNo} · {it.matchedItem.techSpec.slice(0, 60)}</div>
                      )}
                      {!it.matched && it.reason && (
                        <div className="text-[10px] text-amber-600 mt-0.5">{it.reason}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-600 font-mono">{it.size}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{it.quantity}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {it.matched ? formatNumberTR(it.unitPrice, { decimals: 2 }) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500">
                      {it.matched ? `${(it.unitDiscount * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {it.matched ? formatNumberTR(it.unitNetPrice, { decimals: 2 }) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                      {it.matched ? formatNumberTR(it.totalNet, { decimals: 2 }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td colSpan={7} className="py-3 px-3 text-right text-sm font-semibold text-slate-700">Toplam (EUR)</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-lg">
                    {formatNumberTR(valveTotalNet, { decimals: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Net birim fiyat = Liste × (1 − İskonto). Eşleşmeyen satırlar (sarı zemin) toplama dahil edilmez — katalogda doğrudan karşılığı bulunamadı.
          </p>
        </Collapsible>
      )}

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
                  <td className="py-2.5 text-blue-700 font-mono">{calc?.selectedDN.dn ?? '—'}</td>
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
          <div className="space-y-4">
            {dl.map((line, i) => {
              const fmResult = calc?.flowMeterResults.find((r) => r.lineId === line.id);
              return (
                <div key={line.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{i + 1}</span>
                    <span className="font-medium text-slate-800">{line.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <Row label="Kapasite" value={`${line.capacity.toLocaleString('tr-TR')} L/h`} />
                    <Row label="Basınç" value={`${line.pressure} Bar`} />
                    <Row label="Seçilen DN" value={calc?.selectedDN.dn ?? '—'} mono />
                    <Row label="Drain Valve" value={calc?.drainValveSize ?? '—'} />
                    <Row label="Vana Tipi" value={line.valveType} />
                    <Row label="Kontrol" value={CONTROL_UNIT_LABELS[line.valveControlUnit] ?? line.valveControlUnit} />
                    <Row label="Tank Sayısı" value={String(line.connectedTankCount)} />
                    <Row label="Vana Sayısı" value={`${line.connectedTankCount + FIXED_DISCHARGE_VALVES} (${line.connectedTankCount}+${FIXED_DISCHARGE_VALVES} sabit)`} />
                    <Row label="CIP Giriş Vanası (Sabit)" value={cipReturnValveLabel} />
                    <Row label="Leakage Vana (Sabit)" value="ESV" />
                    {hasWaterInlet && <Row label="Su Giriş Vanası (Sabit)" value={waterInletValveLabel} />}
                    {line.pumpModel && <Row label="Pompa Modeli" value={line.pumpModel} />}
                    {line.pumpKw != null && <Row label="Pompa kW" value={`${line.pumpKw} kW`} />}
                    {line.pumpImpellerSize != null && <Row label="İmpeller" value={`${line.pumpImpellerSize} mm`} />}
                    <Row label="Pressure Transmitter" value={line.hasPressureTransmitter ? 'Var' : 'Yok'} />
                    <Row label="Flow Meter" value={line.hasFlowMeter ? 'Var' : 'Yok'} />
                    {line.hasFlowMeter && <Row label="Flow Meter DN" value={fmResult?.selectedDN.dn ?? '—'} mono />}
                    <Row label="CIP Inlet Valve" value={calc?.selectedDN.dn ?? '—'} />
                    <Row label="Leakage Chamber" value="25 mm (Sabit)" />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Her boşaltım hattına sabit (+{FIXED_DISCHARGE_VALVES}): CIP Giriş <strong>{cipReturnValveLabel}</strong> + Leakage <strong>ESV</strong>
            {hasWaterInlet && <> + Su Giriş <strong>{waterInletValveLabel}</strong></>}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700 text-right">
            Toplam Vana: <span className="text-slate-900">{dlTotalValves}</span>
          </p>
        </Collapsible>
      )}

      {/* Tanklar */}
      {moduleData.tanks.length > 0 && (
        <Collapsible title="Tanklar" subtitle={`${moduleData.tanks.length} adet`}>
          <div className="space-y-4">
            {moduleData.tanks.map((tank, i) => {
              const sensorFlags: Array<[boolean, string]> = [
                [tank.hasLSH, 'LSH'], [tank.hasLSM, 'LSM'], [tank.hasLSL, 'LSL'],
                [tank.hasTT, 'TT'], [tank.hasPT, 'PT'],
              ];
              const sensors = sensorFlags.filter(([v]) => v).map(([, label]) => label).join(', ') || 'Yok';

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

              return (
                <div key={tank.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{i + 1}</span>
                    <span className="font-medium text-slate-800">{tank.name}</span>
                    <span className="text-slate-400 text-sm">— {tank.volume.toLocaleString('tr-TR')} L</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <Row label="Sensörler" value={sensors} />
                    <Row label="Sampling Valve" value={tank.samplingValve === 'MANUAL' ? 'Manuel' : 'Aktüatörlü'} />
                    <Row label="Proximity Switch" value={tank.hasProximitySwitch ? 'Var' : 'Yok'} />
                    <Row label="Agitator" value={
                      tank.hasAgitator
                        ? `Var — ${tank.agitatorMotorKw ?? '?'} kW, ${tank.agitatorRpm ?? '?'} rpm, ${tank.agitatorPosition === 'SIDE' ? 'Yan' : 'Üst'}`
                        : 'Yok'
                    } />
                    <Row label="CIP Ball" value={tank.cipBall === 'STATIC' ? 'Statik' : 'Döner'} />
                    <Row label="CIP Inlet (Agitator)" value={tank.hasCipInletForAgitator ? 'Var' : 'Yok'} />
                    <Row label="CIP Inlet (Manhole)" value={tank.hasCipInletForManhole ? 'Var' : 'Yok'} />
                    <Row label="Tank Outlet Valve" value={outletValveLabel} />
                    <Row label="CIP Return Pump" value={
                      tank.cipReturnPumpModel
                        ? `${tank.cipReturnPumpModel} — ${tank.cipReturnPumpKw ?? '?'} kW`
                        : 'Yok'
                    } />
                    <Row label="CIP Valve" value={calc?.selectedDN.dn ?? '—'} mono />
                    <Row label="Drain Valve" value={calc?.tankDrainValveSize ?? '—'} mono />
                    <Row label="Check Valve" value={calc?.selectedDN.dn ?? '—'} mono />
                  </div>
                </div>
              );
            })}
          </div>
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

function CalcCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-blue-100 p-3 text-center">
      <p className="text-xs text-blue-500 mb-1">{label}</p>
      <p className="font-semibold text-blue-800 font-mono">{value}</p>
    </div>
  );
}

interface CollapsibleProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'white' | 'amber' | 'blue';
  defaultOpen?: boolean;
}

function Collapsible({ title, subtitle, badge, children, variant = 'white', defaultOpen = false }: CollapsibleProps) {
  const palettes = {
    white: { bg: 'bg-white', border: 'border-slate-200', label: 'text-slate-500', chevron: 'text-slate-400' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', label: 'text-amber-800', chevron: 'text-amber-500' },
    blue:  { bg: 'bg-blue-50',  border: 'border-blue-200',  label: 'text-blue-700',  chevron: 'text-blue-500' },
  };
  const p = palettes[variant];
  return (
    <details {...(defaultOpen ? { open: true } : {})} className={`group ${p.bg} rounded-xl border ${p.border} mb-4 overflow-hidden`}>
      <summary className="cursor-pointer select-none px-6 py-4 flex items-center justify-between hover:bg-black/2 list-none">
        <div>
          <span className={`text-sm font-semibold uppercase tracking-wide ${p.label}`}>{title}</span>
          {subtitle && <span className="ml-3 text-xs text-slate-400">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-3">
          {badge}
          <svg className={`w-4 h-4 ${p.chevron} transition-transform group-open:rotate-180`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
