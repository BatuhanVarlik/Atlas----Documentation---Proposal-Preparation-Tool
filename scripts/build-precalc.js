/**
 * PRECALCULATION çalışma kitabını uygulamanın kullandığı veri dosyalarına çevirir.
 *
 * Üç çıktı üretir:
 *   lib/precalc/workbook.json      — tüm sayfalar, hücre değerleri + formüller (hesap motoru için)
 *   lib/precalc/catalog.json       — PRECALCULATION'daki tüm kalemler (Fiyat Kataloğu için)
 *   lib/pricing/precalculation.json — eski biçim, fiyatlı kalemler (modül eşleştirme motorları için)
 *
 * Kaynak dosya asla değiştirilmez; salt okunur açılır.
 *
 * Kullanım: node scripts/build-precalc.js ["kaynak.xlsm"]
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SOURCE = process.argv[2] || 'data/templates/ORNEK PRECALCULATION 36.07.xlsm';
const SHEET = 'PRECALCULATION';
const HEADER_ROW = 9;

/*
 * Çıktı yeri. PRECALC_OUT_DIR verilirse üçü de oraya yazılır; eski bir
 * sürümü uygulamanın verisini bozmadan derlemek için kullanılır
 * (ör. bir teklifin dayandığı 36.01'i çıkarıp karşılaştırmak).
 */
const OUT_DIR = process.env.PRECALC_OUT_DIR || '';
const OUT_WORKBOOK = OUT_DIR ? path.join(OUT_DIR, 'workbook.json') : 'lib/precalc/workbook.json';
const OUT_CATALOG = OUT_DIR ? path.join(OUT_DIR, 'catalog.json') : 'lib/precalc/catalog.json';
const OUT_LEGACY = OUT_DIR ? path.join(OUT_DIR, 'precalculation.json') : 'lib/pricing/precalculation.json';

/* ------------------------------------------------------------------ */
/* Kitabın yapısal sınırları — kaynak dosyadan tespit edildi           */
/* ------------------------------------------------------------------ */

/*
 * Kitabın yapısal satırları sürümden sürüme kayar: 36.01 -> 36.07 geçişinde
 * 3882 ve 3947'ye toplam 6 satır eklendiği için ara toplam 4857'den 4863'e,
 * genel toplam 4872'den 4878'e kaydı. Bu yüzden hiçbiri sabit yazılmaz;
 * hepsi kaynak dosyadan tespit edilir ve meta.anchors ile dışa verilir.
 */

