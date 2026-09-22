import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import * as XLSX from 'xlsx-js-style';
import { applySheetSetup, injectLineChart, sheetPartName } from '../xlsxPost';

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

function chartSpec() {
  return {
    sheet: 'AYRINTI',
    title: 'HAFTA',
    catRef: 'AYRINTI!$A$2:$A$5',
    series: [{ nameRef: 'AYRINTI!$D$1', valRef: 'AYRINTI!$D$2:$D$5', colorRGB: 'ED7D31' }],
    anchor: { fromCol: 6, fromRow: 2, toCol: 18, toRow: 27 },
  };
}

describe('grafik enjeksiyonu', () => {
  it('chart ve drawing parçalarını ekler', () => {
    const zip = new PizZip(injectLineChart(sampleBook(), chartSpec()));
    expect(zip.file('xl/charts/chart1.xml')).toBeTruthy();
    expect(zip.file('xl/drawings/drawing1.xml')).toBeTruthy();
    expect(zip.file('xl/drawings/_rels/drawing1.xml.rels')).toBeTruthy();
    expect(zip.file('xl/worksheets/_rels/sheet2.xml.rels')).toBeTruthy();
  });

  it('seri hücrelere bağlıdır — değerler gömülü değil', () => {
    const xml = new PizZip(injectLineChart(sampleBook(), chartSpec()))
      .file('xl/charts/chart1.xml')!.asText();
    expect(xml).toContain('<c:f>AYRINTI!$D$2:$D$5</c:f>');
    expect(xml).toContain('<c:f>AYRINTI!$A$2:$A$5</c:f>');
    expect(xml).toContain('ED7D31');
  });

  it('sayfaya <drawing> düğümü, kapanış etiketinden hemen önce eklenir', () => {
    const xml = new PizZip(injectLineChart(sampleBook(), chartSpec()))
      .file('xl/worksheets/sheet2.xml')!.asText();
    expect(xml).toMatch(/<drawing r:id="[^"]+"\/><\/worksheet>$/);
  });

  it('içerik tipleri chart ve drawing için Override taşır', () => {
    const types = new PizZip(injectLineChart(sampleBook(), chartSpec()))
      .file('[Content_Types].xml')!.asText();
    expect(types).toContain('/xl/charts/chart1.xml');
    expect(types).toContain('drawingml.chart+xml');
    expect(types).toContain('/xl/drawings/drawing1.xml');
  });

  it('sonuç SheetJS ile geri okunabilir', () => {
    const out = injectLineChart(sampleBook(), chartSpec());
    expect(XLSX.read(out, { type: 'buffer' }).SheetNames).toEqual(['BIRINCI', 'AYRINTI']);
  });

  it('bilinmeyen sayfada dosyayı olduğu gibi döndürür', () => {
    const before = sampleBook();
    const out = injectLineChart(before, { ...chartSpec(), sheet: 'YOK' });
    expect(new PizZip(out).file('xl/charts/chart1.xml')).toBeNull();
  });
});
