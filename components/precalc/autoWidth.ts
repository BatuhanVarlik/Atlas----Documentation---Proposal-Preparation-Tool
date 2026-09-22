/**
 * Precalculation No gibi uzunluğu öngörülemeyen alanlar için içerik
 * genişliğinde giriş kutusu. Piksel yerine `ch` (bir karakter genişliği)
 * kullanılır — yazı tipi/ekran boyutundan bağımsız çalışır ve mevcut
 * Tailwind `w-*` sınıflarıyla aynı ölçekte kalır.
 */
export const AUTO_WIDTH_MIN_CH = 18; // önceki sabit `w-44` (11rem) karşılığı
export const AUTO_WIDTH_MAX_CH = 48; // şeridi tek satırda tutan üst sınır

/** Metne göre `ch` cinsinden giriş kutusu genişliği (imleç payı dahil). */
export function computeAutoWidthCh(text: string): number {
  const withCaretRoom = text.length + 2;
  return Math.min(AUTO_WIDTH_MAX_CH, Math.max(AUTO_WIDTH_MIN_CH, withCaretRoom));
}
