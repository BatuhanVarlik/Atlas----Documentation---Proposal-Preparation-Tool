import { describe, expect, it } from 'vitest';
import { COLUMNS, LEAD, OPTIONAL, COLUMN_VIEWS, DEFAULT_COLUMN_VIEW } from '../advancedPrecalcColumns';

describe('advancedPrecalcColumns — mevcut sütunlar (taşıma sonrası davranış aynı)', () => {
  it('7 lead + 17 optional sütun taşınmış olmalı', () => {
    expect(LEAD).toHaveLength(7);
    expect(OPTIONAL.length).toBeGreaterThanOrEqual(17);
    expect(COLUMNS.length).toBe(LEAD.length + OPTIONAL.length);
  });

  it('motor hücresine bağlı sütunların engineCol alanı doğru olmalı', () => {
    const byKey = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
    expect(byKey.techSpec.engineCol).toBe('C');
    expect(byKey.qty.engineCol).toBe('F');
    expect(byKey.listPrice.engineCol).toBe('I');
    expect(byKey.priceFactor.engineCol).toBe('J');
    expect(byKey.extraFactor.engineCol).toBe('K');
    expect(byKey.transportCost.engineCol).toBe('L');
    expect(byKey.totalCost.engineCol).toBe('M');
    expect(byKey.salesPrice.engineCol).toBe('N');
    expect(byKey.machineType.engineCol).toBe('H');
    expect(byKey.label.engineCol).toBe('D');
    expect(byKey.supplier.engineCol).toBe('E');
  });

  it('view seçici "quote"/"tech"/"all" kimlikleriyle üç seçenek sunar', () => {
    expect(COLUMN_VIEWS.map((v) => v.id)).toEqual(['quote', 'tech', 'all']);
  });

  it('DEFAULT_COLUMN_VIEW mevcut view kimliklerinden biri olmalı', () => {
    expect(COLUMN_VIEWS.some((v) => v.id === DEFAULT_COLUMN_VIEW)).toBe(true);
  });
});
