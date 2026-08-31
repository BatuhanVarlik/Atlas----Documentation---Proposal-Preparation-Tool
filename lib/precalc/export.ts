/**
 * Hesaplanmış precalculation'ı Excel dosyasına yazar.
 *
 * Kaynak .xlsm dosyası okunmaz/değiştirilmez; çıktı, motorun hesapladığı
 * değerlerden sıfırdan üretilir.
 *
 * Biçimlendirme `xlsx` yerine `xlsx-js-style` ile yazılır: SheetJS'in
 * topluluk sürümü yazarken hücre stillerini sessizce düşürüyor, bu yüzden
 * üretilen dosyada başlık, kategori ve toplam satırları birbirinden
 * ayırt edilemiyordu. API ikisinde de aynı.
 */

import * as XLSX from 'xlsx-js-style';
import { PrecalcEngine } from './engine';
import { indexToCol, isError } from './formula';
import {
  ROW_HEIGHT, S_BLOCK_TITLE, S_HEAD, S_LABEL, S_LABEL_VALUE, S_TITLE,
  itemStyle, sectionStyle, totalStyle, type NumFmtKey,
} from './exportStyle';
import type { PrecalcEntries, PrecalcWorkbook, RowMeta } from './types';

/**
 * Çıktıya alınacak sütunlar.
 *
 * `fmt` hücrenin Excel sayı biçimini, `input` / `computed` ise dolgu rengini
 * belirler — dosyayı açan kişi neyin elle girildiğini, neyin hesaplandığını
 * ekrandaki renklerin aynısından tanısın.
 */
export const EXPORT_COLUMNS: {
  col: string;
  header: string;
  width: number;
  fmt?: NumFmtKey;
  input?: boolean;
  computed?: boolean;
}[] = [
  { col: 'A', header: 'PLACE OF USE', width: 30 },
  { col: 'B', header: 'EQUIPMENT NUMBER', width: 18 },
  { col: 'C', header: 'TECHNICAL SPECIFICATION', width: 60 },
  { col: 'D', header: 'LABEL', width: 12 },
  { col: 'E', header: 'SUPPLIER', width: 18 },
  { col: 'F', header: 'QUANTITY', width: 10, fmt: 'qty', input: true },
  { col: 'H', header: 'MACHINE / EQUIPMENT', width: 28 },
  { col: 'I', header: 'LIST PRICE', width: 12, fmt: 'money', input: true },
  { col: 'J', header: '% DISCOUNT', width: 10, fmt: 'factor' },
  { col: 'K', header: '% EXTRA DISCOUNT', width: 12, fmt: 'factor' },
  { col: 'L', header: 'TRANSPORT COST', width: 14, fmt: 'money', computed: true },
  { col: 'M', header: 'TOTAL COST', width: 14, fmt: 'money', computed: true },
  { col: 'N', header: 'SALES PRICE', width: 14, fmt: 'money', computed: true },
  { col: 'P', header: 'YEDEK PARÇA NO', width: 16 },
  { col: 'Q', header: 'YEDEK PARÇA TANIMLAMA', width: 30 },
  { col: 'R', header: 'YEDEK PARÇA FİYAT', width: 14, fmt: 'money', input: true },
  { col: 'S', header: 'YEDEK PARÇA TOPLAM FİYAT', width: 16, fmt: 'money', computed: true },
  { col: 'U', header: 'TEDARİK SÜRESİ', width: 12, fmt: 'int' },
  { col: 'V', header: 'ÖDEME HAFTASI', width: 12, fmt: 'int' },
  { col: 'W', header: 'HEMİTEK OC NO', width: 14 },
  { col: 'X', header: 'SİPARİŞ TARİHİ', width: 14, fmt: 'date', input: true },
  { col: 'Y', header: 'POLONYA & DANIMARKA OC NO', width: 18 },
  { col: 'Z', header: 'TAHMİNİ YÜKLEME TARİHİ', width: 16, fmt: 'date', computed: true },
  { col: 'AB', header: 'GÜMRÜĞE GELİŞ TARİHİ', width: 16, fmt: 'date', computed: true },
];

