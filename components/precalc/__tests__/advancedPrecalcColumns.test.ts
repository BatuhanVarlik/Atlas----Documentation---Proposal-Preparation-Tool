import { describe, expect, it } from 'vitest';
import workbookData from '@/lib/precalc/workbook.json';
import { COLUMNS, LEAD, OPTIONAL, COLUMN_VIEWS, DEFAULT_COLUMN_VIEW } from '../advancedPrecalcColumns';

/**
 * lib/precalc/workbook.json'daki `columns` sözlüğünden türetilir — elle
 * kopyalanmaz, böylece kaynak kitap yeni bir sütun kazanırsa bu test
 * kendiliğinden onu da bekler.
 */
const WORKBOOK_COLUMN_LETTERS = Object.keys(workbookData.columns);

/** Motor hücresine değil CatalogItem'ın türetilmiş alanlarına dayanan sütunlar. */
const NON_ENGINE_KEYS = ['row', 'standard', 'topCategory', 'subCategory', 'productType', 'discount', 'netPrice'];

describe('advancedPrecalcColumns — mevcut sütunlar (taşıma sonrası davranış aynı)', () => {
  it('7 lead + 64 optional sütun (71 toplam) olmalı', () => {
    expect(LEAD).toHaveLength(7);
    expect(OPTIONAL).toHaveLength(64);
  });

  it('motor hücresine bağlı sütunların engineCol alanı doğru olmalı', () => {
    const byKey = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
    expect(byKey.eqNo.engineCol).toBe('B');
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
    expect(byKey.placeOfUse.engineCol).toBe('A');
    expect(byKey.sparePartNo.engineCol).toBe('P');
    expect(byKey.sparePartDesc.engineCol).toBe('Q');
    expect(byKey.sparePartPrice.engineCol).toBe('R');
    expect(byKey.inletDiameter.engineCol).toBe('AY');
    expect(byKey.outletDiameter.engineCol).toBe('AZ');
    expect(byKey.connections.engineCol).toBe('BA');
  });

  it('CatalogItem türetilmiş alanlara dayanan sütunların engineCol\'u olmamalı', () => {
    const byKey = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
    for (const key of NON_ENGINE_KEYS) {
      expect(byKey[key], `${key} tanımlı olmalı`).toBeDefined();
      expect(byKey[key].engineCol, `${key}.engineCol tanımsız olmalı`).toBeUndefined();
    }
  });

  it('view seçici "quote"/"tech"/"all" kimlikleriyle üç seçenek sunar', () => {
    expect(COLUMN_VIEWS.map((v) => v.id)).toEqual(['quote', 'tech', 'all']);
  });

  it('DEFAULT_COLUMN_VIEW tam olarak "all" olmalı — sayfa Tümü görünümüyle açılır', () => {
    expect(DEFAULT_COLUMN_VIEW).toBe('all');
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
