import data from './catalog.json';
import type { PrecalcAnchors } from './types';

/** PRECALCULATION sayfasındaki bir kalem — başlık satırları hariç tüm satırlar. */
export interface CatalogItem {
  id: number;
  /** Excel satır numarası — Precalculation sayfasıyla eşleştirmek için. */
  row: number;
  /** 'catalog' = ürün listesi, 'service' = mühendislik/işçilik kalemleri. */
  group: 'catalog' | 'service';
  placeOfUse: string;
  eqNo: string;
  techSpec: string;
  label: string;
  supplier: string;
  machineType: string;
  listPrice: number | null;
  /**
   * Excel'in J sütunu: liste fiyatının ödenen oranı (0,33 = %33'ü ödenir).
   * Başlığı "% DISCOUNT" olsa da hesap M = F*I*J*K biçimindedir.
   */
  priceFactor: number;
  /** Excel'in K sütunu — ikinci çarpan. */
  extraFactor: number;
  /** Gerçek iskonto oranı: 1 - priceFactor*extraFactor */
  discount: number;
  netPrice: number | null;
  sparePartNo: string;
  sparePartDesc: string;
  sparePartPrice: number | null;
  inletDiameter: string;
  outletDiameter: string;
  connections: number | null;
  topCategory: string;
  subCategory: string;
  productType: string;
  standard: string;
  /** Fiyatı dış çalışma kitabına bağlıydı — elle güncellenmeli. */
  needsPrice: boolean;
  /**
   * Excel'in satır gruplamasındaki ata başlıklar — kategoriden en alt gruba.
   * Örn. ["PROCESS VALVES", "REGULATION PROCESS VALVES", "RGE4 REGULATION
   * VALVE", "RGE41 Regulation Valve", "SMS STANDARD"]. Ağaç görünümü bunu kullanır.
   */
  tree: string[];
  /** F sütunu — kaynak dosyadaki miktar (formüllüyse Excel'in son sonucu). */
  qty: number;
  /** L sütunu — NAKLİYE: I×J×K×(nakliye çarpanı)×F */
  transportCost: number | null;
  /** M sütunu — TOPLAM MALİYET: F×I×J×K */
  totalCost: number | null;
  /** N sütunu — SATIŞ FİYATI: M ÷ (kâr çarpanı) */
  salesPrice: number | null;
  /**
   * PRECALCULATION'da formüllü olan sütunların harfleri ("FLMN" gibi).
   * Bu hücreler Excel'de mor gösterilir ve kullanıcıya kapalıdır.
   */
  fx: string;
  /**
   * Kaynakta boş olduğu için elle doldurulabilen tanım sütunları ("CDEH").
   * PUMPS gibi bölümlerde Excel hazır katalog vermez: mühendis pompanın
   * özelliğini C sütununa yazar, Excel de ekipman kodunu (B), motor gücünü (AE)
   * ve çarpanı (J) bu metinden türetir.
   */
  open: string;
}

/**
 * Excel'in tamamen boş bıraktığı şablon satırı mı — teknik açıklaması,
 * makine tipi ve fiyatı olmayan satırlar. Kullanıcı bunları kendisi doldurur.
 */
export function isBlankTemplate(item: CatalogItem): boolean {
  return !item.techSpec && !item.machineType && !item.listPrice;
}

export interface CatalogMeta {
  totalItems: number;
  sourceFile: string;
  extractedAt: string;
  currency: string;
  counts: { items: number; sections: number; formulas: number };
  /**
   * Kitabın yapısal satırları — OTHERS bloğunun nerede başladığı gibi.
   * Sürümden sürüme kaydıkları için kodda sabit yazılmaz.
   */
  anchors: PrecalcAnchors;
}

export interface CatalogDataset {
  meta: CatalogMeta;
  items: CatalogItem[];
}

export function getCatalogDataset(): CatalogDataset {
  return data as unknown as CatalogDataset;
}
