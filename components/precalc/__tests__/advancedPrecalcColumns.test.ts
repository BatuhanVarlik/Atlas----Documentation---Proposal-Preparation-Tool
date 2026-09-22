import { describe, expect, it } from 'vitest';
import { COLUMNS, LEAD, OPTIONAL, COLUMN_VIEWS, DEFAULT_COLUMN_VIEW } from '../advancedPrecalcColumns';

/** lib/precalc/workbook.json → columns anahtarlarının tamamı (A–BO). */
const WORKBOOK_COLUMN_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
  'P', 'Q', 'R', 'S', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC',
  'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO',
  'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA',
  'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM',
  'BN', 'BO',
];

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

describe('advancedPrecalcColumns — tam sütun kapsamı', () => {
  it('workbook.json\'daki her sütun harfi COLUMNS\'ta bir engineCol karşılığı bulur', () => {
    const covered = new Set(COLUMNS.map((c) => c.engineCol).filter(Boolean));
    const missing = WORKBOOK_COLUMN_LETTERS.filter((letter) => !covered.has(letter));
    expect(missing).toEqual([]);
  });

  it('71 sütun tanımlı olmalı (26 mevcut + 45 yeni teknik/lojistik sütun)', () => {
    expect(COLUMNS).toHaveLength(71);
  });

  it('"tech" görünümü yeni teknik sütunlardan en az birini içerir', () => {
    const tech = COLUMN_VIEWS.find((v) => v.id === 'tech')!;
    expect(tech.cols).toContain('capacity');
    expect(tech.cols).toContain('motorKw');
  });
});