/** Çok parçalı SUM zinciri taşıyan satır = kalem ara toplamı. */
function findSubtotalRow() {
  for (let r = 1; r <= 60000; r++) {
    const c = ws['M' + r];
    if (!c || !c.f) continue;
    const parts = String(c.f).match(/SUM\(M/g);
    if (parts && parts.length >= 3) return r;
  }
  throw new Error('Ara toplam satırı bulunamadı (M sütununda çok parçalı SUM yok).');
}

/** Ara toplamdan başlayan tek SUM = genel toplam. */
function findGrandTotalRow(subtotal) {
  // Kaçış karmaşası olmasın diye kalıp regex yerine düz metinle aranır.
  const head = 'SUM(M' + subtotal + ':M';
  for (let r = subtotal + 1; r <= subtotal + 60; r++) {
    const c = ws['M' + r];
    if (!c || !c.f) continue;
    const norm = String(c.f).replace(/\s/g, '');
    // Tek bir SUM, ara toplamdan başlıyor: aradaki genel gider satırlarını toplar.
    if (norm.startsWith(head) && norm.endsWith(')') && norm.indexOf('SUM', 1) === -1) return r;
  }
  throw new Error('Genel toplam satırı bulunamadı (SUM(M' + subtotal + ':M...) yok).');
}

/** A sütununda "OTHERS" başlığını taşıyan satır — genel gider bloğunun başı. */
function findOthersRow(subtotal) {
  for (let r = subtotal - 400; r < subtotal; r++) {
    const c = ws['A' + r];
    if (c && typeof c.v === 'string' && c.v.trim().toUpperCase() === 'OTHERS') return r;
  }
  throw new Error('OTHERS başlığı bulunamadı (A sütununda "OTHERS" yok).');
}

/** H sütununda verilen etiketi taşıyan satır (OTHERS bloğu içinde aranır). */
function findLabelRow(label, from, to) {
  const want = label.replace(/\s+/g, ' ').trim().toUpperCase();
  for (let r = from; r <= to; r++) {
    const c = ws['H' + r];
    if (!c || typeof c.v !== 'string') continue;
    if (c.v.replace(/\s+/g, ' ').trim().toUpperCase() === want) return r;
  }
  throw new Error('OTHERS bloğunda "' + label + '" satırı bulunamadı.');
}

/** Hizmet satırlarındaki SUM(F11:F####) kalıbı katalogun son satırını verir. */
function findCatalogEnd(subtotal) {
  let best = 0;
  for (let r = subtotal - 250; r < subtotal; r++) {
    const c = ws['F' + r];
    if (!c || !c.f) continue;
    const m = String(c.f).match(/SUM\(F11:F(\d+)\)/);
    if (m) best = Math.max(best, parseInt(m[1], 10));
  }
  if (!best) throw new Error('Katalog sonu bulunamadı (SUM(F11:F...) kalıbı yok).');
  return best;
}


/* ------------------------------------------------------------------ */
/* Eski biçim için sabit kategori listesi (eşleştirme motorları buna   */
/* göre filtreliyor — değiştirilmemeli)                                */
/* ------------------------------------------------------------------ */

const LEGACY_TOP_CATEGORIES = [
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

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function fillKey(cell) {
  const s = cell && cell.s;
  if (!s || !s.fgColor) return '';
  const fg = s.fgColor;
  if (fg.rgb) return fg.rgb;
  if (fg.theme !== undefined) return 'theme' + fg.theme + '/' + (fg.tint || 0).toFixed(2);
  return '';
}

function isExternalFormula(f) {
  return /\[\d+\]/.test(f);
}

function clean(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Okuma                                                               */
/* ------------------------------------------------------------------ */

console.log('Kaynak okunuyor: ' + SOURCE);
const wb = XLSX.readFile(SOURCE, { cellFormula: true, cellStyles: true, cellDates: false });
const ws = wb.Sheets[SHEET];
if (!ws) {
  console.error('HATA: "' + SHEET + '" sayfası bulunamadı.');
  process.exit(1);
}

/* Yapısal satırlar ve parametre adresleri kitap okunduktan sonra çözülür. */
/** Ara toplam satırı; buradan sonrası genel gider ve toplamlar. */
const SUBTOTAL_ROW = findSubtotalRow();
/** Genel toplam satırı — ara toplam + genel giderler. */
const GRAND_TOTAL_ROW = findGrandTotalRow(SUBTOTAL_ROW);
/** Ürün kataloğunun bittiği, hizmet/işçilik kalemlerinin başladığı satır. */
const CATALOG_END = findCatalogEnd(SUBTOTAL_ROW);
/** Ödeme planı / nakit akışı bloğunun başı — genel toplamın hemen altı. */
const PLAN_START = GRAND_TOTAL_ROW + 1;
/** "OTHERS" başlığı — genel gider / hizmet bloğunun ilk satırı (kendisi başlık). */
const OTHERS_ROW = findOthersRow(SUBTOTAL_ROW);
/**
 * OTHERS içinde formülü elle ezilebilen blok (mühendislik / montaj / devreye
 * alma kalemleri). Kullanıcı bu satırlara kendi adam-gün sayısını yazabilir,
 * ↺ ile şablondaki formüle döner.
 */
const MANUAL_FORMULA_START = findLabelRow('FUNCTIONAL ANALYSIS', OTHERS_ROW, SUBTOTAL_ROW);
const MANUAL_FORMULA_END = findLabelRow('PROJECT MANAGEMENT', MANUAL_FORMULA_START, SUBTOTAL_ROW);

/*
 * Kaynak kitaptaki düzeltmeler.
 *
 * Kaynak .xlsm salt okunur açılır; APV'nin fiyat listesini biz değiştirmeyiz.
 * Kitapta hesabı bozan bir formül varsa düzeltmesi burada, tek yerde ve
 * gerekçesiyle birlikte durur — böylece yeni sürüm geldiğinde hangi
 * müdahalelerin taşındığı görülür.
 *
 * `was` kaynaktaki formülün birebir kopyasıdır: tutmazsa derleme durur.
 * Bu, üretici formülü kendisi düzelttiğinde yamanın sessizce üstüne
 * yazmasını engeller.
 */
const FORMULA_PATCHES = [
  {
    sheet: '1734-1794 SERISI DC FLEX IO',
    addr: 'U27',
    was: 'IF(O27<2,1,"20A Bakınız")',
    now: 'IF(O27<2,1,2)',
    why: 'Koşul sağlanmayınca formül sayı yerine uyarı metni döndürüyordu; ' +
      'bir alttaki U28=U27*150 metni çarpmaya çalışıp #VALUE! veriyor ve hata ' +
      'pano maliyetinden genel toplama kadar bütün zinciri bozuyordu (Excel ' +
      'dosyasında da aynı sonuç). Doğru kurgu: değer 2 altındaysa 1, değilse 2 adet.',
  },
  // V27 aynı desende: koşul sağlanmayınca "30A Takınız" metnini döndürüyor ve
  // V28 = V27*200 bunu çarpmaya kalkınca zincir yine #VALUE! oluyor. P27 üç
  // ve üzerindeyse 2 adet demektir. Formül her iki pano sayfasında da aynı.
  {
    sheet: '1734-1794 SERISI ASI FLEX IO',
    addr: 'V27',
    was: 'IF(P27<3,1,"30A Takınız")',
    now: 'IF(P27<3,1,2)',
    why: 'Metin dönüşü V28=V27*200 üzerinden bütün pano maliyetini bozuyordu.',
  },
  {
    sheet: '1734-1794 SERISI DC FLEX IO',
    addr: 'V27',
    was: 'IF(P27<3,1,"30A Takınız")',
    now: 'IF(P27<3,1,2)',
    why: 'Metin dönüşü V28=V27*200 üzerinden bütün pano maliyetini bozuyordu.',
  },
];

/** Üst kategori satırlarının dolgu rengi (Excel teması). */
const TOP_LEVEL_FILL = 'theme0/-0.35';

/** Kalem satırlarında kullanıcıya açılan sütunlar. */
const ITEM_INPUT_COLS = ['F', 'I', 'J', 'K', 'P', 'Q', 'R', 'X', 'AD', 'AE', 'AF', 'AY', 'AZ', 'BA'];
/** Fiyat Kataloğu'nda formüllü olup olmadığı izlenen sütunlar. */
const FORMULA_COLS = ['F', 'I', 'J', 'K', 'L', 'M', 'N'];

/**
 * Kaynak dosyada boş bırakılmış olabilen tanım sütunları.
 *
 * PUMPS gibi bölümlerde Excel hazır katalog vermez; mühendis pompanın
 * özelliğini C sütununa yazar, Excel de ekipman kodunu (B), motor gücünü (AE)
 * ve çarpanı (J) bu metinden türetir. Bu sütunların hangilerinin boş —
 * dolayısıyla kullanıcıya açık — olduğu kalem başına taşınır.
 */
const TEXT_INPUT_COLS = ['C', 'D', 'E', 'H'];

/** Hizmet / genel gider / plan satırlarında kullanıcıya açılan sütunlar. */
const SUMMARY_INPUT_COLS = ['B', 'C', 'E', 'F', 'I', 'J', 'K', 'M'];

/*
 * Hesabı yöneten parametre hücreleri. Genel gider bloğundaki satırlar ara
 * toplama göre sabit uzaklıktadır; satır eklenip kaydıklarında uzaklık
 * korunur. Doğruluğu I sütunundaki "SALES PRICE" / "PROFIT MULTIPLIER" /
 * "TRANSPORTATION MULTIPLIER" etiketleriyle karşılaştırılarak denetlenir
 * (bkz. assertParamAnchors) — kayma başka türlü olursa derleme durur.
 */
const at = (col, offset) => col + (SUBTOTAL_ROW + offset);

const PARAMS = [
  { key: 'profitMultiplier', addr: at('M', 20), label: 'Kâr çarpanı (PROFIT MULTIPLIER)' },
  { key: 'transportMultiplier', addr: at('M', 21), label: 'Nakliye çarpanı (TRANSPORTATION MULTIPLIER)' },
  { key: 'salesPrice', addr: at('M', 18), label: 'Satış fiyatı (SALES PRICE)' },
  { key: 'orderDate', addr: at('B', 19), label: 'Sipariş tarihi (ORDER DATE)' },
  { key: 'agencyCommission', addr: at('F', 1), label: 'Acente komisyonu oranı (maks. %5)' },
  { key: 'contingency', addr: at('F', 3), label: 'Beklenmeyen giderler çarpanı (CONTINGENCY)' },
  { key: 'warranty', addr: at('F', 5), label: 'Garanti çarpanı (WARRANTY)' },
  { key: 'warrantyExtension', addr: at('F', 6), label: 'Garanti uzatma (hafta)' },
  { key: 'risk', addr: at('F', 8), label: 'Risk çarpanı (RISK)' },
  { key: 'prepaymentPct', addr: at('F', 10), label: 'Ön ödeme yüzdesi' },
  { key: 'guaranteeLetterPct', addr: at('F', 12), label: 'Garanti teminat mektubu yüzdesi' },
  { key: 'stampDuty', addr: at('F', 14), label: 'Damga vergisi çarpanı' },
  { key: 'siteDelivery', addr: at('F', -4), label: 'Müşteri sahasına teslim (YES/NO)' },
  { key: 'crating', addr: at('F', -3), label: 'Sandıklama & shrink (YES/NO)' },
  { key: 'installationType', addr: at('C', -40), label: 'Kurulum tipi (SKID:1 / SYSTEM:2)' },
  { key: 'installationSize', addr: at('E', -16), label: 'Kurulum ölçeği (Small:0 / Big:1)' },
  { key: 'hemitekOcNo', addr: 'W5', label: 'HEMİTEK OC no' },
  { key: 'foreignOcNo', addr: 'Y5', label: 'Polonya & Danimarka OC no' },
  // A sütunu etiketi ("CUSTOMER: ") taşır, değer B sütunundadır.
  { key: 'customer', addr: 'B1', label: 'Müşteri' },
  { key: 'endUser', addr: 'B3', label: 'Son kullanıcı' },
  { key: 'date', addr: 'B5', label: 'Tarih' },
  { key: 'preparedBy', addr: 'B7', label: 'Hazırlayan' },
  /*
   * Proje ve precalculation numarası. Kaynak kitapta yoktu: başlık bloğunun
   * boş kalan 2. ve 4. satırlarına (A = etiket, B = değer) yerleştirilir.
   * Precalculation no ayrıca AYRINTILI FIYATLANDIRMA!A1'e yansır — o hücre
   * kaynakta dosya adını gösteren bir formüldü.
   */
  { key: 'projectNo', addr: 'B2', label: 'Proje no' },
  { key: 'precalcNo', addr: 'B4', label: 'Precalculation no' },
];

const get = (col, row) => ws[col + row];
const val = (col, row) => {
  const c = get(col, row);
  return c ? c.v : undefined;
};
const filled = (col, row) => {
  const v = val(col, row);
  return v !== undefined && v !== '';
};

/* ------------------------------------------------------------------ */
/* 0) Kaynak üzerindeki uyarlamalar                                    */
/* ------------------------------------------------------------------ */

/*
 * Aşağıdakiler kaynak dosyayı DEĞİL, bellekteki kopyasını değiştirir
 * (.xlsm salt okunur açılır, hiçbir zaman yazılmaz). Uygulamanın kitaptan
 * ayrıldığı her nokta burada, gerekçesiyle birlikte durur.
 */

/** Eski marka adı — tedarikçi hücrelerinde yenisiyle değiştirilir. */
const SUPPLIER_RENAMES = [
  { match: /^\s*SPX\s*FLOW(\s*TECH\.?)?\s*$/i, to: 'ITT FLOW' },
];

let supplierRenamed = 0;
for (const name of wb.SheetNames) {
  const s = wb.Sheets[name];
  if (!s) continue;
  for (const addr in s) {
    if (addr[0] === '!') continue;
    const cell = s[addr];
    if (!cell || cell.f || typeof cell.v !== 'string') continue;
    const rule = SUPPLIER_RENAMES.find((r) => r.match.test(cell.v));
    if (!rule) continue;
    cell.v = rule.to;
    if (cell.w !== undefined) cell.w = rule.to;
    supplierRenamed++;
  }
}
console.log('Tedarikçi adı güncellendi (SPX FLOW -> ITT FLOW): ' + supplierRenamed + ' hücre');

/*
 * Pompa şablonu satırları (CENTRIFUGAL PUMP & FAN bloğu).
 *
 * Çarpanları J = IF(D="APV";0,38;1) ile markadan türer; kaynakta marka
 * hücresi çoğu satırda boş olduğu için çarpan 1 kalıyordu. Teklifler
 * uygulamada APV pompayla açıldığından varsayılan "APV" yazılır — hücre
 * kullanıcıya açık kalır, başka marka yazılınca çarpan kendiliğinden 1 olur.
 *
 * Aynı bloğun tanım hücreleri (teknik açıklama / marka / tedarikçi / ekipman)
 * kaynakta dolu olsalar bile kullanıcıya açılır: burası hazır katalog değil
 * şablondur, mühendis seçtiği pompayı yazar ve gerekirse siler.
 */
const PUMP_LABEL_DEFAULT = 'APV';
const pumpRows = [];
for (const addr in ws) {
  if (addr[0] !== 'J') continue;
  const cell = ws[addr];
  if (!cell || !cell.f || !/=\s*"APV"/i.test(String(cell.f))) continue;
  const r = parseInt(addr.slice(1), 10);
  if (Number.isFinite(r)) pumpRows.push(r);
}
pumpRows.sort((a, b) => a - b);
if (pumpRows.length === 0) {
  throw new Error('Pompa şablonu satırları bulunamadı (J sütununda IF(D..="APV") yok).');
}

for (const r of pumpRows) {
  const cell = ws['D' + r];
  if (cell && cell.f) continue;                                 // formüllü marka hücresi
  if (cell && cell.v !== undefined && cell.v !== '') continue;   // kaynakta zaten yazılı
  ws['D' + r] = { t: 's', v: PUMP_LABEL_DEFAULT, w: PUMP_LABEL_DEFAULT };
}
/** Tanım sütunları dolu olsa da kullanıcıya açılan satırlar. */
const FORCE_OPEN_ROWS = new Set(pumpRows);
console.log('Pompa markası varsayılanı "' + PUMP_LABEL_DEFAULT + '": satır ' +
  pumpRows[0] + '-' + pumpRows[pumpRows.length - 1] + ' (' + pumpRows.length + ' satır, hücreler açık)');

/*
 * Pano bloklarının aç/kapa anahtarı.
 *
 * ALLEN BRADLEY FLEX I/O, ALLEN BRADLEY POINT I/O ve SIEMENS ET20SP başlık
 * satırlarının F hücresi kaynakta boştur. Başlığın F hücresine 1 yazılınca
 * o bloğun formülleri çalışır; yazılmadıkça blok 0 döndürür.
 *
 * Anahtar YALNIZCA kendi bloğunu ilgilendirir: başka blokları susturmaz,
 * kitabın kendi pano seçim kurgusuna (Flex I/O çarpanlarının sıfırlanması,
 * Point I/O'nun IF(J<flex>=0; ...) ile açılması) hiç dokunmaz. Birden fazla
 * anahtar açılırsa açılan blokların hepsi hesaplanır ve tutarlar toplanır —
 * bu kullanıcının tercihidir, formül engellemez; arayüz uyarır.
 *
 * SONUÇ — anahtar diye bir şeyin olmadığı ESKİ teklifler (ör. HEM-352702)
 * yeniden hesaplanırken ilgili anahtara 1 yazılmalıdır; yazılmazsa o teklifin
 * seçtiği pano bloğu teklife girmez ve toplam düşük çıkar.
 *
 * Kapı yalnızca miktara (F) değil tutar sütunlarına da (L/M/N) uygulanır:
 * bloktaki bazı satırların miktarı kullanıcı girdisidir (ör. SIEMENS'te
 * pano adedi), formül olmadığı için kapılanamaz — tutar tarafı kapılanınca
 * anahtar kapalıyken blok yine de teklife girmez.
 */
const GATE_LABELS = ['ALLEN BRADLEY FLEX I/O', 'ALLEN BRADLEY POINT I/O', 'SIEMENS ET20SP'];
/** Blokların bittiği yeri belirleyen ilk sonraki başlık. */
const GATE_BLOCK_END_LABEL = 'ASI MATERIALS';
/** Anahtara bağlanan sütunlar: miktar ve tutarlar. */
const GATE_COLS = ['F', 'L', 'M', 'N'];

const gateRows = GATE_LABELS.map((label) => findLabelRow(label, OTHERS_ROW, SUBTOTAL_ROW));
const gateBounds = gateRows
  .concat([findLabelRow(GATE_BLOCK_END_LABEL, OTHERS_ROW, SUBTOTAL_ROW)])
  .sort((a, b) => a - b);

gateRows.forEach((head, i) => {
  const end = gateBounds[gateBounds.indexOf(head) + 1] - 1;
  let gated = 0;
  for (let r = head + 1; r <= end; r++) {
    for (const col of GATE_COLS) {
      const cell = ws[col + r];
      // Sabit / boş hücreler kullanıcının kendi girdisidir; yalnızca formüller kapılanır.
      if (!cell || !cell.f) continue;
      // Anahtar 1 ise özgün formül, değilse 0. Başka bloğa karışmaz.
      cell.f = 'IF($F$' + head + '=1,' + String(cell.f) + ',0)';
      gated++;
    }
  }
  console.log('Pano bloğu anahtara bağlandı: ' + GATE_LABELS[i] + ' (F' + head + ') → satır ' +
    (head + 1) + '-' + end + ', ' + gated + ' formül');
});
console.log('  (anahtara 1 yazılmadıkça blok 0 döndürür; anahtarlar birbirini etkilemez)');

/*
 * Proje / precalculation numarası ve AYRINTILI FIYATLANDIRMA başlığı.
 *
 * Kaynak kitapta bu iki alan yok; başlık bloğunun boş kalan 2. ve 4.
 * satırlarına yerleştirilir (A = etiket, B = değer; CUSTOMER/END USER ile
 * aynı düzen). AYRINTILI FIYATLANDIRMA!A1 kaynakta dosya adını gösteren bir
 * formüldü — uygulamada dosya adı diye bir şey olmadığı için precalculation
 * numarasını gösterir.
 */
const PROJECT_NO_ADDR = PARAMS.find((p) => p.key === 'projectNo').addr;
const PRECALC_NO_ADDR = PARAMS.find((p) => p.key === 'precalcNo').addr;
const HEADER_LABELS = [
  { addr: 'A' + PROJECT_NO_ADDR.slice(1), text: 'PROJECT NO: ' },
  { addr: 'A' + PRECALC_NO_ADDR.slice(1), text: 'PRECALCULATION NO: ' },
];
for (const { addr, text } of HEADER_LABELS) {
  const cell = ws[addr];
  if (cell && (cell.f || (cell.v !== undefined && cell.v !== ''))) {
    throw new Error('Başlık bloğunda ' + addr + ' dolu; proje/precalculation no için başka satır seçilmeli.');
  }
  ws[addr] = { t: 's', v: text, w: text };
}

const detailSheet = wb.Sheets['AYRINTILI FIYATLANDIRMA'];
if (detailSheet) {
  // Numara girilmemişken hücre "0" değil boş görünsün.
  const ref = SHEET + '!' + PRECALC_NO_ADDR;
  detailSheet.A1 = { t: 's', f: 'IF(' + ref + '="","",' + ref + ')', v: '' };
  console.log("AYRINTILI FIYATLANDIRMA!A1 → " + SHEET + '!' + PRECALC_NO_ADDR + ' (precalculation no)');
}

/* ------------------------------------------------------------------ */
/* 1) Sayfaları serileştir                                             */
/* ------------------------------------------------------------------ */

const sheets = {};
const externalCells = [];
let formulaCount = 0;

for (const name of wb.SheetNames) {
  const s = wb.Sheets[name];
  if (!s || !s['!ref']) {
    sheets[name] = { ref: 'A1:A1', v: {}, f: {}, cached: {} };
    continue;
  }
  const v = {};
  const f = {};
  const cached = {};

  for (const addr in s) {
    if (addr[0] === '!') continue;
    const cell = s[addr];
    if (!cell) continue;

    if (cell.f) {
      f[addr] = cell.f;
      formulaCount++;
      // Dış çalışma kitabına bağlı hücreler hesaplanamaz; Excel'in son
      // değerini saklayıp kullanıcıya "elle güncelle" olarak gösteriyoruz.
      if (isExternalFormula(cell.f)) {
        cached[addr] = cell.v === undefined ? null : cell.v;
        externalCells.push({
          sheet: name,
          addr,
          formula: cell.f,
          cached: cell.v === undefined ? null : cell.v,
        });
      }
      continue;
    }

    if (cell.v !== undefined && cell.v !== '') {
      v[addr] = typeof cell.v === 'string' ? cell.v.replace(/\r/g, '') : cell.v;
    }
  }

  sheets[name] = { ref: s['!ref'], v, f, cached };
}

for (const patch of FORMULA_PATCHES) {
  const sheet = sheets[patch.sheet];
  if (!sheet) throw new Error('Yama sayfası yok: ' + patch.sheet);
  const current = sheet.f[patch.addr];
  if (current === patch.now) continue;              // üretici zaten düzeltmiş
  if (current !== patch.was) {
    throw new Error([
      'Yama uymuyor: ' + patch.sheet + '!' + patch.addr,
      '  beklenen: ' + patch.was,
      '  bulunan : ' + (current === undefined ? '(formül yok)' : current),
      '  Kaynak kitap değişmiş; yamayı gözden geçirin.',
    ].join('\n'));
  }
  sheet.f[patch.addr] = patch.now;
  console.log('Formül düzeltildi: ' + patch.sheet + '!' + patch.addr + '  ' + patch.was + '  ->  ' + patch.now);
}

/* ------------------------------------------------------------------ */
/* 2) PRECALCULATION satır haritası                                    */
/* ------------------------------------------------------------------ */

/**
 * Excel'in kendi satır gruplama (outline) seviyeleri. Kaynak dosyada
 * kategori > alt kategori > ürün tipi > model > standart > kalem şeklinde
 * 6 seviyeye kadar iç içe gruplar var; Fiyat Kataloğu ağacı bunu kullanır.
 */
const rowLevels = ws['!rows'] || [];
const levelOf = (r) => {
  const info = rowLevels[r - 1];
  return info && info.level ? info.level : 0;
};

const range = XLSX.utils.decode_range(ws['!ref']);
let lastRow = HEADER_ROW;
for (let r = range.s.r; r <= range.e.r; r++) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell && (cell.v !== undefined && cell.v !== '' || cell.f)) { lastRow = r + 1; break; }
  }
}

