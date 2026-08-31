/**
 * Uçtan uca duman testi: miktar girilince zincirin tamamı doğru akıyor mu?
 *
 * Kullanım: npx tsx scripts/smoke-precalc.ts
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { PrecalcEngine } from '../lib/precalc/engine';
import { isError } from '../lib/precalc/formula';
import { buildPrecalcWorkbook } from '../lib/precalc/export';
import type { PrecalcWorkbook } from '../lib/precalc/types';
import { parseSumRanges, weightOf } from '../lib/precalc/totals';
import { getCatalogDataset } from '../lib/precalc/catalog';

const wb: PrecalcWorkbook = JSON.parse(fs.readFileSync('lib/precalc/workbook.json', 'utf8'));
const engine = new PrecalcEngine(wb);
const catalogItems = getCatalogDataset().items;
// Yapısal satırlar sürümden sürüme kayar (36.01 -> 36.07'de +6); test de
// sabit adres yazmaz, kitabın kendi çapalarını kullanır.
const AN = engine.anchors;
const SUB = AN.subtotalRow;
const GRAND = AN.grandTotalRow;
const M = (r: number) => 'M' + r;
const N = (r: number) => 'N' + r;

let failed = 0;
function check(label: string, got: number, want: number, tol = 0.005) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(52)} beklenen=${want.toFixed(2).padStart(12)}  bulunan=${got.toFixed(2).padStart(12)}`);
}

console.log('\n=== 1) Boş kitap ===');
check('Ara toplam maliyet', engine.num(M(SUB)), 0);
check('Genel toplam satış', engine.num(N(GRAND)), 0);

/* ------------------------------------------------------------------ */
console.log('\n=== 2) Satır 15: 10 adet Manuel Butterfly Valve ESV-1" ===');
// Beklenen değerler liste fiyatına gömülmez: her yeni fiyat listesinde
// (36.01 -> 36.07 arasında bu satır 169 EUR'dan 175 EUR'ya çıktı) test
// kırılırdı. Doğrulanan şey zincirin kendisi: M = F*I*J*K, N = M/kâr,
// L = I*J*K*nakliye*F.
engine.setCell('PRECALCULATION', 'F15', 10);

const i15 = engine.num('I15');
const j15 = engine.num('J15');
const k15 = engine.num('K15');
const profit = engine.num(engine.paramAddr('profitMultiplier') ?? '');
const transport = engine.num(engine.paramAddr('transportMultiplier') ?? '');
console.log(`     I15=${i15}  J15=${j15}  K15=${k15}  kâr=${profit}  nakliye=${transport}`);

check('M15 toplam maliyet', engine.num('M15'), 10 * i15 * j15 * k15);
check('N15 satış fiyatı', engine.num('N15'), (10 * i15 * j15 * k15) / profit);
check('L15 nakliye', engine.num('L15'), i15 * j15 * k15 * transport * 10);
check('S15 yedek parça toplam', engine.num('S15'), 3 * 42);
check('U15 tedarik haftası', engine.num('U15'), 4);
check('V15 ödeme haftası', engine.num('V15'), 16);
check('G15 (F*2)', engine.num('G15'), 20);
check('BB15 toplam kaynak (F*BA)', engine.num('BB15'), 10 * 2);

console.log('\n  -- kademeli yedek parça kuralı --');
engine.setCell('PRECALCULATION', 'F15', 3);
check('F=3  -> çarpan 2', engine.num('S15'), 2 * 42);
engine.setCell('PRECALCULATION', 'F15', 10);
check('F=10 -> çarpan 3', engine.num('S15'), 3 * 42);
engine.setCell('PRECALCULATION', 'F15', 50);
check('F=50 -> çarpan F/10', engine.num('S15'), (50 / 10) * 42);
engine.setCell('PRECALCULATION', 'F15', 10);

