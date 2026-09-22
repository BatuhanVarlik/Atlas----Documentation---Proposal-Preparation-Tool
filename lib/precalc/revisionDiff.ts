import { getCatalogDataset } from './catalog';
import type { PrecalcEntries, PrecalcWorkbook, RawValue } from './types';
import workbookData from './workbook.json';

/**
 * İki kayıt arasındaki farkı, teklifi hazırlayanın okuyabileceği cümlelere
 * çevirir.
 *
 * Girdiler ham hücre adresleridir ("PRECALCULATION!F1234": 5). Bunlar tek
 * başına kimseye bir şey anlatmaz; burada satır numarası katalogdaki kalem
 * adına, parametre adresi de insan diline çevrilir.
 *
 * Yalnızca kullanıcının GİRDİĞİ hücreler karşılaştırılır — formülle değişen
 * yüzlerce hücre revizyon notunu okunmaz yapardı ve zaten girdilerin sonucu.
 */

const workbook = workbookData as unknown as PrecalcWorkbook;
const { anchors } = workbook.meta;

export type ChangeKind =
  | 'added' | 'removed' | 'qty' | 'price' | 'factor'
  | 'overhead' | 'param' | 'identity';

export interface RevisionChange {
  kind: ChangeKind;
  /** Hücre adresi, sayfa öneki olmadan ("F1234"). */
  addr: string;
  /** Değişen şeyin adı — kalem adı ya da parametre etiketi. */
  label: string;
  before: RawValue;
  after: RawValue;
  /** Hazır cümle. */
  text: string;
}

/** "PRECALCULATION!F1234" → { addr: "F1234", col: "F", row: 1234 } */
function split(key: string) {
  const addr = key.includes('!') ? key.slice(key.indexOf('!') + 1) : key;
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  return m ? { addr, col: m[1], row: Number(m[2]) } : { addr, col: '', row: 0 };
}

/* ---- adres → insan dili sözlükleri ---- */

const IDENTITY_LABELS: Record<string, string> = {
  B1: 'Müşteri',
  B2: 'Proje No',
  B3: 'Son Kullanıcı',
  B4: 'Precalculation No',
  B5: 'Tarih',
  B7: 'Hazırlayan',
};

const PARAM_LABELS: Record<string, string> = {
  profitMultiplier: 'Kâr Oranı',
  transportMultiplier: 'Nakliye Çarpanı',
  salesPrice: 'Satış Fiyatı',
  orderDate: 'Sipariş Tarihi',
};

/**
 * Genel gider satırları — ara toplama olan uzaklıklarıyla.
 *
 * Bu tablo `components/precalc/TotalsPanel.tsx`'teki `OVERHEAD_ROWS` ile
 * doğrulandı (2026-09-22): offset ve etiketler birebir aynı. İkisi de aynı
 * fiziksel satırları anlattığı için burada sabit yazılmak yerine tek bir
 * yerden içe aktarılması ideal olurdu, ama bu modül `components/`'a bağımlı
 * olmamalı (saf lib katmanı) — bu yüzden bilinçli olarak kopyalandı.
 */
const OVERHEAD_LABELS: Record<number, string> = {
  1: 'Acente Komisyonu',
  3: 'Beklenmeyen Giderler',
  5: 'Garanti',
  6: 'Garanti Uzatma',
  8: 'Risk',
  10: 'Banka Teminat Mektubu',
  12: 'Garanti Teminat Mektubu',
  14: 'Damga Vergisi',
};

/** Parametre adresi → etiket. */
const paramLabelByAddr = new Map(
  workbook.params
    .filter((p) => PARAM_LABELS[p.key])
    .map((p) => [p.addr, PARAM_LABELS[p.key]]),
);

/** Satır numarası → kalem adı. */
const itemNameByRow = new Map<number, string>(
  getCatalogDataset().items.map((i) => [
    i.row,
    i.techSpec?.trim() || i.machineType?.trim() || `EQ ${i.row}`,
  ]),
);

const itemName = (row: number) => itemNameByRow.get(row) ?? `EQ ${row}`;

/**
 * F sütununda oturan ama gerçek bir kalem adedi OLMAYAN parametre adresleri
 * (örn. "siteDelivery" F4853, "crating" F4854 — YES/NO anahtarları).
 *
 * `workbook.outline`'da bu satırlar diğer kalemlerle birebir aynı görünür
 * (`kind: 'item'`, `inputs` içinde "F" var) — outline'dan ayırt edilemezler.
 * Aradaki fark yalnızca `workbook.params`'ta tanımlı olmaları: gerçek kalem
 * adetleri hiçbir zaman params listesine girmez, yalnızca kitabın hesabını
 * yöneten anahtar/oran hücreleri girer. Genel gider bloğu (ara toplamın
 * altındaki F hücreleri) zaten yukarıda ayrı ele alındığı için buraya
 * dahil edilmez — geriye kalan "F sütunundaki, genel gider olmayan"
 * params girdileri kalem adedi değil, yapısal bir ayardır.
 */
const NON_ITEM_F_PARAM_ADDRS = new Set(
  workbook.params
    .map((p) => split(p.addr))
    .filter(
      ({ col, row }) =>
        col === 'F' && !(row > anchors.subtotalRow && row <= anchors.grandTotalRow),
    )
    .map(({ addr }) => addr),
);

