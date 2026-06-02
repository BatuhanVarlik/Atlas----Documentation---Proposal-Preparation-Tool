// Fiyatlandırma satırlarından — önizleme kartıyla BİREBİR aynı mantıkla —
// manuel override'lar + çarpan uygulanmış toplamları ve özet sayımları hesaplar.
// Satır anahtarı createRowKeyer ile üretilir; bu yüzden satır sırası ve
// (category|description|size) imzaları EditablePricingCard'a verilenle aynı
// olmalıdır ki override'lar doğru eşleşsin.

import { createRowKeyer } from './rowKey';

export interface CanonicalPricingRow {
  category: string;
  description: string;
  size: string | null;
  quantity: number;
  matched: boolean;
  /** Katalog net birim fiyatı (eşleşmeyen satırda 0) */
  unitNetPrice: number;
}

export interface PricingTotals {
  subtotal: number;
  total: number;
  matchedCount: number;
  totalRows: number;
  /** Kategori bazında toplam adet (itemize etmeden) */
  counts: Array<{ category: string; count: number }>;
  /** "Vanalar" kategorisindeki toplam adet */
  valveCount: number;
  /** Vana dışı tüm ekipman/enstrüman adedi */
  otherCount: number;
  /** Tüm satırların toplam adedi */
  itemCount: number;
}

export function summarizePricingWithOverrides(
  rows: CanonicalPricingRow[],
  overrides: Record<string, number>,
  multiplier: number,
): PricingTotals {
  const keyer = createRowKeyer();
  let subtotal = 0;
  let matchedCount = 0;
  const countByCat = new Map<string, number>();

  for (const r of rows) {
    const key = keyer(r.category, r.description, r.size);
    const ov = overrides[key];
    const hasOverride = typeof ov === 'number' && Number.isFinite(ov);
    const unit = hasOverride ? ov : r.matched ? r.unitNetPrice : 0;
    subtotal += unit * r.quantity;
    if (r.matched || hasOverride) matchedCount += 1;
    countByCat.set(r.category, (countByCat.get(r.category) ?? 0) + r.quantity);
  }

  const counts = Array.from(countByCat, ([category, count]) => ({ category, count }));
  const valveCount = countByCat.get('Vanalar') ?? 0;
  const itemCount = counts.reduce((s, c) => s + c.count, 0);

  return {
    subtotal,
    total: subtotal * (multiplier > 0 ? multiplier : 1),
    matchedCount,
    totalRows: rows.length,
    counts,
    valveCount,
    otherCount: itemCount - valveCount,
    itemCount,
  };
}