/* ------------------------------------------------------------------ */
console.log('\n=== 3) Elle fiyat girişi (dış dosyaya bağlı hücre) ===');
const before = engine.num('I1847');
engine.setCell('PRECALCULATION', 'F1847', 2);
engine.setCell('PRECALCULATION', 'I1847', 1250);
check('I1847 elle girilen liste fiyatı', engine.num('I1847'), 1250);
check('M1847 = F*I*J*K', engine.num('M1847'), 2 * 1250 * engine.num('J1847') * engine.num('K1847'));
console.log(`     (Excel önbelleğindeki eski değer: ${before})`);

/* ------------------------------------------------------------------ */
console.log('\n=== 4) Toplamlara yayılım ===');
const subCost = engine.num(M(SUB));
const subSales = engine.num(N(SUB));
console.log(`     ARA TOPLAM maliyet = ${subCost.toFixed(2)}`);
console.log(`     ARA TOPLAM satış   = ${subSales.toFixed(2)}`);
if (subCost <= 0) { failed++; console.log('  ✗ Ara toplam sıfır kaldı — zincir kopuk!'); }
else console.log('  ✓ Ara toplam kalem girişlerini yansıtıyor');

// Genel giderler ara toplamın yüzdesi olarak hesaplanır
check('Beklenmeyen gider = ara toplam * %3', engine.num('I' + (SUB + 3)), subCost * 3 / 100);
check('Garanti = ara toplam * %2', engine.num('I' + (SUB + 5)), subCost * 2 / 100);

const grand = engine.num(M(GRAND));
console.log(`     GENEL TOPLAM maliyet = ${grand.toFixed(2)}`);
if (grand <= subCost) { failed++; console.log('  ✗ Genel toplam ara toplamdan büyük olmalı'); }
else console.log('  ✓ Genel toplam genel giderleri içeriyor');

/* ------------------------------------------------------------------ */
console.log('\n=== 5) Diğer sayfalara yayılım ===');
console.log(`     'SMS PASLANMAZ'!K505 = ${engine.num('K505', 'SMS PASLANMAZ').toFixed(2)}`);
console.log(`     KABLO!K82            = ${engine.num('K82', 'KABLO').toFixed(2)}`);
console.log(`     AYRINTILI FIYAT. D1  = ${engine.num('D1', 'AYRINTILI FIYATLANDIRMA').toFixed(2)}`);

/* ------------------------------------------------------------------ */
console.log('\n=== 6) Sıfırlama ===');
engine.reset();
check('Sıfırlama sonrası ara toplam', engine.num(M(SUB)), 0);
check('Sıfırlama sonrası M15', engine.num('M15'), 0);
check('I1847 kaynak değerine döndü', engine.num('I1847'), before);

/* ------------------------------------------------------------------ */
console.log('\n=== 7) Excel dışa aktarma ===');
const entries = { 'PRECALCULATION!F15': 10, 'PRECALCULATION!F24': 5, 'PRECALCULATION!F3748': 2 };
const book = buildPrecalcWorkbook(wb, entries, { onlyEntered: true });
const buf = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync('.smoke-precalc.xlsx', buf);

