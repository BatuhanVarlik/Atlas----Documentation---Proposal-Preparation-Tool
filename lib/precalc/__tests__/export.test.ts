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
  it('beklenen sayfaları üretir', () => {
    const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    expect(book.SheetNames).toEqual([
      'PRECALCULATION', 'EQUIPMENT LIST', 'Sevk Listesi',
      'AYRINTILI FIYATLANDIRMA', 'ÖZET',
    ]);
  });

  it('PRECALCULATION sayfası başlık bloğu ve sütun şeridiyle başlar', () => {
    const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    const sheet = book.Sheets['PRECALCULATION'];
    expect(sheet['A2']?.v).toBe('CUSTOMER:');
    expect(sheet['D3']?.v).toBe('PRECALCULATION NO:');
    expect(sheet['E3']?.v).toBe('PRE-TEST RE-00');
  });

  it('yazılıp geri okunabilir bir kitap üretir', () => {
    const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
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

  it('dosya adı .xlsx ile biter', () => {
    expect(precalcFileName()).toMatch(/^PRECALCULATION .+\.xlsx$/);
  });
});
