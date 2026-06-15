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

function impellerEdgePenalty(allD: number[], d: number): number {
  const ds = [...new Set(allD)].sort((a, b) => a - b);
  if (ds.length <= 1) return 0;
  const pos = ds.indexOf(d) / (ds.length - 1);
  return Math.abs(pos - 0.5) * 2;
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
  lowerD?: number | null;
  upperD?: number | null;
  lowerP?: number | null;
  upperP?: number | null;
  nearestD?: number;
  nearestP?: number;
  safeD?: number | null;
  safeP?: number | null;
  mode?: string;
  lowPressure?: boolean;
  pressurePenalty?: number;
  lowPenalty?: number;
  edgePenalty?: number;
  undershootPenalty?: number;
  safeGap?: number;
  recommendedIsSafe?: boolean;
  score?: number;
}

export function evaluate(p: Pump, q: number, target: number): PumpResult {
  const cs = pcurves(p, q).sort((a, b) => a.d - b.d);
  if (!cs.length) return { pump: p, ok: false, reason: 'Q aralık dışında' };
  const minP = Math.min(...cs.map((x) => x.p)), maxP = Math.max(...cs.map((x) => x.p));
  if (target > maxP) return { pump: p, ok: false, reason: 'Yetersiz basınç', minP, maxP };
  const withKw = cs
    .map((c) => ({ ...c, kw: kwAt(p, c.d, q) }))
    .filter((c): c is DPK => c.kw !== null);
  if (!withKw.length) return { pump: p, ok: false, reason: 'kW aralık dışında', minP, maxP };

  const req = requiredImpeller(withKw, target);
  const calcD = req.calc;

  const recommended = withKw
    .map((c) => ({ ...c, diffD: Math.abs(c.d - calcD), diffP: Math.abs(c.p - target) }))
    .sort((a, b) => a.diffD - b.diffD || a.diffP - b.diffP || a.kw - b.kw || a.d - b.d)[0];

  const safeList = withKw.filter((c) => c.p >= target).sort((a, b) => a.d - b.d || a.kw - b.kw);
  const safe = safeList[0] || null;

  const lowPressure = target < minP;
  let mode = lowPressure ? 'Fazla basınç' : 'Hesaplanan/nearest';
  if (!lowPressure && recommended.p < target) mode = 'Recommended hedefin altında';
  if (!lowPressure && recommended.p >= target && safe && recommended.d === safe.d) mode = 'Recommended güvenli';

  const margin = recommended.p - target;
  const diff = Math.abs(margin);
  const npsh = npshRange(p, recommended.d, q);

  const pressurePenalty = target > 0 ? Math.min(diff / Math.max(target, 0.5), 1.8) : 0;
  const lowPenalty = lowPressure ? Math.min((minP - target) / Math.max(minP, 0.5), 1.5) : 0;
  const edgePenalty = impellerEdgePenalty(withKw.map((c) => c.d), recommended.d);
  const undershootPenalty = recommended.p < target ? 0.35 : 0;
  const safeGap = safe ? Math.abs(safe.d - recommended.d) : 0;

  return {
    pump: p, ok: true,
    d: recommended.d, p: recommended.p, diff, signed: margin, kw: recommended.kw,
    npsh: npsh.design, npshText: npsh.text, minP, maxP,
    calcD, lowerD: req.lower ? req.lower.d : null, upperD: req.upper ? req.upper.d : null,
    lowerP: req.lower ? req.lower.p : null, upperP: req.upper ? req.upper.p : null,
    nearestD: recommended.d, nearestP: recommended.p,
    safeD: safe ? safe.d : null, safeP: safe ? safe.p : null,
    mode, lowPressure,
    pressurePenalty, lowPenalty, edgePenalty, undershootPenalty, safeGap,
    recommendedIsSafe: safe ? recommended.d === safe.d : false,
  };
}

export function rankResults(results: PumpResult[]): PumpResult[] {
  const ok = results.filter((r) => r.ok);
  if (!ok.length) return [];
  const minKw = Math.min(...ok.map((r) => r.kw!)), maxKw = Math.max(...ok.map((r) => r.kw!));
  const span = Math.max(maxKw - minKw, 0.001);
  ok.forEach((r) => {
    const kwNorm = (r.kw! - minKw) / span;
    r.score = 0.42 * kwNorm + 0.30 * r.pressurePenalty! + 0.10 * r.lowPenalty! + 0.10 * r.edgePenalty! + 0.08 * r.undershootPenalty!;
  });
  return ok.sort((a, b) => a.score! - b.score! || a.diff! - b.diff! || a.kw! - b.kw!);
}

export interface SizingOutput {
  results: PumpResult[];
  rank: PumpResult[];
  best: PumpResult | null;
}

/** Verilen duty point (Q m³/h, target bar) için tüm pompaları değerlendirip sıralar. */
export function sizePumps(q: number, target: number): SizingOutput {
  const results = pumps.map((p) => evaluate(p, q, target));
  const rank = rankResults(results);
  return { results, rank, best: rank[0] ?? null };
}
