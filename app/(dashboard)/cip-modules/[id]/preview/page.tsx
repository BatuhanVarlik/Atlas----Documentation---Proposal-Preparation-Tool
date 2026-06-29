import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { calculateCipLine, calculateCipModule } from '@/lib/calc/cipCalculator';
import { buildCipPricing, summarizeCipPricing, type CipTankType } from '@/lib/pricing/cipPricing';
import { getCustomPricingItems } from '@/lib/pricing/customCatalogServer';
import { EditablePricingCard, type PricingRowView } from '@/components/pricing/EditablePricingCard';
import { createRowKeyer } from '@/lib/pricing/rowKey';
import type { ControlUnit } from '@/lib/pricing/valveMatcher';
import { CipSchematic } from '@/components/cip-builder/CipSchematic';

type Props = { params: Promise<{ id: string }> };

const CONTROL_UNIT_LABELS: Record<string, string> = { NONE: 'Yok (Pnömatik / Aktüatör)', AS_I: 'AS-i', DC: 'DC' };
const SYSTEM_LABELS: Record<string, string> = { FORWARD: 'Forward System', CIRCULATED: 'Circulated System' };
const SAMPLING_LABELS: Record<string, string> = { NONE: 'Yok', MANUAL: 'Manuel', WITH_ACTUATOR: 'Aktüatörlü' };
const MATERIAL_LABELS: Record<string, string> = { AISI_304: 'AISI 304', AISI_316: 'AISI 316' };
const INSULATION_LABELS: Record<string, string> = { INSULATED: 'İzoleli', UNINSULATED: 'İzolesiz' };
const TANK_LABELS: Record<string, string> = {
  CAUSTIC: 'Caustic Tank', ACID: 'Acid Tank', HOT_WATER: 'Hot Water Tank',
  RECOVERY: 'Recovery Tank', FRESH_WATER: 'Fresh Water Tank',
};

