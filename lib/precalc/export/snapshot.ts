import * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { indexToCol, isError } from '../formula';
import { itemStyle } from '../exportStyle';
import { cellFor } from './cells';

/**
 * Kitabın herhangi bir sayfasını hesaplanmış hâliyle Excel sayfasına döker.
 *
 * PRECALCULATION dışındaki sayfalar (AYRINTILI FIYATLANDIRMA, KABLO, panel
 * listeleri…) serbest yerleşimlidir — sabit bir sütun şeması yoktur. Bu
 * yüzden ızgara olduğu gibi taşınır; ayırt etme işini biçimlendirme yapar:
 * formüllü hücre mor, elle girilen sarı, metin başlıklar kalın.
 */
export function buildSheetSnapshot(engine: PrecalcEngine, sheetName: string): XLSX.WorkSheet | null {
  const data = engine.workbook.sheets[sheetName];
  if (!data) return null;

  let maxRow = 0;
  let maxCol = 0;
  for (const addr of [...Object.keys(data.v), ...Object.keys(data.f)]) {
    const m = /^([A-Z]+)(\d+)$/.exec(addr);
    if (!m) continue;
    let col = 0;
    for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
    maxRow = Math.max(maxRow, parseInt(m[2], 10));
    maxCol = Math.max(maxCol, col);
  }
  if (maxRow === 0) return null;

  const sheet: XLSX.WorkSheet = {};
  const widths = new Array<number>(maxCol).fill(10);

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const addr = indexToCol(c - 1) + r;
      const raw = engine.value(addr, sheetName);
      if (raw === null || raw === undefined || raw === '') continue;

      const value = isError(raw) ? raw.code : raw;
      const isFormula = engine.hasFormula(addr, sheetName);
      const edited = engine.isUserEntry(addr, sheetName);
      const numeric = typeof value === 'number';

      const style = itemStyle({
        // Para mı sade sayı mı ayırt edilemiyor: kırılım sayfalarında ikisi de
        // tutar olduğu için para biçimi en az yanıltıcı olanı.
        fmt: numeric ? 'money' : undefined,
        align: numeric ? 'right' : 'left',
        input: edited,
        computed: isFormula,
        bold: !numeric && !isFormula,
      });
      sheet[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })] = cellFor(value, style)!;

      const len = String(isError(raw) ? raw.code : value).length;
      widths[c - 1] = Math.min(Math.max(widths[c - 1], len + 2), 60);
    }
  }

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow - 1, c: maxCol - 1 } });
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  return sheet;
}
