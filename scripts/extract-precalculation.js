// PRECALCULATION Excel'inden ürün listesi + fiyat verisini çıkarır.
// 3 seviyeli hiyerarşi:
//   topCategory  (Üst Kategori)   — image 1'deki 12 sabit kategori
//   subCategory  (Alt Kategori)   — image 2'deki sabit alt kategoriler
//   productType  (Ürün Tipi)      — geri kalan A-only başlıkları (image 3)
// Kullanım: node scripts/extract-precalculation.js [excel-path]

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SOURCE = process.argv[2] || 'public/ORNEK PRECALCULATION 36.01.xlsm';
const OUT = 'lib/pricing/precalculation.json';

// Image 1 — 12 üst kategori
const TOP_CATEGORIES = [
  'PROCESS VALVES',
  'UTILITY MATERIALS',
  'PUMPS',
  'INSTRUMENTS',
  'OTHER PROCESS MATERIALS',
  'SPECIAL STAINLESS MATERIALS',
  'HEAT EXCHANGERS',
  'MEMBRANE & HOUSING',
  'SPARE PARTS',
  'AUXILIARY MATERIALS',
  'ADDITIONAL MATERIALS SUPPLIED DURING PROJECT',
  'OTHERS',
];

// Image 2 — her üst kategori altındaki alt kategoriler
const SUB_CATEGORIES = {
  'PROCESS VALVES': [
    'MANUEL BUTTERFLY VALVE',
    'NON-RETURN VALVE',
    'MANUEL BALL VALVE',
    'MANUEL SAMPLING VALVE',
    'SOLENOID VALVES',
    'REGULATION PROCESS VALVES',
    'PROCESS VALVES WITH AS-I CONTROL UNIT',
    'PROCESS VALVES WITH DIRECT CONNECT CONTROL UNIT',
    'PNEUMATIC ACTUATED PROCESS VALVES',
  ],
  'UTILITY MATERIALS': [
    'MANUEL UTILITY VALVES',
    'UTILITY VALVES WITH CONTROL UNIT',
    'REGULATING UTILITY VALVES',
    'STEAM TRAP',
  ],
  'PUMPS': [
    'CENTRIFUGAL PUMP & FAN',
    'LOBE & MONO PUMP',
    'VACUUM PUMP',
    'AIR OPERATED DIAPHRAGM PUMP',
    'FREQUENCY CONVERTOR',
  ],
  'INSTRUMENTS': [
    'HIGH LEVEL SENSOR',
    'LOW LEVEL SENSOR',
    'CAPACITIVE LEVEL SENSOR',
    'PT100', 'Pt100',
    'PRESSURE TRANSMITTER',
    'MANOMETER',
    'THERMOMETER',
    'FLOW METER',
    'FLOW SWITCH',
    'CONDUCTIVITY SENSOR',
    'DIFFERENTIAL PRESSURE SENSOR',
    'RADAR LEVEL SENSOR',
    'TURBIDITY SENSOR',
    'REFRACTOMETER',
    'PH METER', 'pH METER',
    'PERACEDIC ACID & OZONE SENSOR',
    'LOAD CELL',
    'OXYGEN SENSOR',
    'CARBONDIOXDE SENSOR',
    'REGTRONIC HIGH PRECISION PRESSURE REGULATOR',
    'PROXIMITY SWITCH',
    'ASI AIRBOX',
    'M12 CONNECTOR',
    'DIALOGUE',
  ],
  'OTHER PROCESS MATERIALS': [
    'MIXER & AGITATOR',
    'HOMOGENIZER & COMMISSIONING & SERVICE',
    'HOMOGENIZER',
    'SEPERATOR & COMMISSIONING & SERVICE',
    'CIP BALL',
    'TANK CIP HOSE',
    'STERIL AIR CABINET',
    'COMPRESSED AIR TREATMENT',
    'TANK SIGHT GLASSES',
    'HOSES',
    'STERILE AIR PRODUCTION',
    'ULTRA-CLEAN VENT',
    'PIG',
    'PARASOL VALVE',
    'SIGHT GLASS WITH PROTECTION',
  ],
  'SPECIAL STAINLESS MATERIALS': [
    'TANK',
    'FILTER',
    'INSTRUMENT COUPLINGS',
    'STAINLESS STEEL PANELS',
    'CIP COLLECTORS LABOUR',
    'LONG HOLDER',
  ],
  'HEAT EXCHANGERS': [
    'PLATE HEAT EXCHANGER',
    'BRAZED PLATE HEAT EXCHANGER',
    'TUBULAR HEAT EXCHANGER',
    'SCRAPED SURFACE HEAT EXCHANGER',
  ],
  'MEMBRANE & HOUSING': [
    'MEMBRANE FILTER',
    'HOUSING',
  ],
  'SPARE PARTS': [],
  'AUXILIARY MATERIALS': ['SWT TANK BOTTOM FLANGE'],
  'ADDITIONAL MATERIALS SUPPLIED DURING PROJECT': [],
  'OTHERS': [],
};

// Hızlı arama için Set
const topSet = new Set(TOP_CATEGORIES.map((s) => s.trim().toUpperCase()));
const subToTop = {}; // 'MANUEL BUTTERFLY VALVE' -> 'PROCESS VALVES'
for (const [top, subs] of Object.entries(SUB_CATEGORIES)) {
  for (const s of subs) subToTop[s.trim().toUpperCase()] = top;
}

