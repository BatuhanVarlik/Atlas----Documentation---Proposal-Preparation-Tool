import { describe, it, expect } from 'vitest';
import { selectDN, getDrainValveSize, getTankDrainValveSize } from '../selectDN';

describe('selectDN', () => {
  describe('DIN standardı', () => {
    it('47 mm için DN50 seçilmeli', () => {
      const result = selectDN(47, 'DIN');
      expect(result.dn).toBe('DN50');
      expect(result.inner).toBe(50);
    });

    it('tam eşit: 50 mm için DN50 seçilmeli', () => {
      const result = selectDN(50, 'DIN');
      expect(result.dn).toBe('DN50');
    });

    it('50.1 mm için DN65 seçilmeli', () => {
      const result = selectDN(50.1, 'DIN');
      expect(result.dn).toBe('DN65');
    });

    it('en küçük için DN25 seçilmeli', () => {
      const result = selectDN(1, 'DIN');
      expect(result.dn).toBe('DN25');
    });

    it('72.84 mm için DN80 seçilmeli (30,000 L/h hesabı)', () => {
      const result = selectDN(72.84, 'DIN');
      expect(result.dn).toBe('DN80');
    });

    it('tabloyu aşan değerde hata fırlatmalı', () => {
      expect(() => selectDN(200, 'DIN')).toThrow();
    });
  });

  describe('SMS standardı', () => {
    it('47 mm için 51 SMS seçilmeli', () => {
      const result = selectDN(47, 'SMS');
      expect(result.dn).toBe('51 SMS (2")');
      expect(result.inner).toBe(48.5);
    });

    it('tam eşit: 48.5 mm için 51 SMS seçilmeli', () => {
      const result = selectDN(48.5, 'SMS');
      expect(result.dn).toBe('51 SMS (2")');
    });

    it('60.6 mm için 76 SMS seçilmeli (60.5 inner aşıldı)', () => {
      // 63 SMS iç çapı 60.5 mm — 60.6 > 60.5 olduğu için bir üst size seçilir
      const result = selectDN(60.6, 'SMS');
      expect(result.dn).toBe('76 SMS (3")');
    });

    it('tabloyu aşan değerde hata fırlatmalı', () => {
      expect(() => selectDN(200, 'SMS')).toThrow();
    });
  });
});

describe('getDrainValveSize', () => {
  it('DIN: DN50 → DN40', () => {
    expect(getDrainValveSize('DN50', 'DIN')).toBe('DN40');
  });

  it('DIN: DN80 → DN65', () => {
    expect(getDrainValveSize('DN80', 'DIN')).toBe('DN65');
  });

  it('DIN: DN25 (en küçük) → DN25 kalır', () => {
    expect(getDrainValveSize('DN25', 'DIN')).toBe('DN25');
  });

  it('SMS: 51 SMS (2") → 38 SMS (1"1/2)', () => {
    expect(getDrainValveSize('51 SMS (2")', 'SMS')).toBe('38 SMS (1"1/2)');
  });

  it('SMS: 25 SMS (en küçük) → 25 SMS kalır', () => {
    expect(getDrainValveSize('25 SMS (1")', 'SMS')).toBe('25 SMS (1")');
  });
});

describe('getTankDrainValveSize', () => {
  it('SMS → 1"', () => {
    expect(getTankDrainValveSize('SMS')).toBe('1"');
  });

  it('DIN → DN25', () => {
    expect(getTankDrainValveSize('DIN')).toBe('DN25');
  });
});
