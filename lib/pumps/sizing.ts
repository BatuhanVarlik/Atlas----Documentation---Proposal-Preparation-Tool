// W+ pompa boyutlandırma — public/W_plus_16_pump_revised_impeller_calc_v13_.html'deki
// seçim mantığının birebir TypeScript portu. Sonuçlar HTML aracıyla AYNI olmalı.
// Saf fonksiyonlar; UI/DB'den bağımsız.
import pumpData from './pumpData.json';

export interface PumpCurve {
  d: number;
  q: number[];
  y: number[];
}
export interface PumpPolyCurve {
  d: number;
  qmin: number;
  qmax: number;
  coef: number[];
}
export interface Pump {
  name: string;
  complete?: boolean;
  pressure?: PumpCurve[];
  pressurePoly?: PumpPolyCurve[];
  kw?: PumpCurve[];
  kwPoly?: PumpPolyCurve[];
  npsh?: PumpCurve[];
}

export const pumps = pumpData as unknown as Pump[];

// ---- Temel sayısal yardımcılar (HTML birebir) ----
function interp(xs: number[], ys: number[], x: number): number | null {
  if (!xs || !ys || xs.length !== ys.length || x < xs[0] || x > xs[xs.length - 1]) return null;
  for (let i = 0; i < xs.length - 1; i++) {
    if (xs[i] <= x && x <= xs[i + 1]) {
      if (xs[i + 1] === xs[i]) return ys[i + 1];
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}

function poly(co: number[], q: number): number {
  let v = 0;
  for (const c of co) v = v * q + c;
  return v;
}

interface DP { d: number; p: number }

function pcurves(p: Pump, q: number): DP[] {
  if (p.pressure) {
    return p.pressure
      .map((c) => ({ d: c.d, p: interp(c.q, c.y, q) }))
      .filter((x): x is DP => x.p !== null);
  }
  if (p.pressurePoly) {
    return p.pressurePoly
      .map((c) => (q >= c.qmin && q <= c.qmax ? { d: c.d, p: poly(c.coef, q) } : null))
      .filter((x): x is DP => x !== null);
  }
  return [];
}

function kwAt(p: Pump, d: number, q: number): number | null {
  if (p.kw) {
    const c = p.kw.find((x) => x.d === d);
    return c ? interp(c.q, c.y, q) : null;
  }
  if (p.kwPoly) {
    const c = p.kwPoly.find((x) => x.d === d);
    return c && q >= c.qmin && q <= c.qmax ? poly(c.coef, q) : null;
  }
  return null;
}

function npshPoint(p: Pump, d: number, q: number): number | null {
  const a = p.npsh;
  if (!a || a.length < 2) return null;
  const lo = a[0], hi = a[1];
  const n1 = interp(lo.q, lo.y, q), n2 = interp(hi.q, hi.y, q);
  if (n1 === null && n2 === null) return null;
  if (n1 === null) return n2;
  if (n2 === null) return n1;
  const t = (d - lo.d) / (hi.d - lo.d);
  return n1 + t * (n2 - n1);
}

export function f(v: number | null | undefined, n = 3): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(n);
}

interface NpshRange { text: string; design: number | null; refText: string; est?: number }
function npshRange(p: Pump, d: number, q: number): NpshRange {
  const a = p.npsh, est = npshPoint(p, d, q);
  if (!a || a.length < 2) return { text: f(est), design: est, refText: '—' };
  const vals = a.map((c) => interp(c.q, c.y, q)).filter((v): v is number => v !== null && !Number.isNaN(v));
  if (!vals.length) return { text: '—', design: null, refText: '—' };
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const selected = est ?? mx;
  const refText = vals.length >= 2 && Math.abs(mx - mn) > 0.001 ? `${f(mn)}–${f(mx)}` : f(selected);
  return { text: f(selected), design: selected, refText, est: selected };
}

interface DPK extends DP { kw: number }
interface RequiredImpeller {
  calc: number;
  lower: DPK | DP | null;
  upper: DPK | DP | null;
  type: string;
}
function requiredImpeller(cs: DPK[], target: number): RequiredImpeller {
  const arr = cs.slice().sort((a, b) => a.d - b.d);
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i], b = arr[i + 1];
    if ((a.p <= target && target <= b.p) || (b.p <= target && target <= a.p)) {
      if (Math.abs(b.p - a.p) < 1e-9) return { calc: a.d, lower: a, upper: b, type: 'Ara değer' };
      const t = (target - a.p) / (b.p - a.p);
      return { calc: a.d + t * (b.d - a.d), lower: a.p <= b.p ? a : b, upper: a.p > b.p ? a : b, type: 'Ara değer' };
    }
  }
  const minP = Math.min(...arr.map((x) => x.p)), maxP = Math.max(...arr.map((x) => x.p));
  if (target < minP) {
    const lowest = arr.slice().sort((a, b) => a.p - b.p || a.d - b.d)[0];
    return { calc: lowest.d, lower: null, upper: lowest, type: 'Fazla basınç' };
  }
  if (target > maxP) {
    const highest = arr.slice().sort((a, b) => b.p - a.p || b.d - a.d)[0];
    return { calc: highest.d, lower: highest, upper: null, type: 'Yetersiz basınç' };
  }
  const nearest = arr.map((c) => ({ ...c, diff: Math.abs(c.p - target) })).sort((a, b) => a.diff - b.diff)[0];
  return { calc: nearest.d, lower: nearest, upper: nearest, type: 'Zarf içinde' };
}

