'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { selectMotorKw } from '@/lib/calc/motorKw';

interface ImpellerDto {
  d: number;
  p: number | null;
  kw: number | null;
  npshText: string | null;
  suitable: boolean;
}
interface PumpDto {
  name: string;
  ok: boolean;
  reason: string | null;
  minP: number | null;
  maxP: number | null;
  d: number | null;
  p: number | null;
  signed: number | null;
  kw: number | null;
  npshText: string | null;
  calcD: number | null;
  safeD: number | null;
  nearestD: number | null;
  mode: string | null;
  lowPressure: boolean;
  recommendedD: number | null;
  impellers: ImpellerDto[];
}
interface SizingDto {
  best: PumpDto | null;
  rank: PumpDto[];
  results: PumpDto[];
}

const FREQUENCY_HZ = 50;   // W+ serisi sabit
const SPEED_RPM = 2900;    // W+ serisi sabit

function fmt(v: number | null | undefined, n = 2): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(n);
}

// Varsayılan/önerilen impeller: hedef basıncı KARŞILAYAN en uygun impeller (safeD).
// Hiçbir impeller hedefi karşılamıyorsa (tolerans dahilinde sınırda) en yakına düşülür.
function preferredImpellerD(p: PumpDto): number | null {
  return p.safeD ?? p.recommendedD;
}

// İlk 3 aday için sıralama bazlı renk paleti.
const RANK_STYLES = [
  { chip: 'bg-emerald-400', row: 'bg-emerald-400/90 text-emerald-950', label: 'En iyi' },
  { chip: 'bg-yellow-300', row: 'bg-yellow-300/90 text-yellow-950', label: '2. aday' },
  { chip: 'bg-orange-400', row: 'bg-orange-400/90 text-orange-950', label: '3. aday' },
];