/**
 * Ekipman ve sevk listelerinin bir satırı. Kaynak kitaptaki iki sayfa da
 * aynı alanları kullanır; yalnızca gruplama ölçütü ve Fiyat sütunu farklıdır.
 */
/** Ekipman ve sevk listelerinin bir satırı. */
interface QuoteLine {
  row: number;
  eqNo: string;
  techSpec: string;
  label: string;
  supplier: string;
  qty: number;
  machine: string;
  /** M sütunu — bu satırın toplam maliyeti (sevk listesindeki "Fiyat"). */
  totalCost: number;
}

/**
 * Ekipman listesi grupları. Excel makrosu satır aralıklarını
 * "Ekipman Listesi Limitleri" sayfasından okur (D = başlangıç, E = bitiş);
 * biz de oradan okuyoruz, çünkü sürüm değiştikçe APV o sayfayı güncelliyor.
 *
 * `apvOnly` alanı makronun kuralını taşır:
 *   APV MATERIALS  -> yalnızca LABEL = "APV" olanlar
 *   PROCESS VALVES -> aynı aralık, ama LABEL <> "APV" olanlar
 *   PUMPS          -> etikete bakılmaz, hepsi
 */
const EQUIPMENT_GROUPS: { title: string; limitRow: number; apvOnly: boolean | null }[] = [
  { title: 'APV MATERIALS', limitRow: 7, apvOnly: true },
  { title: 'PROCESS VALVES', limitRow: 8, apvOnly: false },
  { title: 'UTILITY MATERIALS', limitRow: 9, apvOnly: false },
  { title: 'PUMPS', limitRow: 10, apvOnly: null },
  { title: 'INSTRUMENTS', limitRow: 11, apvOnly: false },
  { title: 'OTHER PROCESS MATERIALS', limitRow: 12, apvOnly: false },
  { title: 'HEAT EXCHANGERS', limitRow: 13, apvOnly: false },
  { title: 'MEMBRANE & HOUSING', limitRow: 14, apvOnly: false },
];

/**
 * Sevk listesindeki marka sırası — kaynak kitapta hazır basılı roster.
 * Kalemi olmayan marka da başlık olarak yazılır (makro da öyle yapıyor):
 * satın alma bu listeyi tedarikçi tedarikçi gezerek kullanıyor.
 */
const SHIPPING_BRANDS = [
  'APV', 'BURKERT', 'EUROBINOX', 'SPIRAX SARCO', 'E-H', 'IFM', 'HRS', 'FESTO',
  'PAKKENS', 'ATERMA', 'BORŞEN', 'GERMETAL', 'MAXVAL', 'DIVERSEY', 'TAPFLO',
  'JUMO', 'GÜCÜM', 'YOKOGAWA', 'VENAIR', 'HAUS', 'SAMSON', 'MINEBEA',
  'METAL WORKS', 'STELZER', 'DONALDSON',
];

/**
 * Makroda BORŞEN, LABEL yerine SUPPLIER sütunuyla eşleştiriliyor
 * (o kalemlerin etiketi marka değil malzeme cinsi).
 */
const MATCH_BY_SUPPLIER = new Set(['BORŞEN']);

/** Ekipman numarasına göre depo bakiyesi / asgari stok. */
export interface StockRow { depoBakiye: number; asgariStok: number }

export interface ExportOptions {
  /** true ise yalnızca miktarı girilmiş kalemler yazılır. */
  onlyEntered: boolean;
  /**
   * Ekipman numarasına göre depo bakiyesi / asgari stok. Sunucudan
   * (/api/stock) gelir; verilmezse bu iki sütun boş kalır.
   */
  stock?: Record<string, StockRow>;
  /** Başlık bloğuna yazılacak proje bilgileri. */
  header?: {
    customer?: string;
    endUser?: string;
    date?: string;
    preparedBy?: string;
    projectNo?: string;
    precalcNo?: string;
  };
}

type Cell = XLSX.CellObject;
type Style = XLSX.CellStyle;

/**
 * Excel gün sayısını okunur tarihe çevirir. Dönüşüm elle yazılmaz: 1900'ün
 * artık yıl sayılması gibi tuhaflıkları xlsx'in kendi ayrıştırıcısı bilir.
 */
