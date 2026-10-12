/**
 * Precalculation No gibi uzunluğu öngörülemeyen alanlar için içerik
 * genişliğinde giriş kutusu. Piksel yerine `ch` (bir karakter genişliği)
 * kullanılır — yazı tipi/ekran boyutundan bağımsız çalışır ve mevcut
 * Tailwind `w-*` sınıflarıyla aynı ölçekte kalır.
 *
 * Gerçek numaralar uzun ve büyük harflidir (ör. "HEM-550202-2608-RS03 P1
 * PASTEURISER", 35 karakter). `ch` "0" rakamının genişliğidir; büyük harfler
 * ondan geniş olduğu için uzunluk UPPER_FACTOR ile büyütülür — yoksa sondaki
 * kelime kutudan taşıp görünmez oluyordu.
 */
export const AUTO_WIDTH_MIN_CH = 30; // boşken de tipik bir numarayı alacak genişlik
export const AUTO_WIDTH_MAX_CH = 64;
const UPPER_FACTOR = 1.15;

/** Metne göre `ch` cinsinden giriş kutusu genişliği (imleç payı dahil). */
export function computeAutoWidthCh(text: string): number {
  const withCaretRoom = Math.ceil(text.length * UPPER_FACTOR) + 2;
  return Math.min(AUTO_WIDTH_MAX_CH, Math.max(AUTO_WIDTH_MIN_CH, withCaretRoom));
}