const columns = {};
for (let c = range.s.c; c <= range.e.c; c++) {
  const col = XLSX.utils.encode_col(c);
  const h = val(col, HEADER_ROW);
  if (h !== undefined && h !== '') columns[col] = clean(String(h));
}

const externalRows = new Set(
  externalCells.filter((e) => e.sheet === SHEET).map((e) => parseInt(e.addr.replace(/[A-Z]/g, ''), 10)),
);

function inputsFor(row, cols) {
  const out = [];
  for (const col of cols) {
    const cell = get(col, row);
    if (cell && cell.f) continue; // formüllü hücre kullanıcıya kapalı
    out.push(col);
  }
  return out;
}

const outline = [];
/** Seviyeye göre en son görülen başlık — kalemlerin ata zinciri buradan çıkar. */
const titleByLevel = [];
let topCategory = '';
let subCategory = '';
let subAbbr = '';
let productType = '';
let standard = '';

let itemCount = 0;
let sectionCount = 0;

for (let r = HEADER_ROW + 1; r <= lastRow; r++) {
  const group =
    r > CATALOG_END && r < SUBTOTAL_ROW ? 'service'
      : r >= PLAN_START ? 'plan'
        : r >= SUBTOTAL_ROW ? 'total'
          : 'catalog';

  const hasA = filled('A', r);
  const identity = filled('B', r) || filled('C', r) || filled('E', r) || filled('H', r) || filled('I', r);
  const isSection = hasA && !filled('C', r) && !filled('E', r) && !filled('H', r) && !filled('I', r);

  if (isSection) {
    const title = clean(String(val('A', r)));
    const upper = title.toUpperCase();
    const abbr = filled('B', r) ? clean(String(val('B', r))) : '';

    let level;
    if (fillKey(get('A', r)) === TOP_LEVEL_FILL) {
      level = 1;
      topCategory = title; subCategory = ''; subAbbr = ''; productType = ''; standard = '';
    } else if (upper === 'SMS STANDARD' || upper === 'DIN STANDARD') {
      level = 4;
      standard = upper.startsWith('SMS') ? 'SMS' : 'DIN';
    } else if (abbr) {
      level = 2;
      subCategory = title; subAbbr = abbr; productType = ''; standard = '';
    } else {
      level = 3;
      productType = title; standard = '';
    }

    const lvl = levelOf(r);
    titleByLevel[lvl] = title;
    titleByLevel.length = lvl + 1;

    outline.push({
      r, kind: 'section', group, level, lvl, title,
      ...(abbr ? { abbr } : {}),
      path: [topCategory, subCategory, productType].filter(Boolean),
      /** Excel gruplamasına göre tam ata zinciri (bu başlık dahil değil). */
      tree: titleByLevel.slice(0, lvl).filter(Boolean),
    });
    sectionCount++;
    continue;
  }

  if (!identity && !filled('F', r) && !filled('M', r)) {
    outline.push({ r, kind: 'blank', group });
    continue;
  }

  if (group === 'catalog' || group === 'service') {
    const lvl = levelOf(r);
    const meta = {
      r,
      kind: 'item',
      group,
      lvl,
      path: [topCategory, subCategory, productType].filter(Boolean),
      /** Excel gruplamasına göre tam ata zinciri. */
      tree: titleByLevel.slice(0, lvl).filter(Boolean),
      standard,
      inputs: inputsFor(r, ITEM_INPUT_COLS),
    };
    if (externalRows.has(r)) meta.needsPrice = true;
    outline.push(meta);
    itemCount++;
  } else {
    outline.push({
      r,
      kind: 'summary',
      group,
      lvl: levelOf(r),
      inputs: inputsFor(r, SUMMARY_INPUT_COLS),
    });
  }
}


