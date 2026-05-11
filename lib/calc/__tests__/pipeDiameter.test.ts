import { describe, it, expect } from 'vitest';
import { calculatePipeDiameter } from '../pipeDiameter';

describe('calculatePipeDiameter', () => {
  it('dolum hattı: 30,000 L/h, V=2 m/s', () => {
    const result = calculatePipeDiameter({ capacityLh: 30_000, velocity: 2.0 });
    // Q = 30 m³/h = 0.00833 m³/s, D = sqrt(4*0.00833/(π*2)) ≈ 0.07284 m = 72.84 mm
    expect(result.diameterMm).toBeCloseTo(72.84, 1);
    expect(result.flowM3h).toBe(30);
    expect(result.flowM3s).toBeCloseTo(0.008333, 5);
  });

  it('boşaltım hattı: 15,000 L/h, V=1.5 m/s', () => {
    const result = calculatePipeDiameter({ capacityLh: 15_000, velocity: 1.5 });
    // Q = 15 m³/h = 0.004167 m³/s, D = sqrt(4*0.004167/(π*1.5)) ≈ 0.05947 m = 59.47 mm
    expect(result.diameterMm).toBeCloseTo(59.47, 1);
  });

  it('flow meter: 30,000 L/h, V=2.75 m/s', () => {
    const result = calculatePipeDiameter({ capacityLh: 30_000, velocity: 2.75 });
    expect(result.diameterMm).toBeCloseTo(62.14, 1);
  });

  it('çok küçük kapasite: 1,000 L/h, V=2 m/s', () => {
    const result = calculatePipeDiameter({ capacityLh: 1_000, velocity: 2.0 });
    expect(result.diameterMm).toBeGreaterThan(0);
    expect(result.diameterMm).toBeLessThan(30);
  });

  it('ara değerleri doğru döndürür', () => {
    const result = calculatePipeDiameter({ capacityLh: 3_600, velocity: 1.0 });
    // Q = 3.6 m³/h = 0.001 m³/s
    expect(result.flowM3h).toBe(3.6);
    expect(result.flowM3s).toBeCloseTo(0.001, 6);
  });
});
