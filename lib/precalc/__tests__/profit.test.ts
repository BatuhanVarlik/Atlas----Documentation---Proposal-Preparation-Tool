import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { profitRate } from '../profit';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

/** Bir kaleme adet girilmiş, hesabı sabitlenmiş motor. */
function engineWithQuote() {
  const engine = new PrecalcEngine(workbook);
  // Katalogdaki ilk gerçek kalem satırına adet ve liste fiyatı yazılır.
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  engine.setCell('PRECALCULATION', 'F' + item.r, 10);
  engine.setCell('PRECALCULATION', 'I' + item.r, 1000);
  engine.settle();
  return engine;
}

describe('kâr oranı', () => {
  it('boş teklifte null döner (satış yok, bölme yapılmaz)', () => {
    const engine = new PrecalcEngine(workbook);
    engine.settle();
    expect(profitRate(engine)).toBeNull();
  });

  it('satış varken (satış − maliyet) / satış verir', () => {
    const engine = engineWithQuote();
    const { grandTotalRow } = engine.anchors;
    const cost = engine.num('M' + grandTotalRow);
    const sales = engine.num('N' + grandTotalRow);

    expect(sales).toBeGreaterThan(0);
    expect(profitRate(engine)).toBeCloseTo(1 - cost / sales, 10);
  });

  it('0 ile 1 arasında kalır — Excel’in SALES PRICE’a bağlı hücresi gibi eksiye düşmez', () => {
    const rate = profitRate(engineWithQuote());
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
    expect(rate!).toBeLessThan(1);
  });
});