/* ------------------------------------------------------------------ */
/* 2b) Paslanmaz malzeme toplamı seçilen vana standardını izlesin       */
/* ------------------------------------------------------------------ */

/*
 * STAINLESS STEEL PRODUCTS satırının çarpanı (J) kaynakta her zaman
 * 'SMS PASLANMAZ' sayfasının toplamını okuyordu. Teklif DIN vanalarla
 * açıldığında yanlış boru/bağlantı malzemesi fiyatlanıyordu. Girilen vana
 * adetleri hangi standartta ağır basıyorsa o sayfanın toplamı kullanılır.
 *
 * SMS/DIN satır aralıkları kitabın kendi "SMS STANDARD" / "DIN STANDARD"
 * başlıklarından çıkarılır; hiçbiri sabit yazılmaz.
 */
const STAINLESS_TOTALS = {
  SMS: { sheet: 'SMS PASLANMAZ', label: 'TOPLAM' },
  DIN: { sheet: 'DIN PASLANMAZ MALZEME', label: 'TOPLAM' },
};

/** Sayfadaki "TOPLAM" satırının K hücresi — malzeme toplamı. */
function stainlessTotalAddr(sheetName) {
  const sh = wb.Sheets[sheetName];
  if (!sh || !sh['!ref']) throw new Error('Paslanmaz sayfası yok: ' + sheetName);
  const rng = XLSX.utils.decode_range(sh['!ref']);
  for (let r = rng.e.r + 1; r >= 1; r--) {
    const tag = sh['I' + r];
    if (!tag || typeof tag.v !== 'string') continue;
    if (tag.v.trim().toUpperCase() !== 'TOPLAM') continue;
    if (!sh['K' + r]) continue;
    return "'" + sheetName + "'!K" + r;
  }
  throw new Error(sheetName + ' sayfasında TOPLAM satırı (I=TOPLAM, K=tutar) bulunamadı.');
}

