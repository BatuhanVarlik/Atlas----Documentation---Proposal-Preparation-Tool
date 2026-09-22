import { describe, expect, it } from 'vitest';
import { diffEntries, formatRevision } from '../revisionDiff';
import type { PrecalcEntries, PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;
const ITEM = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!.r;
const { subtotalRow } = workbook.meta.anchors;

const K = (addr: string) => 'PRECALCULATION!' + addr;

describe('girdi farkı', () => {
  it('değişiklik yoksa boş liste döner', () => {
    const e: PrecalcEntries = { [K('F' + ITEM)]: 5 };
    expect(diffEntries(e, e)).toEqual([]);
  });

  it('adet 0’dan yukarı çıkınca "eklendi" der', () => {
    const [c] = diffEntries({}, { [K('F' + ITEM)]: 5 });
    expect(c.kind).toBe('added');
    expect(c.text).toMatch(/^5 Adet /);
    expect(c.text).toMatch(/ eklendi$/);
  });

  it('adet sıfırlanınca "çıkarıldı" der', () => {
    const [c] = diffEntries({ [K('F' + ITEM)]: 2 }, { [K('F' + ITEM)]: 0 });
    expect(c.kind).toBe('removed');
    expect(c.text).toMatch(/^2 Adet /);
    expect(c.text).toMatch(/ çıkarıldı$/);
  });

  it('adet değişimini eski → yeni olarak yazar', () => {
    const [c] = diffEntries({ [K('F' + ITEM)]: 3 }, { [K('F' + ITEM)]: 5 });
    expect(c.kind).toBe('qty');
    expect(c.text).toMatch(/adedi 3 → 5 oldu$/);
  });

  it('liste fiyatı değişimini para biçiminde yazar', () => {
    const [c] = diffEntries({ [K('I' + ITEM)]: 1200 }, { [K('I' + ITEM)]: 1350 });
    expect(c.kind).toBe('price');
    expect(c.text).toContain('1.200,00 → 1.350,00');
  });

  it('kâr çarpanı değişimini adıyla yazar', () => {
    const addr = workbook.params.find((p) => p.key === 'profitMultiplier')!.addr;
    const [c] = diffEntries({ [K(addr)]: 0.7 }, { [K(addr)]: 0.85 });
    expect(c.kind).toBe('param');
    expect(c.text).toBe('Kâr Oranı 0,70 → 0,85 olarak güncellendi');
  });

  it('genel gider satırını adıyla tanır', () => {
    const risk = 'F' + (subtotalRow + 8);   // RISK satırı
    const [c] = diffEntries({ [K(risk)]: 1 }, { [K(risk)]: 0 });
    expect(c.kind).toBe('overhead');
    expect(c.text).toContain('Risk');
  });

  it('kimlik alanı değişimini tırnaklı yazar', () => {
    const [c] = diffEntries({ [K('B1')]: 'X A.Ş.' }, { [K('B1')]: 'Y A.Ş.' });
    expect(c.kind).toBe('identity');
    expect(c.text).toBe('Müşteri "X A.Ş." → "Y A.Ş." olarak güncellendi');
  });

  it('değişiklikleri kitaptaki satır sırasına göre verir', () => {
    const a = workbook.outline.filter((r) => r.kind === 'item').slice(0, 3).map((r) => r.r);
    const after = Object.fromEntries(a.map((r) => [K('F' + r), 1]));
    const rows = diffEntries({}, after).map((c) => Number(/(\d+)$/.exec(c.addr)![1]));
    expect([...rows].sort((x, y) => x - y)).toEqual(rows);
  });
});

describe('revizyon metni', () => {
  const change = (text: string) => ({
    kind: 'qty' as const, addr: 'F1', label: 'X', before: 1, after: 2, text,
  });

  it('kod, değişiklikler, yazar ve tarihi noktalı virgülle ayırır', () => {
    const out = formatRevision([change('A eklendi'), change('B güncellendi')], {
      code: 'RE-01',
      author: 'Süleyman Altındal',
      date: new Date(2026, 7, 31),
    });
    expect(out).toBe('RE-01 : A eklendi, B güncellendi. ; Süleyman Altındal ; 31.08.2026');
  });

  it('sınırı aşan değişiklikleri sayıya indirir', () => {
    const many = Array.from({ length: 34 }, (_, i) => change('değişiklik ' + i));
    const out = formatRevision(many, {
      code: 'RE-02', author: 'A', date: new Date(2026, 7, 31), limit: 20,
    });
    expect(out).toContain('…ve 14 değişiklik daha');
    expect(out.split(', ').length).toBe(21);
  });

  it('değişiklik yoksa bunu açıkça söyler', () => {
    const out = formatRevision([], { code: 'RE-03', author: 'A', date: new Date(2026, 7, 31) });
    expect(out).toContain('değişiklik kaydedilmedi');
  });
});
