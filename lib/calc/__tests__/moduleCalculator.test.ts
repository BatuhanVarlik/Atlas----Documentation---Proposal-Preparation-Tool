import { describe, it, expect } from 'vitest';
import { calculateModule } from '../moduleCalculator';

describe('calculateModule', () => {
  const baseModule = {
    standard: 'DIN' as const,
    fillingLines: [{ id: 'f1', capacity: 30_000 }],
    dischargeLines: [{ id: 'd1', capacity: 15_000, hasFlowMeter: false }],
  };

  it('dolum hattı daha büyük çap üretiyorsa onu seçmeli', () => {
    // Filling: 30,000 L/h @ 2 m/s → ~72.84 mm → DIN → DN80
    // Discharge: 15,000 L/h @ 1.5 m/s → ~59.47 mm → DIN → DN65
    // Max: 72.84 mm → DN80
    const result = calculateModule(baseModule);
    expect(result.selectedDN.dn).toBe('DN80');
    expect(result.maxRawDiameterMm).toBeCloseTo(72.84, 1);
  });

  it('boşaltım hattı daha büyük çap üretiyorsa onu seçmeli', () => {
    // Filling: 5,000 L/h @ 2 m/s → ~29.8 mm
    // Discharge: 20,000 L/h @ 1.5 m/s → ~68.7 mm → DN80
    const result = calculateModule({
      standard: 'DIN',
      fillingLines: [{ id: 'f1', capacity: 5_000 }],
      dischargeLines: [{ id: 'd1', capacity: 20_000, hasFlowMeter: false }],
    });
    expect(result.selectedDN.dn).toBe('DN80');
  });

  it('SMS standardında doğru çap seçilmeli', () => {
    const result = calculateModule({
      standard: 'SMS',
      fillingLines: [{ id: 'f1', capacity: 30_000 }],
      dischargeLines: [],
    });
    // 30,000 L/h @ 2 m/s → 72.84 mm → SMS: 73 (76 SMS inner) > 72.84 → 76 SMS (3")
    expect(result.selectedDN.dn).toBe('76 SMS (3")');
  });

  it('drain valve boru çapından 1 size küçük olmalı', () => {
    const result = calculateModule(baseModule);
    // selectedDN = DN80 → drain = DN65
    expect(result.drainValveSize).toBe('DN65');
  });

  it('CIP return/inlet/check valve boru çapı ile aynı olmalı', () => {
    const result = calculateModule(baseModule);
    expect(result.cipReturnSize).toBe(result.selectedDN.dn);
    expect(result.cipInletSize).toBe(result.selectedDN.dn);
    expect(result.checkValveSize).toBe(result.selectedDN.dn);
  });

  it('leakage chamber sabit 25 mm olmalı', () => {
    const result = calculateModule(baseModule);
    expect(result.leakageChamberMm).toBe(25);
  });

  it('DIN tank drain valve DN25 olmalı', () => {
    const result = calculateModule(baseModule);
    expect(result.tankDrainValveSize).toBe('DN25');
  });

  it('SMS tank drain valve 1" olmalı', () => {
    const result = calculateModule({
      standard: 'SMS',
      fillingLines: [{ id: 'f1', capacity: 10_000 }],
      dischargeLines: [],
    });
    expect(result.tankDrainValveSize).toBe('1"');
  });

  it('flow meter olmayan hatta flow meter hesabı yapılmamalı', () => {
    const result = calculateModule(baseModule);
    expect(result.flowMeterResults).toHaveLength(0);
  });

  it('flow meter olan hatta ayrı çap hesaplanmalı', () => {
    const result = calculateModule({
      standard: 'DIN',
      fillingLines: [],
      dischargeLines: [{ id: 'd1', capacity: 30_000, hasFlowMeter: true }],
    });
    expect(result.flowMeterResults).toHaveLength(1);
    expect(result.flowMeterResults[0].lineId).toBe('d1');
    // flow meter: 30,000 L/h @ 2.75 m/s → ~62.14 mm → DN65
    expect(result.flowMeterResults[0].selectedDN.dn).toBe('DN65');
  });

  it('hat yokken hata fırlatmalı', () => {
    expect(() =>
      calculateModule({ standard: 'DIN', fillingLines: [], dischargeLines: [] })
    ).toThrow();
  });

  it('birden fazla hat varsa en büyük çap seçilmeli', () => {
    const result = calculateModule({
      standard: 'DIN',
      fillingLines: [
        { id: 'f1', capacity: 5_000 },
        { id: 'f2', capacity: 20_000 },
      ],
      dischargeLines: [
        { id: 'd1', capacity: 8_000, hasFlowMeter: false },
        { id: 'd2', capacity: 12_000, hasFlowMeter: false },
      ],
    });
    // f1: ~26mm, f2: ~59.5mm filling, d1: ~43.6mm, d2: ~53.5mm discharge
    // max = f2 ~59.5 mm → DN65
    expect(result.selectedDN.dn).toBe('DN65');
    expect(result.fillingDiameters).toHaveLength(2);
    expect(result.dischargeDiameters).toHaveLength(2);
  });
});
