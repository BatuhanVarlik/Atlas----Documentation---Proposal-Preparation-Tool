/**
 * PUMPS akışı: boş şablon satırına teknik açıklama yazınca Excel'in türettiği
 * alanlar (ekipman kodu, motor kW, çarpan) doğru geliyor mu?
 *
 * Kullanım: npx tsx scripts/smoke-pumps.ts
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { PrecalcEngine } from '../lib/precalc/engine';
import { buildPrecalcWorkbook } from '../lib/precalc/export';
import { getCatalogDataset, isBlankTemplate } from '../lib/precalc/catalog';
import type { PrecalcWorkbook } from '../lib/precalc/types';

const wb: PrecalcWorkbook = JSON.parse(fs.readFileSync('lib/precalc/workbook.json', 'utf8'));
const engine = new PrecalcEngine(wb);
const items = getCatalogDataset().items;

let failed = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = typeof got === 'number' && typeof want === 'number'
    ? Math.abs(got - want) < 0.005
    : String(got) === String(want);
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(44)} beklenen=${JSON.stringify(want)}  bulunan=${JSON.stringify(got)}`);
}

/* ------------------------------------------------------------------ */
console.log('\n=== 1) Boş şablon satırları tespit ediliyor ===');
const blanks = items.filter(isBlankTemplate);
const pumpBlanks = blanks.filter((i) => i.topCategory === 'PUMPS');
console.log(`  Toplam boş şablon satırı : ${blanks.length}`);
console.log(`  PUMPS altında            : ${pumpBlanks.length}`);
if (pumpBlanks.length === 0) { failed++; console.log('  ✗ PUMPS altında boş satır bulunamadı!'); }

const target = pumpBlanks[0];
console.log(`  Test satırı              : ${target.row} (${target.subCategory})`);
eq('Açık tanım sütunları', target.open, 'CDEH');

/* ------------------------------------------------------------------ */
console.log('\n=== 2) Mühendisin girdiği alanlar ===');
const R = target.row;
const SPEC = 'W+55/35, 7,5 kW, Ø210 mm Impeller, Double Mech. Seal';

engine.setCell('PRECALCULATION', 'C' + R, SPEC);
engine.setCell('PRECALCULATION', 'D' + R, 'APV');
engine.setCell('PRECALCULATION', 'E' + R, 'ITT FLOW');
engine.setCell('PRECALCULATION', 'H' + R, 'Centrifugal Pump');
engine.setCell('PRECALCULATION', 'I' + R, 4500);
engine.setCell('PRECALCULATION', 'F' + R, 2);
console.log(`  C${R} = "${SPEC}"`);
console.log(`  D${R} = "APV"   I${R} = 4500   F${R} = 2`);

/* ------------------------------------------------------------------ */
console.log('\n=== 3) Excel türetmeleri ===');
// B = UPPER(MID(C,1,26)) & (" WF" eğer "Double Mech." geçiyorsa)
// Türkçe yerel ayar: "Impeller" -> "İMPELLER"
eq(`B${R} ekipman kodu`, engine.text('B' + R), SPEC.slice(0, 26).toLocaleUpperCase('tr-TR') + ' WF');
// AE = F × (C metnindeki kW değeri) = 2 × 7,5
eq(`AE${R} motor kW`, engine.num('AE' + R), 15);
// AF = "FC" geçmiyorsa "H"
eq(`AF${R} FC (E/H)`, engine.text('AF' + R), 'H');
// J = EĞER(D="APV"; 0,38; 1)
eq(`J${R} çarpan (D=APV)`, engine.num('J' + R), 0.38);
// M = F×I×J×K
eq(`M${R} toplam maliyet`, engine.num('M' + R), 2 * 4500 * 0.38 * 1);

console.log('\n  -- marka APV değilse çarpan 1 olmalı --');
engine.setCell('PRECALCULATION', 'D' + R, 'GÜCÜM');
eq(`J${R} çarpan (D=GÜCÜM)`, engine.num('J' + R), 1);
eq(`M${R} yeniden hesaplandı`, engine.num('M' + R), 2 * 4500 * 1);
engine.setCell('PRECALCULATION', 'D' + R, 'APV');

console.log('\n  -- "FC" içeren açıklamada AF = E olmalı --');
engine.setCell('PRECALCULATION', 'C' + R, 'AGT Agitator Motor: 160,0kW, FC');
eq(`AF${R}`, engine.text('AF' + R), 'E');
eq(`AE${R} motor kW (160,0)`, engine.num('AE' + R), 2 * 160);
engine.setCell('PRECALCULATION', 'C' + R, SPEC);

/* ------------------------------------------------------------------ */
console.log('\n=== 4) Genel toplama yansıma ===');
const sub = engine.num('M' + engine.anchors.subtotalRow);
console.log(`  Ara toplam maliyet = ${sub.toFixed(2)}`);
if (sub < 3420) { failed++; console.log('  ✗ Girilen pompa ara toplama girmemiş!'); }
else console.log('  ✓ Girilen pompa ara toplama giriyor');