function excelDate(serial: number): string {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d) return String(serial);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.d)}.${pad(d.m)}.${d.y}`;
}

function cellFor(value: unknown, style?: Style): Cell | null {
  if (value === null || value === undefined || value === '') return null;
  let cell: Cell;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    cell = { t: 'n', v: value };
  } else if (typeof value === 'boolean') {
    cell = { t: 'b', v: value };
  } else {
    cell = { t: 's', v: String(value) };
  }
  if (style) cell.s = style;
  return cell;
}

/**
 * Boş da olsa biçimlendirilmiş hücre üretir.
 *
 * Kenarlıklar ancak hücre varsa çizilir; boş bırakılan sütunlarda tablo
 * ızgarası kopuyordu. Değeri olmayan hücre `t: 's'` + boş metin olarak
 * yazılır, Excel'de boş görünür ama çerçevesi durur.
 */
function styledBlank(style: Style): Cell {
  return { t: 's', v: '', s: style };
}

/**
 * PRECALCULATION sayfasını hesaplanmış hâliyle bir çalışma kitabına yazar.
 */
export function buildPrecalcWorkbook(
  wb: PrecalcWorkbook,
  entries: PrecalcEntries,
  options: ExportOptions,
): XLSX.WorkBook {
  const engine = new PrecalcEngine(wb);
  engine.setEntries(entries);
  /*
   * Kaynak kitap yinelemeli hesapla (calcPr iterate="1") kaydedilmiştir:
   * genel gider, dolu kategori sayısına bölünerek dağıtılır ve o sayı yine
   * dağıtımın kendisine bakar. Tek geçişte bu hücreler 0 kalıp #DIV/0!
   * veriyordu — AYRINTILI FIYATLANDIRMA sayfası çıktıda 14 hata hücresiyle
   * geliyordu. settle() Excel'in yaptığı gibi değerleri sabitler.
   */
  engine.settle();

  const sheet: XLSX.WorkSheet = {};
  const rowHeights: XLSX.RowInfo[] = [];
  let out = 0; // 0 tabanlı çıktı satırı

  const put = (col: number, value: unknown, style?: Style) => {
    const cell = style ? (cellFor(value, style) ?? styledBlank(style)) : cellFor(value);
    if (!cell) return;
    sheet[XLSX.utils.encode_cell({ r: out, c: col })] = cell;
  };

  /** Satır yüksekliğini not eder — başlıklar ve kategoriler nefes alsın. */
  const setRowHeight = (hpt: number) => { rowHeights[out] = { hpt }; };

  const readCell = (addr: string) => {
    const v = engine.value(addr);
    return isError(v) ? '' : v;
  };

  /* ---- Başlık bloğu ---- */
  // A sütunu etiketi taşır, değer B sütunundadır; adresler params'tan gelir.
  const h = options.header ?? {};
  const projectField = (key: string) => {
    const addr = engine.paramAddr(key);
    if (!addr) return '';
    const v = engine.value(addr);
    if (v === null || isError(v)) return '';
    if (key === 'date' && typeof v === 'number') return excelDate(v);
    return String(v);
  };
  /** Etiket + değer ikilisi; değer boş olsa da çerçevesi durur. */
  const identity = (labelCol: number, label: string, value: unknown) => {
    put(labelCol, label, S_LABEL);
    put(labelCol + 1, value, S_LABEL_VALUE);
  };

  put(0, wb.meta.sourceFile.replace(/\.xlsm?$/i, ''), S_TITLE);
  setRowHeight(20);
  out++;
  identity(0, 'CUSTOMER:', h.customer ?? projectField('customer'));
  identity(3, 'PROJECT NO:', h.projectNo ?? projectField('projectNo'));
  out++;
  identity(0, 'END USER:', h.endUser ?? projectField('endUser'));
  identity(3, 'PRECALCULATION NO:', h.precalcNo ?? projectField('precalcNo'));
  out++;
  identity(0, 'DATE:', h.date ?? (projectField('date') || new Date().toLocaleDateString('tr-TR')));
  identity(3, 'CURRENCY:', wb.meta.currency);
  out++;
  identity(0, 'PREPARED BY:', h.preparedBy ?? projectField('preparedBy'));
  out++;
  out++; // boş satır

  /* ---- Sütun başlıkları ---- */
  EXPORT_COLUMNS.forEach((c, i) => put(i, c.header, S_HEAD));
  setRowHeight(ROW_HEIGHT.head);
  const headerRowIndex = out;
  out++;

  /* ---- Satırlar ---- */
  const kept: RowMeta[] = [];
  const outline = wb.outline;

  if (options.onlyEntered) {
    // Miktarı olan kalemleri ve onları kapsayan başlıkları koru.
    const keepRows = new Set<number>();
    const pendingSections: RowMeta[] = [];

    for (const row of outline) {
      if (row.kind === 'section') {
        // Aynı seviyedeki eski başlıkları at, yenisini beklemeye al
        while (pendingSections.length && (pendingSections[pendingSections.length - 1].level ?? 0) >= (row.level ?? 0)) {
          pendingSections.pop();
        }
        pendingSections.push(row);
        continue;
      }
      if (row.kind === 'blank') continue;

      const qty = engine.num('F' + row.r);
      const cost = engine.num('M' + row.r);
      if (row.kind === 'item' && qty === 0 && cost === 0) continue;
      if (row.kind === 'summary' && qty === 0 && cost === 0) continue;

      for (const s of pendingSections) keepRows.add(s.r);
      pendingSections.length = 0;
      keepRows.add(row.r);
    }
    for (const row of outline) if (keepRows.has(row.r)) kept.push(row);
  } else {
    for (const row of outline) if (row.kind !== 'blank') kept.push(row);
  }

  const AN0 = engine.anchors;
  let stripe = false;

  for (const row of kept) {
    if (row.kind === 'section') {
      const style = sectionStyle(row.level ?? 1);
      // Dolgu satır boyunca sürsün: yarısı renkli yarısı beyaz başlık,
      // kategori kırılımını okunmaz yapıyordu.
      EXPORT_COLUMNS.forEach((_c, i) => put(i, i === 0 ? row.title : i === 1 ? row.abbr : '', style));
      setRowHeight(ROW_HEIGHT.section);
      stripe = false;
      out++;
      continue;
    }

    if (row.kind === 'summary') {
      const grand = row.r === AN0.grandTotalRow;
      EXPORT_COLUMNS.forEach((c, i) => put(i, readCell(c.col + row.r), totalStyle({ fmt: c.fmt, grand })));
      setRowHeight(grand ? 20 : 17);
      stripe = false;
      out++;
      continue;
    }

    EXPORT_COLUMNS.forEach((c, i) => put(i, readCell(c.col + row.r), itemStyle({
      fmt: c.fmt,
      align: c.fmt ? 'right' : 'left',
      input: c.input,
      computed: c.computed,
      striped: stripe,
    })));
    setRowHeight(ROW_HEIGHT.item);
    stripe = !stripe;
    out++;
  }

  /* ---- Ödeme planı ---- */
  out++;
  [0, 1, 2, 3].forEach((i) => put(i, i === 0 ? 'PAYMENT PLAN' : '', S_BLOCK_TITLE));
  setRowHeight(20);
  out++;
  const AN = engine.anchors;
  const paramCell = (key: string) => readCell(engine.paramAddr(key) ?? '');

  /** Plan bloğundaki "etiket : değer" satırı. */
  const planParam = (label: string, value: unknown, fmt?: NumFmtKey) => {
    put(0, label, itemStyle({ bold: true }));
    put(1, value, itemStyle({ fmt, align: 'right', computed: true }));
    out++;
  };
  planParam('ORDER DATE', paramCell('orderDate'), 'date');
  planParam('SALES PROFIT RATE', readCell('M' + (AN.subtotalRow + 19)), 'percent');
  planParam('PROFIT MULTIPLIER', paramCell('profitMultiplier'), 'factor');
  planParam('TRANSPORTATION MULTIPLIER', paramCell('transportMultiplier'), 'factor');
  out++;

  ['Aşama', 'Oran', 'Hafta', 'Tutar'].forEach((t, i) => put(i, t, S_HEAD));
  setRowHeight(18);
  out++;
  // Ödeme planı kalemleri: nakliye çarpanı satırından başlayıp 8 satır sürer.
  const planFirst = AN.subtotalRow + 21;
  const PLAN_FMT: (NumFmtKey | undefined)[] = [undefined, 'percent', 'int', 'money'];
  for (let r = planFirst; r <= planFirst + 7; r++) {
    ['A', 'B', 'C', 'D'].forEach((c, i) => put(i, readCell(c + r), itemStyle({
      fmt: PLAN_FMT[i],
      align: i === 0 ? 'left' : 'right',
      computed: i > 0,
    })));
    out++;
  }
  [0, 1, 2, 3].forEach((i) => put(
    i,
    i === 0 ? 'TOPLAM' : i === 3 ? readCell('D' + (planFirst + 8)) : '',
    totalStyle({ fmt: i === 3 ? 'money' : undefined, grand: true }),
  ));
  out++;

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: out, c: EXPORT_COLUMNS.length - 1 } });
  sheet['!cols'] = EXPORT_COLUMNS.map((c) => ({ wch: c.width }));
  sheet['!rows'] = rowHeights;
  sheet['!freeze'] = { xSplit: 0, ySplit: headerRowIndex + 1 };
  // Başlık şeridine süzgeç: 3.600 satırlık listede tedarikçi/etiket süzmek
  // dosyayı açan kişinin ilk yaptığı iş.
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: out, c: EXPORT_COLUMNS.length - 1 },
    }),
  };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'PRECALCULATION');

  /* ---- Ekipman ve sevk listeleri ---- */
  // Her ikisi de yalnızca miktarı girilmiş kalemleri gösterir: sipariş ve
  // sevkiyat için kullanıldıklarından tüm katalog anlamsız olur.
  const lines: QuoteLine[] = [];
  for (const row of wb.outline) {
    if (row.kind !== 'item') continue;
    const qty = engine.num('F' + row.r);
    if (qty <= 0) continue;
    lines.push({
      row: row.r,
      eqNo: engine.text('B' + row.r),
      techSpec: engine.text('C' + row.r),
      label: engine.text('D' + row.r),
      supplier: engine.text('E' + row.r),
      qty,
      machine: engine.text('H' + row.r),
      // Kuruşa yuvarlanır: kayan nokta artığı listede okunmaz oluyor.
      totalCost: Math.round(engine.num('M' + row.r) * 100) / 100,
    });
  }

  const listMeta = {
    sourceFile: wb.meta.sourceFile.replace(/\.xlsm?$/i, ''),
    customer: [h.customer ?? projectField('customer'), h.endUser ?? projectField('endUser')]
      .filter(Boolean).join(' / '),
    date: h.date ?? (projectField('date') || new Date().toLocaleDateString('tr-TR')),
  };

  // Grup satır aralıkları "Ekipman Listesi Limitleri" sayfasından okunur;
  // sürüm değiştikçe orası güncellendiği için burada sabit satır tutulmaz.
  const limitSheet = wb.sheets['Ekipman Listesi Limitleri'];
  const limitRange = (limitRow: number) => {
    const from = limitSheet?.v['D' + limitRow];
    const to = limitSheet?.v['E' + limitRow];
    return typeof from === 'number' && typeof to === 'number' ? { from, to } : null;
  };

  const stock = options.stock ?? {};
  XLSX.utils.book_append_sheet(
    book, buildEquipmentSheet(lines, limitRange, stock, listMeta), 'EQUIPMENT LIST');
  XLSX.utils.book_append_sheet(
    book, buildShippingSheet(lines, stock, listMeta), 'Sevk Listesi');

  /* ---- AYRINTILI FIYATLANDIRMA ---- */
  // Kaynak kitaptaki maliyet kırılımı sayfası. Hesap motoru bu sayfayı da
  // canlı hesapladığı için çıktıya hesaplanmış hâliyle konur; kullanıcı
  // teklifi Excel'de açtığında kırılımı da elinde bulur.
  const detailed = buildSheetSnapshot(engine, DETAILED_SHEET);
  if (detailed) XLSX.utils.book_append_sheet(book, detailed, DETAILED_SHEET);

  /* ---- Özet sayfası ---- */
  XLSX.utils.book_append_sheet(book, buildSummarySheet(wb, engine, {
    itemCount: kept.filter((r) => r.kind === 'item').length,
  }), 'ÖZET');

  return book;
}

/** Kaynak kitaptaki maliyet kırılımı sayfasının adı. */
export const DETAILED_SHEET = 'AYRINTILI FIYATLANDIRMA';

/** Özet sayfası — teklifin tek bakışta rakamları. */
function buildSummarySheet(
  wb: PrecalcWorkbook,
  engine: PrecalcEngine,
  opts: { itemCount: number },
): XLSX.WorkSheet {
  const AN = engine.anchors;
  const sheet: XLSX.WorkSheet = {};
  let r = 0;

  const put = (c: number, value: unknown, style?: Style) => {
    const cell = style ? (cellFor(value, style) ?? styledBlank(style)) : cellFor(value);
    if (cell) sheet[XLSX.utils.encode_cell({ r, c })] = cell;
  };
  const row = (label: string, value: unknown, fmt?: NumFmtKey, total = false) => {
    put(0, label, total ? totalStyle() : itemStyle({ bold: true }));
    put(1, value, total ? totalStyle({ fmt, grand: true }) : itemStyle({ fmt, align: 'right' }));
    r++;
  };

  [0, 1].forEach((c) => put(c, c === 0 ? 'PRECALCULATION ÖZET' : '', S_BLOCK_TITLE));
  r += 2;
  row('Kaynak dosya', wb.meta.sourceFile);
  row('Oluşturulma', new Date().toLocaleString('tr-TR'));
  row('Para birimi', wb.meta.currency);
  row('Kalem sayısı (miktar girilmiş)', opts.itemCount, 'int');
  r++;
  row('ARA TOPLAM (maliyet)', engine.num('M' + AN.subtotalRow), 'money');
  row('ARA TOPLAM (satış)', engine.num('N' + AN.subtotalRow), 'money');
  row('Kâr oranı', engine.num('M' + (AN.subtotalRow + 19)), 'percent');
  r++;
  row('GENEL TOPLAM (maliyet)', engine.num('M' + AN.grandTotalRow), 'money', true);
  row('GENEL TOPLAM (satış)', engine.num('N' + AN.grandTotalRow), 'money', true);

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 1 } });
  sheet['!cols'] = [{ wch: 34 }, { wch: 26 }];
  return sheet;
}

/**
 * Kitabın herhangi bir sayfasını hesaplanmış hâliyle Excel sayfasına döker.
 *
 * PRECALCULATION dışındaki sayfalar (AYRINTILI FIYATLANDIRMA, KABLO, panel
 * listeleri…) serbest yerleşimlidir — sabit bir sütun şeması yoktur. Bu
 * yüzden ızgara olduğu gibi taşınır; ayırt etme işini biçimlendirme yapar:
 * formüllü hücre mor, elle girilen sarı, metin başlıklar kalın.
 */
export function buildSheetSnapshot(engine: PrecalcEngine, sheetName: string): XLSX.WorkSheet | null {
  const data = engine.workbook.sheets[sheetName];
  if (!data) return null;

  let maxRow = 0;
  let maxCol = 0;
  for (const addr of [...Object.keys(data.v), ...Object.keys(data.f)]) {
    const m = /^([A-Z]+)(\d+)$/.exec(addr);
    if (!m) continue;
    let col = 0;
    for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
    maxRow = Math.max(maxRow, parseInt(m[2], 10));
    maxCol = Math.max(maxCol, col);
  }
  if (maxRow === 0) return null;

  const sheet: XLSX.WorkSheet = {};
  const widths = new Array<number>(maxCol).fill(10);

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const addr = indexToCol(c - 1) + r;
      const raw = engine.value(addr, sheetName);
      if (raw === null || raw === undefined || raw === '') continue;

      const value = isError(raw) ? raw.code : raw;
      const isFormula = engine.hasFormula(addr, sheetName);
      const edited = engine.isUserEntry(addr, sheetName);
      const numeric = typeof value === 'number';

      const style = itemStyle({
        // Para mı sade sayı mı ayırt edilemiyor: kırılım sayfalarında ikisi de
        // tutar olduğu için para biçimi en az yanıltıcı olanı.
        fmt: numeric ? 'money' : undefined,
        align: numeric ? 'right' : 'left',
        input: edited,
        computed: isFormula,
        bold: !numeric && !isFormula,
      });
      sheet[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })] = cellFor(value, style)!;

      const len = String(isError(raw) ? raw.code : value).length;
      widths[c - 1] = Math.min(Math.max(widths[c - 1], len + 2), 60);
    }
  }

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow - 1, c: maxCol - 1 } });
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  return sheet;
}

/**
 * Ekipman / sevk listesi sayfasının iskeleti — Excel makrosuyla aynı düzen:
 *   C2 (ya da C1): kitap adı        G1/H1: Customer + " / " + End user
 *   G2/H2: tarih                    3. satır: sütun başlıkları
 *   5. satırdan itibaren gruplar (başlık kalın, altında kalemler)
 */
function listSheetShell(opts: {
  titleCell: string;
  sourceFile: string;
  customer: string;
  date: string;
  headers: string[];
  widths: number[];
  /** Sayı biçimi gereken sütunlar (başlık sırasına göre). */
  formats?: (NumFmtKey | undefined)[];
}) {
  const sheet: XLSX.WorkSheet = {};
  const rows: XLSX.RowInfo[] = [];
  const FIRST_COL = 1; // B sütunu
  const put = (r: number, col: number, value: unknown, style?: Style) => {
    const cell = style ? (cellFor(value, style) ?? styledBlank(style)) : cellFor(value);
    if (cell) sheet[XLSX.utils.encode_cell({ r, c: FIRST_COL + col })] = cell;
  };

  sheet[opts.titleCell] = { t: 's', v: opts.sourceFile, s: S_TITLE };
  rows[0] = { hpt: 20 };
  put(0, 5, 'Customer :', S_LABEL);
  put(0, 6, opts.customer, S_LABEL_VALUE);
  put(1, 5, 'Date :', S_LABEL);
  put(1, 6, opts.date, S_LABEL_VALUE);
  opts.headers.forEach((h, i) => put(2, i, h, S_HEAD));
  rows[2] = { hpt: ROW_HEIGHT.head };

  const fmts = opts.formats ?? [];

  return {
    sheet,
    /** Grup başlığı (marka ya da ekipman grubu) — satır boyunca renkli. */
    putGroup(r: number, title: string) {
      opts.headers.forEach((_h, i) => put(r, i, i === 0 ? title : '', sectionStyle(1)));
      rows[r] = { hpt: ROW_HEIGHT.section };
    },
    /** Kalem satırı — sütun biçimleri ve zebra gölgesi uygulanır. */
    putRow(r: number, values: unknown[], striped: boolean) {
      opts.headers.forEach((_h, i) => put(r, i, values[i], itemStyle({
        fmt: fmts[i],
        align: fmts[i] ? 'right' : 'left',
        striped,
      })));
      rows[r] = { hpt: ROW_HEIGHT.item };
    },
    finish(lastRow: number) {
      sheet['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(lastRow, 4), c: FIRST_COL + opts.headers.length - 1 },
      });
      sheet['!cols'] = [{ wch: 3 }, ...opts.widths.map((w) => ({ wch: w }))];
      sheet['!rows'] = rows;
      sheet['!freeze'] = { xSplit: 0, ySplit: 3 };
      sheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 2, c: FIRST_COL },
          e: { r: Math.max(lastRow, 4), c: FIRST_COL + opts.headers.length - 1 },
        }),
      };
      return sheet;
    },
  };
}

/**
 * EQUIPMENT LIST — üretim/depo için ekipman dökümü.
 *
 * Gruplar ve satır aralıkları "Ekipman Listesi Limitleri" sayfasından gelir.
 * İlk iki grup aynı aralığı paylaşır: APV etiketliler "APV MATERIALS"a,
 * geri kalanı "PROCESS VALVES"a düşer.
 */
function buildEquipmentSheet(
  lines: QuoteLine[],
  limits: (limitRow: number) => { from: number; to: number } | null,
  stock: Record<string, StockRow>,
  meta: { sourceFile: string; customer: string; date: string },
): XLSX.WorkSheet {
  const { putGroup, putRow, finish } = listSheetShell({
    titleCell: 'C2',
    ...meta,
    headers: ['EQUIPMENT NUMBER', 'TECHNICAL SPECIFICATION', 'LABEL', 'SUPPLIER',
      'QUANTITY', 'MACHINE / EQUIPMENT', 'Sipariş Numarası', 'Depo Bakiyesi', 'Asgari Stok'],
    widths: [30, 90, 10, 18, 10, 24, 16, 14, 12],
    formats: [undefined, undefined, undefined, undefined, 'qty', undefined, undefined, 'qty', 'qty'],
  });

  const byRow = new Map(lines.map((l) => [l.row, l]));
  let r = 4; // 5. satır (0 tabanlı)

  for (const group of EQUIPMENT_GROUPS) {
    putGroup(r, group.title);
    r++;
    const range = limits(group.limitRow);
    if (!range) continue;

    let stripe = false;
    for (let src = range.from; src <= range.to; src++) {
      const l = byRow.get(src);
      if (!l) continue;
      const isApv = l.label.trim().toUpperCase() === 'APV';
      if (group.apvOnly === true && !isApv) continue;
      if (group.apvOnly === false && isApv) continue;

      const st = stock[l.eqNo];
      putRow(r, [l.eqNo, l.techSpec, l.label, l.supplier, l.qty, l.machine, '',
        st?.depoBakiye, st?.asgariStok], stripe);
      stripe = !stripe;
      r++;
    }
  }
  return finish(r);
}

/**
 * Sevk Listesi — satın almanın tedarikçi tedarikçi kullandığı liste.
 * Marka sırası sabit roster'dan gelir; kalemi olmayan marka da başlık olarak
 * yazılır, gruplar arasında bir boş satır bırakılır.
 */
function buildShippingSheet(
  lines: QuoteLine[],
  stock: Record<string, StockRow>,
  meta: { sourceFile: string; customer: string; date: string },
): XLSX.WorkSheet {
  const { putGroup, putRow, finish } = listSheetShell({
    titleCell: 'C1',
    ...meta,
    headers: ['EQUIPMENT NUMBER', 'TECHNICAL SPECIFICATION', 'LABEL', 'SUPPLIER',
      'QUANTITY', 'MACHINE / EQUIPMENT', 'Sipariş Numarası', 'Fiyat',
      'Depo Bakiyesi', 'Asgari Stok'],
    widths: [30, 90, 10, 18, 10, 24, 16, 12, 14, 12],
    formats: [undefined, undefined, undefined, undefined, 'qty', undefined, undefined,
      'money', 'qty', 'qty'],
  });

  let r = 4;
  for (const brand of SHIPPING_BRANDS) {
    putGroup(r, brand);
    r++;
    const key = brand.toUpperCase();
    const bySupplier = MATCH_BY_SUPPLIER.has(brand);
    let stripe = false;
    for (const l of lines) {
      const field = bySupplier ? l.supplier : l.label;
      if (field.trim().toUpperCase() !== key) continue;
      const st = stock[l.eqNo];
      putRow(r, [l.eqNo, l.techSpec, l.label, l.supplier, l.qty, l.machine, '',
        l.totalCost, st?.depoBakiye, st?.asgariStok], stripe);
      stripe = !stripe;
      r++;
    }
    r++; // markalar arası boş satır
  }
  return finish(r);
}

/**
 * Teklife giren kalemlerin ekipman numaraları.
 *
 * Stok sorgusu Excel üretilmeden önce yapılmalı, sonuç `stock` seçeneğiyle
 * geri verilir. Hangi satırların teklife girdiği F sütununa bağlı, F ise
 * sıklıkla formüllü — bu yüzden liste motor çalıştırılarak çıkarılır.
 */
export function quoteEquipmentNumbers(wb: PrecalcWorkbook, entries: PrecalcEntries): string[] {
  const engine = new PrecalcEngine(wb);
  engine.setEntries(entries);
  engine.settle();

  const out = new Set<string>();
  for (const row of wb.outline) {
    if (row.kind !== 'item') continue;
    if (engine.num('F' + row.r) <= 0) continue;
    const eq = engine.text('B' + row.r).trim();
    if (eq) out.add(eq);
  }
  return [...out];
}

/** Dosya adı: "PRECALCULATION 2026-08-19 14-30.xlsx" */
export function precalcFileName(prefix = 'PRECALCULATION'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
}
