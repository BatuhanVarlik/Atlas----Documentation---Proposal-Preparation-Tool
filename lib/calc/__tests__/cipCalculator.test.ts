import { describe, it, expect } from 'vitest';
import {
  calculateCipLine,
  calculateCipModule,
  velocityForLineKind,
} from '../cipCalculator';

describe('velocityForLineKind', () => {
  it('discharge hattı 1.5 m/s olmalı', () => {
    expect(velocityForLineKind('DISCHARGE')).toBe(1.5);
  });
  it('return hattı 2.0 m/s olmalı', () => {
    expect(velocityForLineKind('RETURN')).toBe(2.0);
  });
});

describe('calculateCipLine', () => {
  it('discharge 20000 L/h @1.5 → ~68.67 mm → DIN DN80', () => {
    const r = calculateCipLine(20000, 'DISCHARGE', 'DIN');
    expect(r.rawDiameterMm).toBeCloseTo(68.67, 1);
    expect(r.selectedDN?.dn).toBe('DN80');
  });

  it('return 20000 L/h @2.0 → ~59.47 mm → DIN DN65', () => {
    const r = calculateCipLine(20000, 'RETURN', 'DIN');
    expect(r.rawDiameterMm).toBeCloseTo(59.47, 1);
    expect(r.selectedDN?.dn).toBe('DN65');
  });

  it('aynı kapasitede discharge, return\'den büyük çap üretmeli (düşük hız)', () => {
    const d = calculateCipLine(20000, 'DISCHARGE', 'DIN');
    const rl = calculateCipLine(20000, 'RETURN', 'DIN');
    expect(d.rawDiameterMm).toBeGreaterThan(rl.rawDiameterMm);
  });

  it('SMS standardında doğru çap seçilmeli', () => {
    // 20000 L/h discharge → 68.67 mm → SMS inner≥68.67 → 76 SMS (inner 73)
    const r = calculateCipLine(20000, 'DISCHARGE', 'SMS');
    expect(r.selectedDN?.dn).toBe('76 SMS (3")');
  });

  it('tabloyu aşan kapasitede selectedDN null dönmeli', () => {
    const r = calculateCipLine(5_000_000, 'DISCHARGE', 'DIN');
    expect(r.selectedDN).toBeNull();
    expect(r.rawDiameterMm).toBeGreaterThan(1000);
  });
});

describe('calculateCipModule', () => {
  it('en büyük ham çaptan modül DN\'i seçilmeli (discharge > return)', () => {
    const result = calculateCipModule({
      standard: 'DIN',
      lines: [
        { id: 'dl1', lineKind: 'DISCHARGE', capacityLh: 20000 },
        { id: 'rl1', lineKind: 'RETURN', capacityLh: 20000 },
      ],
    });
    expect(result.lineResults).toHaveLength(2);
    expect(result.maxRawDiameterMm).toBeCloseTo(68.67, 1);
    expect(result.selectedDN?.dn).toBe('DN80');
  });

  it('kapasitesi 0 olan hatlar hesaba katılmamalı', () => {
    const result = calculateCipModule({
      standard: 'DIN',
      lines: [
        { id: 'dl1', lineKind: 'DISCHARGE', capacityLh: 0 },
        { id: 'rl1', lineKind: 'RETURN', capacityLh: 20000 },
      ],
    });
    expect(result.lineResults).toHaveLength(1);
    expect(result.lineResults[0].lineId).toBe('rl1');
    expect(result.selectedDN?.dn).toBe('DN65');
  });

  it('hat yokken selectedDN null olmalı', () => {
    const result = calculateCipModule({ standard: 'DIN', lines: [] });
    expect(result.lineResults).toHaveLength(0);
    expect(result.maxRawDiameterMm).toBeNull();
    expect(result.selectedDN).toBeNull();
  });
});
