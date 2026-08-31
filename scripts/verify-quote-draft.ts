/**
 * Gerçek bir teklifi, UYGULAMANIN gördüğü şekilde yeniden hesaplar.
 *
 * verify-quote.ts ile arasındaki fark kritiktir: orası, teklifteki formül
 * şablondakinden farklıysa Excel'in DEĞERİNİ girdi olarak sabitler. Bu,
 * "teklifte elden değiştirilmiş formül" durumunu doğru ele alır ama
 * ŞABLONDA bizim yaptığımız formül değişikliklerini de aynı kefeye koyup
 * etkisiz bırakır — yani şablona giren bir hesap hatası oradan görünmez.
 * (Pano bloklarına eklenen anahtar tam olarak böyle kaçtı: teklifi 3.341 EUR
 * ucuzlatıyordu ve verify-quote yeşil kalıyordu.)
 *
 * Burada şablon olduğu gibi çalışır; girdi olarak yalnızca teklifin kendi
 * hücre değerleri (load-quote.ts'in ürettiği .draft.json) verilir. Ekranda
 * çıkan rakam budur, dolayısıyla karşılaştırılması gereken de budur.
 *
 * Kullanım: npx tsx scripts/verify-quote-draft.ts ["teklif.xlsm"]
 * Teklif ya da taslak dosyası yoksa betik atlanır (hata vermez).
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { PrecalcEngine } from '../lib/precalc/engine';
import type { PrecalcEntries, PrecalcWorkbook } from '../lib/precalc/types';

const QUOTE = process.argv[2] || 'data/generated/HEM-352702-2607-RS00 RO PLANT 20T.xlsm';
const DRAFT = QUOTE.replace(/\.xlsm$/i, '.draft.json');
/** Excel ile motor arasında kabul edilen fark (kuruş yuvarlaması). */
const TOL = 0.02;

if (!fs.existsSync(QUOTE) || !fs.existsSync(DRAFT)) {
  console.log(`Teklif ya da taslak yok, doğrulama atlandı: ${QUOTE}`);
  process.exit(0);
}

const wb: PrecalcWorkbook = JSON.parse(fs.readFileSync('lib/precalc/workbook.json', 'utf8'));
const rawDraft = JSON.parse(fs.readFileSync(DRAFT, 'utf8'));
const entries: PrecalcEntries = rawDraft.entries ?? rawDraft;

const quote = XLSX.readFile(QUOTE, { cellFormula: true });
const qs = quote.Sheets.PRECALCULATION;
if (!qs) {
  console.error('HATA: dosyada PRECALCULATION sayfası yok.');
  process.exit(1);
}

const AN = wb.meta.anchors;

