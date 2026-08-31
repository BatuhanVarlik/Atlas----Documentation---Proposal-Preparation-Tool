import { PrecalcEngine } from './engine';
import type { PrecalcEntries, PrecalcWorkbook } from './types';
import workbookData from './workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

/**
 * Bir precalculation kaydının listede görünen özeti.
 *
 * Tutarlar istemciden alınmaz: hesap sunucuda yeniden çalıştırılır, böylece
 * listedeki rakam ile üretilen Excel hiçbir zaman ayrışmaz.
 */
export function summarizePrecalc(entries: PrecalcEntries) {
  const engine = new PrecalcEngine(workbook);
  engine.setEntries(entries);
  // Kitap yinelemeli hesapla kaydedilmiş; sabitlenmeden toplamlar #DIV/0! kalır.
  engine.settle();

  const text = (key: string) => {
    const addr = engine.paramAddr(key);
    return addr ? engine.text(addr).trim() : '';
  };
  const { grandTotalRow } = engine.anchors;

  return {
    precalcNo: text('precalcNo'),
    projectNo: text('projectNo'),
    customer: text('customer'),
    endUser: text('endUser'),
    preparedBy: text('preparedBy'),
    sourceFile: workbook.meta.sourceFile,
    currency: workbook.meta.currency,
    totalCost: engine.num('M' + grandTotalRow),
    totalSales: engine.num('N' + grandTotalRow),
    entryCount: Object.keys(entries).length,
  };
}
