import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { buildDetailedSheet, DETAILED_SHEET } from '../export/detailedSheet';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

function engineWithParity(parity: number) {
  const engine = new PrecalcEngine(workbook);
  engine.setCell(DETAILED_SHEET, 'I9', parity);
  engine.settle();
  return engine;
}

describe('ayrıntılı fiyatlandırma baskı düzeni', () => {
  it('parite 1 iken DOLAR sütunu (E) gizlenir ve baskı D’de biter', () => {
    const built = buildDetailedSheet(engineWithParity(1))!;
    expect(built.parity).toBe(1);
    expect(built.lastCol).toBe('D');
    // !cols dizisinde E, beşinci sütun (0 tabanlı 4).
    expect(built.sheet['!cols']?.[4]?.hidden).toBe(true);
  });

  it('parite 1’den farklıyken E görünür ve baskı E’de biter', () => {
    const built = buildDetailedSheet(engineWithParity(1.08))!;
    expect(built.lastCol).toBe('E');
    expect(built.sheet['!cols']?.[4]?.hidden).toBeFalsy();
  });

  it('son satır sayfanın gerçek son satırından okunur, sabit değildir', () => {
    const built = buildDetailedSheet(engineWithParity(1))!;
    expect(built.lastRow).toBeGreaterThan(40);
    expect(built.lastRow).toBeLessThan(200);
  });
});
