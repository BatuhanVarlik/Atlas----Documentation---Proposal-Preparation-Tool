import { describe, expect, it } from 'vitest';
import { nextRevisionNo, parseRevisionCode } from '../precalcNo';

describe('revizyon kodu ayrıştırma', () => {
  it('sondaki RE-00 kodunu ayırır', () => {
    expect(parseRevisionCode('PRE-2026-114 RE-00')).toEqual({
      base: 'PRE-2026-114', code: 'RE', seq: 0, full: 'RE-00',
    });
  });

  it('RS gibi başka iki harfli kodları da tanır', () => {
    expect(parseRevisionCode('2026-114 RS-12')?.code).toBe('RS');
    expect(parseRevisionCode('2026-114 RS-12')?.seq).toBe(12);
  });

  it('kod yoksa null döner', () => {
    expect(parseRevisionCode('PRE-2026-114')).toBeNull();
    expect(parseRevisionCode('')).toBeNull();
    expect(parseRevisionCode('   ')).toBeNull();
  });

  it('kodu yalnızca sonda arar — ortadaki benzer metni yakalamaz', () => {
    expect(parseRevisionCode('RE-01 PROJESI')).toBeNull();
  });

  it('araya konan boşlukları ve büyük/küçük harfi hoş görür', () => {
    expect(parseRevisionCode('PRE-114  re-03')?.full).toBe('RE-03');
    expect(parseRevisionCode('PRE-114 Re-3')?.seq).toBe(3);
  });
});

describe('sonraki revizyon numarası', () => {
  it('sıra numarasını bir artırır, iki hane korunur', () => {
    expect(nextRevisionNo('PRE-2026-114 RE-00')).toBe('PRE-2026-114 RE-01');
    expect(nextRevisionNo('PRE-2026-114 RE-09')).toBe('PRE-2026-114 RE-10');
  });

  it('kodu olmayan numaraya RE-01 ekler', () => {
    expect(nextRevisionNo('PRE-2026-114')).toBe('PRE-2026-114 RE-01');
  });

  it('iki haneyi aşan sıra numarasını kırpmaz', () => {
    expect(nextRevisionNo('PRE-114 RE-99')).toBe('PRE-114 RE-100');
  });
});