/** Aynı standarttaki ardışık kalem satırlarını SUM aralıklarına sıkıştırır. */
function qtySumExpr(standard) {
  const rows = outline
    .filter((row) => row.kind === 'item' && row.standard === standard)
    .map((row) => row.r)
    .sort((a, b) => a - b);
  if (rows.length === 0) return null;
  const parts = [];
  let start = rows[0];
  let prev = rows[0];
  for (let i = 1; i <= rows.length; i++) {
    if (rows[i] !== prev + 1) { parts.push('SUM(F' + start + ':F' + prev + ')'); start = rows[i]; }
    prev = rows[i];
  }
  return parts.join('+');
}

const stainlessRow = findLabelRow('STAINLESS STEEL PRODUCTS', OTHERS_ROW, SUBTOTAL_ROW);
const smsQty = qtySumExpr('SMS');
const dinQty = qtySumExpr('DIN');
if (!smsQty || !dinQty) {
  throw new Error('SMS/DIN kalem satırları bulunamadı — paslanmaz toplamı standarda bağlanamıyor.');
}

const smsTotal = stainlessTotalAddr(STAINLESS_TOTALS.SMS.sheet);
const dinTotal = stainlessTotalAddr(STAINLESS_TOTALS.DIN.sheet);
// Eşitlikte (ör. hiç vana girilmemişken) kitabın kendi varsayılanı: SMS.
sheets[SHEET].f['J' + stainlessRow] = 'IF((' + dinQty + ')>(' + smsQty + '),' + dinTotal + ',' + smsTotal + ')';
console.log('STAINLESS STEEL PRODUCTS (J' + stainlessRow + ') vana standardına bağlandı: ' +
  smsTotal + ' / ' + dinTotal);

