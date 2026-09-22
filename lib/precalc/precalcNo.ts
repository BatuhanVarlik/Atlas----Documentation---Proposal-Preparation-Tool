/**
 * Precalculation numarasındaki revizyon kodu.
 *
 * Numaralar "PRE-2026-114 RE-00" biçimindedir: sondaki iki harfli kod ve
 * sıra numarası, teklifin kaçıncı revizyonu olduğunu söyler. Versiyon
 * denetimi kullanıcının elinde — numarayı kendisi ilerletir, sistem de
 * o an neyin değiştiğini kaydeder.
 *
 * Kod yalnızca metnin SONUNDA aranır: "RE-01 PROJESİ" gibi bir başlık
 * yanlışlıkla revizyon sanılmamalı.
 */

export interface RevisionCode {
  /** Koddan önceki bölüm ("PRE-2026-114"). */
  base: string;
  /** İki harfli kod, büyük harfe çevrilmiş ("RE", "RS"). */
  code: string;
  seq: number;
  /** Normalleştirilmiş kod ("RE-00"). */
  full: string;
}

const CODE_RE = /^(.*?)\s+([A-Za-z]{2})-(\d{1,3})\s*$/;

export function parseRevisionCode(precalcNo: string): RevisionCode | null {
  const m = CODE_RE.exec(precalcNo ?? '');
  if (!m) return null;

  const base = m[1].trim();
  if (!base) return null;

  const code = m[2].toUpperCase();
  const seq = Number(m[3]);
  return { base, code, seq, full: `${code}-${String(seq).padStart(2, '0')}` };
}

/**
 * Bir sonraki revizyonun numarası — kaydetme diyaloğunda hazır önerilir.
 * Kodu olmayan numara ilk revizyonunu alır.
 */
export function nextRevisionNo(precalcNo: string): string {
  const parsed = parseRevisionCode(precalcNo);
  if (!parsed) return `${(precalcNo ?? '').trim()} RE-01`.trim();
  return `${parsed.base} ${parsed.code}-${String(parsed.seq + 1).padStart(2, '0')}`;
}