export default function PumpSelectionClient() {
  const [q, setQ] = useState('50');
  const [bar, setBar] = useState('2.0');
  const [data, setData] = useState<SizingDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedPumpName, setSelectedPumpName] = useState<string | null>(null);
  const [selectedImpellerD, setSelectedImpellerD] = useState<number | null>(null);

  const compute = useCallback(async () => {
    const qn = Number(q), barn = Number(bar);
    if (!(qn > 0) || !(barn > 0)) { setError('Q ve basınç pozitif olmalı'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/pump-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: qn, bar: barn }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Hata'); setData(null); return; }
      setData(json.data as SizingDto);
    } catch {
      setError('Hesaplama servisine ulaşılamadı');
    } finally {
      setLoading(false);
    }
  }, [q, bar]);

  // İlk yüklemede varsayılan duty point ile hesapla.
  useEffect(() => { compute(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Yeni sonuç gelince ana öneriyi otomatik seç.
  useEffect(() => {
    if (data?.best) {
      setSelectedPumpName(data.best.name);
      setSelectedImpellerD(preferredImpellerD(data.best));
    } else {
      setSelectedPumpName(null);
      setSelectedImpellerD(null);
    }
  }, [data]);

  const target = Number(bar);

  // Pompa adı → ilk 3 aday içindeki sırası (yoksa -1).
  const rankIndexOf = useCallback(
    (name: string) => (data?.rank.slice(0, 3).findIndex((r) => r.name === name) ?? -1),
    [data],
  );

  const selPump = useMemo(
    () => data?.results.find((r) => r.name === selectedPumpName) ?? null,
    [data, selectedPumpName],
  );
  const selImp = useMemo(
    () => selPump?.impellers.find((i) => i.d === selectedImpellerD) ?? null,
    [selPump, selectedImpellerD],
  );

  function selectPump(p: PumpDto) {
    setSelectedPumpName(p.name);
    setSelectedImpellerD(p.ok ? preferredImpellerD(p) : null);
  }

  // Ekranda gösterilecek uyarı (pompa adaylığı + impeller uygunluğu).
  const warning = useMemo<{ text: string; level: 'warn' | 'error' } | null>(() => {
    if (!selPump) return null;
    if (!selPump.ok) {
      return { text: `${selPump.name}: ${selPump.reason ?? 'bu duty point için uygun değil'}.`, level: 'error' };
    }
    if (selImp && !selImp.suitable) {
      return {
        text: `${fmt(selImp.d, 0)} mm impeller hedef basıncı (${fmt(target)} bar) karşılamıyor — eğri basıncı ${fmt(selImp.p)} bar.`,
        level: 'error',
      };
    }
    if (rankIndexOf(selPump.name) === -1) {
      return {
        text: `${selPump.name} girilen değerler için ilk 3 aday arasında değil. Yine de inceleyebilirsiniz.`,
        level: 'warn',
      };
    }
    return null;
  }, [selPump, selImp, target, rankIndexOf]);

  const results = data?.results ?? [];

  return (
    <div className="max-w-7xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Pompa Seçimi</h1>
        <p className="text-sm text-slate-500 mt-1">
          W+ serisi 16 pompa. Basınç ve debi girin; ilk 3 aday Pumps listesinde renklendirilir.
          Pompa veya impeller seçtikçe Specification paneli dinamik güncellenir.
        </p>
      </div>

      {/* Uyarı çubuğu */}
      {warning && (
        <div
          className={`rounded-lg px-4 py-2.5 text-xs font-medium border ${
            warning.level === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          ⚠ {warning.text}
        </div>
      )}
      {error && (
        <div className="rounded-lg px-4 py-2.5 text-xs font-medium bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-5 items-start">
        {/* ---- Conditions ---- */}
        <Panel title="Conditions">
          <div className="space-y-4">
            <Field label="Head" unit="bar">
              <input
                type="number" step="0.01" value={bar}
                onChange={(e) => setBar(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && compute()}
                className="w-full px-3 py-2 text-base font-semibold bg-white text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Flow" unit="m³/h">
              <input
                type="number" step="0.1" value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && compute()}
                className="w-full px-3 py-2 text-base font-semibold bg-white text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <div className="h-px bg-slate-200" />

            <Field label="Frequency" unit="Hz">
              <div className="w-full px-3 py-2 text-base font-semibold bg-slate-100 text-slate-500 border border-slate-200 rounded-lg select-none">
                {FREQUENCY_HZ}
              </div>
            </Field>
            <Field label="Speed" unit="rpm">
              <div className="w-full px-3 py-2 text-base font-semibold bg-slate-100 text-slate-500 border border-slate-200 rounded-lg select-none">
                {SPEED_RPM}
              </div>
            </Field>

            <button
              onClick={compute} disabled={loading}
              className="w-full px-4 py-2.5 bg-secondary hover:bg-secondary-container text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Hesaplanıyor…' : 'Hesapla'}
            </button>
          </div>
        </Panel>

        {/* ---- Pumps + Impeller ---- */}
        <Panel title="Pumps & Impeller">
          <div className="grid grid-cols-2 gap-4">
            {/* Pumps */}
            <div>
              <div className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Pumps</div>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {results.map((p) => {
                  const ri = rankIndexOf(p.name);
                  const style = ri >= 0 ? RANK_STYLES[ri] : null;
                  const selected = p.name === selectedPumpName;
                  return (
                    <button
                      key={p.name}
                      onClick={() => selectPump(p)}
                      className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
                        style ? `${style.row} font-semibold` : p.ok ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-50'
                      } ${selected ? 'ring-2 ring-inset ring-blue-600' : ''}`}
                    >
                      <span>{p.name}</span>
                      {ri >= 0 && <span className="text-[10px] font-bold opacity-70">{ri + 1}</span>}
                    </button>
                  );
                })}
                {!results.length && <div className="px-3 py-4 text-xs text-slate-400">Sonuç yok.</div>}
              </div>
              {/* Renk açıklaması */}
              <div className="mt-2 space-y-1">
                {RANK_STYLES.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className={`inline-block w-3 h-3 rounded-sm ${s.chip}`} />
                    {i + 1}. {s.label}
                    {data?.rank[i] && <span className="font-semibold text-slate-600">· {data.rank[i].name}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Impeller */}
            <div>
              <div className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Impeller</div>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {selPump?.ok && selPump.impellers.length ? (
                  (() => {
                    // Önerilen impeller rengi, seçili pompanın aday rengine (yeşil/sarı/turuncu) uyar.
                    const ri = rankIndexOf(selPump.name);
                    const recRow = ri >= 0 ? RANK_STYLES[ri].row : 'bg-emerald-400/90 text-emerald-950';
                    return selPump.impellers.map((imp) => {
                      const recommended = imp.d === preferredImpellerD(selPump);
                      const selected = imp.d === selectedImpellerD;
                      return (
                        <button
                          key={imp.d}
                          onClick={() => setSelectedImpellerD(imp.d)}
                          className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
                            recommended
                              ? `${recRow} font-semibold`
                              : imp.suitable
                                ? 'text-slate-700 hover:bg-slate-50'
                                : 'text-red-500 hover:bg-red-50'
                          } ${selected ? 'ring-2 ring-inset ring-blue-600' : ''}`}
                        >
                          <span>{fmt(imp.d, 0)} mm</span>
                          <span className="text-[10px] opacity-70">{fmt(imp.p)} bar</span>
                        </button>
                      );
                    });
                  })()
                ) : (
                  <div className="px-3 py-4 text-xs text-slate-400">
                    {selPump && !selPump.ok ? 'Bu pompa uygun değil.' : 'Pompa seçin.'}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-1 text-[10px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-3 h-3 rounded-sm ${
                      selPump && rankIndexOf(selPump.name) >= 0
                        ? RANK_STYLES[rankIndexOf(selPump.name)].chip
                        : 'bg-emerald-400'
                    }`}
                  />
                  Önerilen impeller (seçili pompanın rengi)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-400" /> Hedefi karşılamıyor
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* ---- Specification ---- */}
        <Panel title="Specification">
          <div className="space-y-3">
            <SpecRow label="Pump" value={selPump?.ok ? selPump.name : '—'} strong />
            <SpecRow label="Head" unit="bar" value={selImp ? fmt(selImp.p) : '—'} />
            <SpecRow label="Flow" unit="m³/h" value={selImp ? fmt(Number(q), 1) : '—'} />
            <SpecRow label="Impeller" unit="mm" value={selImp ? fmt(selImp.d, 0) : '—'} />
            <SpecRow label="Power consump." unit="kW" value={selImp ? fmt(selImp.kw) : '—'} />
            <SpecRow label="Motor (kW)" unit="kW" value={selImp ? fmt(selectMotorKw(selImp.kw), 2) : '—'} strong />
            <SpecRow label="NPSH value" unit="m" value={selImp?.npshText ?? '—'} />
            <SpecRow label="List Price" value="—" />
            {selImp && !selImp.suitable && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Bu impeller hedef basıncı karşılamıyor.
              </div>
            )}
            {selImp?.suitable && selPump?.ok && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Seçim hedef basıncı karşılıyor.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        {unit && <span className="text-[10px] text-slate-400">{unit}</span>}
      </div>
      {children}
    </div>
  );
}

function SpecRow({ label, value, unit, strong }: { label: string; value: string; unit?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-right ${strong ? 'text-base font-bold text-slate-800' : 'text-sm font-semibold text-slate-700'}`}>
        {value}{unit && value !== '—' && <span className="text-[10px] text-slate-400 ml-1">{unit}</span>}
      </span>
    </div>
  );
}
