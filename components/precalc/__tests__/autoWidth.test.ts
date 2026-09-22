import { describe, expect, it } from 'vitest';
import { computeAutoWidthCh, AUTO_WIDTH_MIN_CH, AUTO_WIDTH_MAX_CH } from '../autoWidth';

describe('computeAutoWidthCh', () => {
  it('boş ya da kısa metinde asgari genişliği verir', () => {
    expect(computeAutoWidthCh('')).toBe(AUTO_WIDTH_MIN_CH);
    expect(computeAutoWidthCh('PRE-01')).toBe(AUTO_WIDTH_MIN_CH);
  });

  it('asgariyi aşan metinde uzunluk + boşluk payı kadar büyür', () => {
    // 20 karakter + 2 pay = 22 (asgari 18'i aşıyor)
    expect(computeAutoWidthCh('PRE-2026-114 RE-01AB')).toBe(22);
  });

  it('azami genişliği aşmaz', () => {
    expect(computeAutoWidthCh('X'.repeat(100))).toBe(AUTO_WIDTH_MAX_CH);
  });
});
