/**
 * Advanced Precalculation kataloğu üzerinde admin düzeltmeleri.
 *
 * Katalog (catalog.json) ve çalışma kitabı (workbook.json) .xlsm içe
 * aktarımından üretilir; bu dosya onları DEĞİŞTİRMEZ. Düzeltmeler ayrı
 * saklanır (DB) ve okuma anında bir katman olarak bindirilir — tıpkı bir
 * kullanıcının teklifine girdiği miktarın kaynak dosyayı değiştirmemesi gibi.
 *
 * Yalnızca düz DEĞER taşıyan sütunlar (liste fiyatı, iskonto çarpanları,
 * etiket/tedarikçi/teknik açıklama/makine tipi) düzeltilebilir. Formülle
 * üretilen hücreler (bkz. CatalogItem.fx) hiçbir zaman düzeltilmez — motorun
 * 48 binden fazla formülünden hiçbiri bu yoldan bozulamaz.
 */
import type { CatalogItem } from './catalog';

export const OVERRIDE_FIELDS = [
  'listPrice', 'priceFactor', 'extraFactor', 'label', 'supplier', 'techSpec', 'machineType',
] as const;
export type OverrideField = (typeof OVERRIDE_FIELDS)[number];

/** Alanların sayısal olanları — geri kalanı metin. */
const NUMERIC_FIELDS = new Set<OverrideField>(['listPrice', 'priceFactor', 'extraFactor']);

/** Her alanın PRECALCULATION sayfasındaki karşılığı olan sütun harfi. */
export const FIELD_COLUMN: Record<OverrideField, string> = {
  listPrice: 'I',
  priceFactor: 'J',
  extraFactor: 'K',
  label: 'D',
  supplier: 'E',
  techSpec: 'C',
  machineType: 'H',
};

/** DB'den okunan/yazılan bir düzeltme kaydı. */
export interface CatalogOverrideRecord {
  catalogKey: string;
  field: OverrideField;
  value: string;
  updatedByName?: string;
  updatedAt?: string;
}

export interface OverriddenCatalogItem extends CatalogItem {
  /**
   * Kalemin kararlı kimliği — ŞABLON (düzeltilmemiş) alanlardan hesaplanır.
   * UI, bir düzeltmeyi kaydederken/kaldırırken MUTLAKA bunu kullanmalı;
   * computeCatalogKey'i bu nesnenin (olası şekilde düzeltilmiş) alanlarından
   * yeniden hesaplamak techSpec/machineType gibi bileşik-anahtar alanları
   * düzeltilmişse anahtarı kaydırır ve düzeltme "öksüz" görünür.
   */
  catalogKey: string;
  /** Bu kalemde hangi alanlar admin tarafından düzeltilmiş — UI bunu vurgular. */
  overriddenFields: OverrideField[];
}

/**
 * Bir kalemin kararlı kimliği. Excel satır numarası (item.row) sürümden
 * sürüme kayar (36.07 -> 36.10 arasında 6 satır kaydı) — bu yüzden asla
 * anahtar olarak kullanılmaz. Ekipman numarası (eqNo) varsa o kullanılır;
 * yoksa kategori + teknik açıklamadan bileşik bir anahtar üretilir. Bu
 * bileşik anahtar aynı içerikli birden çok satırda (ör. boş şablon satırları)
 * çakışabilir — applyCatalogOverridesToItems böyle durumda düzeltmeyi
 * eşleşen TÜM satırlara uygular (hangisi olduğu ayırt edilemediği için).
 */
export function computeCatalogKey(
  item: Pick<CatalogItem, 'eqNo' | 'topCategory' | 'subCategory' | 'productType' | 'standard' | 'techSpec' | 'machineType'>,
): string {
  const eqNo = item.eqNo.trim();
  if (eqNo) return 'eq:' + eqNo;
  return ['k', item.topCategory, item.subCategory, item.productType, item.standard, item.techSpec, item.machineType]
    .map((s) => s.trim())
    .join('|');
}

/** Bu alan Excel'de formülle mi üretiliyor — öyleyse düzeltme hiç uygulanmaz. */
function isFormulaField(item: CatalogItem, field: OverrideField): boolean {
  return item.fx.includes(FIELD_COLUMN[field]);
}

