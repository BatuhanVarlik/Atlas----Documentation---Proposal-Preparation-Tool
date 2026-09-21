import * as XLSX from 'xlsx-js-style';

export type Cell = XLSX.CellObject;
export type Style = XLSX.CellStyle;

/**
 * Excel gün sayısını okunur tarihe çevirir. Dönüşüm elle yazılmaz: 1900'ün
 * artık yıl sayılması gibi tuhaflıkları xlsx'in kendi ayrıştırıcısı bilir.
 */
export function excelDate(serial: number): string {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d) return String(serial);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.d)}.${pad(d.m)}.${d.y}`;
}

export function cellFor(value: unknown, style?: Style): Cell | null {
  if (value === null || value === undefined || value === '') return null;
  let cell: Cell;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    cell = { t: 'n', v: value };
  } else if (typeof value === 'boolean') {
    cell = { t: 'b', v: value };
  } else {
    cell = { t: 's', v: String(value) };
  }
  if (style) cell.s = style;
  return cell;
}

/**
 * Boş da olsa biçimlendirilmiş hücre üretir.
 *
 * Kenarlıklar ancak hücre varsa çizilir; boş bırakılan sütunlarda tablo
 * ızgarası kopuyordu. Değeri olmayan hücre `t: 's'` + boş metin olarak
 * yazılır, Excel'de boş görünür ama çerçevesi durur.
 */
export function styledBlank(style: Style): Cell {
  return { t: 's', v: '', s: style };
}
