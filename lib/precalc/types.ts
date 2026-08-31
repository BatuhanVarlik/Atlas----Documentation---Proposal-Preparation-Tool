/** PRECALCULATION çalışma kitabının serileştirilmiş biçimi. */

export type RawValue = number | string | boolean | null;

export interface SheetData {
  /** "A1:CJ4928" */
  ref: string;
  /** Formülü olmayan hücrelerin sabit değerleri. */
  v: Record<string, RawValue>;
  /** Formüllü hücreler (A1 gösterimi, baştaki "=" olmadan). */
  f: Record<string, string>;
  /**
   * Motorun hesaplayamadığı hücreler için Excel'in son kaydettiği değer.
   * Yalnızca dış çalışma kitabına bağlı hücreler için doldurulur.
   */
  cached: Record<string, RawValue>;
}

/** PRECALCULATION satırının ne olduğu. */
export type RowKind =
  /** Kategori / alt kategori / ürün tipi / standart başlığı */
  | 'section'
  /** Fiyatlandırılabilir kalem satırı */
  | 'item'
  /** Ara toplam, genel gider, ödeme planı vb. */
  | 'summary'
  | 'blank';

/** Satırın kitabın hangi bölümünde olduğu. */
export type RowGroup = 'catalog' | 'service' | 'total' | 'plan';

export interface RowMeta {
  /** 1 tabanlı Excel satır numarası — hücre adreslerinin anahtarı. */
  r: number;
  kind: RowKind;
  group: RowGroup;
  /** section için: 1 = üst kategori, 2 = alt kategori, 3 = ürün tipi, 4 = standart */
  level?: 1 | 2 | 3 | 4;
  /**
   * Excel'in kendi satır gruplama (outline) seviyesi. level alanından
   * farklıdır: o bizim kategori sınıflandırmamız, bu kitabın kendi katlama
   * derinliği. OTHERS bloğunun ağacı buradan kurulur.
   */
  lvl?: number;
  /** section için başlık metni. */
  title?: string;
  /** section (level 2) için Excel'deki kısaltma (MV, NV, PT ...). */
  abbr?: string;
  /** item için: [üst kategori, alt kategori, ürün tipi] */
  path?: string[];
  /** item için: 'SMS' | 'DIN' | '' */
  standard?: string;
  /** Bu satırda kullanıcıya açık olan sütunlar (A1 sütun harfleri). */
  inputs?: string[];
  /** Fiyatı dış çalışma kitabına bağlı olduğu için elle girilmesi gereken satır. */
  needsPrice?: boolean;
}

/** PRECALCULATION sayfasındaki yapısal satır numaraları. */
export interface PrecalcAnchors {
  /** Ürün kataloğunun son satırı; sonrası hizmet/işçilik kalemleri. */
  catalogEnd: number;
  /** Kalem ara toplamı (genel giderler hariç). */
  subtotalRow: number;
  /** Genel toplam — ara toplam + genel giderler. */
  grandTotalRow: number;
  /** Ödeme planı bloğunun ilk satırı. */
  planStart: number;
  /** "OTHERS" başlığı — genel gider bloğu buradan ara toplama kadar sürer. */
  othersRow: number;
  /**
   * Formülü elle ezilebilen blok (mühendislik, montaj, devreye alma).
   * Kullanıcı kendi adam-gün sayısını yazar, ↺ ile şablon formülüne döner.
   */
  manualFormulaStart: number;
  manualFormulaEnd: number;
  /** F hücresine 1 yazılmadıkça altındaki blok hesaplanmayan başlık satırları. */
  gateRows: number[];
  /** Paslanmaz malzeme toplamının vana standardına bağlandığı satır. */
  stainlessRow: number;
}

export interface PrecalcWorkbook {
  meta: {
    sourceFile: string;
    extractedAt: string;
    currency: string;
    /** PRECALCULATION sayfasında verinin bittiği satır. */
    lastRow: number;
    headerRow: number;
    counts: { items: number; sections: number; formulas: number };
    /**
     * Kitabın yapısal satırları. Her yeni fiyat listesinde kayabildikleri için
     * (36.01 -> 36.07 arasında 6 satır eklendi) kodda sabit yazılmaz,
     * build-precalc.js kaynaktan tespit edip buraya yazar.
     */
    anchors: PrecalcAnchors;
  };
  sheetNames: string[];
  sheets: Record<string, SheetData>;
  /** PRECALCULATION sayfasının satır haritası. */
  outline: RowMeta[];
  /** PRECALCULATION sütun başlıkları (A1 harfi -> başlık). */
  columns: Record<string, string>;
  /**
   * Dış çalışma kitabına (Valveseeker_Active.xlsm, Precalculation 29.02)
   * bağlı olduğu için elle güncellenmesi gereken hücreler.
   */
  externalCells: { sheet: string; addr: string; formula: string; cached: RawValue }[];
  /** Hesaplamayı yöneten parametre hücreleri. */
  params: { key: string; sheet: string; addr: string; label: string; value: RawValue }[];
}

/** Kullanıcının girdiği değerler: "SHEET!ADDR" -> değer */
export type PrecalcEntries = Record<string, RawValue>;
