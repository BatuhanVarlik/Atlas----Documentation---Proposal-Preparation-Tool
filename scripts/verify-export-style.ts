/**
 * Üretilen precalculation dosyasının biçimlendirmesini denetler.
 *
 * `npm run precalc:export-style`
 *
 * Dosyayı gerçekten yazar ve içindeki `xl/styles.xml`e bakar. Denetim
 * oradan yapılır çünkü XLSX.read geri okurken stilin yalnızca dolgu
 * kısmını yüzeye çıkarıyor — yazı tipi ve sayı biçimi dosyada durduğu
 * hâlde okuma tarafında görünmüyor, bu da yanlış alarma yol açıyor.
 *
 * SheetJS'in topluluk sürümü (`xlsx`) yazarken stilleri sessizce
 * düşürdüğü için bu denetim, biçimlendirmenin çıktıda gerçekten olduğunu
 * doğrulayan tek yer.
 */

import PizZip from 'pizzip';
import * as XLSX from 'xlsx-js-style';
import { buildPrecalcWorkbook, DETAILED_SHEET } from '../lib/precalc/export';
import { PrecalcEngine } from '../lib/precalc/engine';
import type { PrecalcEntries, PrecalcWorkbook } from '../lib/precalc/types';
import workbookData from '../lib/precalc/workbook.json';

const wb = workbookData as unknown as PrecalcWorkbook;

/** Birkaç kaleme miktar girip gerçekçi bir teklif üretir. */
function sampleEntries(): PrecalcEntries {
  const engine = new PrecalcEngine(wb);
  const entries: PrecalcEntries = {};
  let taken = 0;
  for (const row of wb.outline) {
    if (row.kind !== 'item' || taken >= 25) continue;
    // Fiyatı olan, formülle bağlanmamış kalemleri seç.
    if (engine.num('I' + row.r) <= 0) continue;
    if (engine.hasFormula('F' + row.r)) continue;
    entries['PRECALCULATION!F' + row.r] = 2;
    taken++;
  }
  return entries;
}

const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '  ok  ' : ' HATA '} ${what}`);
  if (!ok) problems.push(what);
};

const entries = sampleEntries();
console.log(`Girdi: ${Object.keys(entries).length} kalem\n`);

const book = buildPrecalcWorkbook(wb, entries, { onlyEntered: true });
const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
console.log(`Dosya: ${(buffer.length / 1024).toFixed(0)} KB`);
console.log(`Sayfalar: ${book.SheetNames.join(' · ')}\n`);

/* ---- Sayfalar ---- */
for (const name of ['PRECALCULATION', 'EQUIPMENT LIST', 'Sevk Listesi', DETAILED_SHEET, 'ÖZET']) {
  check(book.SheetNames.includes(name), `${name} sayfası var`);
}

/* ---- Bellekteki stiller ---- */
function styleStats(sheet: XLSX.WorkSheet) {
  const s = { cells: 0, styled: 0, filled: 0, bold: 0, numFmt: 0, bordered: 0 };
  for (const [addr, cell] of Object.entries(sheet)) {
    if (addr.startsWith('!')) continue;
    s.cells++;
    const st = (cell as XLSX.CellObject).s;
    if (!st) continue;
    s.styled++;
    if (st.fill?.fgColor?.rgb) s.filled++;
    if (st.font?.bold) s.bold++;
    if (st.numFmt) s.numFmt++;
    if (st.border) s.bordered++;
  }
  return s;
}

console.log('');
const main = styleStats(book.Sheets['PRECALCULATION']);
console.log(`PRECALCULATION: ${JSON.stringify(main)}`);
check(main.styled === main.cells, 'her hücrede stil var');
check(main.filled > 20, 'dolgu rengi uygulanmış hücreler var');
check(main.bold > 10, 'kalın yazılı hücreler var');
check(main.numFmt > 20, 'sayı biçimi verilmiş hücreler var');
check(main.bordered > 100, 'kenarlıklı hücreler var');

const detail = styleStats(book.Sheets[DETAILED_SHEET]);
console.log(`${DETAILED_SHEET}: ${JSON.stringify(detail)}`);
check(detail.styled === detail.cells, `${DETAILED_SHEET} hücrelerinde stil var`);
check(detail.filled > 5, `${DETAILED_SHEET} dolgu renkleri var`);

/* ---- Yinelemeli hesap sabitlendi mi ---- */
// settle() çağrılmazsa AYRINTILI FIYATLANDIRMA'daki genel gider dağıtımı
// #DIV/0! veriyor; hata hücresi kalmadığını burada doğruluyoruz.
console.log('');
let errorCells = 0;
for (const [addr, cell] of Object.entries(book.Sheets[DETAILED_SHEET])) {
  if (addr.startsWith('!')) continue;
  const v = (cell as XLSX.CellObject).v;
  if (typeof v === 'string' && v.startsWith('#')) errorCells++;
}
console.log(`${DETAILED_SHEET} hata hücresi: ${errorCells}`);
check(errorCells === 0, `${DETAILED_SHEET} sayfasında #DIV/0! benzeri hata yok`);

/* ---- Sayfa düzeni ---- */
console.log('');
const sheet = book.Sheets['PRECALCULATION'];
check(!!sheet['!autofilter'], 'başlık şeridinde süzgeç var');
check(!!sheet['!freeze'], 'başlık satırı donduruldu');
check(Array.isArray(sheet['!rows']) && sheet['!rows'].length > 5, 'satır yükseklikleri yazılmış');
check(Array.isArray(sheet['!cols']) && sheet['!cols'].length > 20, 'sütun genişlikleri yazılmış');

/* ---- Dosyaya gerçekten yazıldı mı ---- */
console.log('');
const styles = new PizZip(buffer).file('xl/styles.xml')?.asText() ?? '';
const count = (tag: string) => (styles.match(new RegExp(`<${tag}[ />]`, 'g')) ?? []).length;
const fonts = count('font');
const fills = count('patternFill');
const numFmts = count('numFmt');
const borders = count('border');
console.log(`styles.xml — font: ${fonts} · dolgu: ${fills} · sayı biçimi: ${numFmts} · kenarlık: ${borders}`);
check(fonts > 10, 'styles.xml içinde yazı tipleri var');
check(fills > 10, 'styles.xml içinde dolgular var');
check(numFmts > 5, 'styles.xml içinde sayı biçimleri var');
check(borders > 10, 'styles.xml içinde kenarlıklar var');

if (problems.length) {
  console.error(`\n${problems.length} sorun bulundu.`);
  process.exit(1);
}
console.log('\nTüm denetimler geçti.');
