import * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { isError } from '../formula';
import {
  ROW_HEIGHT, S_BLOCK_TITLE, S_HEAD, S_LABEL, S_LABEL_VALUE, S_TITLE,
  itemStyle, sectionStyle, totalStyle, type NumFmtKey,
} from '../exportStyle';
import type { PrecalcWorkbook, RowMeta } from '../types';
import { cellFor, styledBlank, type Style } from './cells';
import type { QuoteLine } from './listSheets';

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

/** PRECALCULATION sayfasının başlık bloğuna yazılan, çözümlenmiş proje bilgileri. */
export interface ResolvedHeader {
  customer: string;
  endUser: string;
  projectNo: string;
  precalcNo: string;
  date: string;
  preparedBy: string;
}

/**
 * `buildPrecalcSheet`'in ihtiyaç duyduğu seçenekler — `ExportOptions`'ın
 * bir alt kümesi (döngüsel içe aktarımdan kaçınmak için burada ayrı
 * tanımlanır; `ExportOptions` yapısal olarak uyumludur).
 */
export interface PrecalcSheetOptions {
  /** true ise yalnızca miktarı girilmiş kalemler yazılır. */
  onlyEntered: boolean;
}

/**
 * PRECALCULATION sayfasını hesaplanmış hâliyle kurar.
 *
 * `engine` çağıran tarafından zaten `settle()` edilmiş olmalıdır.
 */
export function buildPrecalcSheet(
  engine: PrecalcEngine,
  wb: PrecalcWorkbook,
  options: PrecalcSheetOptions,
  header: ResolvedHeader,
): { sheet: XLSX.WorkSheet; keptItemCount: number; lines: QuoteLine[] } {
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
  /** Etiket + değer ikilisi; değer boş olsa da çerçevesi durur. */
  const identity = (labelCol: number, label: string, value: unknown) => {
    put(labelCol, label, S_LABEL);
    put(labelCol + 1, value, S_LABEL_VALUE);
  };

  put(0, wb.meta.sourceFile.replace(/\.xlsm?$/i, ''), S_TITLE);
  setRowHeight(20);
  out++;
  identity(0, 'CUSTOMER:', header.customer);
  identity(3, 'PROJECT NO:', header.projectNo);
  out++;
  identity(0, 'END USER:', header.endUser);
  identity(3, 'PRECALCULATION NO:', header.precalcNo);
  out++;
  identity(0, 'DATE:', header.date);
  identity(3, 'CURRENCY:', wb.meta.currency);
  out++;
  identity(0, 'PREPARED BY:', header.preparedBy);
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

  return { sheet, keptItemCount: kept.filter((r) => r.kind === 'item').length, lines };
}
