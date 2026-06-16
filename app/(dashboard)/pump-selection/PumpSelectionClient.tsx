'use client';

import { useEffect, useState, useCallback } from 'react';

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
}
interface SizingDto {
  best: PumpDto | null;
  rank: PumpDto[];
  results: PumpDto[];
}

function fmt(v: number | null | undefined, n = 3): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(n);
}
function marginText(r: PumpDto): string {
  if (!r.ok || r.signed === null) return '—';
  return `${r.signed >= 0 ? '+' : ''}${fmt(r.signed)} bar`;
}
function statusClass(r: PumpDto): string {
  if (!r.ok) return 'text-red-600';
  if (r.lowPressure || (r.signed ?? 0) < 0) return 'text-amber-600';
  return 'text-emerald-600';
}

export default function PumpSelectionClient() {
  const [q, setQ] = useState('50');
  const [bar, setBar] = useState('2.0');
  const [data, setData] = useState<SizingDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // İlk yüklemede varsayılan duty point ile hesapla (HTML aracı gibi)
  useEffect(() => { compute(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const best = data?.best ?? null;
  const top3 = data?.rank.slice(0, 3) ?? [];

  return (
    <div className="max-w-7xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Pompa Seçimi</h1>
        <p className="text-sm text-slate-500 mt-1">
          W+ serisi 16 pompa. Debi ve basınç girin; hesaplanan impeller çapı, en yakın katalog impeller,
          güvenli üst impeller, basınç yakınlığı ve kW birlikte değerlendirilerek ana öneri ve alternatifler listelenir.
        </p>
      </div>

      {/* Girdi */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Debi Q (m³/h)</label>
            <input type="number" step="0.1" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && compute()}
              className="w-full px-3 py-2.5 text-lg font-semibold bg-white text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Basınç (bar)</label>
            <input type="number" step="0.01" value={bar} onChange={(e) => setBar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && compute()}
              className="w-full px-3 py-2.5 text-lg font-semibold bg-white text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={compute} disabled={loading}
            className="px-6 py-2.5 bg-secondary hover:bg-secondary-container text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Hesaplanıyor…' : 'Hesapla'}
          </button>
        </div>
        {error && <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      {/* Ana öneri */}
      {best ? (
        <div className="bg-[#0a2147] text-white rounded-xl p-5">
          <div className="text-[11px] tracking-wide text-slate-300 font-semibold">ANA ÖNERİ — EN DÜŞÜK kW</div>
          <h2 className="text-2xl font-bold mt-1">{best.name}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            <Metric label="Güç (kW)" value={fmt(best.kw)} />
            <Metric label="Seçilen impeller" value={`${best.d ?? '—'} mm`} />
            <Metric label="Hesaplanan impeller" value={`${fmt(best.calcD, 1)} mm`} />
            <Metric label="NPSH req." value={`${best.npshText ?? '—'} m`} />
            <Metric label="Eğri basıncı" value={`${fmt(best.p, 2)} bar`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
            <div className="bg-white/10 rounded-lg p-3"><span className="text-slate-300">Margin:</span><br />{marginText(best)}</div>
            <div className="bg-white/10 rounded-lg p-3"><span className="text-slate-300">Durum:</span><br />{best.mode ?? '—'}</div>
            <div className="bg-white/10 rounded-lg p-3"><span className="text-slate-300">Güvenli üst imp.:</span><br />{best.safeD ?? '—'} mm</div>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          Uygun pompa bulunamadı — girilen duty point tüm pompalarda maksimum basınç kapasitesinin üstünde veya Q aralığı dışında.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* İlk 3 aday */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">İlk 3 aday</h3>
          {top3.length ? (
            <div className="space-y-2">
              {top3.map((r, i) => (
                <div key={r.name} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <b className="text-sm text-slate-800">{i + 1}. {r.name}</b>
                    <span className={`text-[11px] font-semibold ${statusClass(r)}`}>{r.mode}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {fmt(r.kw)} kW · Seçilen {r.d ?? '—'} mm · Hesaplanan {fmt(r.calcD, 1)} mm · NPSH {r.npshText} m · {fmt(r.p)} bar · {marginText(r)}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">Uygun seçenek yok.</p>}
        </div>

        {/* Tüm pompa kontrolleri */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Tüm pompa kontrolleri</h3>
          <p className="text-[11px] text-slate-400 mb-3">
            “Uygun”: hedef zarf içinde · “Fazla basınç”: hedef min eğrinin altında ama çalışabilir · “Yetersiz basınç”: hedef max eğrinin üstünde.
          </p>
          <div className="overflow-auto max-h-140">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  {['Pompa', 'Durum', 'kW', 'Seçilen', 'Hesaplanan', 'P(Q)', 'Margin', 'NPSH', 'Zarf'].map((h) => (
                    <th key={h} className="py-2 pr-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.results ?? []).map((r) => (
                  <tr key={r.name} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-800 whitespace-nowrap">{r.name}</td>
                    <td className={`py-2 pr-3 font-semibold whitespace-nowrap ${statusClass(r)}`}>{r.ok ? r.mode : r.reason}</td>
                    <td className="py-2 pr-3 font-semibold whitespace-nowrap">{r.ok ? `${fmt(r.kw)} kW` : '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.ok ? `${r.d} mm` : '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.ok ? `${fmt(r.calcD, 1)} mm` : '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.ok ? `${fmt(r.p)} bar` : '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{marginText(r)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.ok ? `${r.npshText} m` : '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{r.minP === null ? '—' : `${fmt(r.minP, 2)}–${fmt(r.maxP, 2)} bar`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/20 rounded-lg p-3">
      <div className="text-[11px] text-slate-300">{label}</div>
      <b className="block text-lg mt-0.5">{value}</b>
    </div>
  );
}
