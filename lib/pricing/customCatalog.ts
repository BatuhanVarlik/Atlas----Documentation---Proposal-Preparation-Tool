// Kataloğa elle eklenen (Excel'de karşılığı olmayan) ürünler için yardımcılar.
// Fiyatlandırma satırları bunlardan otomatik fiyat çeker.
import type { PricingItem } from './loader';
import { findBySizeTokens, type Standard } from './catalogSizeMatcher';

export const CUSTOM_KINDS = ['MILK_CLARIFIER', 'PHE', 'PUMP', 'OTHER'] as const;
export type CustomKind = (typeof CUSTOM_KINDS)[number];

export const CUSTOM_KIND_LABELS: Record<CustomKind, string> = {
  MILK_CLARIFIER: 'Milk Clarifier (Separatör)',
  PHE: 'Plate Heat Exchanger (PHE)',
  PUMP: 'Pompa (W+ vb.)',
  OTHER: 'Diğer',
};

export interface CustomCatalogInput {
  id: string;
  kind: string;
  name: string;
  standard: string;
  size: string | null;
  listPrice: number;
  discount: number;
}

/** DB kaydını fiyatlandırma motorunun anladığı PricingItem biçimine çevirir. */
export function customToPricingItem(c: CustomCatalogInput): PricingItem {
  const net = Math.round(c.listPrice * (1 - c.discount) * 100) / 100;
  return {
    id: -1,
    eqNo: '',
    techSpec: [c.name, c.size].filter(Boolean).join(' ').trim(),
    label: '',
    supplier: 'Özel Katalog',
    machineType: '',
    listPrice: c.listPrice,
    discount: c.discount,
    netPrice: net,
    topCategory: 'ÖZEL KATALOG',
    subCategory: c.kind, // eşleştirme anahtarı (CustomKind)
    productType: c.name,
    standard: (c.standard === 'DIN' || c.standard === 'SMS' ? c.standard : '') as 'DIN' | 'SMS' | '',
  };
}

/**
 * Belirli bir tür (kind) için en uygun özel katalog kalemini bulur.
 * Öncelik: (1) çap/size token eşleşmesi → (2) isim/model içeren → (3) en ucuz.
 * standard verilirse yalnızca o standart (veya standartsız) kalemler değerlendirilir.
 */
export function matchCustomItem(
  customItems: PricingItem[],
  kind: CustomKind,
  opts: { standard?: Standard; size?: string | null; nameContains?: string | null } = {},
): PricingItem | null {
  let pool = customItems.filter((it) => it.subCategory === kind);
  if (opts.standard) pool = pool.filter((it) => it.standard === '' || it.standard === opts.standard);
  if (pool.length === 0) return null;

  if (opts.size && opts.standard) {
    const { item } = findBySizeTokens(pool, opts.size, opts.standard);
    if (item) return item;
  }
  if (opts.nameContains) {
    const needle = opts.nameContains.toLowerCase();
    const byName = pool.filter((it) => it.techSpec.toLowerCase().includes(needle));
    if (byName.length) return [...byName].sort((a, b) => a.listPrice - b.listPrice)[0];
  }
  return [...pool].sort((a, b) => a.listPrice - b.listPrice)[0];
}