/* ------------------------------------------------------------------ */
/* 3) Çıktı: workbook.json                                             */
/* ------------------------------------------------------------------ */

/**
 * Parametre satırlarını kitabın kendi etiketleriyle doğrular. Excel'de
 * beklenmedik bir satır eklenirse uzaklıklar kayar ve buradan patlar —
 * sessizce yanlış hücreden okumaktan iyidir.
 */
function assertParamAnchors() {
  const expect = [
    ['salesPrice', 'SALES PRICE'],
    ['profitMultiplier', 'PROFIT MULTIPLIER'],
    ['transportMultiplier', 'TRANSPORTATION MULTIPLIER'],
  ];
  for (const [key, label] of expect) {
    const addr = PARAMS.find((p) => p.key === key).addr;
    const row = parseInt(addr.replace(/[A-Z]/g, ''), 10);
    const tag = get('I', row);
    const text = tag && tag.v !== undefined ? String(tag.v).trim().toUpperCase() : '';
    if (text !== label) {
      throw new Error(
        'Parametre çapası tutmuyor: ' + key + ' -> ' + addr + ' satırında I sütunu "' +
        text + '", beklenen "' + label + '". Kitapta satır eklenmiş olabilir.'
      );
    }
  }
  console.log('Çapalar doğrulandı: ara toplam=' + SUBTOTAL_ROW + ', genel toplam=' +
    GRAND_TOTAL_ROW + ', katalog sonu=' + CATALOG_END);
}
assertParamAnchors();

