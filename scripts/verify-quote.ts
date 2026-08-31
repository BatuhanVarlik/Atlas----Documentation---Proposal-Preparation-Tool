/**
 * Gerçek bir teklif dosyasıyla uçtan uca doğrulama.
 *
 * Excel'de hazırlanmış, sonuçları kaydedilmiş bir PRECALCULATION kopyası alır;
 * içindeki bütün girdileri (miktar, elle yazılmış fiyat, parametre, formül
 * üzerine yazılmış hücreler) motora aktarır ve motorun hesapladığı her M/N/L
 * hücresini Excel'in kendi sonucuyla karşılaştırır.
 *
 * Duman testi formülleri sentetik girdilerle sınar; bu betik ise sahadan gelen
 * tam bir teklifle sınar — kapsam farkı önemli, çünkü ilk kez burada ortaya
 * çıkan hatalar oldu (pano sayfasındaki uyarı metni, satır bazında elden
 * değiştirilmiş nakliye çarpanı gibi).
 *
 * KÖR NOKTA: teklifteki formül şablondakinden farklıysa burada Excel'in
 * DEĞERİ girdi olarak sabitlenir. Bu, teklifte elden değiştirilmiş formüller
 * için doğrudur; ama ŞABLONA giren bir formül değişikliği de aynı yoldan
 * etkisiz kalır, yani bu betik onu göremez. Şablonun kendi hesabını sınamak
 * için verify-quote-draft.ts kullanın (npm run precalc:quote-draft).
 *
 * Kullanım: npx tsx scripts/verify-quote.ts ["teklif.xlsm"] ["workbook.json"]
 *
 * Teklif hangi şablon sürümüyle hazırlandıysa onunla karşılaştırılmalıdır:
 * sürümler arasında satır eklendiği için adresler kayar (36.01 -> 36.07'de
 * ara toplam 4857'den 4863'e gitti). Betik uyuşmazlığı kendisi yakalar ve
 * eski sürümün nasıl derleneceğini söyler.
 *
 * Teklif dosyaları data/ altında ve sürüm kontrolüne girmiyor; dosya yoksa
 * betik atlanır (hata vermez).
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { PrecalcEngine } from '../lib/precalc/engine';
import type { PrecalcWorkbook, RawValue } from '../lib/precalc/types';

const SOURCE = process.argv[2] || 'data/generated/HEM-352702-2607-RS00 RO PLANT 20T.xlsm';
const TEMPLATE = process.argv[3] || 'lib/precalc/workbook.json';
const TOL = 0.02;

if (!fs.existsSync(SOURCE)) {
  console.log(`Teklif dosyası yok, doğrulama atlandı: ${SOURCE}`);
  process.exit(0);
}

const quote = XLSX.readFile(SOURCE, { cellFormula: true });
const qs = quote.Sheets['PRECALCULATION'];
if (!qs) {
  console.error('HATA: dosyada PRECALCULATION sayfası yok.');
  process.exit(1);
}

const wb: PrecalcWorkbook = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
const AN = wb.meta.anchors;

/* Teklifin kendi ara toplam satırı — şablonunkiyle tutmalı. */
function quoteSubtotalRow(): number | null {
  for (let r = 1; r <= 60000; r++) {
    const c = qs['M' + r];
    if (!c || !c.f) continue;
    if ((String(c.f).match(/SUM\(M/g) || []).length >= 3) return r;
  }
  return null;
}

const qSub = quoteSubtotalRow();
if (qSub !== null && qSub !== AN.subtotalRow) {
  console.error(
    `Sürüm uyuşmuyor: teklifin ara toplamı ${qSub}. satırda, şablonunki ${AN.subtotalRow}.
` +
    `Bu teklif başka bir fiyat listesi sürümüyle hazırlanmış; adresler kaydığı için
` +
    `karşılaştırma anlamsız olur. Doğru şablonu derleyip onunla çalıştırın:

` +
    `  PRECALC_OUT_DIR=<klasör> node scripts/build-precalc.js "data/templates/<sürüm>.xlsm"
` +
    `  npx tsx scripts/verify-quote.ts "${SOURCE}" <klasör>/workbook.json
`
  );
  process.exit(1);
}

const engine = new PrecalcEngine(wb);

const norm = (f: unknown) => String(f ?? '').replace(/\s+/g, '').toUpperCase();
const near = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;

console.log(`Teklif      : ${SOURCE}`);
console.log(`Şablon      : ${wb.meta.sourceFile} (ara toplam ${AN.subtotalRow}, genel toplam ${AN.grandTotalRow})\n`);

/* ---------------------------------------------------------------- */
/* 1) Teklifin girdi durumunu motora aktar                          */
/* ---------------------------------------------------------------- */

let literals = 0;
const rewritten: { sheet: string; addr: string; was: string; now: string }[] = [];

for (const name of wb.sheetNames) {
  const q = quote.Sheets[name];
  const base = wb.sheets[name];
  if (!q || !base) continue;

  for (const addr of Object.keys(q)) {
    if (addr.startsWith('!')) continue;
    const cell = q[addr];
    if (cell.v === undefined) continue;

    if (cell.f) {
      // Formül şablondakiyle aynıysa motor kendi hesaplasın.
      if (norm(cell.f) === norm(base.f[addr])) continue;
      // Farklıysa teklifte elden değiştirilmiş demektir: Excel'in sonucunu al.
      rewritten.push({ sheet: name, addr, was: String(base.f[addr] ?? '(sabit)'), now: String(cell.f) });
      engine.setCell(name, addr, cell.v as RawValue);
      continue;
    }

    if (near(base.v[addr], cell.v)) continue;
    engine.setCell(name, addr, cell.v as RawValue);
    literals++;
  }
}

const st = engine.settle();
console.log(`Aktarılan girdi : ${literals} hücre`);
console.log(`Elden değiştirilmiş formül: ${rewritten.length}`);
for (const r of rewritten) {
  console.log(`   ${r.sheet}!${r.addr}`);
  console.log(`      şablon: ${r.was.slice(0, 68)}`);
  console.log(`      teklif: ${r.now.slice(0, 68)}`);
}
console.log(`Yinelemeli hesap: ${st.iterations} tur, ${st.circularCells} döngüsel hücre, ${st.durationMs} ms\n`);

/* ---------------------------------------------------------------- */
/* 2) Karşılaştır                                                    */
/* ---------------------------------------------------------------- */

let failed = 0;
const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const excel = (addr: string, sheet = 'PRECALCULATION') => {
  const c = quote.Sheets[sheet]?.[addr];
  return c && typeof c.v === 'number' ? c.v : 0;
};

console.log('=== Toplamlar ===');
for (const [label, addr] of [
  ['Ara toplam maliyet', 'M' + AN.subtotalRow],
  ['Ara toplam satış', 'N' + AN.subtotalRow],
  ['Genel toplam maliyet', 'M' + AN.grandTotalRow],
  ['Genel toplam satış', 'N' + AN.grandTotalRow],
] as [string, string][]) {
  const got = engine.num(addr);
  const want = excel(addr);
  const ok = Math.abs(got - want) <= TOL;
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(22)} motor=${money(got).padStart(14)}  excel=${money(want).padStart(14)}`);
}

console.log('\n=== Satır bazında (kalem + hizmet satırları) ===');
for (const col of ['F', 'L', 'M', 'N']) {
  const bad: { r: number; got: number; want: number }[] = [];
  for (let r = wb.meta.headerRow + 1; r < AN.subtotalRow; r++) {
    const got = engine.num(col + r);
    const want = excel(col + r);
    if (Math.abs(got - want) > TOL) bad.push({ r, got, want });
  }
  bad.sort((a, b) => Math.abs(b.got - b.want) - Math.abs(a.got - a.want));
  if (bad.length === 0) {
    console.log(`  ✓ ${col} sütunu tam uyum`);
    continue;
  }
  failed++;
  console.log(`  ✗ ${col} sütununda ${bad.length} satır uyuşmuyor`);
  for (const b of bad.slice(0, 10)) {
    const desc = qs['C' + b.r] ? String(qs['C' + b.r].v).slice(0, 40) : '(hizmet satırı)';
    console.log(`     ${String(b.r).padEnd(6)} ${desc.padEnd(42)} motor=${money(b.got).padStart(12)} excel=${money(b.want).padStart(12)}`);
  }
}

console.log('\n=== AYRINTILI FIYATLANDIRMA ===');
const AYR = 'AYRINTILI FIYATLANDIRMA';
for (const [label, addr] of [
  ['Genel toplam', 'D47'], ['Dağılım %1', 'D49'], ['Dağılım %2', 'D50'], ['Dağılım %3', 'D51'],
] as [string, string][]) {
  const got = engine.num(addr, AYR);
  const want = excel(addr, AYR);
  const ok = Math.abs(got - want) <= TOL;
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(22)} ${addr.padEnd(5)} motor=${money(got).padStart(14)}  excel=${money(want).padStart(14)}`);
}

console.log(failed === 0
  ? '\n✓ Motor bu teklifi Excel ile birebir hesapladı.\n'
  : `\n✗ ${failed} karşılaştırma başarısız.\n`);
process.exit(failed === 0 ? 0 : 1);