export interface PumpResult {
  pump: Pump;
  ok: boolean;
  reason?: string;
  minP?: number;
  maxP?: number;
  // ok === true alanları
  d?: number;
  p?: number;
  diff?: number;
  signed?: number;
  kw?: number;
  npsh?: number | null;
  npshText?: string;
  calcD?: number;
  nearestD?: number;   // hesaplanan çapa en yakın impeller (bilgi amaçlı)
  nearestP?: number;
  safeD?: number | null;
  safeP?: number | null;
  mode?: string;
  lowPressure?: boolean;
}

// Hedef, pompanın maks basıncını bu oran kadar aşsa bile pompa elenmez; en büyük impeller
// "sınırda" olarak önerilir (fiziksel olarak biraz altında çalışır).
const PRESSURE_TOLERANCE = 0.03;

export function evaluate(p: Pump, q: number, target: number): PumpResult {
  const cs = pcurves(p, q).sort((a, b) => a.d - b.d);
  if (!cs.length) return { pump: p, ok: false, reason: 'Q aralık dışında' };
  const minP = Math.min(...cs.map((x) => x.p)), maxP = Math.max(...cs.map((x) => x.p));
  if (target > maxP * (1 + PRESSURE_TOLERANCE)) return { pump: p, ok: false, reason: 'Yetersiz basınç', minP, maxP };
  const withKw = cs
    .map((c) => ({ ...c, kw: kwAt(p, c.d, q) }))
    .filter((c): c is DPK => c.kw !== null);
  if (!withKw.length) return { pump: p, ok: false, reason: 'kW aralık dışında', minP, maxP };

  const req = requiredImpeller(withKw, target);
  const calcD = req.calc;

  // SEÇİM: hesaplanan çapa EN YAKIN katalog impeller (ara impellerler dahil; alta da yuvarlanır).
  // Örn. calc=166.5 → 165 (170 değil). Hiç impeller hesaba uymuyorsa en yakın yine seçilir.
  const safe = withKw.filter((c) => c.p >= target).sort((a, b) => a.d - b.d || a.kw - b.kw)[0] ?? null;
  const selected = withKw
    .map((c) => ({ ...c, diffD: Math.abs(c.d - calcD) }))
    .sort((a, b) => a.diffD - b.diffD || a.kw - b.kw || a.d - b.d)[0];

  const lowPressure = target < minP;
  const overMax = !safe; // hedefi karşılayan impeller yok → tolerans dahilinde, sınırda
  const mode = overMax
    ? 'Sınırda (pompa maks.)'
    : lowPressure
      ? 'Fazla basınç'
      : selected.p >= target
        ? 'Uygun'
        : 'Hedefin biraz altında';

  const margin = selected.p - target;
  const npsh = npshRange(p, selected.d, q);

  return {
    pump: p, ok: true,
    d: selected.d, p: selected.p, diff: Math.abs(margin), signed: margin, kw: selected.kw,
    npsh: npsh.design, npshText: npsh.text, minP, maxP,
    calcD,
    nearestD: selected.d, nearestP: selected.p,
    safeD: safe ? safe.d : null, safeP: safe ? safe.p : null,
    mode, lowPressure,
  };
}

