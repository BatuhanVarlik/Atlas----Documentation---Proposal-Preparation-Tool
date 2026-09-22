import { describe, expect, it } from 'vitest';
import { computeThumbRect } from '../HScrollControl';

describe('computeThumbRect', () => {
  it('taşma yoksa thumb tüm track\'i kaplar', () => {
    expect(computeThumbRect({ scrollLeft: 0, scrollWidth: 800, clientWidth: 800 }))
      .toEqual({ left: 0, width: 1 });
  });

  it('en solda scrollLeft=0 iken thumb solda başlar', () => {
    const r = computeThumbRect({ scrollLeft: 0, scrollWidth: 2000, clientWidth: 500 });
    expect(r.left).toBe(0);
    expect(r.width).toBeCloseTo(500 / 2000, 5);
  });

  it('en sağda (scrollLeft = scrollWidth - clientWidth) thumb sağa yaslanır', () => {
    const r = computeThumbRect({ scrollLeft: 1500, scrollWidth: 2000, clientWidth: 500 });
    expect(r.left + r.width).toBeCloseTo(1, 5);
  });

  it('ortada (%50) thumb da track\'in ortasına yakın olur', () => {
    const r = computeThumbRect({ scrollLeft: 750, scrollWidth: 2000, clientWidth: 500 });
    const maxLeft = 1 - r.width;
    expect(r.left).toBeCloseTo(maxLeft * 0.5, 5);
  });

  it('çok dar içerikte thumb en az %8 genişlikte kalır (görünür olsun diye)', () => {
    const r = computeThumbRect({ scrollLeft: 0, scrollWidth: 100000, clientWidth: 500 });
    expect(r.width).toBeGreaterThanOrEqual(0.08);
  });
});
