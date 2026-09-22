/**
 * Hesaplanmış precalculation'ı Excel dosyasına yazar.
 *
 * Kaynak .xlsm dosyası okunmaz/değiştirilmez; çıktı, motorun hesapladığı
 * değerlerden sıfırdan üretilir.
 *
 * Biçimlendirme `xlsx` yerine `xlsx-js-style` ile yazılır: SheetJS'in
 * topluluk sürümü yazarken hücre stillerini sessizce düşürüyor, bu yüzden
 * üretilen dosyada başlık, kategori ve toplam satırları birbirinden
 * ayırt edilemiyordu. API ikisinde de aynı.
 */

import * as XLSX from 'xlsx-js-style';
import { PrecalcEngine } from '../engine';
import { isError } from '../formula';
import type { PrecalcEntries, PrecalcWorkbook } from '../types';
import { excelDate } from './cells';
import { buildPrecalcSheet, type ResolvedHeader } from './precalcSheet';
import { buildEquipmentSheet, buildShippingSheet, type StockRow } from './listSheets';
import { buildDetailedSheet, DETAILED_SHEET } from './detailedSheet';
import { buildSummarySheet } from './summarySheet';

export interface ExportOptions {
  /** true ise yalnızca miktarı girilmiş kalemler yazılır. */
  onlyEntered: boolean;
  /**
   * Ekipman numarasına göre depo bakiyesi / asgari stok. Sunucudan
   * (/api/stock) gelir; verilmezse bu iki sütun boş kalır.
   */
  stock?: Record<string, StockRow>;
  /** Başlık bloğuna yazılacak proje bilgileri. */
  header?: {
    customer?: string;
    endUser?: string;
    date?: string;
    preparedBy?: string;
    projectNo?: string;
    precalcNo?: string;
  };
}

/**
 * PRECALCULATION sayfasını hesaplanmış hâliyle bir çalışma kitabına yazar.
 */
export function buildPrecalcWorkbook(
  wb: PrecalcWorkbook,
  entries: PrecalcEntries,
  options: ExportOptions,
): XLSX.WorkBook {
  const engine = new PrecalcEngine(wb);
  engine.setEntries(entries);
  /*
   * Kaynak kitap yinelemeli hesapla (calcPr iterate="1") kaydedilmiştir:
   * genel gider, dolu kategori sayısına bölünerek dağıtılır ve o sayı yine
   * dağıtımın kendisine bakar. Tek geçişte bu hücreler 0 kalıp #DIV/0!
   * veriyordu — AYRINTILI FIYATLANDIRMA sayfası çıktıda 14 hata hücresiyle
   * geliyordu. settle() Excel'in yaptığı gibi değerleri sabitler.
   */
  engine.settle();

  /* ---- Başlık bloğu ---- */
  // A sütunu etiketi taşır, değer B sütunundadır; adresler params'tan gelir.
  const h = options.header ?? {};
  const projectField = (key: string) => {
    const addr = engine.paramAddr(key);
    if (!addr) return '';
    const v = engine.value(addr);
    if (v === null || isError(v)) return '';
    if (key === 'date' && typeof v === 'number') return excelDate(v);
    return String(v);
  };
  const header: ResolvedHeader = {
    customer: h.customer ?? projectField('customer'),
    endUser: h.endUser ?? projectField('endUser'),
    projectNo: h.projectNo ?? projectField('projectNo'),
    precalcNo: h.precalcNo ?? projectField('precalcNo'),
    date: h.date ?? (projectField('date') || new Date().toLocaleDateString('tr-TR')),
    preparedBy: h.preparedBy ?? projectField('preparedBy'),
  };

  const { sheet, keptItemCount, lines } = buildPrecalcSheet(engine, wb, options, header);

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'PRECALCULATION');

  /* ---- Ekipman ve sevk listeleri ---- */
  // Her ikisi de yalnızca miktarı girilmiş kalemleri gösterir: sipariş ve
  // sevkiyat için kullanıldıklarından tüm katalog anlamsız olur.
  const listMeta = {
    sourceFile: wb.meta.sourceFile.replace(/\.xlsm?$/i, ''),
    customer: [header.customer, header.endUser].filter(Boolean).join(' / '),
    date: header.date,
  };

  // Grup satır aralıkları "Ekipman Listesi Limitleri" sayfasından okunur;
  // sürüm değiştikçe orası güncellendiği için burada sabit satır tutulmaz.
  const limitSheet = wb.sheets['Ekipman Listesi Limitleri'];
  const limitRange = (limitRow: number) => {
    const from = limitSheet?.v['D' + limitRow];
    const to = limitSheet?.v['E' + limitRow];
    return typeof from === 'number' && typeof to === 'number' ? { from, to } : null;
  };

  const stock = options.stock ?? {};
  XLSX.utils.book_append_sheet(
    book, buildEquipmentSheet(lines, limitRange, stock, listMeta), 'EQUIPMENT LIST');
  XLSX.utils.book_append_sheet(
    book, buildShippingSheet(lines, stock, listMeta), 'Sevk Listesi');

  /* ---- AYRINTILI FIYATLANDIRMA ---- */
  // Kaynak kitaptaki maliyet kırılımı sayfası. Hesap motoru bu sayfayı da
  // canlı hesapladığı için çıktıya hesaplanmış hâliyle konur; kullanıcı
  // teklifi Excel'de açtığında kırılımı da elinde bulur.
  const detailed = buildDetailedSheet(engine);
  if (detailed) {
    XLSX.utils.book_append_sheet(book, detailed.sheet, DETAILED_SHEET);

    // Baskı alanı tanımlı adla verilir; sayfa adı boşluk içerdiği için tırnaklı.
    const sheetIndex = book.SheetNames.indexOf(DETAILED_SHEET);
    book.Workbook = book.Workbook ?? {};
    book.Workbook.Names = [
      ...(book.Workbook.Names ?? []),
      {
        Name: '_xlnm.Print_Area',
        Sheet: sheetIndex,
        Ref: `'${DETAILED_SHEET}'!$A$1:$${detailed.lastCol}$${detailed.lastRow}`,
      },
    ];
  }

  /* ---- Özet sayfası ---- */
  XLSX.utils.book_append_sheet(book, buildSummarySheet(wb, engine, {
    itemCount: keptItemCount,
  }), 'ÖZET');

  return book;
}

export { EXPORT_COLUMNS } from './precalcSheet';
export { buildSheetSnapshot } from './snapshot';
export { precalcFileName } from './fileName';
export { quoteEquipmentNumbers, type StockRow } from './listSheets';
export { DETAILED_SHEET } from './detailedSheet';
