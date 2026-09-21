/** Dosya adında kullanılamayan karakterler (Windows). */
const UNSAFE = /[\\/:*?"<>|]/g;

/**
 * Üretilen Excel dosyasının adı.
 *
 * Precalculation numarası verilmişse dosya onunla anılır — kullanıcı
 * indirdiği dosyayı hangi teklife ait olduğunu açmadan görsün. Numara yoksa
 * (henüz doldurulmamış taslak) tarih-saatli eski ad kullanılır, çünkü aynı
 * gün üretilen iki dosya birbirini ezmemeli.
 */
export function precalcFileName(precalcNo?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const clean = (precalcNo ?? '').replace(UNSAFE, '_').trim();
  if (clean) return `${clean} ${day}.xlsx`;

  return `PRECALCULATION ${day} ${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
}
