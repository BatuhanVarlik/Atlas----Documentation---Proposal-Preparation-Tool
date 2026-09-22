import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { buildCashflowSheet, CASHFLOW_SHEET } from '../export/cashflowSheet';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

function quoted() {
  const engine = new PrecalcEngine(workbook);
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  engine.setCell('PRECALCULATION', 'F' + item.r, 10);
  engine.setCell('PRECALCULATION', 'I' + item.r, 1000);
  engine.setCell('PRECALCULATION', engine.paramAddr('salesPrice')!, 200000);
  engine.settle();
  return engine;
}

describe('CASHFLOW sayfası', () => {
  it('sayfa adı sabittir', () => {
    expect(CASHFLOW_SHEET).toBe('CASHFLOW');
  });

  it('haftalık tablonun başlıkları ve 52 satırı vardır', () => {
    const { sheet, layout } = buildCashflowSheet(quoted());
    const head = layout.netHeaderRow;

    expect(sheet['A' + head]?.v).toBe('HAFTA');
    expect(sheet['B' + head]?.v).toBe('GELİR');
    expect(sheet['C' + head]?.v).toBe('GİDER');
    expect(sheet['D' + head]?.v).toBe('NET');

    expect(layout.lastWeekRow - layout.firstWeekRow + 1).toBe(52);
    expect(sheet['A' + layout.firstWeekRow]?.v).toBe(1);
    expect(sheet['A' + layout.lastWeekRow]?.v).toBe(52);
  });

  it('NET sütunu motordaki kümülatif değerle aynıdır', () => {
    const engine = quoted();
    const { sheet, layout } = buildCashflowSheet(engine);
    const { subtotalRow } = engine.anchors;

    expect(sheet['D' + layout.firstWeekRow]?.v)
      .toBeCloseTo(engine.num('V' + (subtotalRow + 20)), 6);
    expect(sheet['D' + layout.lastWeekRow]?.v)
      .toBeCloseTo(engine.num('V' + (subtotalRow + 71)), 6);
  });

  it('ödeme planı bloğu sekiz aşama ve toplam satırı taşır', () => {
    const { sheet } = buildCashflowSheet(quoted());
    // Ödeme planı üstte: başlık 3. satır, aşamalar 5–12, toplam 13.
    expect(sheet['A4']?.v).toBe('Aşama');
    expect(sheet['A5']?.v).toBe('PRE-PAYMENT');
    expect(sheet['A13']?.v).toBe('TOPLAM');
  });

  it('!ref ve sütun genişlikleri kurulur', () => {
    const { sheet, layout } = buildCashflowSheet(quoted());
    expect(sheet['!ref']).toBe(`A1:E${layout.lastWeekRow}`);
    expect(sheet['!cols']).toHaveLength(5);
  });
});
