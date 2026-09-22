# Advanced Precalculation — Tablo/Scroll Mimarisi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advanced Precalculation ekranının ana katalog tablosunda (a) workbook'taki tüm 69 sütunu erişilebilir yap, (b) dikey kaydırmayı tek native pencere scroll'una bağla, (c) yatay kaydırmayı native işlevi koruyarak kompakt, ekranın altına sabit özel bir kontrolle yönet.

**Architecture:** `AdvancedPrecalculationClient.tsx` içindeki sütun tanımları (`COLUMNS`, `Column`, `RowCtx`, `SheetCell`/`TextSheetCell`) davranış değiştirmeden yeni bir dosyaya (`components/precalc/advancedPrecalcColumns.tsx`) taşınır — hem 2174 satırlık dosyayı küçültür hem sütun tamlığını birim testle doğrulamayı mümkün kılar. Sonra eksik 45 sütun eklenir, varsayılan görünüm "Tümü" olur, satır sanallaştırması `el.scrollTop` yerine pencere scroll'una bağlanır, ve yeni bağımsız `HScrollControl.tsx` bileşeni yatay kaydırmayı yönetir.

**Tech Stack:** Next.js 16 (App Router, `'use client'`), TypeScript strict, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-advanced-precalc-table-scroll-design.md`

## Global Constraints

- Hesap motoru mantığı (`lib/precalc/engine.ts`, formüller) değişmez — bu plan yalnızca görünüm/scroll katmanına dokunur.
- Hiçbir sütun sabit (sticky/frozen) olmayacak — mevcut davranış korunur.
- Sütun genişlik/sıra kaydı (`localStorage['atlas.pricing.columns.v1']`) formatı değişmez.
- `components/precalc/PrecalcTable.tsx` ve `components/precalc/columns.ts` bu plan kapsamında **değiştirilmez** (kullanılmayan eski `/precalculation` sayfasına ait — karıştırma).
- `any` tipi kullanılmaz; `unknown` + daraltma.
- Her görevden sonra `npm run type-check` hatasız olmalı.

---

## Not: satır numaraları

`AdvancedPrecalculationClient.tsx` için verilen satır numaraları **Task 1
başlamadan önceki hâline** aittir. Task 1 dosyadan ~215 satır kaldırdığı
için Task 3/4/5'teki numaralar o noktada kaymış olacak — her adımda hedefi
bulmak için verilen tam kod bloğunu (yorum satırı, değişken adı, JSX) ara/
grep'le; satır numarası yalnızca kabaca "nerede" fikri verir, kesin adres
değildir.

## Faz 1 — Sütun modülünün çıkarılması ve tamamlanması

### Task 1: `advancedPrecalcColumns.tsx` — mevcut sütunları davranış değiştirmeden taşı

**Files:**
- Create: `components/precalc/advancedPrecalcColumns.tsx`
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx:1-28` (import bloğu), `:149-193` (sil: `RowCtx`, `Column` arayüzleri), `:195` (sil: `money`), `:197-364` (sil: `COLUMNS`, `LEAD`, `OPTIONAL`), `:371-385` (sil: `COLUMN_VIEWS`), `:1928-2025` (sil: `TextSheetCell`, `SheetCell`)
- Test: `components/precalc/__tests__/advancedPrecalcColumns.test.ts`