const params = PARAMS.map((p) => {
  const cell = get(p.addr.replace(/[0-9]/g, ''), parseInt(p.addr.replace(/[A-Z]/g, ''), 10));
  return { ...p, sheet: SHEET, value: cell && cell.v !== undefined ? cell.v : null };
});

const meta = {
  sourceFile: path.basename(SOURCE),
  extractedAt: new Date().toISOString(),
  currency: 'EUR',
  lastRow,
  headerRow: HEADER_ROW,
  counts: { items: itemCount, sections: sectionCount, formulas: formulaCount },
  /**
   * Kitabın yapısal satırları. Uygulama kodu bunları okur; hiçbir yerde
   * satır numarası sabit yazılmaz, çünkü her yeni fiyat listesinde kayarlar.
   */
  anchors: {
    catalogEnd: CATALOG_END,
    subtotalRow: SUBTOTAL_ROW,
    grandTotalRow: GRAND_TOTAL_ROW,
    planStart: PLAN_START,
    /** "OTHERS" başlık satırı — genel gider bloğu buradan ara toplama kadar sürer. */
    othersRow: OTHERS_ROW,
    /** Formülü elle ezilip ↺ ile geri alınabilen blok (mühendislik/montaj). */
    manualFormulaStart: MANUAL_FORMULA_START,
    manualFormulaEnd: MANUAL_FORMULA_END,
    /** F hücresine 1 yazılmadıkça altındaki blok hesaplanmayan başlıklar. */
    gateRows,
    /** Paslanmaz malzeme toplamının vana standardına bağlandığı satır. */
    stainlessRow,
  },
};

const workbook = {
  meta,
  sheetNames: wb.SheetNames,
  sheets,
  outline,
  columns,
  externalCells,
  params,
};

fs.mkdirSync(path.dirname(OUT_WORKBOOK), { recursive: true });
fs.writeFileSync(OUT_WORKBOOK, JSON.stringify(workbook));

/* ------------------------------------------------------------------ */
/* 4) Çıktı: catalog.json — tüm kalemler                               */
/* ------------------------------------------------------------------ */

const catalogItems = [];
for (const row of outline) {
  if (row.kind !== 'item') continue;
  const r = row.r;

  const listPrice = typeof val('I', r) === 'number' ? val('I', r) : null;
  // Excel'de J ve K birer ÇARPAN'dır: J=0.33 -> liste fiyatının %33'ü ödenir.
  // Başlığı "% DISCOUNT" olsa da hesap M = F*I*J*K şeklindedir.
  const jRaw = typeof val('J', r) === 'number' ? val('J', r) : null;
  const kRaw = typeof val('K', r) === 'number' ? val('K', r) : null;
  const priceFactor = jRaw === null ? 1 : jRaw;
  const extraFactor = kRaw === null ? 1 : kRaw;
  const netPrice = listPrice === null ? null
    : Math.round(listPrice * priceFactor * extraFactor * 100) / 100;

  // PRECALCULATION'da formüllü hücreler kullanıcıya kapalıdır (Excel'de mor
  // gösterilirler). Hangi sütunun formüllü olduğu tek bir dizgede taşınır:
  // "FLMN" -> F, L, M, N formüllü.
  const fx = FORMULA_COLS.filter((c) => { const cell = get(c, r); return !!(cell && cell.f); }).join('');
  const num = (col) => (typeof val(col, r) === 'number' ? val(col, r) : null);

  // Kaynakta boş ve formülsüz olan tanım sütunları elle doldurulabilir.
  // Dolu katalog satırlarında bu hücreler kapalı kalır — kaynak veriyi
  // yanlışlıkla ezmemek için.
  const open = TEXT_INPUT_COLS.filter((c) => {
    const cell = get(c, r);
    if (cell && cell.f) return false;                 // formüllü hücre her zaman kapalı
    // Pompa şablonu satırlarında hücre dolu olsa da açıktır (bkz. FORCE_OPEN_ROWS).
    return FORCE_OPEN_ROWS.has(r) || !filled(c, r);
  }).join('');

  catalogItems.push({
    id: catalogItems.length + 1,
    row: r,
    group: row.group,
    placeOfUse: filled('A', r) ? clean(String(val('A', r))) : '',
    eqNo: filled('B', r) ? clean(String(val('B', r))) : '',
    techSpec: filled('C', r) ? clean(String(val('C', r))) : '',
    label: filled('D', r) ? clean(String(val('D', r))) : '',
    supplier: filled('E', r) ? clean(String(val('E', r))) : '',
    machineType: filled('H', r) ? clean(String(val('H', r))) : '',
    listPrice,
    priceFactor,
    extraFactor,
    /** Gerçek iskonto oranı: 1 - J*K */
    discount: Math.round((1 - priceFactor * extraFactor) * 10000) / 10000,
    netPrice,
    sparePartNo: filled('P', r) ? clean(String(val('P', r))) : '',
    sparePartDesc: filled('Q', r) ? clean(String(val('Q', r))) : '',
    sparePartPrice: typeof val('R', r) === 'number' ? val('R', r) : null,
    inletDiameter: filled('AY', r) ? clean(String(val('AY', r))) : '',
    outletDiameter: filled('AZ', r) ? clean(String(val('AZ', r))) : '',
    connections: typeof val('BA', r) === 'number' ? val('BA', r) : null,
    /** F sütunu — kaynak dosyadaki miktar (formüllüyse Excel'in son sonucu). */
    qty: num('F') ?? 0,
    /** L sütunu — NAKLİYE: I*J*K*M$4878*F */
    transportCost: num('L'),
    /** M sütunu — TOPLAM MALİYET: F*I*J*K */
    totalCost: num('M'),
    /** N sütunu — SATIŞ FİYATI: M/M$4877 */
    salesPrice: num('N'),
    /** Formüllü (salt okunur) sütunların harfleri. */
    fx,
    /**
     * Kaynakta boş olduğu için elle doldurulabilen tanım sütunları ("CDEH").
     * Excel'de bu satırlar boş şablondur (ör. CENTRIFUGAL PUMP & FAN).
     */
    open,
    /** Excel gruplamasındaki ata başlıklar — ağaç görünümü bunu kullanır. */
    tree: row.tree || [],
    topCategory: row.path[0] || '',
    subCategory: row.path[1] || '',
    productType: row.path[2] || '',
    standard: row.standard || '',
    needsPrice: !!row.needsPrice,
  });
}