export default async function CipPreviewPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const mod = await prisma.cipModule.findUnique({
    where: { id },
    include: {
      creator: { select: { name: true } },
      tanks: { orderBy: { order: 'asc' } },
      lines: { orderBy: [{ lineKind: 'asc' }, { order: 'asc' }] },
    },
  });
  if (!mod) notFound();
  if (user.role === 'MEMBER' && mod.creatorId !== user.id) notFound();

  const standard = mod.standard;

  const moduleCalc = calculateCipModule({
    standard,
    lines: mod.lines.map((l) => ({ id: l.id, lineKind: l.lineKind, capacityLh: l.capacity })),
  });
  const selectedDN = moduleCalc.selectedDN?.dn ?? null;

  const lineCalcs = mod.lines.map((l) => {
    if (!l.capacity || l.capacity <= 0) return { lineId: l.id, dn: null as string | null, inner: null as number | null };
    const c = calculateCipLine(l.capacity, l.lineKind, standard);
    return { lineId: l.id, dn: c.selectedDN?.dn ?? null, inner: c.selectedDN?.inner ?? null };
  });

  const dischargeLines = mod.lines.filter((l) => l.lineKind === 'DISCHARGE');
  const returnLines = mod.lines.filter((l) => l.lineKind === 'RETURN');

  // === Fiyatlandırma / Ekipman üretimi ===
  const customItems = await getCustomPricingItems();
  const allRows = (mod.tanks.length > 0 || mod.lines.length > 0)
    ? buildCipPricing({
        standard,
        controlUnit: (mod.valveControlUnit ?? 'NONE') as ControlUnit,
        systemType: mod.systemType,
        samplingValve: mod.samplingValve,
        hasManholeSwitch: mod.hasManholeSwitch,
        selectedDN,
        tanks: mod.tanks.map((t) => ({
          tankType: t.tankType as CipTankType,
          capacity: t.capacity,
          hasLSH: t.hasLSH,
          hasLSL: t.hasLSL,
          hasExternalSensor: t.hasExternalSensor,
          hasPressureTransmitter: t.hasPressureTransmitter,
        })),
        lines: mod.lines.map((l) => ({
          name: l.name,
          lineKind: l.lineKind,
          dn: lineCalcs.find((c) => c.lineId === l.id)?.dn ?? null,
          pumpModel: l.pumpModel,
        })),
        customItems,
      })
    : [];

  const pricedRows = allRows.filter((r) => !r.informational);
  const infoRows = allRows.filter((r) => r.informational);
  const summary = summarizeCipPricing(allRows);

  const pricingKeyer = createRowKeyer();
  const pricingRowViews: PricingRowView[] = pricedRows.map((r) => ({
    key: pricingKeyer(r.category, r.description, r.size),
    category: r.category,
    description: r.description,
    subText: r.matchedItem ? `${r.matchedItem.eqNo} · ${r.matchedItem.techSpec.slice(0, 70)}` : r.reason,
    size: r.size,
    quantity: r.quantity,
    unitListPrice: r.matched ? r.unitPrice : null,
    baseUnitNet: r.matched ? r.unitNetPrice : null,
  }));

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-5">
        <Link href="/modules" className="hover:text-slate-900">Modüller</Link>
        <span>/</span>
        <Link href={`/cip-modules/${mod.id}`} className="hover:text-slate-900">{mod.name}</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Önizleme</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Modül Özeti</h1>
        <Link href={`/cip-modules/${mod.id}`} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">
          ← Düzenlemeye Dön
        </Link>
      </div>

      <Collapsible title="Genel Seçimler" subtitle={mod.name} defaultOpen>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Modül Adı" value={mod.name} />
          <Row label="Müşteri" value={mod.customerName ?? '—'} />
          <Row label="Proje Kodu" value={mod.projectCode ?? '—'} mono />
          <Row label="Standart" value={mod.standard} />
          <Row label="Valve Control Unit" value={CONTROL_UNIT_LABELS[mod.valveControlUnit] ?? mod.valveControlUnit} />
          <Row label="Sistem Tipi" value={SYSTEM_LABELS[mod.systemType] ?? mod.systemType} />
          <Row label="Sampling Valve" value={SAMPLING_LABELS[mod.samplingValve] ?? mod.samplingValve} />
          <Row label="Manhole Switch" value={mod.hasManholeSwitch ? 'Var' : 'Yok'} />
          <Row label="Seçilen Modül DN" value={selectedDN ?? '—'} mono />
          <Row label="Oluşturan" value={mod.creator.name} />
          <Row label="Tarih" value={formatDate(mod.createdAt)} />
        </div>
      </Collapsible>

      {/* Tanklar */}
      {mod.tanks.length > 0 && (
        <Collapsible title="Tanklar" subtitle={`${mod.tanks.length} adet`} defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Tank</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Kapasite</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Malzeme</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">İzolasyon</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">LSH</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">LSL</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Dış Sensör</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">PT</th>
                </tr>
              </thead>
              <tbody>
                {mod.tanks.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2.5 px-3 font-medium text-slate-800">{TANK_LABELS[t.tankType] ?? t.tankType}</td>
                    <td className="py-2.5 px-3 text-slate-700">{t.capacity > 0 ? `${t.capacity.toLocaleString('tr-TR')} L` : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{MATERIAL_LABELS[t.material] ?? t.material}</td>
                    <td className="py-2.5 px-3 text-slate-700">{INSULATION_LABELS[t.insulation] ?? t.insulation}</td>
                    <td className="py-2.5 px-3 text-slate-600">{t.hasLSH ? '✓' : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{t.hasLSL ? '✓' : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{t.hasExternalSensor ? '✓' : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{t.tankType === 'FRESH_WATER' ? '—' : (t.hasPressureTransmitter ? '✓' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Collapsible>
      )}

      {/* Akış Şeması (P&ID) */}
      {(mod.tanks.length > 0 || mod.lines.length > 0) && (
        <Collapsible title="Akış Şeması (P&ID)" subtitle={SYSTEM_LABELS[mod.systemType] ?? mod.systemType} defaultOpen>
          <CipSchematic
            standard={standard}
            systemType={mod.systemType}
            selectedDN={selectedDN}
            tanks={mod.tanks.map((t) => ({
              tankType: t.tankType as CipTankType,
              label: TANK_LABELS[t.tankType] ?? t.tankType,
              capacity: t.capacity,
            }))}
            dischargeLines={dischargeLines.map((l) => ({
              name: l.name,
              capacity: l.capacity,
              dn: lineCalcs.find((c) => c.lineId === l.id)?.dn ?? null,
              pumpModel: l.pumpModel,
              pumpKw: l.pumpKw,
            }))}
            returnLines={returnLines.map((l) => ({
              name: l.name,
              capacity: l.capacity,
              dn: lineCalcs.find((c) => c.lineId === l.id)?.dn ?? null,
              pumpModel: l.pumpModel,
              pumpKw: l.pumpKw,
            }))}
          />
        </Collapsible>
      )}

      {/* Hatlar */}
      {mod.lines.length > 0 && (
        <Collapsible title="Hatlar" subtitle={`${dischargeLines.length} DL · ${returnLines.length} RL`} defaultOpen>
          <LineTable title="Discharge Lines (V=1.5 m/s)" lines={dischargeLines} lineCalcs={lineCalcs} />
          <div className="h-4" />
          <LineTable title="Return Lines (V=2.0 m/s)" lines={returnLines} lineCalcs={lineCalcs} />
          <p className="text-[11px] text-slate-500 mt-3">
            Boru çapı kapasiteden hesaplanır (Discharge V=1.5, Return V=2.0 m/s). Tank-hat vana adedi =
            tank sayısı × hat sayısı ({mod.tanks.length} × {dischargeLines.length} = {mod.tanks.length * dischargeLines.length} discharge valve).
          </p>
        </Collapsible>
      )}

      {/* Fiyatlandırma / Ekipman */}
      {pricedRows.length > 0 && (
        <EditablePricingCard
          saveUrl={`/api/cip-modules/${mod.id}/pricing`}
          rows={pricingRowViews}
          initialOverrides={(mod.priceOverrides as Record<string, number> | null) ?? {}}
          initialMultiplier={mod.priceMultiplier ?? 1}
          matchedCount={summary.matched}
          footerNote={
            <>
              Net birim fiyat = Liste × (1 − İskonto). Yalnızca katalogda kesin karşılığı olan ürünler
              (LMT100, TA2812, GI701S/G1501S, IFM SMF flowmetre, ESV/SW vanalar, PI1700) otomatik fiyatlanır.
              Karşılığı olmayanlar (Krohne FM, JUMO conductivity, TA812, tubular HE, holding tube, angle seat,
              steam trap, disco check, pompalar) <strong>Düzenle</strong> ile elle fiyatlanır veya Özel Kataloğa eklenir.
            </>
          }
        />
      )}

      {/* Bilgi Amaçlı Ekipmanlar (fiyata dahil değil) */}
      {infoRows.length > 0 && (
        <Collapsible title="Bilgi Amaçlı Ekipmanlar" subtitle="Fiyata dahil değil">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700 w-44">Kategori</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Ekipman</th>
                <th className="py-2 px-3 text-right text-xs font-semibold text-slate-700 w-20">Adet</th>
              </tr>
            </thead>
            <tbody>
              {infoRows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 px-3">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">{r.category}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-800">{r.description}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700">{r.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-3">
            Kimyasal besleme (level gauge rod, diaphragm pump, solenoid, regulator) ve steam line (manometer,
            steam trap, disco check, ball valve) kalemleri yalnızca bilgi amaçlıdır; teklif toplamına eklenmez.
          </p>
        </Collapsible>
      )}

      {mod.tanks.length === 0 && mod.lines.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Henüz tank veya hat girilmemiş. Düzenleme sayfasında ekleyin.
        </div>
      )}
    </div>
  );
}

function LineTable({
  title,
  lines,
  lineCalcs,
}: {
  title: string;
  lines: Array<{ id: string; name: string; capacity: number; pressure: number; pumpModel: string | null; pumpKw: number | null; pumpImpellerSize: number | null }>;
  lineCalcs: Array<{ lineId: string; dn: string | null; inner: number | null }>;
}) {
  if (lines.length === 0) return <p className="text-xs text-slate-400 italic">{title}: hat yok.</p>;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-y border-slate-200">
            <tr>
              <th className="text-left py-2 px-2 font-medium text-slate-600">İsim</th>
              <th className="text-left py-2 px-2 font-medium text-slate-600">Kapasite</th>
              <th className="text-left py-2 px-2 font-medium text-slate-600">Basınç</th>
              <th className="text-left py-2 px-2 font-medium text-slate-600">Hesap. DN</th>
              <th className="text-left py-2 px-2 font-medium text-slate-600">Pompa</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const calc = lineCalcs.find((c) => c.lineId === line.id);
              const pump = line.pumpModel
                ? `${line.pumpModel}${line.pumpKw != null ? ` · ${line.pumpKw}kW` : ''}${line.pumpImpellerSize != null ? ` · ⌀${line.pumpImpellerSize}` : ''}`
                : '—';
              return (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2.5 px-2 font-medium text-slate-800">{line.name}</td>
                  <td className="py-2.5 px-2 text-slate-700">{line.capacity > 0 ? `${line.capacity.toLocaleString('tr-TR')} L/h` : '—'}</td>
                  <td className="py-2.5 px-2 text-slate-700">{line.pressure > 0 ? `${line.pressure} Bar` : '—'}</td>
                  <td className="py-2.5 px-2 font-mono text-slate-700">{calc?.dn ?? '—'}</td>
                  <td className="py-2.5 px-2 text-xs text-slate-600">{pump}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Collapsible({ title, subtitle, children, defaultOpen = false }: CollapsibleProps) {
  return (
    <details {...(defaultOpen ? { open: true } : {})} className="group bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
      <summary className="cursor-pointer select-none px-6 py-4 flex items-center justify-between hover:bg-slate-50 list-none">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</span>
          {subtitle && <span className="ml-3 text-xs text-slate-500">{subtitle}</span>}
        </div>
        <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-6 pb-6 pt-1">{children}</div>
    </details>
  );
}
