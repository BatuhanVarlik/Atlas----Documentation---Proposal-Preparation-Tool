/**
 * Fiyatlandırma satırları için kararlı anahtar üreteci.
 * Anahtar = "category|description|size" — manuel fiyat override'larını
 * yeniden render'lar arasında eşlemek için kullanılır. Aynı imzaya sahip
 * tekrar eden satırlar için sona "#n" eklenir (React key çakışmasını önler).
 */
export function createRowKeyer() {
  const seen = new Map<string, number>();
  return (category: string, description: string, size: string | null): string => {
    const base = `${category}|${description}|${size ?? ''}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  };
}
