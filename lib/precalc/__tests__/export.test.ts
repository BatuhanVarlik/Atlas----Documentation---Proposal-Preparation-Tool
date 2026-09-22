import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { buildPrecalcWorkbook, buildSheetSnapshot, precalcFileName } from '../export';
import { PrecalcEngine } from '../engine';
import type { PrecalcEntries, PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

/** Bir kaleme adet + liste fiyatı girilmiş küçük bir teklif. */
function quoteEntries(): PrecalcEntries {
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  return {
    ['PRECALCULATION!F' + item.r]: 10,
    ['PRECALCULATION!I' + item.r]: 1000,
    'PRECALCULATION!B4': 'PRE-TEST RE-00',
  };
}

describe('precalculation dışa aktarımı', () => {
  it('ÖZET ilk sırada, EQUIPMENT LIST ve limitler dışarıda', () => {
    const { book } = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });

    expect(book.SheetNames[0]).toBe('ÖZET');
    expect(book.SheetNames[1]).toBe('CASHFLOW');
    expect(book.SheetNames).not.toContain('EQUIPMENT LIST');
    expect(book.SheetNames).not.toContain('Ekipman Listesi Limitleri');
    expect(book.SheetNames).toContain('Sevk Listesi');
  });

  it('kitabın kalan sayfalarını da taşır', () => {
    const { book } = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    for (const name of ['KABLO', 'SMS PASLANMAZ', 'DIN PASLANMAZ MALZEME',
      'INTEGRATOR PANOSU', 'KONTROL ODASI OLUSTURMA']) {
      expect(book.SheetNames).toContain(name);
    }
  });

  it('Excel’in 31 karakter sınırını aşan sayfa adı kısaltılır', () => {
    const { book } = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    for (const name of book.SheetNames) expect(name.length).toBeLessThanOrEqual(31);
  });

  it('PRECALCULATION sayfası başlık bloğu ve sütun şeridiyle başlar', () => {
    const { book } = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    const sheet = book.Sheets['PRECALCULATION'];
    expect(sheet['A2']?.v).toBe('CUSTOMER:');
    expect(sheet['D3']?.v).toBe('PRECALCULATION NO:');
    expect(sheet['E3']?.v).toBe('PRE-TEST RE-00');
  });

  it('yazılıp geri okunabilir bir kitap üretir', () => {
    const { book } = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(buffer.length).toBeGreaterThan(1000);
    expect(XLSX.read(buffer, { type: 'buffer' }).SheetNames).toContain('ÖZET');
  });

  it('buildSheetSnapshot bilinmeyen sayfada null döner', () => {
    const engine = new PrecalcEngine(workbook);
    engine.settle();
    expect(buildSheetSnapshot(engine, 'YOK BÖYLE BİR SAYFA')).toBeNull();
    expect(buildSheetSnapshot(engine, 'KABLO')).not.toBeNull();
  });

  it('ÖZET sayfasına revizyon geçmişi yazar', () => {
    const { book } = buildPrecalcWorkbook(workbook, quoteEntries(), {
      onlyEntered: true,
      revisions: [
        { code: 'RE-00', note: 'İlk sürüm.', author: 'A', date: '30.08.2026' },
        { code: 'RE-01', note: '5 Adet vana eklendi.', author: 'B', date: '31.08.2026' },
      ],
    });

    const cells = Object.values(book.Sheets['ÖZET'])
      .filter((c): c is { v: unknown } => !!c && typeof c === 'object' && 'v' in c)
      .map((c) => String(c.v));

    expect(cells).toContain('REVİZYON GEÇMİŞİ');
    expect(cells).toContain('RE-01');
    expect(cells).toContain('5 Adet vana eklendi.');
    // En yeni üstte.
    expect(cells.indexOf('RE-01')).toBeLessThan(cells.indexOf('RE-00'));
  });

  it('revizyon yoksa ÖZET blok başlığını hiç yazmaz', () => {
    const { book } = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    const cells = Object.values(book.Sheets['ÖZET'])
      .filter((c): c is { v: unknown } => !!c && typeof c === 'object' && 'v' in c)
      .map((c) => String(c.v));
    expect(cells).not.toContain('REVİZYON GEÇMİŞİ');
  });

  describe('dosya adı', () => {
    it('numara yoksa eski biçimi korur', () => {
      expect(precalcFileName()).toMatch(/^PRECALCULATION \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.xlsx$/);
    });

    it('numara verilirse dosya adı numarayla başlar', () => {
      expect(precalcFileName('PRE-2026-114 RE-01'))
        .toMatch(/^PRE-2026-114 RE-01 \d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it("Windows'ta yasak karakterleri alt çizgiye çevirir", () => {
      const name = precalcFileName('PRE/2026:114*RE?01');
      expect(name).toMatch(/^PRE_2026_114_RE_01 /);
      expect(name).not.toMatch(/[\\/:*?"<>|]/);
    });

    it('boş ya da yalnızca boşluktan oluşan numarayı yok sayar', () => {
      expect(precalcFileName('   ')).toMatch(/^PRECALCULATION /);
    });
  });
});
