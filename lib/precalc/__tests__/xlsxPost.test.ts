import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import * as XLSX from 'xlsx-js-style';
import { applySheetSetup, sheetPartName } from '../xlsxPost';

/** İki sayfalı küçük bir kitap: ikincisi düzenlenecek olan. */
function sampleBook(): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[1, 2]]), 'BIRINCI');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['a', 'b', 'c']]), 'AYRINTI');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('xlsx son işlem', () => {
  it('sayfa adından doğru XML parçasını bulur', () => {
    const zip = new PizZip(sampleBook());
    expect(sheetPartName(zip, 'BIRINCI')).toBe('xl/worksheets/sheet1.xml');
    expect(sheetPartName(zip, 'AYRINTI')).toBe('xl/worksheets/sheet2.xml');
    expect(sheetPartName(zip, 'YOK')).toBeNull();
  });

  it('A4 sığdırma düğümlerini ekler', () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'AYRINTI', a4FitToWidth: true }]);
    const xml = new PizZip(out).file('xl/worksheets/sheet2.xml')!.asText();

    expect(xml).toContain('<pageSetUpPr fitToPage="1"/>');
    expect(xml).toContain('paperSize="9"');
    expect(xml).toContain('fitToWidth="1"');
    expect(xml).toContain('fitToHeight="0"');
  });

  it('sheetPr belgenin ilk çocuğu olur — şema sırası bozulmaz', () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'AYRINTI', a4FitToWidth: true }]);
    const xml = new PizZip(out).file('xl/worksheets/sheet2.xml')!.asText();

    const openTag = xml.indexOf('<worksheet ');
    const closeOfOpen = xml.indexOf('>', openTag) + 1;
    expect(xml.slice(closeOfOpen)).toMatch(/^<sheetPr>/);
  });

  it("pageSetup sheetData'dan sonra gelir", () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'AYRINTI', a4FitToWidth: true }]);
    const xml = new PizZip(out).file('xl/worksheets/sheet2.xml')!.asText();
    expect(xml.indexOf('</sheetData>')).toBeLessThan(xml.indexOf('<pageSetup '));
  });

  it('dokunulmayan sayfayı değiştirmez ve dosya geri okunabilir kalır', () => {
    const before = sampleBook();
    const out = applySheetSetup(before, [{ sheet: 'AYRINTI', a4FitToWidth: true }]);

    expect(new PizZip(out).file('xl/worksheets/sheet1.xml')!.asText())
      .toBe(new PizZip(before).file('xl/worksheets/sheet1.xml')!.asText());
    expect(XLSX.read(out, { type: 'buffer' }).SheetNames).toEqual(['BIRINCI', 'AYRINTI']);
  });

  it('bilinmeyen sayfa adı sessizce atlanır', () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'YOK', a4FitToWidth: true }]);
    expect(XLSX.read(out, { type: 'buffer' }).SheetNames).toEqual(['BIRINCI', 'AYRINTI']);
  });
});
