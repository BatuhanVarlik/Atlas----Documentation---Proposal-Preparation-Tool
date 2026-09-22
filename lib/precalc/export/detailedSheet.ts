import type * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { buildSheetSnapshot } from './snapshot';

/** Kaynak kitaptaki maliyet kırılımı sayfasının adı. */
export const DETAILED_SHEET = 'AYRINTILI FIYATLANDIRMA';

/** Pariteyi taşıyan hücre — D (EURO) sütununu E'ye (DOLAR) çeviren çarpan. */
const PARITY_ADDR = 'I9';

/** E sütununun 0 tabanlı indeksi. */
const DOLLAR_COL = 4;

export interface DetailedSheet {
  sheet: XLSX.WorkSheet;
  parity: number;
  /** Sayfanın dolu son satırı (1 tabanlı). */
  lastRow: number;
  /** Baskı alanının son sütunu. */
  lastCol: 'D' | 'E';
}

/**
 * Ayrıntılı fiyatlandırma sayfası, A4'e sığacak baskı bilgisiyle birlikte.
 *
 * D sütunu EURO, E sütunu `D × PARİTE` ile DOLAR toplamıdır. Parite 1 ise iki
 * sütun aynı sayıyı gösterir; bu durumda E gizlenir ve baskı A–D ile kapanır,
 * böylece tablo A4'e ferah sığar. Parite 1'den farklıysa DOLAR sütunu gerçek
 * bilgi taşır: görünür kalır ve baskı A–E olur.
 */
export function buildDetailedSheet(engine: PrecalcEngine): DetailedSheet | null {
  const sheet = buildSheetSnapshot(engine, DETAILED_SHEET);
  if (!sheet) return null;

  const parity = engine.num(PARITY_ADDR, DETAILED_SHEET);
  const singleCurrency = parity === 1;

  const cols = (sheet['!cols'] ?? []) as XLSX.ColInfo[];
  while (cols.length <= DOLLAR_COL) cols.push({ wch: 12 });
  cols[DOLLAR_COL] = { ...cols[DOLLAR_COL], hidden: singleCurrency };
  sheet['!cols'] = cols;

  // Son satır kaynak sayfadan okunur: sürüm değiştikçe kalem sayısı değişiyor.
  const range = sheet['!ref'] ? (sheet['!ref'] as string).split(':')[1] : '';
  const lastRow = Number(/(\d+)$/.exec(range)?.[1] ?? 0);

  return { sheet, parity, lastRow, lastCol: singleCurrency ? 'D' : 'E' };
}
