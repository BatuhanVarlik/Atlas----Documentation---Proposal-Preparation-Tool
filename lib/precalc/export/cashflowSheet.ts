import * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { readCashflow } from '../cashflow';
import {
  S_BLOCK_TITLE, S_HEAD, itemStyle, totalStyle, type NumFmtKey,
} from '../exportStyle';
import { cellFor, styledBlank, type Style } from './cells';

export const CASHFLOW_SHEET = 'CASHFLOW';

/** Grafiğin bağlanacağı satırlar — chart XML'i bunlara referans verir. */
export interface CashflowLayout {
  /** Haftalık tablonun başlık satırı (1 tabanlı). */
  netHeaderRow: number;
  firstWeekRow: number;
  lastWeekRow: number;
}

/** Yerleşim sabitleri — testler ve chart aynı sayıları okusun diye burada. */
const PLAN_HEAD_ROW = 4;
const PLAN_FIRST_ROW = 5;
const PLAN_COUNT = 8;

/**
 * CASHFLOW sayfası: üstte ödeme planı, altında 52 haftalık nakit akışı.
 *
 * Değerler kitabın kendi formüllerinden gelir (bkz. lib/precalc/cashflow.ts);
 * burada yalnızca biçimlendirilip yerleştirilir. Grafik bu sayfaya Task 11'de,
 * dosya paketlendikten sonra enjekte edilir — SheetJS grafik yazamıyor.
 */
export function buildCashflowSheet(engine: PrecalcEngine): {
  sheet: XLSX.WorkSheet;
  layout: CashflowLayout;
} {
  const data = readCashflow(engine);
  const sheet: XLSX.WorkSheet = {};

  /** 1 tabanlı satır/sütuna yazar. */
  const put = (row: number, col: number, value: unknown, style?: Style) => {
    const cell = style ? (cellFor(value, style) ?? styledBlank(style)) : cellFor(value);
    if (cell) sheet[XLSX.utils.encode_cell({ r: row - 1, c: col })] = cell;
  };
  /** Bir satırı baştan sona tek stille doldurur — şerit yarım kalmasın. */
  const band = (row: number, values: unknown[], style: Style) => {
    for (let c = 0; c < 5; c++) put(row, c, values[c] ?? '', style);
  };

  band(1, ['CASHFLOW', '', '', '', ''], S_BLOCK_TITLE);
  band(3, ['ÖDEME PLANI', '', '', '', ''], S_BLOCK_TITLE);

  ['Aşama', 'Oran', 'Hafta', 'Tutar', 'Tahsilat Haftası']
    .forEach((h, c) => put(PLAN_HEAD_ROW, c, h, S_HEAD));

  const PLAN_FMT: (NumFmtKey | undefined)[] = [undefined, 'percent', 'int', 'money', 'int'];
  data.stages.forEach((s, i) => {
    const row = PLAN_FIRST_ROW + i;
    [s.label, s.ratio, s.week, s.amount, s.collectWeek].forEach((v, c) => put(row, c, v, itemStyle({
      fmt: PLAN_FMT[c],
      align: c === 0 ? 'left' : 'right',
      computed: c > 0,
      striped: i % 2 === 1,
    })));
  });

  const planTotalRow = PLAN_FIRST_ROW + PLAN_COUNT;   // 13
  ['TOPLAM', '', '', data.stageTotal, ''].forEach((v, c) => put(
    planTotalRow, c, v, totalStyle({ fmt: c === 3 ? 'money' : undefined, grand: true }),
  ));

  const netHeaderRow = planTotalRow + 3;              // 16
  band(netHeaderRow - 1, ['HAFTALIK NAKİT AKIŞI', '', '', '', ''], S_BLOCK_TITLE);
  ['HAFTA', 'GELİR', 'GİDER', 'NET', '']
    .forEach((h, c) => put(netHeaderRow, c, h, S_HEAD));

  const firstWeekRow = netHeaderRow + 1;
  data.weeks.forEach((w, i) => {
    const row = firstWeekRow + i;
    [w.week, w.gelir, w.gider, w.net].forEach((v, c) => put(row, c, v, itemStyle({
      fmt: c === 0 ? 'int' : 'money',
      align: 'right',
      computed: c === 3,
      striped: i % 2 === 1,
    })));
  });

  const lastWeekRow = firstWeekRow + data.weeks.length - 1;

  sheet['!ref'] = `A1:E${lastWeekRow}`;
  sheet['!cols'] = [{ wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  sheet['!freeze'] = { xSplit: 0, ySplit: netHeaderRow };

  return { sheet, layout: { netHeaderRow, firstWeekRow, lastWeekRow } };
}
