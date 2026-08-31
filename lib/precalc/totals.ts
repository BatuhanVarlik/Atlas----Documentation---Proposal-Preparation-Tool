/**
 * Excel'in kalem ara toplamı düz bir toplam değildir:
 *
 *   M<ara toplam> =SUM(M2:M4660)+SUM(M4662:M4671)+…+SUM(M4840:M4862)
 *                  -SUM(M4848:M4849)-SUM(M4415:M4420)      (36.07 satırları)
 *
 * Bazı aralıklar hiç toplanmaz (OTHERS bölümündeki seçenek
 * satırları), bazıları da başka bir aralıkta zaten sayıldığı için çıkarılır.
 * Ekrandaki toplamlar bu kuralı uygulamazsa kitabın genel toplamıyla tutmaz —
 * bu yüzden aralıklar sabit yazılmaz, doğrudan formülden okunur.
 *
 * Maliyet (M) ve satış (N) tarafı ayrı okunmalıdır: maliyet ara toplamı
 * fazladan bir çıkarma aralığı içerir, satış tarafı içermez. Bu asimetri
 * kitabın kendi kurgusudur ve birebir izlenir.
 *
 * Satır numaraları sürümden sürüme kayar; bu yüzden hiçbiri sabit yazılmaz,
 * formül `engine.anchors.subtotalRow` üzerinden okunur.
 */

/** Ara toplam formülündeki tek bir SUM aralığı ve işareti. */
export interface SumRange {
  from: number;
  to: number;
  /** +1 eklenir, -1 çıkarılır. */
  sign: number;
}

const SUM_RE = /([+-])?\s*SUM\(\s*\$?[A-Z]+\$?(\d+)\s*:\s*\$?[A-Z]+\$?(\d+)\s*\)/gi;

/** "SUM(M2:M10)-SUM(M5:M6)" → aralık listesi. Formül yoksa boş dizi. */
export function parseSumRanges(formula: string | null | undefined): SumRange[] {
  if (!formula) return [];
  const out: SumRange[] = [];
  SUM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SUM_RE.exec(formula)) !== null) {
    out.push({ from: +m[2], to: +m[3], sign: m[1] === '-' ? -1 : 1 });
  }
  return out;
}

/** Satırın ara toplamdaki katsayısı: 1 sayılır, 0 sayılmaz, -1 düşülür. */
export function weightOf(ranges: SumRange[], row: number): number {
  let w = 0;
  for (const r of ranges) if (row >= r.from && row <= r.to) w += r.sign;
  return w;
}
