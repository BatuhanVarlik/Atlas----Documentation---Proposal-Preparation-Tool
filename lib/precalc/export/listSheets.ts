import * as XLSX from 'xlsx-js-style';
import { PrecalcEngine } from '../engine';
import {
  ROW_HEIGHT, S_HEAD, S_LABEL, S_LABEL_VALUE, S_TITLE,
  itemStyle, sectionStyle, type NumFmtKey,
} from '../exportStyle';
import type { PrecalcEntries, PrecalcWorkbook } from '../types';
import { cellFor, styledBlank, type Style } from './cells';

/**
 * Ekipman ve sevk listelerinin bir satırı. Kaynak kitaptaki iki sayfa da
 * aynı alanları kullanır; yalnızca gruplama ölçütü ve Fiyat sütunu farklıdır.
 */
/** Ekipman ve sevk listelerinin bir satırı. */
export interface QuoteLine {
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
export function buildEquipmentSheet(
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
export function buildShippingSheet(
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
