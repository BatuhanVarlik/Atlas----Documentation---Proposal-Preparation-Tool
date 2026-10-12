import { describe, expect, it } from 'vitest';
import { fontStyleOf, xlFontProps } from '../fontStyle';
import workbook from '../workbook.json';
import type { PrecalcWorkbook } from '../types';

const wb = {
  fontStyles: {
    palette: [{ c: 'FF0000', b: 1 as const }, { i: 1 as const }],
    cells: { S: { A1: 0, B2: 1 } },
  },
};

describe('fontStyleOf', () => {
  it('kayıtlı hücrenin biçimini döndürür', () => {
    expect(fontStyleOf(wb, 'S', 'A1')).toEqual({ c: 'FF0000', b: 1 });
  });
  it('kaydı olmayan hücre / sayfa / kitap için null', () => {
    expect(fontStyleOf(wb, 'S', 'Z9')).toBeNull();
    expect(fontStyleOf(wb, 'YOK', 'A1')).toBeNull();
    expect(fontStyleOf({}, 'S', 'A1')).toBeNull();
    expect(fontStyleOf(null, 'S', 'A1')).toBeNull();
  });
  it('gerçek şablon: ürün tipi başlığı kırmızı-kalın, tarih sütunu kırmızı', () => {
    const real = workbook as unknown as PrecalcWorkbook;
    expect(fontStyleOf(real, 'PRECALCULATION', 'A13')).toEqual({ c: 'FF0000', b: 1 });
    expect(fontStyleOf(real, 'PRECALCULATION', 'A11')).toEqual({ b: 1 });
  });
});

describe('xlFontProps', () => {
  it('renk + kalın → sınıflar ve CSS değişkeni', () => {
    const p = xlFontProps({ c: 'FF0000', b: 1 });
    expect(p.className).toBe('xl-c xl-b');
    expect(p.style).toEqual({ '--xl-c': '#FF0000' });
  });
  it('yalnız italik → stil yok', () => {
    expect(xlFontProps({ i: 1 })).toEqual({ className: 'xl-i', style: undefined });
  });
  it('null → boş', () => {
    expect(xlFontProps(null)).toEqual({ className: '', style: undefined });
  });
});
