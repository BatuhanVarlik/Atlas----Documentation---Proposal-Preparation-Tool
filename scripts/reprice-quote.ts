/* 36.01 ile hazırlanmış bir teklifi, aynı girdilerle 36.07 listesinde fiyatlar. */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { PrecalcEngine } from '../lib/precalc/engine';
import type { PrecalcWorkbook, RawValue } from '../lib/precalc/types';

const QUOTE = process.argv[3] || 'data/generated/HEM-540377-2605-RS00 PY PASTEURISER CIP UPGRADE.xlsm';
const q = XLSX.readFile(QUOTE, { cellFormula: true });
const oldWb: PrecalcWorkbook = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const newWb: PrecalcWorkbook = JSON.parse(fs.readFileSync('lib/precalc/workbook.json', 'utf8'));
const PS = 'PRECALCULATION';

/* ---- satır eşleme: metin imzası, olmayanlarda kayma ---- */
const COLS = ['B', 'C', 'D', 'E'];
const sig = (wb: PrecalcWorkbook, r: number) =>
  COLS.map((c) => String(wb.sheets[PS].v[c + r] ?? '').replace(/\s+/g, ' ').trim()).join('|');
const idx = new Map<string, number[]>();
for (let r = 1; r <= newWb.meta.anchors.subtotalRow; r++) {
  const k = sig(newWb, r);
  if (!k.replace(/\|/g, '')) continue;
  (idx.get(k) ?? idx.set(k, []).get(k)!).push(r);
}
const bySig = (r: number): number | null => {
  const k = sig(oldWb, r);
  if (!k.replace(/\|/g, '')) return null;
  const h = idx.get(k);
  return h && h.length === 1 ? h[0] : null;
};
const shifts: { from: number; delta: number }[] = [];
{
  let last = 0;
  for (let r = 1; r <= oldWb.meta.anchors.subtotalRow + 40; r++) {
    const m = bySig(r);
    if (m === null) continue;
    if (m - r !== last) { shifts.push({ from: r, delta: m - r }); last = m - r; }
  }
}
function mapRow(r: number): number {
  const e = bySig(r);
  if (e !== null) return e;
  let d = 0;
  for (const s of shifts) if (r >= s.from) d = s.delta;
  return r + d;
}
console.log('Satır kayması:', shifts.map((s) => `${s.from}. satırdan sonra +${s.delta}`).join(', ') || 'yok');

/* ---- teklifin girdi durumu (verify-quote ile aynı yöntem) ---- */
const norm = (f: unknown) => String(f ?? '').replace(/\s+/g, '').toUpperCase();
const near = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;

type Input = { sheet: string; addr: string; v: RawValue; fromFormula: boolean };
const inputs: Input[] = [];
for (const name of oldWb.sheetNames) {
  const t = q.Sheets[name], b = oldWb.sheets[name];
  if (!t || !b) continue;
  for (const addr of Object.keys(t)) {
    if (addr.startsWith('!')) continue;
    const c = t[addr];
    if (c.v === undefined) continue;
    if (c.f) {
      if (norm(c.f) === norm(b.f[addr])) continue;
      inputs.push({ sheet: name, addr, v: c.v as RawValue, fromFormula: true });
      continue;
    }
    if (near(b.v[addr], c.v)) continue;
    inputs.push({ sheet: name, addr, v: c.v as RawValue, fromFormula: false });
  }
}
const qtyCount = inputs.filter((i) => i.sheet === PS && /^F\d+$/.test(i.addr) && typeof i.v === 'number' && i.v !== 0).length;
console.log(`Girdi: ${inputs.length} hücre (bunun ${qtyCount}'i elle girilmiş miktar)\n`);

const remap = (i: Input) => {
  if (i.sheet !== PS) return i.addr;
  const m = i.addr.match(/^([A-Z]+)(\d+)$/);
  return m ? m[1] + mapRow(parseInt(m[2], 10)) : i.addr;
};

function price(wb: PrecalcWorkbook, shift: boolean) {
  const e = new PrecalcEngine(wb);
  for (const i of inputs) {
    // Elden değiştirilmiş formüller yeni listede yeniden hesaplansın:
    // Excel'in eski sonucunu taşımak yeni fiyatları gizlerdi.
    if (shift && i.fromFormula) continue;
    e.setCell(i.sheet, shift ? remap(i) : i.addr, i.v);
  }
  e.settle();
  return e;
}
const A = price(oldWb, false);
const B = price(newWb, true);

const m = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const row = (lbl: string, col: string, key: 'subtotalRow' | 'grandTotalRow') => {
  const a = A.num(col + oldWb.meta.anchors[key]);
  const b = B.num(col + newWb.meta.anchors[key]);
  console.log(`  ${lbl.padEnd(22)} 36.01=${m(a).padStart(12)}   36.07=${m(b).padStart(12)}   fark=${m(b - a).padStart(10)}  (%${((b / a - 1) * 100).toFixed(1)})`);
};
console.log('=== Ara toplam (genel giderler hariç) ===');
row('Maliyet', 'M', 'subtotalRow');
row('Satış', 'N', 'subtotalRow');
console.log('=== Genel toplam ===');
row('Maliyet', 'M', 'grandTotalRow');
row('Satış', 'N', 'grandTotalRow');

console.log('\n=== Miktar girilmiş kalemlerde fiyat değişimi ===');
const rows: { desc: string; qty: number; o: number; n: number; eff: number; derived: boolean }[] = [];
for (const i of inputs) {
  if (i.sheet !== PS || !/^F\d+$/.test(i.addr) || typeof i.v !== 'number' || i.v === 0) continue;
  const r = parseInt(i.addr.slice(1), 10);
  const r2 = mapRow(r);
  const o = A.num('I' + r), nn = B.num('I' + r2);
  const desc = String(oldWb.sheets[PS].v['C' + r] ?? oldWb.sheets[PS].v['B' + r] ?? `(satır ${r})`).slice(0, 44);
  if (Math.abs(o - nn) < 0.005) continue;
  // I hücresi formüllüyse liste fiyatı değişmiş değildir: değer başka
  // satırlardan türediği için toplam oynayınca o da oynar.
  const derived = oldWb.sheets[PS].f['I' + r] !== undefined;
  rows.push({ desc, qty: i.v, o, n: nn, eff: (nn - o) * i.v, derived });
}
rows.sort((a, b) => Math.abs(b.eff) - Math.abs(a.eff));

const listed = rows.filter((r) => !r.derived);
const derivedRows = rows.filter((r) => r.derived);
const show = (r: typeof rows[number]) =>
  console.log(`   ${r.desc.padEnd(46)} ${String(r.qty).padStart(4)} ad.  ${m(r.o).padStart(10)} -> ${m(r.n).padStart(10)}   etki=${m(r.eff).padStart(9)}`);

console.log(`  Liste fiyatı değişen: ${listed.length} / ${qtyCount} kalem`);
listed.forEach(show);
if (derivedRows.length) {
  console.log(`\n  Türev satırlar (fiyatı formülle gelir, toplam değişince değişir): ${derivedRows.length}`);
  derivedRows.forEach(show);
}
console.log(`\n  Liste fiyatı artışlarının doğrudan etkisi: ${m(listed.reduce((t, r) => t + r.eff, 0))}`);