const wb = XLSX.readFile(SOURCE);
const ws = wb.Sheets['PRECALCULATION'];
if (!ws) { console.error('PRECALCULATION sheet bulunamadı.'); process.exit(1); }
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });

const items = [];
let topCategory = '';
let subCategory = '';
let productType = '';
let standard = '';

function looksLikeSub(aStr, bStr) {
  // A+B kombinasyonu (kısa abbreviation) — image 2'deki yapı
  if (bStr && typeof bStr === 'string' && bStr.length > 0 && bStr.length <= 6) return true;
  // veya sabit alt kategori listemizdeyse
  return subToTop[aStr.toUpperCase()] !== undefined;
}

for (let i = 8; i < data.length; i++) {
  const row = data[i];
  const a = row[0]; const b = row[1]; const c = row[2];

  if (a && !c) {
    const aStr = String(a).trim();
    const upper = aStr.toUpperCase();

    // Standart başlıkları
    if (upper === 'SMS STANDARD') { standard = 'SMS'; continue; }
    if (upper === 'DIN STANDARD') { standard = 'DIN'; continue; }

    // Üst kategori mi?
    if (topSet.has(upper)) {
      topCategory = aStr;
      subCategory = '';
      productType = '';
      standard = '';
      continue;
    }

    // Alt kategori mi?
    if (looksLikeSub(aStr, b)) {
      // A+B veya sabit listede — alt kategori
      subCategory = aStr;
      productType = '';
      standard = '';
      // Eğer subToTop biliyor ve mevcut topCategory yanlışsa düzelt
      const expectedTop = subToTop[upper];
      if (expectedTop && topCategory.toUpperCase() !== expectedTop.toUpperCase()) {
        topCategory = expectedTop;
      }
      continue;
    }

    // Kalanlar — ürün tipi
    productType = aStr;
    standard = '';
    continue;
  }

  // Ürün satırı — techSpec (C) + liste fiyatı (I) yeterli; eqNo (B) opsiyonel.
  // Bazı ürünler (ör. KROHNE flowmetreler, RGE regulating valve'ler) eqNo'suz
  // listelenmiş; eski `b && c` koşulu bunları (203 ürün) atlıyordu.
  if (c) {
    const listPrice = typeof row[8] === 'number' ? row[8] : null;
    const rawDiscount = typeof row[9] === 'number' ? row[9] : 0;
    if (!listPrice) continue;
    // Excel kuralı: discount sütununda 1 = iskonto yok (liste fiyatı korunur).
    // 0.33 → %33 iskonto, 0 → iskonto yok, 1 → iskonto yok.
    const discount = rawDiscount === 1 ? 0 : rawDiscount;
    items.push({
      id: items.length + 1,
      eqNo: b ? String(b).trim() : '',
      techSpec: String(c).trim().replace(/\s+/g, ' '),
      label: row[3] ? String(row[3]).trim() : '',
      supplier: row[4] ? String(row[4]).trim() : '',
      machineType: row[7] ? String(row[7]).trim() : '',  // col H — referans
      listPrice,
      discount,
      netPrice: Math.round(listPrice * (1 - discount) * 100) / 100,
      topCategory,
      subCategory,
      productType,
      standard,
    });
  }
}

const meta = {
  totalItems: items.length,
  sourceFile: path.basename(SOURCE),
  sheet: 'PRECALCULATION',
  extractedAt: new Date().toISOString(),
  currency: 'EUR',
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ meta, items }));

console.log(`✓ ${items.length} ürün ${OUT} dosyasına yazıldı.`);
console.log(`  Boyut: ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);

// === Doğrulama: techSpec(C) + sayısal liste fiyatı(I) olan tüm satırlar alınmalı ===
let priceableRows = 0;
let noPriceRows = 0;
for (let i = 8; i < data.length; i++) {
  const r = data[i];
  if (!r) continue;
  const a = r[0]; const b = r[1]; const c = r[2];
  if (a && !c) continue; // başlık satırı
  const price = typeof r[8] === 'number' ? r[8] : null;
  if (c && price) priceableRows++;
  else if (b && c && !price) noPriceRows++;
}
if (priceableRows === items.length) {
  console.log(`✓ Doğrulama: fiyatlı ${priceableRows} ürün satırının tamamı çıkarıldı.`);
} else {
  console.warn(`⚠ Doğrulama: ${priceableRows} fiyatlı satır var ama ${items.length} çıkarıldı (fark: ${priceableRows - items.length}).`);
}
console.log(`  Not: ${noPriceRows} satırda eqNo+techSpec var ama liste fiyatı (col I) boş — fiyatlandırılamaz (kaynak veride fiyat yok).`);
const fmCount = items.filter((it) => it.subCategory === 'FLOW METER').length;
console.log(`  Flow meter (FLOW METER alt kategorisi): ${fmCount} ürün.`);

// Özet
const topTally = {};
items.forEach((it) => { topTally[it.topCategory || '(yok)'] = (topTally[it.topCategory || '(yok)'] || 0) + 1; });
console.log('\nÜst kategoriye göre dağılım:');
TOP_CATEGORIES.forEach((t) => console.log(`  ${t}: ${topTally[t] || 0}`));
if (topTally['(yok)']) console.log(`  (yok): ${topTally['(yok)']}`);