fs.writeFileSync(OUT_CATALOG, JSON.stringify({
  meta: { ...meta, totalItems: catalogItems.length },
  items: catalogItems,
}));

/* ------------------------------------------------------------------ */
/* 5) Çıktı: precalculation.json — eski biçim (eşleştirme motorları)   */
/* ------------------------------------------------------------------ */

const legacyTopSet = new Set(LEGACY_TOP_CATEGORIES.map((s) => s.toUpperCase()));
const formulaCells = new Set(Object.keys(sheets[SHEET].f));
const legacyItems = [];

for (const it of catalogItems) {
  // Eski dosyanın kapsamı korunuyor: teknik açıklaması ve liste fiyatı olan
  // her kalem (hizmet bölümündeki operatör paneli, IPC, lisans vb. dahil).
  // Modül eşleştirme motorları bu listeyi tarıyor; kapsamı daraltmak
  // eşleşmeleri bozardı.
  if (!it.listPrice) continue;
  if (!it.techSpec) continue;
  // Teknik açıklaması formülle üretilen satırlar ürün değildir (ör. C4818).
  if (formulaCells.has('C' + it.row)) continue;

  const top = it.topCategory;

  legacyItems.push({
    id: legacyItems.length + 1,
    eqNo: it.eqNo,
    techSpec: it.techSpec,
    label: it.label,
    supplier: it.supplier,
    machineType: it.machineType,
    listPrice: it.listPrice,
    // DÜZELTME: Excel'de J/K çarpandır. Gerçek iskonto = 1 - J*K.
    discount: it.discount,
    netPrice: it.netPrice,
    topCategory: top,
    subCategory: it.subCategory,
    productType: it.productType,
    standard: it.standard,
  });
}

fs.mkdirSync(path.dirname(OUT_LEGACY), { recursive: true });
fs.writeFileSync(OUT_LEGACY, JSON.stringify({
  meta: {
    totalItems: legacyItems.length,
    sourceFile: path.basename(SOURCE),
    sheet: SHEET,
    extractedAt: meta.extractedAt,
    currency: 'EUR',
  },
  items: legacyItems,
}));

/* ------------------------------------------------------------------ */
/* Özet                                                                */
/* ------------------------------------------------------------------ */

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + ' KB';

console.log('');
console.log('  ' + OUT_WORKBOOK.padEnd(34) + itemCount + ' kalem, ' + sectionCount + ' başlık, ' + formulaCount + ' formül  (' + kb(OUT_WORKBOOK) + ')');
console.log('  ' + OUT_CATALOG.padEnd(34) + catalogItems.length + ' kalem  (' + kb(OUT_CATALOG) + ')');
console.log('  ' + OUT_LEGACY.padEnd(34) + legacyItems.length + ' fiyatlı kalem  (' + kb(OUT_LEGACY) + ')');
console.log('');
console.log('  Dış dosyaya bağlı, elle güncellenmesi gereken hücreler: ' + externalCells.length);
for (const e of externalCells) {
  console.log('    ' + e.sheet + '!' + e.addr + '  =  ' + e.formula.slice(0, 70) + (e.formula.length > 70 ? '…' : ''));
}

const noPrice = catalogItems.filter((i) => !i.listPrice).length;
console.log('');
console.log('  Fiyatı boş kalem: ' + noPrice + ' (listede gösterilir, fiyat elle girilebilir)');

const tally = {};
for (const i of catalogItems) tally[i.topCategory || '(kategorisiz)'] = (tally[i.topCategory || '(kategorisiz)'] || 0) + 1;
console.log('');
console.log('  Üst kategoriye göre dağılım:');
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log('    ' + String(v).padStart(5) + '  ' + k);
}
