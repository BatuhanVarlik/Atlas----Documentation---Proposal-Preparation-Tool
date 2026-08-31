/** PRECALCULATION tablosunun sütun tanımı. */

/**
 * `factor`: çarpan hücreleri (kâr, nakliye, J/K iskonto çarpanları). Sayıdan
 * tek farkı hassasiyeti: virgülden sonra 4 haneye kadar gösterilir, çünkü
 * 0,7025 gibi değerler `number` biçiminde 0,70'e yuvarlanıp kayboluyordu.
 */
export type CellFormat = 'text' | 'number' | 'money' | 'percent' | 'date' | 'int' | 'factor';

/** Çarpan hücrelerinde virgülden sonra izin verilen en fazla hane. */
export const FACTOR_DECIMALS = 4;

export interface PrecalcColumn {
  /** Excel sütun harfi. */
  col: string;
  label: string;
  /** px cinsinden genişlik. */
  width: number;
  format: CellFormat;
  /** Kullanıcı bu sütuna veri girebilir mi? */
  editable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Sola sabitlenmiş kimlik sütunu. */
  sticky?: boolean;
  /** Hesaplanan (salt okunur) sütunları görsel olarak ayırmak için. */
  computed?: boolean;
}

export const PRECALC_COLUMNS: PrecalcColumn[] = [
  { col: 'B', label: 'Ekipman No', width: 130, format: 'text', sticky: true },
  { col: 'C', label: 'Teknik Açıklama', width: 380, format: 'text', sticky: true },

  { col: 'A', label: 'Kullanım Yeri', width: 200, format: 'text' },
  { col: 'D', label: 'Etiket', width: 90, format: 'text' },
  { col: 'E', label: 'Tedarikçi', width: 150, format: 'text' },

  { col: 'F', label: 'Miktar', width: 90, format: 'number', editable: true, align: 'right' },
  { col: 'H', label: 'Makine / Ekipman', width: 220, format: 'text' },

  { col: 'I', label: 'Liste Fiyatı', width: 110, format: 'money', editable: true, align: 'right' },
  { col: 'J', label: 'Çarpan', width: 80, format: 'factor', editable: true, align: 'right' },
  { col: 'K', label: 'Ek Çarpan', width: 85, format: 'factor', editable: true, align: 'right' },

  { col: 'L', label: 'Nakliye', width: 105, format: 'money', align: 'right', computed: true },
  { col: 'M', label: 'Toplam Maliyet', width: 125, format: 'money', align: 'right', computed: true },
  { col: 'N', label: 'Satış Fiyatı', width: 125, format: 'money', align: 'right', computed: true },

  { col: 'P', label: 'Yedek Parça No', width: 130, format: 'text', editable: true },
  { col: 'Q', label: 'Yedek Parça Tanım', width: 220, format: 'text', editable: true },
  { col: 'R', label: 'Yedek Parça Fiyat', width: 120, format: 'money', editable: true, align: 'right' },
  { col: 'S', label: 'Yedek Parça Toplam', width: 130, format: 'money', align: 'right', computed: true },

  { col: 'U', label: 'Tedarik (hafta)', width: 105, format: 'int', align: 'right', computed: true },
  { col: 'V', label: 'Ödeme (hafta)', width: 105, format: 'int', align: 'right', computed: true },

  { col: 'W', label: 'HEMİTEK OC', width: 110, format: 'text' },
  { col: 'X', label: 'Sipariş Tarihi', width: 115, format: 'date', editable: true },
  { col: 'Y', label: 'Yurtdışı OC', width: 110, format: 'text' },
  { col: 'Z', label: 'Tahmini Yükleme', width: 125, format: 'date', computed: true },
  { col: 'AB', label: 'Gümrüğe Geliş', width: 125, format: 'date', computed: true },

  { col: 'AE', label: 'Motor kW', width: 90, format: 'number', align: 'right', computed: true },
  { col: 'AY', label: 'Giriş Ø', width: 85, format: 'text' },
  { col: 'AZ', label: 'Çıkış Ø', width: 85, format: 'text' },
  { col: 'BA', label: 'Bağlantı Sayısı', width: 105, format: 'int', align: 'right' },
  { col: 'BB', label: 'Toplam Kaynak', width: 110, format: 'int', align: 'right', computed: true },
];

export const STICKY_COLUMNS = PRECALC_COLUMNS.filter((c) => c.sticky);
export const SCROLL_COLUMNS = PRECALC_COLUMNS.filter((c) => !c.sticky);

/** Satır numarası sütunu dahil, sola sabitlenen bloğun genişliği. */
export const ROW_NO_WIDTH = 56;
export const STICKY_WIDTH = ROW_NO_WIDTH + STICKY_COLUMNS.reduce((s, c) => s + c.width, 0);
export const SCROLL_WIDTH = SCROLL_COLUMNS.reduce((s, c) => s + c.width, 0);

export const ROW_HEIGHT = 34;
