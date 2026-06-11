import data from './precalculation.json';

export interface PricingItem {
  id: number;
  eqNo: string;
  techSpec: string;
  label: string;
  supplier: string;
  machineType: string;   // col H — referans (Butterfly Valve, Single Seat Valve, vs.)
  listPrice: number;
  discount: number;
  netPrice: number;
  topCategory: string;
  subCategory: string;
  productType: string;
  standard: 'SMS' | 'DIN' | '';
}

export interface PricingMeta {
  totalItems: number;
  sourceFile: string;
  sheet: string;
  extractedAt: string;
  currency: string;
}

export interface PricingDataset {
  meta: PricingMeta;
  items: PricingItem[];
}

export function getPricingDataset(): PricingDataset {
  return data as PricingDataset;
}

/** Katalogda eqNo (ürün kodu) ile birebir kalem bulur. Belirli ürün pinlemek için. */
export function findItemByEqNo(eqNo: string): PricingItem | null {
  return getPricingDataset().items.find((it) => it.eqNo === eqNo) ?? null;
}