/* ---- biçimlendirme ---- */

const num = (v: RawValue): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

const money = (v: RawValue) =>
  num(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const plain = (v: RawValue) => {
  if (typeof v === 'number') {
    return v.toLocaleString('tr-TR', { maximumFractionDigits: 4 });
  }
  return String(v ?? '');
};

/** Çarpan ve oranlar iki haneyle yazılır: "0,70 → 0,85". */
const factor = (v: RawValue) =>
  num(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/* ---- fark ---- */

const same = (a: RawValue, b: RawValue) =>
  (a ?? '') === (b ?? '') || (typeof a === 'number' && typeof b === 'number' && a === b);

function describe1(
  key: string, before: RawValue, after: RawValue,
): RevisionChange | null {
  const { addr, col, row } = split(key);
  if (!col) return null;

  // Yalnızca ana sayfanın hücreleri anlatılır; diğer sayfalar teknik ayrıntı.
  if (key.includes('!') && !key.startsWith('PRECALCULATION!')) return null;

  const base = { addr, before, after };

  if (IDENTITY_LABELS[addr]) {
    const label = IDENTITY_LABELS[addr];
    return {
      ...base, kind: 'identity', label,
      text: `${label} "${plain(before)}" → "${plain(after)}" olarak güncellendi`,
    };
  }

  const paramLabel = paramLabelByAddr.get(addr);
  if (paramLabel) {
    return {
      ...base, kind: 'param', label: paramLabel,
      text: `${paramLabel} ${factor(before)} → ${factor(after)} olarak güncellendi`,
    };
  }

  // Genel gider bloğu: ara toplamdan sonraki F hücreleri.
  if (col === 'F' && row > anchors.subtotalRow && row <= anchors.grandTotalRow) {
    const label = OVERHEAD_LABELS[row - anchors.subtotalRow];
    if (label) {
      return {
        ...base, kind: 'overhead', label,
        text: `${label} ${plain(before)} → ${plain(after)} olarak güncellendi`,
      };
    }
  }

  // Kalem adedi gibi görünen ama aslında YES/NO anahtarı olan yapısal
  // parametreler (site delivery, crating vb.) — sessizce yok say.
  if (col === 'F' && NON_ITEM_F_PARAM_ADDRS.has(addr)) return null;

  const name = itemName(row);

  if (col === 'F') {
    const b = num(before);
    const a = num(after);
    if (b === 0 && a > 0) {
      return { ...base, kind: 'added', label: name, text: `${plain(a)} Adet ${name} eklendi` };
    }
    if (b > 0 && a === 0) {
      return { ...base, kind: 'removed', label: name, text: `${plain(b)} Adet ${name} çıkarıldı` };
    }
    return {
      ...base, kind: 'qty', label: name,
      text: `${name} adedi ${plain(b)} → ${plain(a)} oldu`,
    };
  }

  if (col === 'I') {
    return {
      ...base, kind: 'price', label: name,
      text: `${name} liste fiyatı ${money(before)} → ${money(after)}`,
    };
  }

  if (col === 'J' || col === 'K') {
    const which = col === 'J' ? 'çarpanı' : 'ek çarpanı';
    return {
      ...base, kind: 'factor', label: name,
      text: `${name} ${which} ${factor(before)} → ${factor(after)}`,
    };
  }

  return null;   // anlatmaya değmeyen hücre (tanım metni, takip alanı vb.)
}

/**
 * İki girdi kümesi arasındaki anlamlı değişiklikler, kitaptaki satır
 * sırasıyla.
 */
export function diffEntries(
  before: PrecalcEntries,
  after: PrecalcEntries,
): RevisionChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: RevisionChange[] = [];

  for (const key of keys) {
    const b = before[key] ?? null;
    const a = after[key] ?? null;
    if (same(b, a)) continue;
    const change = describe1(key, b, a);
    if (change) out.push(change);
  }

  // Kimlik ve parametre değişiklikleri sona: önce teklifin içeriği anlatılır.
  const rank = (c: RevisionChange) =>
    c.kind === 'identity' || c.kind === 'param' || c.kind === 'overhead' ? 1 : 0;

  return out.sort((x, y) => rank(x) - rank(y) || split(x.addr).row - split(y.addr).row);
}

/** Varsayılan olarak metne giren en fazla değişiklik sayısı. */
export const DEFAULT_LIMIT = 20;

/**
 * Özet sayfasına ve revizyon şeridine yazılan tek satırlık metin:
 *
 *   RE-01 : 5 Adet Manuel Butterfly Valve … eklendi, Kâr Oranı 0,70 → 0,85
 *   olarak güncellendi. ; Süleyman Altındal ; 31.08.2026
 */
export function formatRevision(
  changes: RevisionChange[],
  opts: { code: string; author: string; date: Date; limit?: number },
): string {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const shown = changes.slice(0, limit).map((c) => c.text);
  if (changes.length > limit) {
    shown.push(`…ve ${changes.length - limit} değişiklik daha`);
  }

  const body = shown.length ? shown.join(', ') + '.' : 'değişiklik kaydedilmedi.';
  const day = opts.date.toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return `${opts.code} : ${body} ; ${opts.author} ; ${day}`;
}