/* Sürüm denetimi: adresler kaymışsa karşılaştırma anlamsız olur. */
let quoteSubtotal: number | null = null;
for (let r = 1; r <= 60000 && quoteSubtotal === null; r++) {
  const c = qs['M' + r];
  if (c?.f && (String(c.f).match(/SUM\(M/g) || []).length >= 3) quoteSubtotal = r;
}
if (quoteSubtotal !== null && quoteSubtotal !== AN.subtotalRow) {
  console.error(
    `Sürüm uyuşmuyor: teklifin ara toplamı ${quoteSubtotal}, şablonunki ${AN.subtotalRow}. ` +
    'Bu teklif başka bir fiyat listesi sürümüyle hazırlanmış.',
  );
  process.exit(1);
}

const engine = new PrecalcEngine(wb);
engine.setEntries(entries);

/*
 * Pano anahtarları (F4704 / F4712 / F4722) şablona sonradan eklendi; bu
 * teklif hazırlandığında böyle bir hücre yoktu ve boş kaldı. Uygulamada
 * kullanıcı pano tipini bu anahtarla seçer, dolayısıyla karşılaştırmanın
 * doğru zemini "teklifin kullandığı panonun anahtarı açık" hâlidir.
 *
 * Hangi anahtarın açılacağı tahmin edilmez: teklifin KENDİ sonuçlarına
 * bakılır — blokta miktar (F) ya da tutar (M) varsa o blok kullanılmış
 * demektir. Miktara da bakmak şart: bu teklifte Flex I/O bloğunun miktarları
 * dolu ama çarpanları (J) sıfırlandığı için tutarı 0 — yalnızca tutara
 * bakılsaydı blok kullanılmamış sanılır ve miktar sütunu tutmazdı.
 */
const autoSwitches: number[] = [];
for (const gate of wb.meta.anchors.gateRows) {
  const head = wb.outline.find((r) => r.r === gate);
  const lvl = head?.lvl ?? 0;
  const next = wb.outline.find((r) => r.r > gate && r.kind === 'item' && (r.lvl ?? 0) <= lvl);
  const end = (next?.r ?? wb.meta.anchors.subtotalRow) - 1;

  let used = false;
  for (let r = gate + 1; r <= end && !used; r++) {
    for (const col of ['F', 'M']) {
      const c = qs[col + r];
      if (typeof c?.v === 'number' && Math.abs(c.v) > 0.005) { used = true; break; }
    }
  }
  if (used) {
    engine.setCell('PRECALCULATION', 'F' + gate, 1);
    autoSwitches.push(gate);
  }
}

engine.settle();

const excel = (addr: string) => (typeof qs[addr]?.v === 'number' ? (qs[addr].v as number) : 0);
const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let failed = 0;

console.log(`Teklif : ${QUOTE}`);
console.log(`Şablon : ${wb.meta.sourceFile} · ${Object.keys(entries).length} girdi hücresi`);
console.log(
  autoSwitches.length
    ? `Pano anahtarı: ${autoSwitches.join(', ')} = 1 (teklifin kullandığı blok)\n`
    : `Pano anahtarı: teklifte pano bloğu kullanılmamış\n`,
);

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
  console.log(
    `  ${ok ? '✓' : '✗'} ${label.padEnd(22)} motor=${money(got).padStart(14)}` +
    `  excel=${money(want).padStart(14)}  fark=${money(got - want).padStart(12)}`,
  );
}

/*
 * Anahtar satırlarının KENDİSİ karşılaştırma dışıdır: o hücreler şablona
 * sonradan eklendi, teklifte hiç yoktu. Altındaki bloğun hesabı sınanır,
 * anahtarın kendi değeri değil.
 */
const gateSet = new Set(AN.gateRows);

console.log('\n=== Satır bazında ===');
for (const col of ['F', 'L', 'M', 'N']) {
  const bad: { r: number; got: number; want: number }[] = [];
  for (let r = wb.meta.headerRow + 1; r < AN.subtotalRow; r++) {
    if (col === 'F' && gateSet.has(r)) continue;
    const got = engine.num(col + r);
    const want = excel(col + r);
    if (Math.abs(got - want) > TOL) bad.push({ r, got, want });
  }
  if (bad.length === 0) {
    console.log(`  ✓ ${col} sütunu tam uyum`);
    continue;
  }
  failed++;
  bad.sort((a, b) => Math.abs(b.got - b.want) - Math.abs(a.got - a.want));
  console.log(`  ✗ ${col} sütununda ${bad.length} satır uyuşmuyor`);
  for (const b of bad.slice(0, 10)) {
    const label = String(qs['H' + b.r]?.v ?? qs['C' + b.r]?.v ?? '(hizmet satırı)').slice(0, 44);
    console.log(
      `     ${String(b.r).padEnd(6)} ${label.padEnd(46)}` +
      ` motor=${money(b.got).padStart(12)} excel=${money(b.want).padStart(12)}`,
    );
  }
}

console.log(
  failed === 0
    ? '\n✓ Şablon bu teklifi olduğu gibi, Excel ile birebir üretiyor.\n'
    : `\n✗ ${failed} kontrol başarısız — şablondaki bir değişiklik teklifin hesabını kaydırıyor.\n`,
);
process.exit(failed === 0 ? 0 : 1);