/* ------------------------------------------------------------------ */
console.log('\n=== 5) Excel çıktısı ===');
const entries = engine.getEntries();
const book = buildPrecalcWorkbook(wb, entries, { onlyEntered: true });
const buf = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
const rows = XLSX.utils.sheet_to_json(
  XLSX.read(buf, { type: 'buffer' }).Sheets['PRECALCULATION'],
  { header: 1, blankrows: false },
) as unknown[][];

const written = rows.find((r) => typeof r[2] === 'string' && String(r[2]).startsWith('W+55/35'));
if (!written) { failed++; console.log('  ✗ Girilen pompa satırı çıktıda yok!'); }
else {
  console.log('  ✓ Pompa satırı çıktıya yazıldı:');
  console.log(`      Ekipman No : ${written[1]}`);
  console.log(`      Açıklama   : ${String(written[2]).slice(0, 50)}`);
  console.log(`      Marka      : ${written[3]}    Tedarikçi: ${written[4]}`);
  console.log(`      Adet       : ${written[5]}    Tip: ${written[6]}`);
  console.log(`      Liste      : ${written[7]}    Maliyet: ${written[11]}`);
  eq('Çıktıdaki adet', written[5], 2);
  eq('Çıktıdaki liste fiyatı', written[7], 4500);
}

/* ------------------------------------------------------------------ */
console.log('\n=== 6) Şablon satırı açık, katalog satırı korunuyor ===');
/*
 * Pompa şablonu satırları çarpanlarını markadan türetir (J = IF(D="APV";…)).
 * Test bunu build ile aynı kuraldan tanır; satır numarası sabit yazılmaz.
 */
const pumpTemplate = (row: number) => /=\s*"APV"/i.test(wb.sheets.PRECALCULATION.f['J' + row] ?? '');

// Şablon satırı: kaynakta dolu olsa bile mühendis kendi pompasını yazabilmeli.
const templateFilled = items.find((i) => pumpTemplate(i.row) && i.techSpec);
if (!templateFilled) { failed++; console.log('  ✗ Dolu pompa şablonu satırı bulunamadı'); }
else {
  console.log(`  Şablon satırı ${templateFilled.row}: "${templateFilled.techSpec.slice(0, 40)}…"`);
  eq('Şablonda tanım sütunları açık', templateFilled.open, 'CDEH');
  eq('Marka varsayılanı', templateFilled.label, 'APV');
}

// Şablon dışındaki dolu katalog satırı: hiçbir tanım hücresi açılmamalı.
const filled = items.find((i) =>
  !pumpTemplate(i.row) && i.techSpec && i.label && i.supplier && i.machineType);
if (!filled) { failed++; console.log('  ✗ Tam dolu katalog satırı bulunamadı'); }
else {
  console.log(`  Katalog satırı ${filled.row}: "${filled.techSpec.slice(0, 40)}…"`);
  eq('Tanım sütunları kapalı (open boş)', filled.open, '');
}

// Kısmen dolu katalog satırında yalnızca kaynakta boş olanlar açılır.
const partial = items.find((i) => !pumpTemplate(i.row) && i.techSpec && i.open.length > 0);
if (partial) {
  const closed = ['C', 'D', 'E', 'H'].filter((c) => !partial.open.includes(c));
  console.log(`  Satır ${partial.row}: açıklaması dolu, açık = "${partial.open}", kapalı = ${closed.join('')}`);
  if (partial.open.includes('C')) { failed++; console.log('  ✗ Açıklaması dolu satırda C açılmamalı!'); }
  else console.log('  ✓ Dolu hücreler kapalı kaldı, yalnızca boşlar açıldı');
}

/* ------------------------------------------------------------------ */
console.log('\n=== 7) Marka çarpanı: APV varsayılan, değiştirilebilir ===');
if (templateFilled) {
  const brandRow = templateFilled.row;
  const fresh = new PrecalcEngine(wb);
  eq(`J${brandRow} varsayılan (APV)`, fresh.num('J' + brandRow), 0.38);
  fresh.setCell('PRECALCULATION', 'D' + brandRow, 'GRUNDFOS');
  eq(`J${brandRow} başka marka`, fresh.num('J' + brandRow), 1);
  fresh.setCell('PRECALCULATION', 'D' + brandRow, null);
  eq(`J${brandRow} şablona dönüş`, fresh.num('J' + brandRow), 0.38);
}

/* ------------------------------------------------------------------ */
console.log('\n=== 8) Tedarikçi adı ===');
eq('SPX FLOW kalmadı', items.filter((i) => /SPX/i.test(i.supplier)).length, 0);
const ittCount = items.filter((i) => /ITT FLOW/i.test(i.supplier)).length;
if (ittCount === 0) { failed++; console.log('  ✗ ITT FLOW tedarikçili kalem yok'); }
else console.log(`  ✓ ITT FLOW tedarikçili kalem: ${ittCount}`);

console.log(failed === 0 ? '\n✓ Tüm kontroller geçti.\n' : `\n✗ ${failed} kontrol başarısız.\n`);
process.exit(failed === 0 ? 0 : 1);