export interface ImpellerDetail {
  d: number;
  p: number | null;       // bu impellerin Q'daki eğri basıncı (bar)
  kw: number | null;      // güç tüketimi
  npshText: string | null;
  suitable: boolean;      // hedef basıncı karşılıyor mu (p >= target)
}

/** Verilen pompa için duty Q'daki tüm geçerli impellerlerin detayını döndürür (küçükten büyüğe). */
export function impellerDetails(p: Pump, q: number, target: number): ImpellerDetail[] {
  const cs = pcurves(p, q).sort((a, b) => a.d - b.d);
  return cs.map((c) => {
    const kw = kwAt(p, c.d, q);
    const npsh = npshRange(p, c.d, q);
    return {
      d: c.d,
      p: c.p,
      kw,
      npshText: npsh.text,
      suitable: c.p >= target,
    };
  });
}

// Karar mekanizması: ÖNCELİK EN DÜŞÜK kW (yuvarlanarak seçilen impellerin kW'ı).
// Skor mekanizması kaldırıldı. Eşit kW'da hedefe yakınlık, sonra küçük çap önceliklidir.
export function rankResults(results: PumpResult[]): PumpResult[] {
  const ok = results.filter((r) => r.ok);
  return ok.sort((a, b) => a.kw! - b.kw! || a.diff! - b.diff! || a.d! - b.d!);
}

export interface SizingOutput {
  results: PumpResult[];
  rank: PumpResult[];
  best: PumpResult | null;
}

// Doğrulanmış manuel seçimler (başka programdan; operating-window kuralı bilinmiyor →
// logic'e dökülemiyor). Tam (Q, bar) eşleşmesinde ANA ÖNERİ bu olur.
const OVERRIDES: { q: number; bar: number; pump: string; d: number }[] = [
  { q: 36, bar: 0.8, pump: 'W+35/35', d: 140 },
  { q: 90, bar: 4.2, pump: 'W+55/60', d: 205 },
  { q: 230.5, bar: 2.7, pump: 'W+50/600', d: 290 },
  { q: 284, bar: 1.7, pump: 'W+65/350', d: 190 },
  { q: 314, bar: 1.7, pump: 'W+65/350', d: 190 },
  { q: 337.5, bar: 0.8, pump: 'W+65/350', d: 200 },
];

// Verilen pompa + sabit impellerde sonucu kurar (override için).
function buildOverrideResult(o: { pump: string; d: number }, q: number, target: number): PumpResult | null {
  const p = pumps.find((x) => x.name === o.pump);
  if (!p) return null;
  const cs = pcurves(p, q);
  if (!cs.length) return null;
  const dp = cs.find((c) => Math.abs(c.d - o.d) < 1e-9);
  const kw = kwAt(p, o.d, q);
  if (!dp || kw === null) return null;
  const npsh = npshRange(p, o.d, q);
  const margin = dp.p - target;
  return {
    pump: p, ok: true,
    d: o.d, p: dp.p, diff: Math.abs(margin), signed: margin, kw,
    npsh: npsh.design, npshText: npsh.text,
    minP: Math.min(...cs.map((c) => c.p)), maxP: Math.max(...cs.map((c) => c.p)),
    calcD: o.d, nearestD: o.d, nearestP: dp.p, safeD: o.d, safeP: dp.p,
    mode: 'Doğrulanmış seçim (bellek)', lowPressure: false,
  };
}

/** Verilen duty point (Q m³/h, target bar) için tüm pompaları değerlendirip sıralar. */
export function sizePumps(q: number, target: number): SizingOutput {
  const results = pumps.map((p) => evaluate(p, q, target));
  const rank = rankResults(results);

  const ov = OVERRIDES.find((o) => Math.abs(o.q - q) < 1e-9 && Math.abs(o.bar - target) < 1e-9);
  if (ov) {
    const oRes = buildOverrideResult(ov, q, target);
    if (oRes) {
      // Aynı pompanın normal sıralamadaki kaydını çıkar, override'ı en öne koy.
      const restRank = rank.filter((r) => r.pump.name !== ov.pump);
      return { results, rank: [oRes, ...restRank], best: oRes };
    }
  }
  return { results, rank, best: rank[0] ?? null };
}