/** Ham metni alanın tipine çevirir; sayısal alanda sayı çözülemezse null döner. */
function parseFieldValue(field: OverrideField, raw: string): number | string | null {
  if (!NUMERIC_FIELDS.has(field)) return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** M/N sütunlarının Excel'deki yuvarlama kuralı — build-precalc.js ile birebir aynı. */
function recomputePriceFields(it: CatalogItem): void {
  const priceFactor = it.priceFactor;
  const extraFactor = it.extraFactor;
  it.netPrice = it.listPrice === null ? null : Math.round(it.listPrice * priceFactor * extraFactor * 100) / 100;
  it.discount = Math.round((1 - priceFactor * extraFactor) * 10000) / 10000;
}

/**
 * Düzeltmeleri katalog kalemlerinin üzerine bindirir (salt okunur girdilerden
 * yeni bir dizi üretir, hiçbirini yerinde değiştirmez).
 */
export function applyCatalogOverridesToItems(
  items: CatalogItem[],
  overrides: CatalogOverrideRecord[],
): { items: OverriddenCatalogItem[] } {
  const byKey = new Map<string, OverriddenCatalogItem[]>();
  // Anahtar, ŞABLON alanlarından (henüz hiçbir düzeltme uygulanmamışken) hesaplanır
  // ve nesneye yapıştırılır — sonraki adımda techSpec/machineType gibi bileşik-
  // anahtar alanları düzeltilse bile anahtar kaymaz.
  const out: OverriddenCatalogItem[] = items.map((it) => ({ ...it, catalogKey: computeCatalogKey(it), overriddenFields: [] }));
  for (const it of out) {
    const arr = byKey.get(it.catalogKey);
    if (arr) arr.push(it); else byKey.set(it.catalogKey, [it]);
  }

  for (const ov of overrides) {
    const targets = byKey.get(ov.catalogKey);
    if (!targets) continue; // öksüz düzeltme — kataloğa artık uymuyor, sessizce atlanır

    for (const it of targets) {
      if (isFormulaField(it, ov.field)) continue; // formül üretimli — hiçbir zaman uygulanmaz
      const value = parseFieldValue(ov.field, ov.value);
      if (value === null) continue; // sayısal alanda çözülemeyen değer — atla

      (it as unknown as Record<OverrideField, number | string | null>)[ov.field] = value;
      it.overriddenFields.push(ov.field);
      if (NUMERIC_FIELDS.has(ov.field)) recomputePriceFields(it);
    }
  }

  return { items: out };
}

/** Canlı motora (workbook.json) yazılacak tek bir hücre yaması. */
export interface WorkbookCellPatch {
  addr: string;
  value: number | string;
}

/**
 * Düzeltmeleri, motorun okuduğu PRECALCULATION hücrelerine karşılık gelen
 * yamalara çevirir (ör. eq:H1 -> listPrice=200 => {addr:'I1847', value:200}).
 * Böylece bir kullanıcı yeni bir teklif açtığında motor, düzeltilmiş değeri
 * kendi statik değeriymiş gibi okur — kullanıcının kendi girdiği bir değer
 * varsa (motorun kendi önceliği gereği) yine de ondan üstün gelmez.
 */
export function resolveOverridesToWorkbookPatches(
  items: CatalogItem[],
  overrides: CatalogOverrideRecord[],
): WorkbookCellPatch[] {
  const byKey = new Map<string, CatalogItem[]>();
  for (const it of items) {
    const key = computeCatalogKey(it);
    const arr = byKey.get(key);
    if (arr) arr.push(it); else byKey.set(key, [it]);
  }

  const patches: WorkbookCellPatch[] = [];
  for (const ov of overrides) {
    const targets = byKey.get(ov.catalogKey);
    if (!targets) continue;
    for (const it of targets) {
      if (isFormulaField(it, ov.field)) continue;
      const value = parseFieldValue(ov.field, ov.value);
      if (value === null) continue;
      patches.push({ addr: FIELD_COLUMN[ov.field] + it.row, value });
    }
  }
  return patches;
}
