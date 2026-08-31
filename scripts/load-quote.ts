/**
 * Bir teklif dosyasındaki girdileri uygulamaya yüklenecek biçime çevirir.
 *
 * Girdiler tarayıcının localStorage'ında durduğu için Node buraya doğrudan
 * yazamaz; betik konsola yapıştırılacak satırı üretir, aynı içeriği bir .json
 * ve bir .console.txt dosyasına da yazar.
 *
 * Girdi durumu verify-quote.ts ile aynı yöntemle çıkarılır: formülü olmayan
 * ve şablondakinden farklı olan HER hücre. Yalnızca miktarları almak yetmiyor
 * -- bu teklifte örneğin paslanmaz malzeme metrajları ayrı bir sayfada, iki
 * kaynak sayısı formülün üzerine 0 yazılarak iptal edilmiş, beş pompanın
 * açıklaması elle değiştirilmiş; hepsi toplamı değiştiriyor.
 *
 * Kullanım:
 *   npx tsx scripts/load-quote.ts ["teklif.xlsm"] [--only-qty]
 *
 * --only-qty  yalnızca PRECALCULATION miktarlarını alır (fiyatlar ve diğer
 *             sayfalar şablon değerinde kalır) -- kataloğun kendi fiyatlarıyla
 *             ne çıkacağını görmek için.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import type { PrecalcWorkbook, RawValue } from '../lib/precalc/types';

const args = process.argv.slice(2);
const ONLY_QTY = args.includes('--only-qty');
const SOURCE = args.find((a) => !a.startsWith('--'))
  || 'data/generated/HEM-352702-2607-RS00 RO PLANT 20T.xlsm';

if (!fs.existsSync(SOURCE)) {
  console.error(`Dosya yok: ${SOURCE}`);
  process.exit(1);
}

const wb: PrecalcWorkbook = JSON.parse(fs.readFileSync('lib/precalc/workbook.json', 'utf8'));
const AN = wb.meta.anchors;
const PS = 'PRECALCULATION';
const quote = XLSX.readFile(SOURCE, { cellFormula: true });
const qs = quote.Sheets[PS];
if (!qs) {
  console.error('Dosyada PRECALCULATION sayfası yok.');
  process.exit(1);
}

/* Sürüm denetimi: adresler kaymışsa girdiler yanlış satırlara düşer. */
let qSub: number | null = null;
for (let r = 1; r <= 60000 && qSub === null; r++) {
  const c = qs['M' + r];
  if (c && c.f && (String(c.f).match(/SUM\(M/g) || []).length >= 3) qSub = r;
}
if (qSub !== null && qSub !== AN.subtotalRow) {
  console.error(
    `Sürüm uyuşmuyor: teklifin ara toplamı ${qSub}. satırda, uygulamanınki ${AN.subtotalRow}.\n` +
    `Bu teklif başka bir fiyat listesi sürümüyle hazırlanmış; girdiler yanlış\n` +
    `satırlara düşeceği için yükleme yapılmadı.`
  );
  process.exit(1);
}

/* ---- girdi durumu ---- */
const norm = (f: unknown) => String(f ?? '').replace(/\s+/g, '').toUpperCase();
const near = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;

const entries: Record<string, RawValue> = {};
const stat = { qty: 0, price: 0, otherSheet: 0, text: 0, overwritten: 0, param: 0 };

for (const name of wb.sheetNames) {
  const t = quote.Sheets[name];
  const base = wb.sheets[name];
  if (!t || !base) continue;
  if (ONLY_QTY && name !== PS) continue;

  for (const addr of Object.keys(t)) {
    if (addr.startsWith('!')) continue;
    const cell = t[addr];
    if (cell.v === undefined) continue;

    const isFormulaCell = !!cell.f;
    if (isFormulaCell && norm(cell.f) === norm(base.f[addr])) continue;   // aynı formül: motor hesaplasın
    if (!isFormulaCell && near(base.v[addr], cell.v)) continue;           // değişmemiş

    const col = addr.replace(/\d+/g, '');
    if (ONLY_QTY && col !== 'F') continue;

    entries[`${name}!${addr}`] = cell.v as RawValue;

    if (isFormulaCell) stat.overwritten++;
    else if (name !== PS) stat.otherSheet++;
    else if (typeof cell.v === 'string') stat.text++;
    else if (col === 'F') stat.qty++;
    else stat.price++;
  }
}

for (const key of ['profitMultiplier', 'transportMultiplier']) {
  const p = wb.params.find((x) => x.key === key);
  if (!p || !(`${PS}!${p.addr}` in entries)) continue;
  stat.param++;
  console.log(`  ${p.label}: şablonda ${p.value} -> teklifte ${entries[`${PS}!${p.addr}`]}`);
}

const payload = { entries, savedAt: new Date().toISOString() };
const stem = path.join('data', 'generated', path.basename(SOURCE).replace(/\.xlsm$/i, ''));
const snippet =
  `localStorage.setItem('atlas.precalc.draft.v1', ${JSON.stringify(JSON.stringify(payload))}); location.reload();`;
fs.writeFileSync(stem + '.draft.json', JSON.stringify(payload, null, 1));
fs.writeFileSync(stem + '.console.txt', snippet);

console.log(`\nTeklif : ${path.basename(SOURCE)}`);
console.log(`Girdi  : ${Object.keys(entries).length} hücre` + (ONLY_QTY ? '   (--only-qty)' : ''));
console.log(`         ${stat.qty} miktar, ${stat.price} elle fiyat/çarpan, ${stat.text} açıklama metni,`);
console.log(`         ${stat.otherSheet} diğer sayfalarda (metraj vb.), ${stat.overwritten} formül üzerine yazım`);
console.log(`Dosya  : ${stem}.draft.json`);
console.log(`         ${stem}.console.txt   <- yapıştırılacak satır`);
console.log('\nhttp://localhost:8000/pricing sayfasını açın, F12 ile konsolu açıp');
console.log('.console.txt içeriğini yapıştırın; sayfa kendini yeniler.');
console.log('Geri almak için: Fiyat Kataloğu\'ndaki "Girdileri Sıfırla" düğmesi.');
