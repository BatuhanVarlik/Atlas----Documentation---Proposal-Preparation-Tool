/**
 * Hesap motorunu kaynak Excel dosyasının kendi sonuçlarıyla karşılaştırır.
 *
 * Excel her formül hücresinin son hesaplanmış değerini dosyada saklar.
 * Motor aynı formülleri sıfırdan çalıştırır; ikisi tutuyorsa motor doğrudur.
 *
 * Kullanım: npx tsx scripts/verify-precalc.ts
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { PrecalcEngine } from '../lib/precalc/engine';
import { isError } from '../lib/precalc/formula';
import type { PrecalcWorkbook } from '../lib/precalc/types';

const SOURCE = process.argv[2] || 'data/templates/ORNEK PRECALCULATION 36.07.xlsm';
const TOLERANCE = 1e-6;

const workbook: PrecalcWorkbook = JSON.parse(fs.readFileSync('lib/precalc/workbook.json', 'utf8'));
const engine = new PrecalcEngine(workbook);

console.log('Motor çalıştırılıyor…');
const stats = engine.recalcAll();
console.log(`  ${stats.evaluated.toLocaleString('tr-TR')} formül hücresi ${stats.durationMs} ms'de hesaplandı.`);

const src = XLSX.readFile(SOURCE, { cellFormula: true });

interface Mismatch {
  sheet: string;
  addr: string;
  formula: string;
  excel: unknown;
  engine: unknown;
}

const mismatches: Mismatch[] = [];
let compared = 0;
let skippedExternal = 0;
let engineErrors = 0;
const errorCodes: Record<string, number> = {};

for (const sheetName of workbook.sheetNames) {
  const sheet = src.Sheets[sheetName];
  const data = workbook.sheets[sheetName];
  if (!sheet || !data) continue;

  for (const addr in data.f) {
    // Dış dosyaya bağlı hücreler zaten Excel'in değerini kullanıyor
    if (data.cached[addr] !== undefined) { skippedExternal++; continue; }

    const cell = sheet[addr];
    if (!cell) continue;
    const excelValue = cell.v;
    if (excelValue === undefined) continue;

    const got = engine.value(addr, sheetName);

    if (isError(got)) {
      engineErrors++;
      errorCodes[got.code] = (errorCodes[got.code] || 0) + 1;
      // Excel de hata döndürmüşse (cell.t === 'e') sorun yok
      if (cell.t === 'e') { compared++; continue; }
      mismatches.push({ sheet: sheetName, addr, formula: data.f[addr], excel: excelValue, engine: got.code });
      continue;
    }

    compared++;

    if (typeof excelValue === 'number' && typeof got === 'number') {
      const diff = Math.abs(excelValue - got);
      const scale = Math.max(1, Math.abs(excelValue));
      if (diff / scale > TOLERANCE) {
        mismatches.push({ sheet: sheetName, addr, formula: data.f[addr], excel: excelValue, engine: got });
      }
      continue;
    }

    const a = excelValue === null ? '' : String(excelValue);
    const b = got === null ? '' : String(got);
    if (a !== b) {
      mismatches.push({ sheet: sheetName, addr, formula: data.f[addr], excel: excelValue, engine: got });
    }
  }
}

console.log('');
console.log(`  Karşılaştırılan hücre : ${compared.toLocaleString('tr-TR')}`);
console.log(`  Dış bağlantı (atlandı): ${skippedExternal}`);
console.log(`  Uyuşmazlık            : ${mismatches.length.toLocaleString('tr-TR')}`);
if (engineErrors) {
  console.log(`  Motor hata değeri     : ${engineErrors} → ${JSON.stringify(errorCodes)}`);
}

if (mismatches.length) {
  console.log('');
  console.log('  İlk 40 uyuşmazlık:');
  for (const m of mismatches.slice(0, 40)) {
    console.log(`    ${(m.sheet + '!' + m.addr).padEnd(34)} excel=${JSON.stringify(m.excel)}  motor=${JSON.stringify(m.engine)}`);
    console.log(`      ${m.formula.slice(0, 150)}`);
  }

  // Formül desenlerine göre grupla
  const byPattern: Record<string, number> = {};
  for (const m of mismatches) {
    const p = m.formula.replace(/([A-Z]{1,3})\$?\d+/g, '$1#').slice(0, 90);
    byPattern[p] = (byPattern[p] || 0) + 1;
  }
  console.log('');
  console.log('  Uyuşmazlık desenleri (ilk 25):');
  for (const [p, n] of Object.entries(byPattern).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`    ${String(n).padStart(6)}x  ${p}`);
  }
} else {
  console.log('');
  console.log('  ✓ Motor, Excel ile birebir aynı sonucu üretiyor.');
}