const reread = XLSX.read(buf, { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(reread.Sheets['PRECALCULATION'], { header: 1, blankrows: false }) as unknown[][];
console.log(`  ✓ ${(buf.length / 1024).toFixed(0)} KB, sayfalar: ${reread.SheetNames.join(', ')}`);
console.log(`  ✓ ${rows.length} satır yazıldı (yalnızca girilen kalemler + başlıkları)`);
const dataRows = rows.filter((r) => typeof r[5] === 'number' && (r[5] as number) > 0);
console.log(`  ✓ miktarı olan ${dataRows.length} kalem satırı`);
for (const r of dataRows.slice(0, 5)) {
  console.log(`      ${String(r[2] ?? r[6] ?? '').slice(0, 52).padEnd(54)} miktar=${r[5]}  maliyet=${Number(r[11] ?? 0).toFixed(2)}`);
}
// Elle girilen 3 kalemin yanında, miktarı formülle türeyen hizmet satırları da
// (ORDER HANDLING, SHIPMENT HANDLING, CABLING …) çıktıya girer — Excel de böyle yapar.
const manual = dataRows.filter((r) => typeof r[2] === 'string' && String(r[2]).length > 0);
if (manual.length < 3) { failed++; console.log(`  ✗ En az 3 elle girilen kalem bekleniyordu, ${manual.length} bulundu`); }
else console.log(`  ✓ ${manual.length} elle girilen kalem + ${dataRows.length - manual.length} türetilmiş hizmet satırı`);
fs.unlinkSync('.smoke-precalc.xlsx');

/* ------------------------------------------------------------------ */
console.log('\n=== 8) Performans ===');
const e2 = new PrecalcEngine(wb);
let t = Date.now();
e2.recalcAll();
console.log(`     Tam yeniden hesap (48k formül): ${Date.now() - t} ms`);
t = Date.now();
e2.setCell('PRECALCULATION', 'F15', 7);
e2.num(M(GRAND));
console.log(`     Girdi sonrası toplam okuma     : ${Date.now() - t} ms`);
t = Date.now();
for (let i = 0; i < 40; i++) e2.num('M' + (15 + i));
console.log(`     40 görünür satır hücresi        : ${Date.now() - t} ms`);

/* ------------------------------------------------------------------ */
// Kaynak kitap yinelemeli hesapla kaydedilmis (calcPr iterate=1):
// AYRINTILI FIYATLANDIRMA'da genel gider, dolu kategori sayisina (F2)
// bolunerek dagitilir; F2 de o kategorilere bakar. settle() bu donguyu
// sabitlemezse butun kategori toplamlari #DIV/0! kalir.
console.log('');
console.log('=== 9) Yinelemeli hesap (dongusel referanslar) ===');
const AYR = 'AYRINTILI FIYATLANDIRMA';
const e3 = new PrecalcEngine(wb);
e3.setCell('PRECALCULATION', 'F15', 10);
e3.setCell('PRECALCULATION', 'F3570', 3);
const settleStats = e3.settle();
console.log(`     ${settleStats.iterations} yineleme, ${settleStats.circularCells} dongusel hucre, ${settleStats.durationMs} ms`);
if (!settleStats.converged) { failed++; console.log('  x Degerler sabitlenmedi'); }
else console.log('  + Degerler sabitlendi');

let ayrErrors = 0;
for (const addr in wb.sheets[AYR].f) if (isError(e3.value(addr, AYR))) ayrErrors++;
if (ayrErrors > 0) { failed++; console.log(`  x AYRINTILI FIYATLANDIRMA'da ${ayrErrors} hatali hucre (#DIV/0! vb.)`); }
else console.log('  + AYRINTILI FIYATLANDIRMA hatasiz');

check('Kategori toplami = genel toplam', e3.num('D47', AYR), e3.num(N(GRAND)), 0.01);
check('Dagilim yuzdeleri toplami', e3.num('D49', AYR) + e3.num('D50', AYR) + e3.num('D51', AYR), 100, 0.01);

/* ------------------------------------------------------------------ */
// Kalem ara toplami duz bir toplam degil: OTHERS bolumundeki bazi secenek
// satirlari hic sayilmaz, bazilari da baska bir aralikta sayildigi icin
// dusulur. Ekrandaki kartlar bu kurali uygulamazsa genel toplami asar.
console.log('');
console.log('=== 10) Ara toplamin satir kurallari ===');
const e4 = new PrecalcEngine(wb);
const priced = catalogItems.filter((i) => (i.listPrice ?? 0) > 0).slice(0, 40);
for (const it of priced) e4.setCell('PRECALCULATION', 'F' + it.row, 2);
e4.settle();

const costRanges = parseSumRanges(e4.formulaOf(M(SUB)));
const salesRanges = parseSumRanges(e4.formulaOf(N(SUB)));
if (costRanges.length === 0 || salesRanges.length === 0) {
  failed++;
  console.log('  x Ara toplam formulu cozumlenemedi');
}

let wCost = 0, wSales = 0, naiveSales = 0, skipped = 0;
for (const it of catalogItems) {
  wCost += weightOf(costRanges, it.row) * e4.num('M' + it.row);
  wSales += weightOf(salesRanges, it.row) * e4.num('N' + it.row);
  naiveSales += e4.num('N' + it.row);
  if (weightOf(salesRanges, it.row) <= 0) skipped++;
}
check('Agirlikli maliyet = ara toplam', wCost, e4.num(M(SUB)), 0.01);
check('Agirlikli satis  = ara toplam', wSales, e4.num(N(SUB)), 0.01);
console.log(`     toplama girmeyen katalog satiri : ${skipped}`);
if (skipped === 0) { failed++; console.log('  x Haric tutulan satir bulunamadi'); }
if (naiveSales <= e4.num(N(SUB))) {
  failed++;
  console.log('  x Duz toplam ara toplamdan buyuk cikmadi - kural degismis olabilir');
} else {
  console.log(`  + Duz toplam ${(naiveSales - e4.num(N(SUB))).toFixed(2)} fazla veriyor`);
}
if (e4.num(N(GRAND)) <= e4.num(N(SUB))) {
  failed++;
  console.log('  x Genel toplam ara toplamdan buyuk degil');
} else {
  console.log(`  + Genel giderler payi ${(e4.num(N(GRAND)) - e4.num(N(SUB))).toFixed(2)}`);
}

/* ------------------------------------------------------------------ */
// Pano sayfalarindaki IF formulleri kosul saglanmayinca uyari metni
// dondurebiliyor. Metin bir ust satirda sayiyla carpilinca #VALUE! olusuyor
// ve hata genel toplama kadar yayiliyor -- gercek bir teklifte bu yuzden
// butun fiyat sifir cikti. U27 build sirasinda duzeltiliyor; ayni desendeki
// diger hucreler burada listelenir.
console.log('');
console.log('=== 11) Pano uyari hucreleri sayi dondurmeli ===');
const PANEL_SHEETS = ['1734-1794 SERISI ASI FLEX IO', '1734-1794 SERISI DC FLEX IO'];
const e5 = new PrecalcEngine(wb);
// Pano sayfalarini calistiracak kadar miktar: AS-i ve DC vana gruplari.
e5.setCell('PRECALCULATION', 'F1270', 12);
e5.setCell('PRECALCULATION', 'F1777', 8);
e5.setCell('PRECALCULATION', 'F3400', 6);
e5.settle();

let textResults = 0;
for (const sheet of PANEL_SHEETS) {
  const sd = wb.sheets[sheet];
  for (const addr of Object.keys(sd.f)) {
    if (!/^IF\(/i.test(sd.f[addr].trim())) continue;
    const v = e5.value(addr, sheet);
    if (typeof v !== 'string') continue;
    // Sonucu baska bir formulde kullaniliyor mu?
    const used = Object.keys(sd.f).filter((a) => sd.f[a].includes(addr));
    textResults++;
    console.log(`  ! ${sheet}!${addr} = "${v}"  (kullanan: ${used.join(', ') || 'yok'})`);
    console.log(`      ${sd.f[addr]}`);
    if (used.length > 0) {
      failed++;
      console.log('      x Bu metin baska bir formulde kullaniliyor -> #VALUE! riski');
    }
  }
}
if (textResults === 0) console.log('  + Metin donduren hucre yok');

// Esikleri asan miktarlarla da denenir: U27 icin O27>=2, V27 icin P27>=3.
// Dusuk miktarda ikisi de "kucuk" dalina duser ve hatayi gizler -- V27'deki
// ayni hata ilk turda bu yuzden gorunmemisti.
const DCS = '1734-1794 SERISI DC FLEX IO';
for (const [label, engineAt] of [
  ['dusuk miktar', e5],
  ['yuksek miktar', (() => {
    const big = new PrecalcEngine(wb);
    big.setCell('PRECALCULATION', 'F1270', 400);
    big.setCell('PRECALCULATION', 'F1777', 400);
    big.setCell('PRECALCULATION', 'F3400', 400);
    big.settle();
    return big;
  })()],
] as [string, PrecalcEngine][]) {
  const o27 = engineAt.value('O27', DCS);
  const p27 = engineAt.value('P27', DCS);
  console.log(`  -- ${label}: O27=${JSON.stringify(o27)}  P27=${JSON.stringify(p27)}`);

  for (const [cell, mult] of [['U27', 150], ['V27', 200]] as [string, number][]) {
    const v = engineAt.value(cell, DCS);
    if (typeof v !== 'number') {
      failed++;
      console.log(`     x ${cell} sayi dondurmedi: ${JSON.stringify(v)} (build yamasi uygulanmamis olabilir)`);
      continue;
    }
    const next = cell[0] + '28';
    check(`${next} = ${cell} * ${mult}`, engineAt.num(next, DCS), v * mult);
  }

  const sub = engineAt.value('M' + SUB);
  if (typeof sub !== 'number') {
    failed++;
    console.log(`     x Ara toplam sayi degil: ${JSON.stringify(sub)} -- pano zinciri hatayi yaymis`);
  } else {
    console.log(`     + Ara toplam sayisal: ${sub.toFixed(2)}`);
  }
}

/* ------------------------------------------------------------------ */
console.log('\n=== 12) Pano blokları anahtara bağlı ===');
/*
 * Üç pano tipi (Flex I/O, Point I/O, ET200SP) kitapta aynı anda hesaplanıyor;
 * seçilmeyeni teklif dışında bırakmanın doğrudan yolu yoktu. Başlığın F
 * hücresine 1 yazılınca o bloğun formülleri çalışır, yazılmadıkça blok 0
 * döndürür.
 *
 * Anahtar yalnızca kendi bloğunu ilgilendirir: başka bloğu susturmaz, kitabın
 * kendi pano seçim kurgusuna dokunmaz. Test her iki yönü de sınar.
 *
 * Blok sınırı Excel'in kendi satır gruplamasından okunur: başlıkla aynı ya da
 * daha üst seviyeye dönen ilk satır bloğu bitirir. Satır numarası yazılmaz.
 */
const blockEnd = (gate: number) => {
  const head = wb.outline.find((r) => r.r === gate);
  const level = head?.lvl ?? 0;
  const after = wb.outline.find((r) => r.r > gate && r.kind === 'item' && (r.lvl ?? 0) <= level);
  return (after?.r ?? SUB) - 1;
};

/** Bloğun toplam maliyeti — anahtarın etkisi buradan ölçülür. */
const blockCost = (e: PrecalcEngine, from: number, to: number) => {
  let sum = 0;
  for (let r = from; r <= to; r++) sum += e.num(M(r));
  return sum;
};

/**
 * Bloğu besleyen girdiler: vana miktarları (pano sayfaları bunlardan türer)
 * ve bloğun kendi elle girilen miktar hücreleri.
 */
const seedBlock = (e: PrecalcEngine, from: number, to: number) => {
  for (const addr of ['F1270', 'F1777', 'F3400']) e.setCell('PRECALCULATION', addr, 400);
  for (let r = from; r <= to; r++) {
    if (!e.hasFormula('F' + r)) e.setCell('PRECALCULATION', 'F' + r, 2);
  }
};

let anyOpened = 0;
for (const gate of AN.gateRows) {
  const from = gate + 1;
  const to = blockEnd(gate);

  // a) Anahtar kapalı: blok hiç tutar üretmemeli.
  const off = new PrecalcEngine(wb);
  seedBlock(off, from, to);
  off.settle();
  check(`${gate} anahtarı kapalı (${from}-${to})`, blockCost(off, from, to), 0);

  // b) Anahtar açık: blok hesaplanmalı.
  const on = new PrecalcEngine(wb);
  seedBlock(on, from, to);
  on.setCell('PRECALCULATION', 'F' + gate, 1);
  on.settle();
  const opened = blockCost(on, from, to);
  anyOpened += opened;
  console.log(`     + ${gate} anahtarı açık: ${opened.toFixed(2)}`);

  // c) Başka bloğun anahtarı bu bloğu ETKİLEMEMELİ (seçim mantığına karışılmaz).
  const other = AN.gateRows.find((g) => g !== gate)!;
  const both = new PrecalcEngine(wb);
  seedBlock(both, from, to);
  both.setCell('PRECALCULATION', 'F' + gate, 1);
  both.setCell('PRECALCULATION', 'F' + other, 1);
  both.settle();
  check(`${gate} bloğu, ${other} de açıkken değişmiyor`, blockCost(both, from, to), opened);
}
/*
 * Anahtar açılınca en az bir blok tutar üretmeli — yoksa kapı bloğu kalıcı
 * olarak sıfırlamış olurdu. (Point I/O kitabın kendi kurgusunda ancak Flex I/O
 * çarpanları sıfırlandığında miktar üretir; bu yüzden toplamda aranır.)
 */
if (anyOpened > 0) console.log('  ✓ Anahtar açılınca bloklar tutar üretiyor');
else { failed++; console.log('  ✗ Hiçbir blok anahtar açıkken tutar üretmedi'); }

/* ------------------------------------------------------------------ */
console.log('\n=== 13) Paslanmaz malzeme seçilen vana standardını izliyor ===');
/*
 * Kitapta bu satır her zaman SMS sayfasının toplamını okuyordu. Girilen vana
 * adetleri hangi standartta ağır basıyorsa o sayfanın toplamı gelmeli.
 * Sayfa toplamları boş kitapta 0 olduğu için önce birer metraj verilir.
 */
const std = new PrecalcEngine(wb);
std.setCell('SMS PASLANMAZ', 'E4', 30);
std.setCell('DIN PASLANMAZ MALZEME', 'E4', 70);
std.settle();
const smsTotal = std.num('K505', 'SMS PASLANMAZ');
const dinTotal = std.num('K502', 'DIN PASLANMAZ MALZEME');
console.log(`  SMS sayfası toplamı = ${smsTotal.toFixed(2)}   DIN sayfası toplamı = ${dinTotal.toFixed(2)}`);

const stainless = 'J' + AN.stainlessRow;
check('Vana girilmemişken SMS', std.num(stainless), smsTotal);

// Kitabın kendi DIN / SMS başlıklarından birer satır seç.
const dinRow = catalogItems.find((i) => i.standard === 'DIN');
const smsRow = catalogItems.find((i) => i.standard === 'SMS');
if (!dinRow || !smsRow) {
  failed++;
  console.log('  ✗ SMS/DIN kalem satırı bulunamadı');
} else {
  std.setCell('PRECALCULATION', 'F' + dinRow.row, 50);
  std.settle();
  check(`DIN baskın (F${dinRow.row}=50)`, std.num(stainless), dinTotal);

  std.setCell('PRECALCULATION', 'F' + smsRow.row, 90);
  std.settle();
  check(`SMS baskın (F${smsRow.row}=90)`, std.num(stainless), smsTotal);
}

/* ------------------------------------------------------------------ */
console.log('\n=== 14) Precalculation no Ayrıntılı Fiyatlandırma A1 hücresinde ===');
const idEngine = new PrecalcEngine(wb);
const precalcAddr = idEngine.paramAddr('precalcNo') ?? '';
if (!precalcAddr) {
  failed++;
  console.log('  ✗ precalcNo parametresi yok');
} else {
  const a1 = () => idEngine.text('A1', 'AYRINTILI FIYATLANDIRMA');
  if (a1() !== '') { failed++; console.log(`  ✗ Numara boşken A1 boş değil: ${JSON.stringify(a1())}`); }
  else console.log('  ✓ Numara boşken A1 boş');

  idEngine.setCell('PRECALCULATION', precalcAddr, 'PRE-2026-001');
  if (a1() !== 'PRE-2026-001') { failed++; console.log(`  ✗ A1 numarayı göstermiyor: ${JSON.stringify(a1())}`); }
  else console.log('  ✓ A1 = PRE-2026-001');
}

console.log(failed === 0 ? '\n✓ Tüm kontroller geçti.\n' : `\n✗ ${failed} kontrol başarısız.\n`);
process.exit(failed === 0 ? 0 : 1);
