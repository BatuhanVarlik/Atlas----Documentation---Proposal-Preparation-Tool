/**
 * Dışa aktarılan Excel dosyalarının görsel dili.
 *
 * Üretilen dosya, kaynak .xlsm'in okunabilirliğini taşımalı: hangi satır
 * başlık, hangi hücre kullanıcı girdisi, hangisi hesaplanmış — dosyayı açan
 * kişi renklerden anlamalı. Ekrandaki kodlarla aynı sözlük kullanılır:
 *
 *   mor   → formülle hesaplanan hücre (ekranda da mor)
 *   sarı  → kullanıcının elle girdiği değer (ekranda da amber)
 *   lacivert başlık şeridi → sütun adları
 *
 * `xlsx` (SheetJS CE) yazarken stilleri düşürdüğü için biçimlendirme
 * gerektiren her yerde `xlsx-js-style` kullanılır; API'si birebir aynıdır.
 */

import type { CellStyle } from 'xlsx-js-style';

/** Excel sayı biçimleri — hücrenin ne olduğu biçiminden de anlaşılsın. */
export const NUM_FMT = {
  money: '#,##0.00',
  qty: '#,##0.###',
  factor: '0.0000',
  int: '0',
  percent: '0.00%',
  date: 'dd.mm.yyyy',
} as const;

export type NumFmtKey = keyof typeof NUM_FMT;

const NAVY = '1F3864';
const HEADER_BLUE = '2F5597';
const GRID = 'D9D9D9';

/** İnce gri kenarlık — kalem satırlarını birbirinden ayırır. */
const thin = { style: 'thin' as const, color: { rgb: GRID } };
export const BORDER_ALL = { top: thin, bottom: thin, left: thin, right: thin };

/** Kitap kimliği: CUSTOMER / PROJECT NO bloğunun etiketleri. */
export const S_LABEL: CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: NAVY } },
  alignment: { vertical: 'center' },
};

/** Kimlik bloğundaki değerler — etiketten ayrılsın diye hafif dolgulu. */
export const S_LABEL_VALUE: CellStyle = {
  font: { sz: 10, color: { rgb: '222222' } },
  fill: { fgColor: { rgb: 'F2F2F2' } },
  alignment: { vertical: 'center' },
  border: BORDER_ALL,
};

/** Sayfanın en üstündeki dosya adı / başlık. */
export const S_TITLE: CellStyle = {
  font: { bold: true, sz: 14, color: { rgb: NAVY } },
  alignment: { vertical: 'center' },
};

/** Sütun başlığı şeridi. */
export const S_HEAD: CellStyle = {
  font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: HEADER_BLUE } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: HEADER_BLUE } },
    bottom: { style: 'medium', color: { rgb: NAVY } },
    left: { style: 'thin', color: { rgb: 'FFFFFF' } },
    right: { style: 'thin', color: { rgb: 'FFFFFF' } },
  },
};

/**
 * Kategori başlıkları. Excel'in kendi kırılımı dört seviyeli: üst kategori →
 * alt kategori → ürün tipi → standart. Derinleştikçe dolgu açılır ki
 * hiyerarşi tek bakışta okunsun.
 */
const SECTION_TONES = [
  { fill: 'BDD0EA', color: NAVY, sz: 11 },
  { fill: 'DAE3F3', color: NAVY, sz: 10 },
  { fill: 'EDF2FA', color: '2F5597', sz: 10 },
  { fill: 'F5F8FC', color: '44546A', sz: 10 },
];

export function sectionStyle(level = 1): CellStyle {
  const tone = SECTION_TONES[Math.min(Math.max(level, 1), SECTION_TONES.length) - 1];
  return {
    font: { bold: true, sz: tone.sz, color: { rgb: tone.color } },
    fill: { fgColor: { rgb: tone.fill } },
    alignment: { vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: '9BB0CE' } } },
  };
}

/** Sıradan kalem hücresi. */
export function itemStyle(opts: {
  fmt?: NumFmtKey;
  align?: 'left' | 'center' | 'right';
  /** Kullanıcının elle girdiği sütun (miktar, liste fiyatı). */
  input?: boolean;
  /** Formülle hesaplanan sütun (nakliye, toplam maliyet, satış). */
  computed?: boolean;
  bold?: boolean;
  /** Okunurluk için bir satır atlamalı gölge. */
  striped?: boolean;
} = {}): CellStyle {
  const style: CellStyle = {
    font: { sz: 9, bold: opts.bold, color: { rgb: opts.computed ? '5B3FA8' : '222222' } },
    alignment: {
      horizontal: opts.align,
      vertical: 'center',
      wrapText: false,
    },
    border: BORDER_ALL,
  };
  if (opts.fmt) style.numFmt = NUM_FMT[opts.fmt];

  // Renk sırası önemli: girdi (sarı) hesaplanmışın (mor) önüne geçer,
  // ikisi de yoksa zebra gölgesi kalır.
  if (opts.input) style.fill = { fgColor: { rgb: 'FFF2CC' } };
  else if (opts.computed) style.fill = { fgColor: { rgb: 'F1ECFB' } };
  else if (opts.striped) style.fill = { fgColor: { rgb: 'FAFAFA' } };

  return style;
}

/** Ara toplam / genel toplam satırları. */
export function totalStyle(opts: { fmt?: NumFmtKey; grand?: boolean } = {}): CellStyle {
  const style: CellStyle = {
    font: {
      bold: true,
      sz: opts.grand ? 11 : 10,
      color: { rgb: opts.grand ? '7F3F00' : NAVY },
    },
    fill: { fgColor: { rgb: opts.grand ? 'FFE699' : 'E2EFDA' } },
    alignment: { vertical: 'center' },
    border: {
      // Genel toplam kalın çerçeveyle kapanır: ara toplamla karışmasın.
      top: { style: opts.grand ? 'thick' : 'thin', color: { rgb: '7F7F7F' } },
      bottom: { style: opts.grand ? 'thick' : 'thin', color: { rgb: '7F7F7F' } },
      left: thin,
      right: thin,
    },
  };
  if (opts.fmt) style.numFmt = NUM_FMT[opts.fmt];
  return style;
}

/** Bölüm başlığı (PAYMENT PLAN, ÖZET vb.) — tabloların arasını ayırır. */
export const S_BLOCK_TITLE: CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: NAVY } },
  alignment: { vertical: 'center' },
};

/** Satır yüksekliği — sarılan başlıklar kırpılmasın. */
export const ROW_HEIGHT = { head: 30, section: 18, item: 15 };
