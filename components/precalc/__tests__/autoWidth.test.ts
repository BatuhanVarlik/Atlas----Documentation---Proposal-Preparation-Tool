import { describe, expect, it } from 'vitest';
import { computeAutoWidthCh, AUTO_WIDTH_MIN_CH, AUTO_WIDTH_MAX_CH } from '../autoWidth';

describe('computeAutoWidthCh', () => {
  it('boş ya da kısa metinde asgari genişliği verir', () => {
    expect(computeAutoWidthCh('')).toBe(AUTO_WIDTH_MIN_CH);
    expect(computeAutoWidthCh('PRE-01')).toBe(AUTO_WIDTH_MIN_CH);
  });

  it('asgariyi aşan metinde büyük harf payıyla büyür', () => {
    // 35 karakter × 1,15 = 40,25 → 41 + 2 pay = 43 (asgari 30'u aşıyor)
    expect(computeAutoWidthCh('HEM-550202-2608-RS03 P1 PASTEURISER')).toBe(43);
  });

  it('azami genişliği aşmaz', () => {
    expect(computeAutoWidthCh('X'.repeat(100))).toBe(AUTO_WIDTH_MAX_CH);
  });
});
