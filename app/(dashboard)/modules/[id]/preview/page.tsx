import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { calculateModule } from '@/lib/calc/moduleCalculator';
import { formatDate } from '@/lib/utils';

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
  const flTotalValves = fl.reduce((sum, l) => sum + (l.connectedTankCount ?? 0), 0);
  const dlTotalValves = dl.reduce((sum, l) => sum + (l.connectedTankCount ?? 0), 0);

  const calc = hasLines
    ? calculateModule({
        standard: moduleData.standard as 'DIN' | 'SMS',
        fillingLines: fl.map((l) => ({ id: l.id, capacity: l.capacity })),
        dischargeLines: dl.map((l) => ({ id: l.id, capacity: l.capacity, hasFlowMeter: l.hasFlowMeter })),
      })
    : null;

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
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Modül Bilgileri</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Modül Adı" value={moduleData.name} />
          <Row label="Müşteri" value={moduleData.customerName ?? '—'} />
          <Row label="Proje Kodu" value={moduleData.projectCode ?? '—'} mono />
          <Row label="Standart" value={moduleData.standard} />
          <Row label="Ürün Tipi" value={PRODUCT_LABELS[moduleData.productType] ?? moduleData.productType} />
          <Row label="Oluşturan" value={moduleData.creator.name} />
          <Row label="Tarih" value={formatDate(moduleData.createdAt)} />
        </div>
      </section>

      {/* Hesaplanan Değerler */}
      {calc && (
        <section className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-4">Hesaplanan Boru Çapları</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <CalcCard label="Seçilen DN" value={calc.selectedDN.dn} />
            <CalcCard label="İç Çap" value={`${calc.selectedDN.inner} mm`} />
            <CalcCard label="Dış Çap" value={`${calc.selectedDN.outer} mm`} />
            <CalcCard label="Drain Valve" value={calc.drainValveSize} />
            <CalcCard label="CIP Return" value={calc.cipReturnSize} />
            <CalcCard label="Tank Drain Valve" value={calc.tankDrainValveSize} />
          </div>
        </section>
      )}

      {/* Dolum Hatları */}
      {fl.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Dolum Hatları ({fl.length})
          </h2>
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
                  <td className="py-2.5 text-slate-800 font-semibold">{line.connectedTankCount}</td>
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
          <p className="mt-3 text-xs text-slate-400">CIP Return = {calc?.cipReturnSize ?? '—'} (boru ile aynı)</p>
        </section>
      )}

      {/* Boşaltım Hatları */}
      {dl.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Boşaltım Hatları ({dl.length})
          </h2>
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
                    <Row label="Vana Sayısı" value={String(line.connectedTankCount)} />
                    {line.pumpModel && <Row label="Pompa Modeli" value={line.pumpModel} />}
                    {line.pumpKw != null && <Row label="Pompa kW" value={`${line.pumpKw} kW`} />}
                    {line.pumpImpellerSize != null && <Row label="İmpeller" value={`${line.pumpImpellerSize} mm`} />}
                    <Row label="Pressure Transmitter" value={line.hasPressureTransmitter ? 'Var' : 'Yok'} />
                    <Row label="Flow Meter" value={line.hasFlowMeter ? 'Var' : 'Yok'} />
                    {line.hasFlowMeter && <Row label="Flow Meter DN" value={fmResult?.selectedDN.dn ?? '—'} mono />}
                    {line.waterInletType && <Row label="Water Inlet" value={WATER_INLET_LABELS[line.waterInletType] ?? line.waterInletType} />}
                    <Row label="CIP Inlet Valve" value={calc?.selectedDN.dn ?? '—'} />
                    <Row label="Leakage Chamber" value="25 mm (Sabit)" />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700 text-right">
            Toplam Vana: <span className="text-slate-900">{dlTotalValves}</span>
          </p>
        </section>
      )}

      {/* Tanklar */}
      {moduleData.tanks.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Tanklar ({moduleData.tanks.length})
          </h2>
          <div className="space-y-4">
            {moduleData.tanks.map((tank, i) => {
              const sensorFlags: Array<[boolean, string]> = [
                [tank.hasLSH, 'LSH'], [tank.hasLSM, 'LSM'], [tank.hasLSL, 'LSL'],
                [tank.hasTT, 'TT'], [tank.hasPT, 'PT'],
              ];
              const sensors = sensorFlags.filter(([v]) => v).map(([, label]) => label).join(', ') || 'Yok';

              let outletValveLabel = 'Yok';
              if (tank.hasTankOutletValve) {
                if (tank.tankOutletValveType === 'WITH_ACTUATOR') {
                  const sub = tank.tankOutletValveSubType === 'BUTTERFLY' ? 'Kelebek' : 'Tek Koltuklu';
                  outletValveLabel = `Aktüatörlü — ${sub}`;
                } else {
                  outletValveLabel = 'Manuel';
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
        </section>
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
