import { describe, expect, it } from 'vitest';
import { IDENTITY_FIELDS } from '../identityFields';
import workbookData from '@/lib/precalc/workbook.json';
import type { PrecalcWorkbook } from '@/lib/precalc/types';

const workbook = workbookData as unknown as PrecalcWorkbook;

describe('kimlik şeridi alanları', () => {
  it('altı alanı bu sırayla taşır', () => {
    expect(IDENTITY_FIELDS.map((f) => f.key)).toEqual([
      'projectNo', 'precalcNo', 'customer', 'endUser', 'date', 'preparedBy',
    ]);
  });

  it('her alanın karşılığı çalışma kitabının params listesinde vardır', () => {
    const known = new Set(workbook.params.map((p) => p.key));
    for (const f of IDENTITY_FIELDS) expect(known).toContain(f.key);
  });

  it('tarih alanı date biçiminde, kalanı metin', () => {
    const byKey = new Map(IDENTITY_FIELDS.map((f) => [f.key, f]));
    expect(byKey.get('date')?.format).toBe('date');
    expect(byKey.get('customer')?.format).toBe('text');
  });
});