**Interfaces:**
- Produces: `RowCtx`, `Column`, `SortKey`, `SortDir` (type'lar), `COLUMNS`, `LEAD`, `OPTIONAL`, `COLUMN_VIEWS`, `DEFAULT_COLUMN_VIEW` (const), `TextSheetCell`, `SheetCell` (bileşenler) — hepsi `advancedPrecalcColumns.tsx`'ten export edilir.
- Consumes: `CatalogItem` (`@/lib/precalc/catalog`), `CellValue` (`@/lib/precalc/formula`), `RawValue` (`@/lib/precalc/types`), `formatCell` (`./cellFormat`), `FACTOR_DECIMALS`/`CellFormat` (`./columns` — **not** `PRECALC_COLUMNS`), `EditableCell` (`./EditableCell`), `cn`/`formatNumberTR` (`@/lib/utils`).

- [ ] **Step 1: Write the failing test**

`components/precalc/__tests__/advancedPrecalcColumns.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COLUMNS, LEAD, OPTIONAL, COLUMN_VIEWS, DEFAULT_COLUMN_VIEW } from '../advancedPrecalcColumns';

describe('advancedPrecalcColumns — mevcut sütunlar (taşıma sonrası davranış aynı)', () => {
  it('7 lead + 17 optional sütun taşınmış olmalı', () => {
    expect(LEAD).toHaveLength(7);
    expect(OPTIONAL.length).toBeGreaterThanOrEqual(17);
    expect(COLUMNS.length).toBe(LEAD.length + OPTIONAL.length);
  });

  it('motor hücresine bağlı sütunların engineCol alanı doğru olmalı', () => {
    const byKey = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
    expect(byKey.techSpec.engineCol).toBe('C');
    expect(byKey.qty.engineCol).toBe('F');
    expect(byKey.listPrice.engineCol).toBe('I');
    expect(byKey.priceFactor.engineCol).toBe('J');
    expect(byKey.extraFactor.engineCol).toBe('K');
    expect(byKey.transportCost.engineCol).toBe('L');
    expect(byKey.totalCost.engineCol).toBe('M');
    expect(byKey.salesPrice.engineCol).toBe('N');
    expect(byKey.machineType.engineCol).toBe('H');
    expect(byKey.label.engineCol).toBe('D');
    expect(byKey.supplier.engineCol).toBe('E');
  });

  it('view seçici "quote"/"tech"/"all" kimlikleriyle üç seçenek sunar', () => {
    expect(COLUMN_VIEWS.map((v) => v.id)).toEqual(['quote', 'tech', 'all']);
  });

  it('DEFAULT_COLUMN_VIEW mevcut view kimliklerinden biri olmalı', () => {
    expect(COLUMN_VIEWS.some((v) => v.id === DEFAULT_COLUMN_VIEW)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/precalc/__tests__/advancedPrecalcColumns.test.ts`
Expected: FAIL — `Cannot find module '../advancedPrecalcColumns'`

- [ ] **Step 3: Yeni dosyayı oluştur — `RowCtx`, `Column`, yardımcılar iskeleti**

`components/precalc/advancedPrecalcColumns.tsx` başlangıcı (aşağıdaki blok TAM olarak böyle olacak; `COLUMNS` dizisinin içeriği Step 4'te eklenir):

```tsx
'use client';

import type { CatalogItem } from '@/lib/precalc/catalog';
import type { CellValue } from '@/lib/precalc/formula';
import type { RawValue } from '@/lib/precalc/types';
import { cn, formatNumberTR } from '@/lib/utils';
import { formatCell } from './cellFormat';
import { FACTOR_DECIMALS, type CellFormat } from './columns';
import { EditableCell } from './EditableCell';

/** Tabloda bir satıra erişim — hücre okuma/yazma, formül/düzenleme durumu. */
export interface RowCtx {
  /** Hesap motoru hazır mı — hazır değilken hücreler salt okunurdur. */
  ready: boolean;
  /** Excel sütununun değeri. */
  value: (col: string) => CellValue;
  /** Excel sütununun sayısal değeri. */
  num: (col: string) => number;
  /** Sütun formüllü mü — Excel'de mor, kullanıcıya kapalı. */
  isFormula: (col: string) => boolean;
  /** Kullanıcı bu hücreyi elle değiştirdi mi. */
  isEdited: (col: string) => boolean;
  /** Mor hücrenin ipucunda gösterilen Excel formülü. */
  formulaOf: (col: string) => string | null;
  setCell: (col: string, v: RawValue) => void;
  /** Birim net fiyat: I × J × K (adetten bağımsız). */
  unitNet: number;
  /** Satır Excel'in genel toplamına giriyor mu (OTHERS'ta girmeyenler var). */
  inTotal: boolean;
  /** Tanım sütunu (C/D/E/H) kaynakta boş mu — yani kullanıcıya açık mı. */
  isOpenText: (col: string) => boolean;
}

export type SortKey = 'row' | 'eqNo' | 'techSpec' | 'productType' | 'supplier'
  | 'listPrice' | 'netPrice' | 'qty' | 'totalCost' | 'salesPrice';
export type SortDir = 'asc' | 'desc';

export interface Column {
  key: string;
  label: string;
  width: number;
  sortKey?: SortKey;
  align?: 'left' | 'right';
  /**
   * Temel kimlik/giriş sütunu: her sütun setinde ve hep solda görünür.
   * Sabitlenmiş (donmuş) değildir — yatay kaydırmada diğerleriyle birlikte kayar.
   */
  lead?: boolean;
  /** Hücre kırpma/tooltip sarmalayıcısı olmadan basılır (girdi kutuları, çok satırlı hücreler). */
  custom?: boolean;
  /** Başlığın üzerine gelince çıkan açıklama — sütunun ne anlama geldiği. */
  hint?: string;
  /** Kullanıcının veri girebildiği sütun — başlıkta mavi gösterilir. */
  input?: boolean;
  /** Bu sütunun motor hücresi (varsa) — tamlık testi ve dokümantasyon için. */
  engineCol?: string;
  render: (it: CatalogItem, ctx: RowCtx) => React.ReactNode;
}

const money = (v: number | null) => (v === null ? '—' : formatNumberTR(v, { decimals: 2 }));

export const COLUMNS: Column[] = [
  // Step 4'te doldurulacak
];

export const LEAD = COLUMNS.filter((c) => c.lead);
export const OPTIONAL = COLUMNS.filter((c) => !c.lead);

export const COLUMN_VIEWS: { id: string; label: string; cols: string[] | null }[] = [
  {
    id: 'quote',
    label: 'Teklif',
    // Çarpan / Ek Çarpan / Nakliye günlük kullanımda gürültü yapıyor; "Tümü"nde duruyorlar.
    cols: ['supplier', 'label', 'standard', 'discount', 'netPrice'],
  },
  {
    id: 'tech',
    label: 'Teknik',
    cols: ['placeOfUse', 'machineType', 'supplier', 'standard', 'inletDiameter',
      'outletDiameter', 'connections', 'sparePartNo', 'sparePartDesc', 'sparePartPrice'],
  },
  { id: 'all', label: 'Tümü', cols: null },
];

/** Sayfa ilk açıldığında hangi görünüm seçili — "Tümü": tüm sütunlar scroll ile erişilir. */
export const DEFAULT_COLUMN_VIEW = 'all';
```

- [ ] **Step 4: `COLUMNS` dizisinin 24 mevcut girdisini taşı — sırayla `engineCol` ekle**

`AdvancedPrecalculationClient.tsx:197-361` içindeki 24 girdiyi (satır, eqNo, techSpec, qty, listPrice, totalCost, salesPrice, placeOfUse, machineType, label, supplier, standard, topCategory, subCategory, productType, priceFactor, extraFactor, discount, netPrice, transportCost, sparePartNo, sparePartDesc, sparePartPrice, inletDiameter, outletDiameter, connections) **değiştirmeden** yeni dosyadaki `COLUMNS = [...]` içine yapıştır; yalnızca motor hücresine bağlı olanlara `engineCol` ekle:

- `techSpec` → `engineCol: 'C'`
- `qty` → `engineCol: 'F'`
- `listPrice` → `engineCol: 'I'`
- `totalCost` → `engineCol: 'M'`
- `salesPrice` → `engineCol: 'N'`
- `machineType` → `engineCol: 'H'`
- `label` → `engineCol: 'D'`
- `supplier` → `engineCol: 'E'`
- `priceFactor` → `engineCol: 'J'`
- `extraFactor` → `engineCol: 'K'`
- `transportCost` → `engineCol: 'L'`
- `placeOfUse` → `engineCol: 'A'`
- `sparePartNo` → `engineCol: 'P'`
- `sparePartDesc` → `engineCol: 'Q'`
- `sparePartPrice` → `engineCol: 'R'`
- `inletDiameter` → `engineCol: 'AY'`
- `outletDiameter` → `engineCol: 'AZ'`
- `connections` → `engineCol: 'BA'`
- `eqNo` → `engineCol: 'B'`

(`row`, `standard`, `topCategory`, `subCategory`, `productType`, `discount`, `netPrice` motor hücresine değil `CatalogItem` türetilmiş alanlarına dayanır — `engineCol` eklenmez.)

- [ ] **Step 5: `TextSheetCell`/`SheetCell`'i taşı**

`AdvancedPrecalculationClient.tsx:1928-2025`'teki iki fonksiyonu **değiştirmeden** yeni dosyanın sonuna ekle (üstteki importlar zaten yeterli — `EditableCell`, `formatCell`, `cn` hepsi mevcut).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run components/precalc/__tests__/advancedPrecalcColumns.test.ts`
Expected: PASS

- [ ] **Step 7: `AdvancedPrecalculationClient.tsx`'i yeni modüle bağla**

Silinen bloklar yerine tek import satırı ekle (mevcut import listesinin sonuna, `IDENTITY_FIELDS` importından sonra):

```ts
import {
  COLUMNS, LEAD, OPTIONAL, COLUMN_VIEWS, DEFAULT_COLUMN_VIEW,
  TextSheetCell, SheetCell,
  type Column, type RowCtx, type SortKey, type SortDir,
} from '@/components/precalc/advancedPrecalcColumns';
```

Dosyada kalan `SortKey`/`SortDir` tip tanımları (satır 61-63) silinir — artık import edilen tipler kullanılır.

`money` fonksiyonu (satır 195) `AdvancedPrecalculationClient.tsx`'te COLUMNS dışında da kullanılıyor (satır 1663, 1669 — teklif toplamı gösterimi); bu yüzden dosyadan silinmez, olduğu gibi kalır. Yeni dosyadaki `money` (Step 3'te tanımlandı) yalnızca `SheetCell`/`TextSheetCell`'in kapalı kapsamında kullanılan ayrı bir kopyadır — iki dosyanın da kendi `money`'si olması kasıtlıdır, paylaşılan bir modül çıkarmak bu görevin kapsamı dışındadır.

- [ ] **Step 8: Tip denetimi ve elle doğrulama**

Run: `npm run type-check`
Expected: hata yok.

Tarayıcıda `/advanced-precalculation` aç, PRECALCULATION sekmesi önceki gibi görünmeli (24 sütun, "Teklif" görünümü hâlâ varsayılan — Step 7 sonrası `DEFAULT_COLUMN_VIEW` henüz `useState`'e bağlanmadı, bu Task 3'te yapılacak; şimdilik `COLUMN_VIEWS`/`COLUMNS` içeriği birebir aynı olduğu için ekran hiç değişmemiş olmalı).

- [ ] **Step 9: Commit**

```bash
git add components/precalc/advancedPrecalcColumns.tsx components/precalc/__tests__/advancedPrecalcColumns.test.ts "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx"
git commit -m "refactor(precalc): sütun tanımlarını advancedPrecalcColumns.tsx'e taşı (davranış aynı)"
```

---

### Task 2: Eksik 45 workbook sütununu ekle

**Files:**
- Modify: `components/precalc/advancedPrecalcColumns.tsx` (`COLUMNS` dizisine ekleme, `COLUMN_VIEWS.tech.cols`'a ekleme)
- Test: `components/precalc/__tests__/advancedPrecalcColumns.test.ts` (genişlet)

**Interfaces:**
- Consumes: Task 1'in `Column`/`engineCol` alanı.
- Produces: `COLUMNS` artık 69 girdi (24 mevcut + 45 yeni), her workbook harfi için bir `engineCol` eşleşmesi.

- [ ] **Step 1: Write the failing test**

`advancedPrecalcColumns.test.ts`'e ekle (dosyanın başına workbook'un tam sütun haritası sabitlenir — `lib/precalc/workbook.json`'dan alınmıştır, elle güncellenmez):

```ts
/** lib/precalc/workbook.json → columns anahtarlarının tamamı (A–BO). */
const WORKBOOK_COLUMN_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
  'P', 'Q', 'R', 'S', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC',
  'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO',
  'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA',
  'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM',
  'BN', 'BO',
];

describe('advancedPrecalcColumns — tam sütun kapsamı', () => {
  it('workbook.json\'daki her sütun harfi COLUMNS\'ta bir engineCol karşılığı bulur', () => {
    const covered = new Set(COLUMNS.map((c) => c.engineCol).filter(Boolean));
    const missing = WORKBOOK_COLUMN_LETTERS.filter((letter) => !covered.has(letter));
    expect(missing).toEqual([]);
  });

  it('69 sütun tanımlı olmalı (24 mevcut + 45 yeni teknik/lojistik sütun)', () => {
    expect(COLUMNS).toHaveLength(69);
  });

  it('"tech" görünümü yeni teknik sütunlardan en az birini içerir', () => {
    const tech = COLUMN_VIEWS.find((v) => v.id === 'tech')!;
    expect(tech.cols).toContain('capacity');
    expect(tech.cols).toContain('motorKw');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/precalc/__tests__/advancedPrecalcColumns.test.ts`
Expected: FAIL — `missing` boş dizi değil (45 harf eksik), `COLUMNS` uzunluğu 24.

- [ ] **Step 3: 45 yeni sütunu `COLUMNS` dizisinin sonuna ekle**

`components/precalc/advancedPrecalcColumns.tsx`'te `COLUMNS` dizisinin kapanışından (`connections` girdisinden) hemen önce ekle:

```tsx
  {
    key: 'sparePartTotal', label: 'Yedek Parça Toplam (€)', width: 140, align: 'right', engineCol: 'S',
    hint: 'Yedek parça fiyatı × adet (Excel S sütunu).',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="S" format="money" readOnly />,
  },
  {
    key: 'leadTime', label: 'Tedarik Süresi (hafta)', width: 130, align: 'right', engineCol: 'U',
    hint: 'Siparişten teslime geçen süre (Excel U sütunu).',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="U" format="int" readOnly />,
  },
  {
    key: 'paymentWeek', label: 'Ödeme Haftası', width: 110, align: 'right', engineCol: 'V',
    hint: 'Bu kalemin ödeme planındaki haftası (Excel V sütunu) — Cashflow sekmesini besler.',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="V" format="int" readOnly />,
  },
  {
    key: 'hemitekOC', label: 'HEMİTEK OC No', width: 120, engineCol: 'W',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="W" format="text" readOnly />,
  },
  {
    key: 'orderDate', label: 'Sipariş Tarihi', width: 115, engineCol: 'X',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="X" format="date" readOnly />,
  },
  {
    key: 'abroadOC', label: 'Yurtdışı OC No', width: 120, engineCol: 'Y',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="Y" format="text" readOnly />,
  },
  {
    key: 'estLoadDate', label: 'Tahmini Yükleme Tarihi', width: 140, engineCol: 'Z',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="Z" format="date" readOnly />,
  },
  {
    key: 'actualLoadDate', label: 'Gerçekleşen Yükleme Tarihi', width: 150, engineCol: 'AA',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AA" format="date" readOnly />,
  },
  {
    key: 'estCustomsDate', label: 'Gümrüğe Geliş (Tahmini)', width: 150, engineCol: 'AB',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AB" format="date" readOnly />,
  },
  {
    key: 'customsArrivalDate', label: 'Gümrük Varış Tarihi', width: 140, engineCol: 'AC',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AC" format="date" readOnly />,
  },
  {
    key: 'capacity', label: 'Kapasite (lt/h)', width: 110, align: 'right', engineCol: 'AD',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AD" format="number" readOnly />,
  },
  {
    key: 'motorKw', label: 'Motor (kW)', width: 95, align: 'right', engineCol: 'AE',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AE" format="number" readOnly />,
  },
  {
    key: 'fcEH', label: 'FC E/H', width: 80, engineCol: 'AF',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AF" format="text" readOnly />,
  },
  {
    key: 'acOrDc', label: 'AC/DC', width: 80, engineCol: 'AG',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AG" format="text" readOnly />,
  },
  {
    key: 'revolutionRpm', label: 'Devir (rpm)', width: 100, align: 'right', engineCol: 'AH',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AH" format="number" readOnly />,
  },
  {
    key: 'impellerMm', label: 'Pervane (mm)', width: 100, align: 'right', engineCol: 'AI',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AI" format="number" readOnly />,
  },
  {
    key: 'pressureBar', label: 'Basınç (bar)', width: 100, align: 'right', engineCol: 'AJ',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AJ" format="number" readOnly />,
  },
  {
    key: 'elastomer', label: 'Elastomer', width: 100, engineCol: 'AK',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AK" format="text" readOnly />,
  },
  {
    key: 'aisiGrade', label: 'AISI 316/304', width: 100, engineCol: 'AL',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AL" format="text" readOnly />,
  },
  {
    key: 'voltage', label: 'Voltaj', width: 90, engineCol: 'AM',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AM" format="text" readOnly />,
  },
  {
    key: 'steamConsumption', label: 'Buhar Sarfiyatı (kg/h)', width: 140, align: 'right', engineCol: 'AN',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AN" format="number" readOnly />,
  },
  {
    key: 'steamPressure', label: 'Buhar Basıncı (bar)', width: 130, align: 'right', engineCol: 'AO',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AO" format="number" readOnly />,
  },
  {
    key: 'condensate', label: 'Kondens (kg/h)', width: 110, align: 'right', engineCol: 'AP',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AP" format="number" readOnly />,
  },
  {
    key: 'processWater', label: 'Proses Suyu (lt/h)', width: 130, align: 'right', engineCol: 'AQ',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AQ" format="number" readOnly />,
  },
  {
    key: 'coldWater', label: 'Soğuk Su (lt/h)', width: 120, align: 'right', engineCol: 'AR',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AR" format="number" readOnly />,
  },
  {
    key: 'iceWater', label: 'Buzlu Su (lt/h)', width: 120, align: 'right', engineCol: 'AS',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AS" format="number" readOnly />,
  },
  {
    key: 'heatLoad', label: 'Isı Yükü (kcal/h)', width: 130, align: 'right', engineCol: 'AT',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AT" format="number" readOnly />,
  },
  {
    key: 'product', label: 'Ürün', width: 130, engineCol: 'AU',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AU" format="text" readOnly />,
  },
  {
    key: 'productTemp', label: 'Ürün Sıcaklığı (°C)', width: 130, align: 'right', engineCol: 'AV',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AV" format="number" readOnly />,
  },
  {
    key: 'productViscosity', label: 'Ürün Viskozitesi (cP)', width: 140, align: 'right', engineCol: 'AW',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AW" format="number" readOnly />,
  },
  {
    key: 'connectionType', label: 'Bağlantı Tipi', width: 120, engineCol: 'AX',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="AX" format="text" readOnly />,
  },
  {
    key: 'totalWelding', label: 'Toplam Kaynak', width: 110, align: 'right', engineCol: 'BB',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BB" format="int" readOnly />,
  },
  {
    key: 'controlUnit', label: 'Kontrol Ünitesi (V/H)', width: 140, engineCol: 'BC',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BC" format="text" readOnly />,
  },
  {
    key: 'orificeDiameter', label: 'Orifis Çapı (mm)', width: 130, align: 'right', engineCol: 'BD',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BD" format="number" readOnly />,
  },
  {
    key: 'powerConsumption', label: 'Güç Tüketimi (kW)', width: 130, align: 'right', engineCol: 'BE',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BE" format="number" readOnly />,
  },
  {
    key: 'positionerType', label: 'Pozisyoner Tipi', width: 130, engineCol: 'BF',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BF" format="text" readOnly />,
  },
  {
    key: 'actuatorType', label: 'Aktüatör Tipi', width: 120, engineCol: 'BG',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BG" format="text" readOnly />,
  },
  {
    key: 'actuatorDiameter', label: 'Aktüatör Çapı (mm)', width: 140, align: 'right', engineCol: 'BH',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BH" format="number" readOnly />,
  },
  {
    key: 'airPressure', label: 'Hava Basıncı (bar)', width: 130, align: 'right', engineCol: 'BI',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BI" format="number" readOnly />,
  },
  {
    key: 'airConsumption', label: 'Hava Sarfiyatı (Nl/h)', width: 140, align: 'right', engineCol: 'BJ',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BJ" format="number" readOnly />,
  },
  {
    key: 'airSupplyPressure', label: 'Hava Besleme Basıncı (bar)', width: 160, align: 'right', engineCol: 'BK',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BK" format="number" readOnly />,
  },
  {
    key: 'airSignalPressure', label: 'Hava Sinyal Basıncı (bar)', width: 160, align: 'right', engineCol: 'BL',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BL" format="number" readOnly />,
  },
  {
    key: 'linePressure', label: 'Hat Basıncı (bar)', width: 130, align: 'right', engineCol: 'BM',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BM" format="number" readOnly />,
  },
  {
    key: 'mechanicalSeal', label: 'Mekanik Keçe (S/D)', width: 140, engineCol: 'BN',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BN" format="text" readOnly />,
  },
  {
    key: 'operationTime', label: 'Çalışma Süresi (saat/yıl)', width: 160, align: 'right', engineCol: 'BO',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="BO" format="number" readOnly />,
  },
```

- [ ] **Step 4: `tech` görünümüne yeni sütunları ekle**

`COLUMN_VIEWS`'teki `tech` girdisinin `cols` dizisine ekle (mevcut 10 anahtarın sonuna):

```ts
'capacity', 'motorKw', 'pressureBar', 'voltage', 'product', 'connectionType',
'controlUnit', 'actuatorType', 'airPressure', 'linePressure',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/precalc/__tests__/advancedPrecalcColumns.test.ts`
Expected: PASS — `missing` boş, `COLUMNS.length === 69`.

- [ ] **Step 6: Tip denetimi ve elle doğrulama**

Run: `npm run type-check`

Tarayıcıda "Sütunlar: Tümü" görünümüne geç, yeni eklenen sütunların (Kapasite, Motor kW, Buhar Basıncı vb.) başlıklarının göründüğünü ve dolu satırlarda değer bastığını doğrula.

- [ ] **Step 7: Commit**

```bash
git add components/precalc/advancedPrecalcColumns.tsx components/precalc/__tests__/advancedPrecalcColumns.test.ts
git commit -m "feat(precalc): eksik 45 workbook sütununu (AD-BO teknik blok) tabloya ekle"
```

---

### Task 3: Varsayılan sütun görünümü "Tümü" olsun

**Files:**
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx:423` (`useState('quote')`), `:556-561` (`resetLayout`), `:563` (`layoutChanged`)

**Interfaces:**
- Consumes: `DEFAULT_COLUMN_VIEW` (Task 1'de export edildi).

- [ ] **Step 1: Satır 423'ü değiştir**

```ts
const [colView, setColView] = useState(DEFAULT_COLUMN_VIEW);
```

- [ ] **Step 2: `resetLayout` içindeki `setColView('quote')`'u değiştir (satır ~559)**

```ts
function resetLayout() {
  setColWidths({});
  setColOrder([]);
  setColView(DEFAULT_COLUMN_VIEW);
  try { window.localStorage.removeItem(COLUMN_LAYOUT_KEY); } catch { /* yok say */ }
}
```

- [ ] **Step 3: `layoutChanged` karşılaştırmasını değiştir (satır 563)**

```ts
const layoutChanged = Object.keys(colWidths).length > 0 || colOrder.length > 0 || colView !== DEFAULT_COLUMN_VIEW;
```

- [ ] **Step 4: Tip denetimi**

Run: `npm run type-check`

- [ ] **Step 5: Elle doğrulama**

`localStorage`'da `atlas.pricing.columns.v1` anahtarını sil (tarayıcı devtools → Application → Local Storage), sayfayı yenile: sütun görünümü artık "Tümü" olarak açılmalı, araç çubuğundaki "Tümü" düğmesi koyu (seçili) görünmeli.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx"
git commit -m "feat(precalc): varsayılan sütun görünümü Tümü olsun"
```

---

## Faz 2 — Scroll mimarisi

### Task 4: Dikey sanallaştırmayı pencere scroll'una bağla

**Files:**
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx:70-73` (`OVERSCAN`/`TABLE_HEIGHT` sabitleri), `:439-468` (viewport ölçüm effect'i), `:1019-1022` (filtre sonrası başa dönme), `:1377-1379` (tablo kutusu sarmalayıcı)

**Interfaces:**
- Consumes: mevcut `rowOffsets`, `seek`, `windowRows`/`padTop`/`padBottom` mantığı (satır 985-1013) — **değişmez**.

- [ ] **Step 1: `TABLE_HEIGHT` sabitini sil (satır 72-73)**

`const TABLE_HEIGHT = 'calc(100vh - 17rem)';` satırını ve üstündeki yorumu sil — artık kullanılmayacak.

- [ ] **Step 2: Viewport ölçüm effect'ini pencereye bağla (satır 439-468)**

```tsx
  /* ---- tablo kutusu ve sanallaştırma ---- */
  // Tablo artık sayfayla birlikte akar (tek native pencere scroll'u); yalnızca
  // dikeyde görünür satır aralığı çizilir. Yatay kaydırma hâlâ bu kutunun
  // kendi ekseninde — bkz. Task 5 (HScrollControl).
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Tablonun viewport'un üstünden ne kadar kaydırıldığı: element'in üst
      // kenarı ekranın üstünün ne kadar üzerindeyse o kadar satır "geçilmiş"
      // demektir. getBoundingClientRect().top negatifse tablo yukarı kaymıştır.
      const top = Math.max(0, -el.getBoundingClientRect().top);
      const height = window.innerHeight;
      setViewport((prev) => (prev.top === top && prev.height === height ? prev : { top, height }));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [activeSheet]);
```

- [ ] **Step 3: Filtre sonrası "başa dön" davranışını pencereye taşı (satır 1019-1022)**

```tsx
  useEffect(() => {
    if (scrollRef.current) {
      window.scrollTo({ top: window.scrollY + scrollRef.current.getBoundingClientRect().top });
    }
  }, [search, topCategory, subCategory, productType, standard, supplier, label,
    group, priced, minPrice, maxPrice, onlyEntered, sortKey, sortDir]);
```

- [ ] **Step 4: Tablo kutusunun dış kartını ve sabit yüksekliği kaldır (satır 1377-1379)**

Eskisi:
```tsx
          {/* Tablo — kendi kutusunda kayar: başlık ve yatay çubuk hep ekranda */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div ref={scrollRef} className="overflow-auto" style={{ height: TABLE_HEIGHT }}>
```

Yenisi:
```tsx
          {/*
            Tablo artık ayrı bir kart değil — sayfa akışının doğal bir parçası.
            Dikey kaydırma pencereye ait (bkz. yukarıdaki viewport effect'i);
            bu kutu yalnızca yatay eksende taşar (overflow-x). CSS overflow
            normalizasyonu gereği overflow-y burada "visible" yazılsa da
            tarayıcı bunu "auto"ya çevirir (bkz. CSS Overflow spec) — zararsız,
            çünkü kutuya sabit yükseklik verilmediği için hiçbir zaman taşmaz.
          */}
          <div ref={scrollRef} className="overflow-x-auto">
```

Bu değişiklikle kapanan `</div>` sayısı bir azalır — satır ~1470-1471'deki iç içe iki `</div>`'den dış olanı (kart sarmalayıcıya ait) silinir; tablo artık tek `<div ref={scrollRef}>` içinde kalır.

- [ ] **Step 5: Tip denetimi**

Run: `npm run type-check`

- [ ] **Step 6: Elle doğrulama**

Tarayıcıda PRECALCULATION sekmesini aç, sayfayı fare tekerleğiyle aşağı kaydır: hem tablo satırları hem üstteki araç çubuğu/altındaki içerik TEK scroll ile hareket etmeli (artık tabloya girince kaydırma "hapsolmuyor"). Hızlı kaydırmada satırların atlanmadığını / boş kalmadığını doğrula. Header (`sticky top-0`) hâlâ ekranın üstünde sabit kalmalı.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx"
git commit -m "feat(precalc): dikey sanallaştırma pencere scroll'una bağlansın (tek scroll)"
```

---

### Task 5: `HScrollControl` — kompakt özel yatay scroll kontrolü

**Files:**
- Create: `components/precalc/HScrollControl.tsx`
- Test: `components/precalc/__tests__/HScrollControl.test.ts`
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx` (import + JSX'e ekleme + `scrollRef` div'in className'i), `app/globals.css` (native scrollbar'ı gizleyen utility)

**Interfaces:**
- Produces: `computeThumbRect(state): { left: number; width: number }` (saf fonksiyon, export edilir, testte kullanılır), `HScrollControl` (default export, `{ targetRef: RefObject<HTMLElement>; watch?: unknown }` props alır).
- Consumes: Task 4'teki `scrollRef` (`AdvancedPrecalculationClient.tsx`'te tanımlı).

- [ ] **Step 1: Write the failing test**

`components/precalc/__tests__/HScrollControl.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeThumbRect } from '../HScrollControl';

describe('computeThumbRect', () => {
  it('taşma yoksa thumb tüm track\'i kaplar', () => {
    expect(computeThumbRect({ scrollLeft: 0, scrollWidth: 800, clientWidth: 800 }))
      .toEqual({ left: 0, width: 1 });
  });

  it('en solda scrollLeft=0 iken thumb solda başlar', () => {
    const r = computeThumbRect({ scrollLeft: 0, scrollWidth: 2000, clientWidth: 500 });
    expect(r.left).toBe(0);
    expect(r.width).toBeCloseTo(500 / 2000, 5);
  });

  it('en sağda (scrollLeft = scrollWidth - clientWidth) thumb sağa yaslanır', () => {
    const r = computeThumbRect({ scrollLeft: 1500, scrollWidth: 2000, clientWidth: 500 });
    expect(r.left + r.width).toBeCloseTo(1, 5);
  });

  it('ortada (%50) thumb da track\'in ortasına yakın olur', () => {
    const r = computeThumbRect({ scrollLeft: 750, scrollWidth: 2000, clientWidth: 500 });
    const maxLeft = 1 - r.width;
    expect(r.left).toBeCloseTo(maxLeft * 0.5, 5);
  });

  it('çok dar içerikte thumb en az %8 genişlikte kalır (görünür olsun diye)', () => {
    const r = computeThumbRect({ scrollLeft: 0, scrollWidth: 100000, clientWidth: 500 });
    expect(r.width).toBeGreaterThanOrEqual(0.08);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/precalc/__tests__/HScrollControl.test.ts`
Expected: FAIL — `Cannot find module '../HScrollControl'`

- [ ] **Step 3: `HScrollControl.tsx`'i yaz**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';

/** Bir kayan kutunun thumb konum/genişliğini (0-1 oranında) hesaplar. */
export function computeThumbRect(state: { scrollLeft: number; scrollWidth: number; clientWidth: number }) {
  const { scrollLeft, scrollWidth, clientWidth } = state;
  if (scrollWidth <= clientWidth) return { left: 0, width: 1 };
  const width = Math.max(0.08, clientWidth / scrollWidth);
  const maxLeft = 1 - width;
  const range = scrollWidth - clientWidth;
  const left = range > 0 ? maxLeft * (scrollLeft / range) : 0;
  return { left, width };
}

const STEP = 160;

interface Props {
  /** Yatay kaydırılan hedef elementin ref'i (ör. tabloyu saran overflow-x kutusu). */
  targetRef: RefObject<HTMLElement | null>;
  /** Hedefin içeriği değişince (sütun sayısı vb.) yeniden ölçmek için. */
  watch?: unknown;
}

/**
 * Ekranın altına sabit, kompakt yatay kaydırma kontrolü. Hedef elementin
 * native `overflow-x: auto` scroll'unu okur/yazar — kaydırma fiziği
 * (trackpad, shift+wheel, klavye) native scrollbar'dan devralınır, yalnızca
 * görsel scrollbar bu bileşenle değiştirilir (bkz. globals.css `.hscroll-hidden`).
 */
export default function HScrollControl({ targetRef, watch }: Props) {
  const [state, setState] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    setState({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [targetRef, measure, watch]);

  function scrollByStep(dir: 1 | -1) {
    targetRef.current?.scrollBy({ left: dir * STEP, behavior: 'smooth' });
  }

  function moveTo(clientX: number) {
    const track = trackRef.current;
    const el = targetRef.current;
    if (!track || !el) return;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  }

  function onTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  }
  function onTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    moveTo(e.clientX);
  }
  function onTrackPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    trackRef.current?.releasePointerCapture(e.pointerId);
  }

  const canScroll = state.scrollWidth > state.clientWidth + 1;
  if (!canScroll) return null;

  const thumb = computeThumbRect(state);

  return (
    <div
      className={cn(
        'fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1',
        'rounded-full border border-slate-200 bg-slate-50/95 backdrop-blur px-1.5 py-1 shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={() => scrollByStep(-1)}
        aria-label="Sola kaydır"
        className="w-5 h-5 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 text-xs leading-none"
      >
        ‹
      </button>
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        className="relative w-28 h-2 rounded-full bg-slate-200 cursor-pointer"
      >
        <div
          className="absolute top-0 h-2 rounded-full bg-slate-500"
          style={{ left: `${thumb.left * 100}%`, width: `${thumb.width * 100}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => scrollByStep(1)}
        aria-label="Sağa kaydır"
        className="w-5 h-5 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 text-xs leading-none"
      >
        ›
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/precalc/__tests__/HScrollControl.test.ts`
Expected: PASS

- [ ] **Step 5: Native scrollbar'ı gizleyen utility'i ekle**

`app/globals.css` sonuna ekle:

```css

/* Yatay scroll kutularında native scrollbar'ı gizler; scroll işlevi kalır —
   HScrollControl.tsx bunun üstüne kompakt bir kontrol biner. */
.hscroll-hidden { scrollbar-width: none; -ms-overflow-style: none; }
.hscroll-hidden::-webkit-scrollbar { display: none; }
```

- [ ] **Step 6: `AdvancedPrecalculationClient.tsx`'e bağla**

Import ekle (üstteki import bloğuna, `RevisionDialog` importundan sonra):

```ts
import HScrollControl from '@/components/precalc/HScrollControl';
```

Task 4'te yazılan `<div ref={scrollRef} className="overflow-x-auto">` satırını genişlet:

```tsx
          <div ref={scrollRef} className="overflow-x-auto hscroll-hidden">
```

Tablonun kapanış `</div>`'inden hemen sonra (legend bloğundan önce) ekle:

```tsx
          <HScrollControl targetRef={scrollRef} watch={cols.length} />
```

- [ ] **Step 7: Tip denetimi**

Run: `npm run type-check`

- [ ] **Step 8: Elle doğrulama**

"Tümü" görünümünde (69 sütun) tarayıcıda tabloyu aç: ekranın altında küçük, gri, ok+track+thumb kontrolü görünmeli. Sağ/sol oka tıklayınca tablo yumuşak kayar; thumb'ı sürükleyince tablo anında takip eder; native yatay scrollbar görünmemeli ama trackpad/shift+wheel ile kaydırma hâlâ çalışmalı. "Teklif" görünümüne geçip (12 sütun, taşma yoksa) kontrolün kaybolduğunu doğrula.

- [ ] **Step 9: Commit**

```bash
git add components/precalc/HScrollControl.tsx components/precalc/__tests__/HScrollControl.test.ts app/globals.css "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx"
git commit -m "feat(precalc): kompakt ozel yatay scroll kontrolu (HScrollControl)"
```

---

## Kapanış Kontrolü

- [ ] `npm test` — tüm paketler PASS (yeni `advancedPrecalcColumns.test.ts` + `HScrollControl.test.ts` dahil)
- [ ] `npm run type-check` — hata yok
- [ ] `npm run lint` — yeni uyarı yok
- [ ] Uçtan uca: `/advanced-precalculation` aç → "Sütunlar: Tümü" varsayılan seçili → 69 sütun yatayda erişilebilir → sayfa tek fare tekerleğiyle (tablo dahil) akıyor → ekranın altında kompakt yatay scroll kontrolü çalışıyor → sütun genişlik/sıra sürükleme hâlâ çalışıyor ve kaydediliyor → "Teklif"/"Teknik" görünüm kısayolları hâlâ çalışıyor.
