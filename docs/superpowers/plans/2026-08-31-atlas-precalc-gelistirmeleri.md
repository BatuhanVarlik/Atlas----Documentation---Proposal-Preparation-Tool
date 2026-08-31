# Atlas Advanced Precalculation Geliştirmeleri — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advanced Precalculation ekranına on geliştirme eklemek — sütun düzeni, revizyon zinciri, cashflow ve yeniden tasarlanmış Excel çıktısı.

**Architecture:** Cashflow ve revizyon mantığı, hesap motorunu okuyan **saf modüllere** yazılır; ekran ve sunucu aynı fonksiyonu çağırır, böylece listedeki rakam ile üretilen Excel ayrışmaz. `lib/precalc/export.ts` bir klasöre bölünür. Üretilen .xlsx, `pizzip` ile açılıp `pageSetup`, gizli sütun ve native chart XML'i enjekte edilerek kapatılır.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma + PostgreSQL, `xlsx-js-style`, `pizzip`, `recharts`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-precalc-gelistirmeleri-design.md`

## Global Constraints

- Çalışma dizini: `Atlas/`. Tüm yollar buraya görelidir.
- **Yeni npm paketi eklenmeyecek.** `pizzip`, `xlsx-js-style`, `recharts` zaten `package.json`'da.
- **Kaynak `.xlsm` ve `workbook.json` salt okunurdur.** Hiçbir görev bunları değiştirmez; `scripts/build-precalc.js` çalıştırılmaz.
- **Hesap sunucuda yeniden koşar.** API uçları istemciden yalnızca `entries` alır; hesaplanmış tutarlara asla güvenilmez.
- **`engine.settle()` zorunludur.** Kitap yinelemeli hesapla (`calcPr iterate="1"`) kaydedilmiştir; `settle()` çağrılmadan genel gider dağıtımı `#DIV/0!` kalır.
- **Satır numaraları sabit yazılmaz.** Hepsi `engine.anchors` üzerinden ofsetle bulunur (`subtotalRow = 4863`, `grandTotalRow = 4878` şu anki kitapta).
- Arayüz metinleri ve kod yorumları **Türkçe**; kodun geri kalanı mevcut dosyaların üslubunu izler.
- Sayı biçimi: `formatNumberTR` (`lib/utils.ts`), ondalık ayırıcı virgül.
- Test komutu: `npm test` (vitest, `environment: 'node'`). Vitest yalnızca `lib/**/__tests__/**/*.test.ts` ve `components/**/__tests__/**/*.test.ts` dosyalarını toplar.
- Tip denetimi: `npm run type-check`.

## Test Stratejisi

DOM test ortamı kurulu değil (`environment: 'node'`, testing-library yok) ve kurmak kapsam dışı. Bu yüzden **her görev, test edilebilir saf bir modül çıkarır** ve testi ona yazar; kalan React bağlantısı elle doğrulanır. Bir görevin "saf" parçası yoksa (yalnızca JSX yerleşimi), doğrulama `npm run type-check` + tarayıcıda adım adım kontroldür ve bu, görevin adımlarında açıkça yazılıdır.

## Dosya Yapısı

**Yeni saf modüller (test edilir):**

| Dosya | Sorumluluk |
|---|---|
| `components/precalc/othersColumns.ts` | OTHERS tablosunun sütun düzeni |
| `components/precalc/identityFields.ts` | Kimlik şeridi alan tanımları |
| `components/precalc/columnGroups.ts` | P–AC / AD–BO katlanır sütun grupları |
| `lib/precalc/profit.ts` | Kâr oranı hesabı |
| `lib/precalc/cashflow.ts` | 52 haftalık nakit akışı okuması |
| `lib/precalc/precalcNo.ts` | Revizyon kodu ayrıştırma |
| `lib/precalc/revisionDiff.ts` | Girdi farkı → Türkçe revizyon metni |
| `lib/precalc/xlsxPost.ts` | .xlsx son işlem (pageSetup, gizli sütun, chart) |

**`lib/precalc/export.ts` → `lib/precalc/export/`:**

| Dosya | Sorumluluk |
|---|---|
| `index.ts` | `buildPrecalcWorkbook`, `ExportOptions`, yeniden dışa aktarımlar |
| `cells.ts` | `cellFor`, `styledBlank`, `excelDate`, `Style` tipi |
| `precalcSheet.ts` | PRECALCULATION sayfası + `EXPORT_COLUMNS` |
| `summarySheet.ts` | ÖZET (+ revizyon geçmişi bloğu) |
| `cashflowSheet.ts` | CASHFLOW sayfası |
| `detailedSheet.ts` | AYRINTILI FIYATLANDIRMA baskı kuralı |
| `listSheets.ts` | EQUIPMENT LIST + Sevk Listesi + `quoteEquipmentNumbers` |
| `snapshot.ts` | `buildSheetSnapshot` |
| `fileName.ts` | `precalcFileName` |

**Değiştirilen mevcut dosyalar:** `components/precalc/OthersTable.tsx`, `components/precalc/TotalsPanel.tsx`, `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx`, `app/api/precalc/export/route.ts`, `app/api/precalc/export-sheet/route.ts`, `app/api/precalc/saved/route.ts`, `app/api/precalc/saved/[id]/route.ts`, `lib/precalc/savedClient.ts`, `lib/precalc/savedSummary.ts`, `prisma/schema.prisma`.

**Yeni bileşenler:** `components/precalc/CashflowPanel.tsx`, `components/precalc/RevisionBar.tsx`, `components/precalc/RevisionDialog.tsx`.

---

## Faz 1 — Küçük düzeltmeler

### Task 1: OTHERS tablosunda Kaynak (G) sütununu sona taşı

**Files:**
- Create: `components/precalc/othersColumns.ts`
- Create: `components/precalc/__tests__/othersColumns.test.ts`
- Modify: `components/precalc/OthersTable.tsx:19-47` (`OTHERS_COLUMNS` tanımı kaldırılır, import edilir)

**Interfaces:**
- Produces: `OTHERS_COLUMNS: OthersColumn[]` — `{ col: string; label: string; width: number; format: CellFormat; align?: 'right' }`

- [ ] **Step 1: Write the failing test**

`components/precalc/__tests__/othersColumns.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { OTHERS_COLUMNS } from '../othersColumns';

describe('OTHERS sütun düzeni', () => {
  it('Kaynak (G) en sonda durur', () => {
    const cols = OTHERS_COLUMNS.map((c) => c.col);
    expect(cols[cols.length - 1]).toBe('G');
  });

  it('değer sütunları (F, H–N) kimlik sütunlarından (A–E) önce gelir', () => {
    const cols = OTHERS_COLUMNS.map((c) => c.col);
    expect(cols.indexOf('N')).toBeLessThan(cols.indexOf('A'));
    expect(cols.indexOf('F')).toBe(0);
  });

  it('kitabın A–O sütunlarının tamamını bir kez taşır', () => {
    const cols = OTHERS_COLUMNS.map((c) => c.col);
    expect(new Set(cols).size).toBe(cols.length);
    expect(cols.sort()).toEqual(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'].sort(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- othersColumns`
Expected: FAIL — `Failed to resolve import "../othersColumns"`

- [ ] **Step 3: Write the module**

`components/precalc/othersColumns.ts`:

```ts
import type { CellFormat } from './columns';

export interface OthersColumn {
  col: string;
  label: string;
  width: number;
  format: CellFormat;
  align?: 'right';
}

/**
 * OTHERS bölümünün sütun düzeni.
 *
 * Kitabın asıl değerleri F–N arasındadır (miktar, kalem adı, birim fiyat,
 * çarpanlar, maliyet, satış); kimlik sütunları A–E bu blokta çoğu satırda
 * boştur. Bu yüzden önce F–N, sonra A–E gösterilir. Fiyat uyarısı (O) ve
 * kaynak (G) günlük kullanımda okunmadığı için en sonda durur.
 */
export const OTHERS_COLUMNS: OthersColumn[] = [
  { col: 'F', label: 'Miktar (F)', width: 110, format: 'number', align: 'right' },
  { col: 'H', label: 'Kalem (H)', width: 330, format: 'text' },
  { col: 'I', label: 'Birim / Matrah (I)', width: 135, format: 'money', align: 'right' },
  { col: 'J', label: 'Çarpan (J)', width: 105, format: 'number', align: 'right' },
  { col: 'K', label: 'Ek Çarpan (K)', width: 110, format: 'number', align: 'right' },
  { col: 'L', label: 'Nakliye (L)', width: 115, format: 'money', align: 'right' },
  { col: 'M', label: 'Maliyet (M)', width: 130, format: 'money', align: 'right' },
  { col: 'N', label: 'Satış (N)', width: 130, format: 'money', align: 'right' },

  { col: 'A', label: 'Kullanım Yeri (A)', width: 190, format: 'text' },
  { col: 'B', label: 'Ekipman No (B)', width: 150, format: 'text' },
  { col: 'C', label: 'Teknik Açıklama (C)', width: 260, format: 'text' },
  { col: 'D', label: 'Etiket (D)', width: 110, format: 'text' },
  { col: 'E', label: 'Tedarikçi (E)', width: 160, format: 'text' },

  { col: 'O', label: 'Fiyat Uyarısı (O)', width: 120, format: 'number', align: 'right' },
  { col: 'G', label: 'Kaynak (G)', width: 95, format: 'number', align: 'right' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- othersColumns`
Expected: PASS (3 test)

- [ ] **Step 5: OthersTable.tsx'i modüle bağla**

`components/precalc/OthersTable.tsx` içinde 19–47. satırlardaki `OTHERS_COLUMNS` blok yorumuyla birlikte silinir, yerine import gelir:

```ts
import { OTHERS_COLUMNS } from './othersColumns';
```

`CellFormat` importu yalnızca `OTHERS_COLUMNS` için kullanılıyorsa (`import type { CellFormat } from './columns';`) o da silinir. Dosyanın geri kalanı `OTHERS_COLUMNS`'u zaten aynı adla kullandığı için başka değişiklik gerekmez.

- [ ] **Step 6: Tip denetimi ve elle doğrulama**

Run: `npm run type-check`
Expected: hata yok

`npm run dev` → `/advanced-precalculation` → **OTHERS** sekmesi. Beklenen: son sütun "Kaynak (G)", ondan önce "Fiyat Uyarısı (O)". Ağaç katlama ve düzenlenebilir hücreler eskisi gibi çalışır.

- [ ] **Step 7: Commit**

```bash
git add components/precalc/othersColumns.ts components/precalc/__tests__/othersColumns.test.ts components/precalc/OthersTable.tsx
git commit -m "feat(precalc): OTHERS tablosunda Kaynak (G) sutununu sona tasi"
```

---

### Task 2: Kimlik şeridine Customer / End User / Date / Prepared By ekle

**Files:**
- Create: `components/precalc/identityFields.ts`
- Create: `components/precalc/__tests__/identityFields.test.ts`
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx:1671-1695` (`IDENTITY_FIELDS` kaldırılır, import edilir)

**Interfaces:**
- Produces: `IDENTITY_FIELDS: IdentityField[]` — `{ key: string; label: string; placeholder: string; hint: string; format: 'text' | 'date' }`

- [ ] **Step 1: Write the failing test**

`components/precalc/__tests__/identityFields.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IDENTITY_FIELDS } from '../identityFields';
import workbookData from '@/lib/precalc/workbook.json';
import type { PrecalcWorkbook } from '@/lib/precalc/types';

const workbook = workbookData as unknown as PrecalcWorkbook;

describe('kimlik şeridi alanları', () => {
  it('altı alanı bu sırayla taşır', () => {
    expect(IDENTITY_FIELDS.map((f) => f.key)).toEqual([
      'projectNo', 'precalcNo', 'customer', 'endUser', 'date', 'preparedBy',
    ]);
  });

  it('her alanın karşılığı çalışma kitabının params listesinde vardır', () => {
    const known = new Set(workbook.params.map((p) => p.key));
    for (const f of IDENTITY_FIELDS) expect(known).toContain(f.key);
  });

  it('tarih alanı date biçiminde, kalanı metin', () => {
    const byKey = new Map(IDENTITY_FIELDS.map((f) => [f.key, f]));
    expect(byKey.get('date')?.format).toBe('date');
    expect(byKey.get('customer')?.format).toBe('text');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- identityFields`
Expected: FAIL — `Failed to resolve import "../identityFields"`

- [ ] **Step 3: Write the module**

`components/precalc/identityFields.ts`:

```ts
import type { CellFormat } from './columns';

export interface IdentityField {
  /** workbook.params'taki anahtar — adres oradan çözülür. */
  key: string;
  label: string;
  placeholder: string;
  hint: string;
  format: Extract<CellFormat, 'text' | 'date'>;
}

/**
 * Teklifin kimliği. Hepsi kitabın başlık bloğuna yazılır (B1–B7);
 * dışa aktarılan Excel'in başlık bloğu da aynı hücrelerden okunduğu için
 * burada girilen değer doğrudan dosyaya düşer.
 */
export const IDENTITY_FIELDS: IdentityField[] = [
  {
    key: 'projectNo',
    label: 'Proje No',
    placeholder: 'ör. 2026-114',
    hint: 'Teklifin bağlı olduğu proje numarası. Başlık bloğuna yazılır.',
    format: 'text',
  },
  {
    key: 'precalcNo',
    label: 'Precalculation No',
    placeholder: 'ör. PRE-2026-114 RE-00',
    hint: 'Kaydın listedeki adı. Revizyon için sonundaki kodu değiştirin (RE-00 → RE-01).',
    format: 'text',
  },
  {
    key: 'customer',
    label: 'Müşteri',
    placeholder: 'ör. Sütaş A.Ş.',
    hint: 'Teklifin verildiği firma (CUSTOMER).',
    format: 'text',
  },
  {
    key: 'endUser',
    label: 'Son Kullanıcı',
    placeholder: 'ör. Karacabey Tesisi',
    hint: 'Sistemi işletecek taraf (END USER). Müşteriyle aynıysa boş bırakılabilir.',
    format: 'text',
  },
  {
    key: 'date',
    label: 'Tarih',
    placeholder: 'gg.aa.yyyy',
    hint: 'Teklif tarihi (DATE). Boşsa Excel üretilirken bugünün tarihi yazılır.',
    format: 'date',
  },
  {
    key: 'preparedBy',
    label: 'Hazırlayan',
    placeholder: 'ör. Süleyman Altındal',
    hint: 'Teklifi hazırlayan mühendis (PREPARED BY).',
    format: 'text',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- identityFields`
Expected: PASS (3 test)

- [ ] **Step 5: Client'ı modüle bağla**

`AdvancedPrecalculationClient.tsx`:

1. 1671–1695 arasındaki `const IDENTITY_FIELDS: {...}[] = [...]` bloğunu tümüyle sil.
2. Üstteki import bloğuna ekle:

```ts
import { IDENTITY_FIELDS } from '@/components/precalc/identityFields';
```

3. `QuoteIdentityBar` içindeki `EditableCell` çağrısı artık alanın biçimini kullanır — `format="text"` sabiti `format={f.format}` olur:

```tsx
<EditableCell
  value={f.value}
  format={f.format}
  align="left"
  edited={f.edited}
  placeholder={f.placeholder}
  onCommit={(v) => onSetCell(f.addr, v)}
/>
```

4. Şerit altı alanla kalabalıklaştığı için alan kutusu daralır: `QuoteIdentityBar` içindeki `<span className="w-40">` → `<span className="w-36">`.

- [ ] **Step 6: Tip denetimi ve elle doğrulama**

Run: `npm run type-check`
Expected: hata yok

`/advanced-precalculation` → kimlik şeridinde altı alan görünür. "Müşteri" alanına bir değer yazıp Enter'a bas, **OTHERS** sekmesine geçip geri dön: değer durmalı (motora yazıldı). Sayfayı yenile: taslaktan geri gelmeli.

- [ ] **Step 7: Commit**

```bash
git add components/precalc/identityFields.ts components/precalc/__tests__/identityFields.test.ts "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx"
git commit -m "feat(precalc): kimlik seridine musteri, son kullanici, tarih ve hazirlayan alanlari"
```

---

### Task 3: Kâr oranını doğru formülle hesapla

**Files:**
- Create: `lib/precalc/profit.ts`
- Create: `lib/precalc/__tests__/profit.test.ts`
- Modify: `lib/precalc/export.ts:465` (ÖZET satırı — Task 5'te taşınacak, şimdilik yerinde)
- Modify: `components/precalc/TotalsPanel.tsx:57,68,101-106`

**Interfaces:**
- Produces: `profitRate(engine: PrecalcEngine): number | null` — genel toplam satırından `1 − M/N`; `N ≤ 0` ise `null`.

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/profit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { profitRate } from '../profit';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

/** Bir kaleme adet girilmiş, hesabı sabitlenmiş motor. */
function engineWithQuote() {
  const engine = new PrecalcEngine(workbook);
  // Katalogdaki ilk gerçek kalem satırına adet ve liste fiyatı yazılır.
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  engine.setCell('PRECALCULATION', 'F' + item.r, 10);
  engine.setCell('PRECALCULATION', 'I' + item.r, 1000);
  engine.settle();
  return engine;
}

describe('kâr oranı', () => {
  it('boş teklifte null döner (satış yok, bölme yapılmaz)', () => {
    const engine = new PrecalcEngine(workbook);
    engine.settle();
    expect(profitRate(engine)).toBeNull();
  });

  it('satış varken (satış − maliyet) / satış verir', () => {
    const engine = engineWithQuote();
    const { grandTotalRow } = engine.anchors;
    const cost = engine.num('M' + grandTotalRow);
    const sales = engine.num('N' + grandTotalRow);

    expect(sales).toBeGreaterThan(0);
    expect(profitRate(engine)).toBeCloseTo(1 - cost / sales, 10);
  });

  it('0 ile 1 arasında kalır — Excel’in SALES PRICE’a bağlı hücresi gibi eksiye düşmez', () => {
    const rate = profitRate(engineWithQuote());
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
    expect(rate!).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- profit`
Expected: FAIL — `Failed to resolve import "../profit"`

- [ ] **Step 3: Write the module**

`lib/precalc/profit.ts`:

```ts
import type { PrecalcEngine } from './engine';

/**
 * Teklifin kâr oranı.
 *
 * Kitabın kendi hücresi (M<ara toplam+19>) `1-(M<toplam>/M<SALES PRICE>)`
 * biçimindedir ve SALES PRICE elle girilen, varsayılanı 0 olan bir hücredir —
 * girilmediği sürece oran anlamsız çıkar. Bu yüzden gösterilen değer genel
 * toplam satırından türetilir: satışın ne kadarı kâr.
 *
 * Kaynak kitabın hücresi değiştirilmez; yalnızca ekranda ve özet sayfasında
 * gösterdiğimiz rakam buradan gelir.
 *
 * @returns 0–1 arası oran; satış yoksa null (çağıran "—" gösterir).
 */
export function profitRate(engine: PrecalcEngine): number | null {
  const { grandTotalRow } = engine.anchors;
  const sales = engine.num('N' + grandTotalRow);
  if (!(sales > 0)) return null;
  return 1 - engine.num('M' + grandTotalRow) / sales;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- profit`
Expected: PASS (3 test)

- [ ] **Step 5: ÖZET sayfasını bağla**

`lib/precalc/export.ts` içinde `buildSummarySheet` fonksiyonundaki satırı değiştir:

```ts
// önce
row('Kâr oranı', engine.num('M' + (AN.subtotalRow + 19)), 'percent');

// sonra
row('Kâr oranı', profitRate(engine) ?? '—', 'percent');
```

Dosyanın başına import ekle:

```ts
import { profitRate } from './profit';
```

`row()` yardımcısı değeri `cellFor`'a verdiği için metin `'—'` de sorunsuz basılır; `percent` biçimi yalnızca sayıya uygulanır.

- [ ] **Step 6: TotalsPanel'i bağla**

`components/precalc/TotalsPanel.tsx`:

1. Import ekle: `import { profitRate } from '@/lib/precalc/profit';`
2. `totals` memo'sunda satırı değiştir:

```ts
// önce
const profitRate = engine.num('M' + (subtotalRow + 19));

// sonra
const rate = profitRate(engine);
```

ve döndürülen nesnede `profitRate` → `profitRate: rate`. `margin` alanı aynı bilgiyi ikinci kez hesapladığı için silinir (kullanılmıyor).

3. Dört ölçü kutusunun bulunduğu grid'i beşe çıkar ve kâr oranını göster:

```tsx
<div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
  <Stat label={`Ara Toplam — Maliyet (${currency})`} value={money(totals.subCost)} />
  <Stat label={`Ara Toplam — Satış (${currency})`} value={money(totals.subSales)} />
  <Stat label={`Genel Toplam — Maliyet (${currency})`} value={money(totals.grandCost)} tone="slate" />
  <Stat label={`Genel Toplam — Satış (${currency})`} value={money(totals.grandSales)} tone="emerald" />
  <Stat
    label="Kâr Oranı"
    value={totals.profitRate === null
      ? '—'
      : formatNumberTR(totals.profitRate * 100, { decimals: 2 }) + ' %'}
    tone="emerald"
  />
</div>
```

`formatNumberTR` zaten dosyanın import'unda var.

- [ ] **Step 7: Tüm testleri ve tip denetimini çalıştır**

Run: `npm test && npm run type-check`
Expected: hepsi PASS, tip hatası yok

- [ ] **Step 8: Elle doğrulama**

`/advanced-precalculation` → **Genel Giderler & Toplam** sekmesi. Boş teklifte "Kâr Oranı — " görünür. Bir kaleme adet gir, 1 sn bekle (settle): oran ~%30 çıkmalı (kâr çarpanı 0,70). Kâr çarpanını 0,85 yap: oran ~%15'e düşmeli.

- [ ] **Step 9: Commit**

```bash
git add lib/precalc/profit.ts lib/precalc/__tests__/profit.test.ts lib/precalc/export.ts components/precalc/TotalsPanel.tsx
git commit -m "fix(precalc): kar oranini genel toplamdan hesapla, ozet ve toplam panelinde goster"
```

---

## Faz 2 — Export yeniden yapılandırma

### Task 4: export.ts'i export/ klasörüne böl (davranış değişmez)

Bu görev **saf yeniden yapılandırmadır**: tek bir çıktı baytı değişmemeli. Bunu kanıtlayan test önce yazılır, bölme sonra yapılır.

**Files:**
- Create: `lib/precalc/__tests__/export.test.ts`
- Create: `lib/precalc/export/index.ts`, `cells.ts`, `precalcSheet.ts`, `summarySheet.ts`, `detailedSheet.ts`, `listSheets.ts`, `snapshot.ts`, `fileName.ts`
- Delete: `lib/precalc/export.ts`

**Interfaces:**
- Consumes: `profitRate` (Task 3)
- Produces: `lib/precalc/export/index.ts`'ten `buildPrecalcWorkbook`, `buildSheetSnapshot`, `quoteEquipmentNumbers`, `precalcFileName`, `EXPORT_COLUMNS`, `DETAILED_SHEET`, `ExportOptions`, `StockRow` — imza ve isimler birebir korunur, `@/lib/precalc/export` importu değişmeden çalışır.

- [ ] **Step 1: Bölmeden önce mevcut çıktıyı kilitleyen testi yaz**

`lib/precalc/__tests__/export.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { buildPrecalcWorkbook, buildSheetSnapshot, precalcFileName } from '../export';
import { PrecalcEngine } from '../engine';
import type { PrecalcEntries, PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

/** Bir kaleme adet + liste fiyatı girilmiş küçük bir teklif. */
function quoteEntries(): PrecalcEntries {
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  return {
    ['PRECALCULATION!F' + item.r]: 10,
    ['PRECALCULATION!I' + item.r]: 1000,
    'PRECALCULATION!B4': 'PRE-TEST RE-00',
  };
}

describe('precalculation dışa aktarımı', () => {
  it('beklenen sayfaları üretir', () => {
    const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    expect(book.SheetNames).toEqual([
      'PRECALCULATION', 'EQUIPMENT LIST', 'Sevk Listesi',
      'AYRINTILI FIYATLANDIRMA', 'ÖZET',
    ]);
  });

  it('PRECALCULATION sayfası başlık bloğu ve sütun şeridiyle başlar', () => {
    const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    const sheet = book.Sheets['PRECALCULATION'];
    expect(sheet['A2']?.v).toBe('CUSTOMER:');
    expect(sheet['D3']?.v).toBe('PRECALCULATION NO:');
    expect(sheet['E3']?.v).toBe('PRE-TEST RE-00');
  });

  it('yazılıp geri okunabilir bir kitap üretir', () => {
    const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(buffer.length).toBeGreaterThan(1000);
    expect(XLSX.read(buffer, { type: 'buffer' }).SheetNames).toContain('ÖZET');
  });

  it('buildSheetSnapshot bilinmeyen sayfada null döner', () => {
    const engine = new PrecalcEngine(workbook);
    engine.settle();
    expect(buildSheetSnapshot(engine, 'YOK BÖYLE BİR SAYFA')).toBeNull();
    expect(buildSheetSnapshot(engine, 'KABLO')).not.toBeNull();
  });

  it('dosya adı .xlsx ile biter', () => {
    expect(precalcFileName()).toMatch(/^PRECALCULATION .+\.xlsx$/);
  });
});
```

- [ ] **Step 2: Testi çalıştır — bölmeden ÖNCE geçmeli**

Run: `npm test -- export`
Expected: PASS (5 test). Geçmiyorsa bölmeye başlama; test mevcut davranışı yanlış tarif ediyordur, önce onu düzelt.

- [ ] **Step 3: Klasörü oluştur ve dosyaları ayır**

`lib/precalc/export.ts`'i aşağıdaki sınırlardan keserek `lib/precalc/export/` altına dağıt. **Kod gövdeleri olduğu gibi taşınır**, yalnızca import satırları ve `export` anahtar kelimeleri düzeltilir.

| Yeni dosya | Taşınan içerik (mevcut satır aralığı) |
|---|---|
| `cells.ts` | `excelDate` (148–154), `cellFor` (155–169), `styledBlank` (177–180) ve bunların kullandığı `Style` tip takma adı |
| `snapshot.ts` | `buildSheetSnapshot` (492–541) |
| `fileName.ts` | `precalcFileName` (727–730) |
| `listSheets.ts` | `QuoteLine` (67–78), `EQUIPMENT_GROUPS` (90–99), `SHIPPING_BRANDS` (106–111), `MATCH_BY_SUPPLIER` (117), `StockRow` (119–120), `listSheetShell` (549–611), `buildEquipmentSheet` (620–660), `buildShippingSheet` (667–702), `quoteEquipmentNumbers` (711–725) |
| `precalcSheet.ts` | `EXPORT_COLUMNS` (29–61) ve `buildPrecalcWorkbook` gövdesinden **PRECALCULATION sayfasını kuran bölüm** (200–375) — yeni imza: `buildPrecalcSheet(engine, wb, options, header): { sheet: XLSX.WorkSheet; keptItemCount: number; lines: QuoteLine[] }` |
| `summarySheet.ts` | `DETAILED_SHEET` sabiti hariç `buildSummarySheet` (446–482) |
| `detailedSheet.ts` | `DETAILED_SHEET = 'AYRINTILI FIYATLANDIRMA'` (443) ve detaylı sayfayı üreten sarmalayıcı: `buildDetailedSheet(engine)` — şimdilik yalnızca `buildSheetSnapshot(engine, DETAILED_SHEET)` döner (parite kuralı Task 7'de eklenecek) |
| `index.ts` | `ExportOptions` (122–142), `buildPrecalcWorkbook` orkestrasyonu ve yeniden dışa aktarımlar |

`index.ts`'in yeniden dışa aktarım bloğu:

```ts
export { EXPORT_COLUMNS } from './precalcSheet';
export { buildSheetSnapshot } from './snapshot';
export { precalcFileName } from './fileName';
export { quoteEquipmentNumbers, type StockRow } from './listSheets';
export { DETAILED_SHEET } from './detailedSheet';
```

- [ ] **Step 4: Eski dosyayı sil**

```bash
git rm lib/precalc/export.ts
```

Node, `@/lib/precalc/export` importunu artık `lib/precalc/export/index.ts` olarak çözer; `app/api/precalc/export/route.ts`, `app/api/precalc/export-sheet/route.ts` ve testteki `../export` importu değişmeden çalışır.

- [ ] **Step 5: Aynı testin hâlâ geçtiğini doğrula**

Run: `npm test -- export && npm run type-check`
Expected: aynı 5 test PASS, tip hatası yok. Herhangi biri düşerse bölme sırasında davranış kaymıştır — düzelt, testi değiştirme.

- [ ] **Step 6: Uçtan uca doğrulama**

`npm run dev` → `/precalculation` → bir kaleme adet gir → **Precalculation Oluştur**. İnen dosyayı Excel'de aç: beş sayfa, renkler ve başlık bloğu bölmeden önceki gibi.

- [ ] **Step 7: Commit**

```bash
git add lib/precalc/export lib/precalc/__tests__/export.test.ts
git rm --cached lib/precalc/export.ts 2>/dev/null; git add -A lib/precalc
git commit -m "refactor(precalc): export.ts'i export/ klasorune bol"
```

---

### Task 5: Dosya adı Precalculation No olsun

**Files:**
- Modify: `lib/precalc/export/fileName.ts`
- Modify: `lib/precalc/__tests__/export.test.ts` (dosya adı testi genişler)
- Modify: `app/api/precalc/export/route.ts:76`
- Modify: `app/api/precalc/export-sheet/route.ts:68`

**Interfaces:**
- Produces: `precalcFileName(precalcNo?: string): string` — numara verilmişse `"<temizlenmiş no> <YYYY-MM-DD>.xlsx"`, yoksa eski `"PRECALCULATION <tarih> <saat>.xlsx"`.

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/export.test.ts` içindeki dosya adı testini şununla değiştir:

```ts
describe('dosya adı', () => {
  it('numara yoksa eski biçimi korur', () => {
    expect(precalcFileName()).toMatch(/^PRECALCULATION \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.xlsx$/);
  });

  it('numara verilirse dosya adı numarayla başlar', () => {
    expect(precalcFileName('PRE-2026-114 RE-01'))
      .toMatch(/^PRE-2026-114 RE-01 \d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('Windows’ta yasak karakterleri alt çizgiye çevirir', () => {
    const name = precalcFileName('PRE/2026:114*RE?01');
    expect(name).toMatch(/^PRE_2026_114_RE_01 /);
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('boş ya da yalnızca boşluktan oluşan numarayı yok sayar', () => {
    expect(precalcFileName('   ')).toMatch(/^PRECALCULATION /);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- export`
Expected: "numara verilirse…" ve "yasak karakterleri…" FAIL — şu anki imza numarayı önek sanıp `"PRE-2026-114 RE-01 2026-08-31 14-30.xlsx"` üretir ve `/` temizlenmez.

- [ ] **Step 3: Implement**

`lib/precalc/export/fileName.ts`:

```ts
/** Dosya adında kullanılamayan karakterler (Windows). */
const UNSAFE = /[\\/:*?"<>|]/g;

/**
 * Üretilen Excel dosyasının adı.
 *
 * Precalculation numarası verilmişse dosya onunla anılır — kullanıcı
 * indirdiği dosyayı hangi teklife ait olduğunu açmadan görsün. Numara yoksa
 * (henüz doldurulmamış taslak) tarih-saatli eski ad kullanılır, çünkü aynı
 * gün üretilen iki dosya birbirini ezmemeli.
 */
export function precalcFileName(precalcNo?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const clean = (precalcNo ?? '').replace(UNSAFE, '_').trim();
  if (clean) return `${clean} ${day}.xlsx`;

  return `PRECALCULATION ${day} ${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- export`
Expected: PASS

- [ ] **Step 5: Export ucunu bağla**

`app/api/precalc/export/route.ts` — numara istemciden değil, sunucudaki hesaptan okunur:

```ts
import { summarizePrecalc } from '@/lib/precalc/savedSummary';
// …
const filename = precalcFileName(summarizePrecalc(parsed.data.entries).precalcNo);
```

- [ ] **Step 6: Tek sayfa ucunu bağla**

`app/api/precalc/export-sheet/route.ts` — sayfa dosyaları da teklifin numarasıyla anılsın:

```ts
const no = summarizePrecalc(entries).precalcNo;
const safeSheet = sheet.replace(/[\\/?*[\]:]/g, ' ');
const filename = precalcFileName(no ? `${no} — ${safeSheet}` : safeSheet);
```

`summarizePrecalc` importunu dosyanın başına ekle.

- [ ] **Step 7: Elle doğrulama**

`/advanced-precalculation` → Precalculation No alanına `PRE-2026-114 RE-00` yaz → `/precalculation` → **Precalculation Oluştur**. İnen dosyanın adı `PRE-2026-114 RE-00 2026-08-31.xlsx` olmalı. Numarayı silip tekrar dene: `PRECALCULATION …` adına dönmeli.

- [ ] **Step 8: Commit**

```bash
git add lib/precalc/export/fileName.ts lib/precalc/__tests__/export.test.ts app/api/precalc/export/route.ts app/api/precalc/export-sheet/route.ts
git commit -m "feat(precalc): export dosya adi precalculation numarasindan gelsin"
```

---

### Task 6: xlsxPost — üretilen .xlsx'e sayfa düzeni enjekte et

SheetJS `pageSetup` yazmaz. Üretilen dosya `pizzip` ile açılır, ilgili sayfanın XML'ine düğümler eklenir ve yeniden paketlenir.

**Files:**
- Create: `lib/precalc/xlsxPost.ts`
- Create: `lib/precalc/__tests__/xlsxPost.test.ts`

**Interfaces:**
- Produces:
  - `sheetPartName(zip: PizZip, sheetName: string): string | null` — sayfa adından `xl/worksheets/sheetN.xml` yolunu çözer.
  - `applySheetSetup(buffer: Buffer, setups: SheetSetup[]): Buffer`
  - `interface SheetSetup { sheet: string; a4FitToWidth?: boolean }`

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/xlsxPost.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import * as XLSX from 'xlsx-js-style';
import { applySheetSetup, sheetPartName } from '../xlsxPost';

/** İki sayfalı küçük bir kitap: ikincisi düzenlenecek olan. */
function sampleBook(): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[1, 2]]), 'BIRINCI');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['a', 'b', 'c']]), 'AYRINTI');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('xlsx son işlem', () => {
  it('sayfa adından doğru XML parçasını bulur', () => {
    const zip = new PizZip(sampleBook());
    expect(sheetPartName(zip, 'BIRINCI')).toBe('xl/worksheets/sheet1.xml');
    expect(sheetPartName(zip, 'AYRINTI')).toBe('xl/worksheets/sheet2.xml');
    expect(sheetPartName(zip, 'YOK')).toBeNull();
  });

  it('A4 sığdırma düğümlerini ekler', () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'AYRINTI', a4FitToWidth: true }]);
    const xml = new PizZip(out).file('xl/worksheets/sheet2.xml')!.asText();

    expect(xml).toContain('<pageSetUpPr fitToPage="1"/>');
    expect(xml).toContain('paperSize="9"');
    expect(xml).toContain('fitToWidth="1"');
    expect(xml).toContain('fitToHeight="0"');
  });

  it('sheetPr belgenin ilk çocuğu olur — şema sırası bozulmaz', () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'AYRINTI', a4FitToWidth: true }]);
    const xml = new PizZip(out).file('xl/worksheets/sheet2.xml')!.asText();

    const openTag = xml.indexOf('<worksheet ');
    const closeOfOpen = xml.indexOf('>', openTag) + 1;
    expect(xml.slice(closeOfOpen)).toMatch(/^<sheetPr>/);
  });

  it('pageSetup sheetData’dan sonra gelir', () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'AYRINTI', a4FitToWidth: true }]);
    const xml = new PizZip(out).file('xl/worksheets/sheet2.xml')!.asText();
    expect(xml.indexOf('</sheetData>')).toBeLessThan(xml.indexOf('<pageSetup '));
  });

  it('dokunulmayan sayfayı değiştirmez ve dosya geri okunabilir kalır', () => {
    const before = sampleBook();
    const out = applySheetSetup(before, [{ sheet: 'AYRINTI', a4FitToWidth: true }]);

    expect(new PizZip(out).file('xl/worksheets/sheet1.xml')!.asText())
      .toBe(new PizZip(before).file('xl/worksheets/sheet1.xml')!.asText());
    expect(XLSX.read(out, { type: 'buffer' }).SheetNames).toEqual(['BIRINCI', 'AYRINTI']);
  });

  it('bilinmeyen sayfa adı sessizce atlanır', () => {
    const out = applySheetSetup(sampleBook(), [{ sheet: 'YOK', a4FitToWidth: true }]);
    expect(XLSX.read(out, { type: 'buffer' }).SheetNames).toEqual(['BIRINCI', 'AYRINTI']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- xlsxPost`
Expected: FAIL — `Failed to resolve import "../xlsxPost"`

- [ ] **Step 3: Implement**

`lib/precalc/xlsxPost.ts`:

```ts
import PizZip from 'pizzip';

/**
 * Üretilen .xlsx dosyasına SheetJS'in yazamadığı parçaları ekler.
 *
 * SheetJS sayfa düzenini (kâğıt boyu, sığdırma) ve grafikleri yazmaz.
 * Dosya burada açılır, ilgili sayfanın XML'ine düğümler eklenir ve yeniden
 * paketlenir. XML metin olarak işlenir: kaynak SheetJS'in kendi çıktısıdır,
 * biçimi bilinir ve dar kapsamlıdır — tam bir XML ayrıştırıcısı taşımaya
 * değmez.
 *
 * Şema sırası önemlidir: <sheetPr> belgenin ilk çocuğu olmalı, <pageSetup>
 * ise <sheetData>'dan sonra gelmeli. Sıra bozulursa Excel dosyayı
 * "onarılması gerekiyor" diye açar.
 */

export interface SheetSetup {
  /** Kitaptaki sayfa adı. */
  sheet: string;
  /** A4 dikey, genişliği tek sayfaya sığdır. */
  a4FitToWidth?: boolean;
}

/** XML metnindeki öznitelik değerini okur. */
function attr(xml: string, tag: string, name: string): string | null {
  const open = xml.indexOf('<' + tag);
  if (open < 0) return null;
  const end = xml.indexOf('>', open);
  const m = new RegExp(`${name}="([^"]*)"`).exec(xml.slice(open, end));
  return m ? m[1] : null;
}

/**
 * Sayfa adından worksheet XML parçasının yolunu çözer.
 *
 * Sıra workbook.xml'deki <sheet> düğümlerinden, dosya adı da r:id üzerinden
 * workbook.xml.rels'ten gelir — "sheetN.xml, N'inci sayfadır" varsayımı her
 * zaman doğru değil.
 */
export function sheetPartName(zip: PizZip, sheetName: string): string | null {
  const wb = zip.file('xl/workbook.xml')?.asText();
  const rels = zip.file('xl/_rels/workbook.xml.rels')?.asText();
  if (!wb || !rels) return null;

  const escaped = sheetName
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const node = new RegExp(`<sheet[^>]*name="${escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`)
    .exec(wb);
  if (!node) return null;

  const rid = /r:id="([^"]+)"/.exec(node[0])?.[1];
  if (!rid) return null;

  const rel = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*/>`).exec(rels);
  const target = rel && /Target="([^"]+)"/.exec(rel[0])?.[1];
  if (!target) return null;

  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  return zip.file(path) ? path : null;
}

/** <sheetPr> düğümünü belgenin ilk çocuğu olarak ekler ya da tazeler. */
function withSheetPr(xml: string, inner: string): string {
  if (xml.includes('<sheetPr')) {
    // Var olan sheetPr'ı kendi kendine kapanıyorsa aç, içine ekle.
    return xml
      .replace('<sheetPr/>', `<sheetPr>${inner}</sheetPr>`)
      .replace(/<sheetPr>(?!.*?<pageSetUpPr)/, `<sheetPr>${inner}`);
  }
  const close = xml.indexOf('>', xml.indexOf('<worksheet ')) + 1;
  return xml.slice(0, close) + `<sheetPr>${inner}</sheetPr>` + xml.slice(close);
}

/**
 * <pageSetup> düğümünü şema sırasına uygun yere koyar: <pageMargins> varsa
 * hemen ardına, yoksa </sheetData>'dan sonraki ilk uygun noktaya.
 */
function withPageSetup(xml: string, node: string): string {
  if (xml.includes('<pageSetup ')) return xml;

  const margins = xml.indexOf('<pageMargins');
  if (margins >= 0) {
    const end = xml.indexOf('>', margins) + 1;
    return xml.slice(0, end) + node + xml.slice(end);
  }

  // pageMargins yoksa Excel varsayılanını da yazarız; pageSetup tek başına
  // duran bir düğüm olarak kabul edilse de ikisi birlikte daha güvenli.
  const defaults = '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5"'
    + ' header="0.3" footer="0.3"/>';
  const anchor = xml.indexOf('<ignoredErrors');
  const at = anchor >= 0 ? anchor : xml.lastIndexOf('</worksheet>');
  return xml.slice(0, at) + defaults + node + xml.slice(at);
}

/** Verilen sayfalara sayfa düzeni uygular; dosyayı yeniden paketleyip döner. */
export function applySheetSetup(buffer: Buffer, setups: SheetSetup[]): Buffer {
  const zip = new PizZip(buffer);

  for (const setup of setups) {
    const part = sheetPartName(zip, setup.sheet);
    if (!part) continue;                       // sayfa yoksa sessizce geç

    let xml = zip.file(part)!.asText();
    if (setup.a4FitToWidth) {
      xml = withSheetPr(xml, '<pageSetUpPr fitToPage="1"/>');
      xml = withPageSetup(
        xml,
        '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>',
      );
    }
    zip.file(part, xml);
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

/** Testlerde ve hata ayıklamada işe yarar: bir sayfanın öznitelik okuması. */
export const __internal = { attr };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- xlsxPost`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add lib/precalc/xlsxPost.ts lib/precalc/__tests__/xlsxPost.test.ts
git commit -m "feat(precalc): xlsx son islem modulu (A4 sayfa duzeni enjeksiyonu)"
```

---

### Task 7: AYRINTILI FIYATLANDIRMA — parite kuralı ve A4 baskı alanı

**Files:**
- Modify: `lib/precalc/export/detailedSheet.ts`
- Modify: `lib/precalc/export/index.ts` (baskı alanı tanımlı adı + `applySheetSetup` çağrısı)
- Modify: `app/api/precalc/export/route.ts` (buffer artık son işlemden geçer)
- Create: `lib/precalc/__tests__/detailedSheet.test.ts`

**Interfaces:**
- Consumes: `applySheetSetup`, `sheetPartName` (Task 6); `buildSheetSnapshot` (Task 4)
- Produces: `buildDetailedSheet(engine): { sheet: XLSX.WorkSheet; parity: number; lastRow: number; lastCol: 'D' | 'E' } | null`

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/detailedSheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { buildDetailedSheet, DETAILED_SHEET } from '../export/detailedSheet';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

function engineWithParity(parity: number) {
  const engine = new PrecalcEngine(workbook);
  engine.setCell(DETAILED_SHEET, 'I9', parity);
  engine.settle();
  return engine;
}

describe('ayrıntılı fiyatlandırma baskı düzeni', () => {
  it('parite 1 iken DOLAR sütunu (E) gizlenir ve baskı D’de biter', () => {
    const built = buildDetailedSheet(engineWithParity(1))!;
    expect(built.parity).toBe(1);
    expect(built.lastCol).toBe('D');
    // !cols dizisinde E, beşinci sütun (0 tabanlı 4).
    expect(built.sheet['!cols']?.[4]?.hidden).toBe(true);
  });

  it('parite 1’den farklıyken E görünür ve baskı E’de biter', () => {
    const built = buildDetailedSheet(engineWithParity(1.08))!;
    expect(built.lastCol).toBe('E');
    expect(built.sheet['!cols']?.[4]?.hidden).toBeFalsy();
  });

  it('son satır sayfanın gerçek son satırından okunur, sabit değildir', () => {
    const built = buildDetailedSheet(engineWithParity(1))!;
    expect(built.lastRow).toBeGreaterThan(40);
    expect(built.lastRow).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- detailedSheet`
Expected: FAIL — `buildDetailedSheet` dışa aktarılmıyor

- [ ] **Step 3: Implement**

`lib/precalc/export/detailedSheet.ts`:

```ts
import type * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { buildSheetSnapshot } from './snapshot';

/** Kaynak kitaptaki maliyet kırılımı sayfasının adı. */
export const DETAILED_SHEET = 'AYRINTILI FIYATLANDIRMA';

/** Pariteyi taşıyan hücre — D (EURO) sütununu E'ye (DOLAR) çeviren çarpan. */
const PARITY_ADDR = 'I9';

/** E sütununun 0 tabanlı indeksi. */
const DOLLAR_COL = 4;

export interface DetailedSheet {
  sheet: XLSX.WorkSheet;
  parity: number;
  /** Sayfanın dolu son satırı (1 tabanlı). */
  lastRow: number;
  /** Baskı alanının son sütunu. */
  lastCol: 'D' | 'E';
}

/**
 * Ayrıntılı fiyatlandırma sayfası, A4'e sığacak baskı bilgisiyle birlikte.
 *
 * D sütunu EURO, E sütunu `D × PARİTE` ile DOLAR toplamıdır. Parite 1 ise iki
 * sütun aynı sayıyı gösterir; bu durumda E gizlenir ve baskı A–D ile kapanır,
 * böylece tablo A4'e ferah sığar. Parite 1'den farklıysa DOLAR sütunu gerçek
 * bilgi taşır: görünür kalır ve baskı A–E olur.
 */
export function buildDetailedSheet(engine: PrecalcEngine): DetailedSheet | null {
  const sheet = buildSheetSnapshot(engine, DETAILED_SHEET);
  if (!sheet) return null;

  const parity = engine.num(PARITY_ADDR, DETAILED_SHEET);
  const singleCurrency = parity === 1;

  const cols = (sheet['!cols'] ?? []) as XLSX.ColInfo[];
  while (cols.length <= DOLLAR_COL) cols.push({ wch: 12 });
  cols[DOLLAR_COL] = { ...cols[DOLLAR_COL], hidden: singleCurrency };
  sheet['!cols'] = cols;

  // Son satır kaynak sayfadan okunur: sürüm değiştikçe kalem sayısı değişiyor.
  const range = sheet['!ref'] ? (sheet['!ref'] as string).split(':')[1] : '';
  const lastRow = Number(/(\d+)$/.exec(range)?.[1] ?? 0);

  return { sheet, parity, lastRow, lastCol: singleCurrency ? 'D' : 'E' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- detailedSheet`
Expected: PASS (3 test)

- [ ] **Step 5: Baskı alanını kitaba yaz**

`lib/precalc/export/index.ts` içinde detaylı sayfa eklenirken tanımlı adı da yaz:

```ts
const detailed = buildDetailedSheet(engine);
if (detailed) {
  XLSX.utils.book_append_sheet(book, detailed.sheet, DETAILED_SHEET);

  // Baskı alanı tanımlı adla verilir; sayfa adı boşluk içerdiği için tırnaklı.
  const sheetIndex = book.SheetNames.indexOf(DETAILED_SHEET);
  book.Workbook = book.Workbook ?? {};
  book.Workbook.Names = [
    ...(book.Workbook.Names ?? []),
    {
      Name: '_xlnm.Print_Area',
      Sheet: sheetIndex,
      Ref: `'${DETAILED_SHEET}'!$A$1:$${detailed.lastCol}$${detailed.lastRow}`,
    },
  ];
}
```

- [ ] **Step 6: API ucunda son işlemi çalıştır**

`app/api/precalc/export/route.ts` — `XLSX.write` sonrası buffer son işlemden geçer:

```ts
import { applySheetSetup } from '@/lib/precalc/xlsxPost';
import { DETAILED_SHEET } from '@/lib/precalc/export';
// …
const raw: Buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
const buffer = applySheetSetup(raw, [{ sheet: DETAILED_SHEET, a4FitToWidth: true }]);
```

`Content-Length` başlığı da `buffer.length` okuduğu için kendiliğinden düzelir.

- [ ] **Step 7: Testleri çalıştır ve elle doğrula**

Run: `npm test && npm run type-check`
Expected: hepsi PASS

Excel'de doğrulama: teklif oluştur, dosyayı aç → **AYRINTILI FIYATLANDIRMA** sayfası → `Sayfa Düzeni ▸ Yazdırma Alanı` "A1:D51" göstermeli, E sütunu gizli olmalı, `Ctrl+P` önizlemesi tek sayfa A4 vermeli. Sonra ekrandan pariteyi 1,08 yapıp yeniden üret: E görünür ve baskı alanı `A1:E51` olmalı.

- [ ] **Step 8: Commit**

```bash
git add lib/precalc/export/detailedSheet.ts lib/precalc/export/index.ts lib/precalc/__tests__/detailedSheet.test.ts app/api/precalc/export/route.ts
git commit -m "feat(precalc): ayrintili fiyatlandirma A4'e sigsin, parite 1 iken dolar sutunu gizlensin"
```

---

### Task 8: Export'a kitabın bütün sayfalarını ekle, ÖZET'i başa al

**Files:**
- Modify: `lib/precalc/export/index.ts`
- Modify: `lib/precalc/__tests__/export.test.ts` (sayfa listesi testi güncellenir)

**Interfaces:**
- Consumes: `buildSheetSnapshot`, `buildDetailedSheet`, `buildSummarySheet`
- Produces: `EXCLUDED_SHEETS: ReadonlySet<string>` — dosyaya girmeyen sayfalar

- [ ] **Step 1: Testi yeni sıraya göre yaz**

`lib/precalc/__tests__/export.test.ts` içindeki "beklenen sayfaları üretir" testini değiştir:

```ts
it('ÖZET ilk sırada, EQUIPMENT LIST ve limitler dışarıda', () => {
  const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });

  expect(book.SheetNames[0]).toBe('ÖZET');
  expect(book.SheetNames).not.toContain('EQUIPMENT LIST');
  expect(book.SheetNames).not.toContain('Ekipman Listesi Limitleri');
  expect(book.SheetNames).toContain('Sevk Listesi');
});

it('kitabın kalan sayfalarını da taşır', () => {
  const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
  for (const name of ['KABLO', 'SMS PASLANMAZ', 'DIN PASLANMAZ MALZEME',
    'INTEGRATOR PANOSU', 'KONTROL ODASI OLUSTURMA']) {
    expect(book.SheetNames).toContain(name);
  }
});

it('Excel’in 31 karakter sınırını aşan sayfa adı kısaltılır', () => {
  const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
  for (const name of book.SheetNames) expect(name.length).toBeLessThanOrEqual(31);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- export`
Expected: FAIL — `book.SheetNames[0]` şu an `'PRECALCULATION'`, KABLO yok

- [ ] **Step 3: Implement**

`lib/precalc/export/index.ts` — sayfa ekleme bölümünü şununla değiştir:

```ts
/**
 * Dosyaya girmeyen sayfalar.
 *
 * EQUIPMENT LIST üretim tarafının kendi listesi; teklif dosyasında yer
 * kaplıyor ve kimse açmıyordu. "Ekipman Listesi Limitleri" ise bir ayar
 * sayfası — satır aralıklarını tutar, teklife dair bir bilgi taşımaz.
 */
export const EXCLUDED_SHEETS: ReadonlySet<string> = new Set([
  'EQUIPMENT LIST',
  'Ekipman Listesi Limitleri',
]);

/** Excel sayfa adı 31 karakterle sınırlı ve bazı işaretleri kabul etmez. */
const safeSheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
```

Kitap kurulum sırası (mevcut `book_append_sheet` çağrılarının yerine):

```ts
const book = XLSX.utils.book_new();

// 1 — ÖZET en başta: dosyayı açan kişi önce rakamları görsün.
XLSX.utils.book_append_sheet(book, buildSummarySheet(wb, engine, {
  itemCount: kept.filter((r) => r.kind === 'item').length,
}), 'ÖZET');

// 2 — CASHFLOW (Task 10'da eklenecek; şimdilik atlanır)

// 3 — Teklifin kendisi
XLSX.utils.book_append_sheet(book, sheet, 'PRECALCULATION');

// 4 — Maliyet kırılımı, baskı düzeniyle
const detailed = buildDetailedSheet(engine);
if (detailed) { /* Task 7'deki blok */ }

// 5 — Kitabın kalan sayfaları, kaynak dosyadaki sırayla
for (const name of wb.sheetNames) {
  if (name === 'PRECALCULATION' || name === DETAILED_SHEET) continue;
  if (EXCLUDED_SHEETS.has(name)) continue;
  if (name === 'Sevk Listesi') continue;              // aşağıda üretilmiş hâli eklenir
  const snapshot = buildSheetSnapshot(engine, name);
  if (snapshot) XLSX.utils.book_append_sheet(book, snapshot, safeSheetName(name));
}

// 6 — Sevk Listesi: ham sayfa değil, satın alma için üretilen biçimi
XLSX.utils.book_append_sheet(book, buildShippingSheet(lines, stock, listMeta), 'Sevk Listesi');
```

`buildEquipmentSheet` çağrısı ve onu besleyen `limitRange` yardımcısı kaldırılır; **fonksiyonun kendisi `listSheets.ts`'te kalır** (spec: ileride geri istenirse tek satırla döner). Kullanılmadığı için `listSheets.ts`'te `export function buildEquipmentSheet` olarak dışa aktarılır ki lint "kullanılmayan" demesin.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- export`
Expected: PASS

- [ ] **Step 5: Elle doğrulama**

Teklif oluştur, dosyayı Excel'de aç. Beklenen sekme sırası: **ÖZET · PRECALCULATION · AYRINTILI FIYATLANDIRMA · KABLO · SMS PASLANMAZ · DIN PASLANMAZ MALZEME · INTEGRATOR PANOSU · 1734-1794 SERISI ASI FLEX IO · 1734-1794 SERISI DC FLEX IO · KONTROL ODASI OLUSTURMA · Sevk Listesi**. EQUIPMENT LIST ve limitler olmamalı. Dosya boyutunun büyümesi beklenir (~2–4 MB); Excel uyarısız açmalı.

- [ ] **Step 6: Commit**

```bash
git add lib/precalc/export/index.ts lib/precalc/export/listSheets.ts lib/precalc/__tests__/export.test.ts
git commit -m "feat(precalc): export'a tum sayfalar girsin, OZET ilk sirada, EQUIPMENT LIST cikarildi"
```

---

## Faz 3 — Cashflow

### Task 9: cashflow.ts — 52 haftalık nakit akışını motordan oku

Kaynak kitapta (`ORNEK PRECALCULATION 36.07`) tablo `P4883:X4934`'tedir; satırlar `subtotalRow` ofsetiyle bulunur, sabit yazılmaz.

**Files:**
- Create: `lib/precalc/cashflow.ts`
- Create: `lib/precalc/__tests__/cashflow.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface CashflowWeek { week: number; gelir: number; gider: number; net: number }
  interface PaymentStage { row: number; label: string; ratio: number; week: number; amount: number; collectWeek: number }
  interface CashflowData {
    weeks: CashflowWeek[];          // 52 kayıt
    stages: PaymentStage[];         // 8 kayıt
    stageTotal: number;
    totalGelir: number;
    totalGider: number;
    closingNet: number;
    lowest: { week: number; net: number };
  }
  function readCashflow(engine: PrecalcEngine): CashflowData
  ```

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/cashflow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { readCashflow } from '../cashflow';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

/** Adet, fiyat ve ödeme haftası girilmiş; satış fiyatı da verilmiş bir teklif. */
function quoted() {
  const engine = new PrecalcEngine(workbook);
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  engine.setCell('PRECALCULATION', 'F' + item.r, 10);
  engine.setCell('PRECALCULATION', 'I' + item.r, 1000);
  // Ödeme planı tutarları SALES PRICE'a (M4881) bağlıdır.
  engine.setCell('PRECALCULATION', engine.paramAddr('salesPrice')!, 200000);
  engine.settle();
  return engine;
}

describe('cashflow okuması', () => {
  it('52 hafta döner ve haftalar 1’den 52’ye sıralıdır', () => {
    const cf = readCashflow(quoted());
    expect(cf.weeks).toHaveLength(52);
    expect(cf.weeks[0].week).toBe(1);
    expect(cf.weeks[51].week).toBe(52);
  });

  it('NET kümülatiftir — her hafta bir öncekine (gelir − gider) ekler', () => {
    const cf = readCashflow(quoted());
    let running = 0;
    for (const w of cf.weeks) {
      running += w.gelir - w.gider;
      expect(w.net).toBeCloseTo(running, 6);
    }
  });

  it('sekiz ödeme aşaması ve toplamı okunur', () => {
    const cf = readCashflow(quoted());
    expect(cf.stages).toHaveLength(8);
    expect(cf.stages[0].label).toBe('PRE-PAYMENT');
    expect(cf.stageTotal).toBeCloseTo(
      cf.stages.reduce((s, x) => s + x.amount, 0), 6,
    );
  });

  it('ödeme oranları toplamı 1’dir (kitabın kendi planı)', () => {
    const cf = readCashflow(quoted());
    expect(cf.stages.reduce((s, x) => s + x.ratio, 0)).toBeCloseTo(1, 6);
  });

  it('toplamlar ve kapanış neti hafta tablosuyla tutar', () => {
    const cf = readCashflow(quoted());
    expect(cf.totalGelir).toBeCloseTo(cf.weeks.reduce((s, w) => s + w.gelir, 0), 6);
    expect(cf.totalGider).toBeCloseTo(cf.weeks.reduce((s, w) => s + w.gider, 0), 6);
    expect(cf.closingNet).toBeCloseTo(cf.weeks[51].net, 6);
  });

  it('en düşük net, tablodaki gerçek en küçük değerdir', () => {
    const cf = readCashflow(quoted());
    const min = Math.min(...cf.weeks.map((w) => w.net));
    expect(cf.lowest.net).toBeCloseTo(min, 6);
    expect(cf.weeks.find((w) => w.week === cf.lowest.week)!.net).toBeCloseTo(min, 6);
  });

  it('settle() çağrılmamış motorda bile sayısal döner — hata hücresi 0 sayılır', () => {
    // Kitap yinelemeli hesapla kaydedilmiş; sabitlenmeden bazı hücreler
    // #DIV/0! kalır. Okuma bunu 0'a düşürmeli, NaN sızdırmamalı.
    const engine = new PrecalcEngine(workbook);
    const cf = readCashflow(engine);
    for (const w of cf.weeks) {
      expect(Number.isFinite(w.gelir)).toBe(true);
      expect(Number.isFinite(w.gider)).toBe(true);
      expect(Number.isFinite(w.net)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cashflow`
Expected: FAIL — `Failed to resolve import "../cashflow"`

- [ ] **Step 3: Implement**

`lib/precalc/cashflow.ts`:

```ts
import type { PrecalcEngine } from './engine';

/**
 * Projenin haftalık nakit akışı.
 *
 * Kaynak kitapta ödeme planının sağında duran tabloyu (36.07'de P4883:X4934)
 * okur. Hesabı burada yeniden kurmuyoruz — kitabın kendi formülleri
 * çalıştırılıyor, biz yalnızca sonucu topluyoruz:
 *
 *   W (GELİR) = SUMIF(tahsilat haftası; ödeme planı tutarları)
 *   X (GİDER) = SUMIF(ödeme haftası; kalem maliyetleri)
 *   V (NET)   = bir önceki NET + (GELİR − GİDER)      ← kümülatif
 *
 * Böylece ekranda gördüğü rakam ile Excel'den çıkan rakam ayrışmaz.
 *
 * Satır numaraları sürümden sürüme kaydığı için sabit yazılmaz; hepsi
 * `engine.anchors.subtotalRow` üzerinden ofsettir.
 */

/** Tablodaki tek bir hafta. */
export interface CashflowWeek {
  week: number;
  gelir: number;
  gider: number;
  /** Kümülatif net — o haftanın sonundaki kasa durumu. */
  net: number;
}

/** Ödeme planındaki bir aşama. */
export interface PaymentStage {
  /** Excel satır numarası — düzenlenebilir hücrelerin adresi buradan kurulur. */
  row: number;
  label: string;
  /** Toplam satıştan bu aşamaya düşen oran (0–1). */
  ratio: number;
  /** Aşamanın tamamlandığı proje haftası. */
  week: number;
  amount: number;
  /** Tahsilatın kasaya girdiği hafta (kitapta hafta + 2). */
  collectWeek: number;
}

export interface CashflowData {
  weeks: CashflowWeek[];
  stages: PaymentStage[];
  stageTotal: number;
  totalGelir: number;
  totalGider: number;
  /** 52. haftadaki kümülatif net. */
  closingNet: number;
  /** Kasanın en dibe indiği hafta — finansmanın karşılaması gereken tutar. */
  lowest: { week: number; net: number };
}

/** Haftalık tablonun ilk satırı: ara toplamdan 20 satır aşağıda. */
const WEEK_OFFSET = 20;
/** Ödeme planının ilk aşaması: ara toplamdan 21 satır aşağıda. */
const STAGE_OFFSET = 21;

export const WEEK_COUNT = 52;
export const STAGE_COUNT = 8;

/** Hata hücresi (#DIV/0! gibi) ya da boş değer sıfır sayılır. */
const n = (engine: PrecalcEngine, addr: string): number => {
  const v = engine.num(addr);
  return Number.isFinite(v) ? v : 0;
};

export function readCashflow(engine: PrecalcEngine): CashflowData {
  const { subtotalRow } = engine.anchors;
  const firstWeekRow = subtotalRow + WEEK_OFFSET;
  const firstStageRow = subtotalRow + STAGE_OFFSET;

  const weeks: CashflowWeek[] = [];
  for (let i = 0; i < WEEK_COUNT; i++) {
    const r = firstWeekRow + i;
    weeks.push({
      week: i + 1,
      gelir: n(engine, 'W' + r),
      gider: n(engine, 'X' + r),
      net: n(engine, 'V' + r),
    });
  }

  const stages: PaymentStage[] = [];
  for (let i = 0; i < STAGE_COUNT; i++) {
    const r = firstStageRow + i;
    stages.push({
      row: r,
      label: engine.text('A' + r),
      ratio: n(engine, 'B' + r),
      week: n(engine, 'C' + r),
      amount: n(engine, 'D' + r),
      collectWeek: n(engine, 'E' + r),
    });
  }

  let lowest = { week: weeks[0].week, net: weeks[0].net };
  for (const w of weeks) if (w.net < lowest.net) lowest = { week: w.week, net: w.net };

  return {
    weeks,
    stages,
    // Kitabın kendi toplamı (D<ilk aşama + 8>) — aşamalarla aynı olmalı.
    stageTotal: n(engine, 'D' + (firstStageRow + STAGE_COUNT)),
    totalGelir: weeks.reduce((s, w) => s + w.gelir, 0),
    totalGider: weeks.reduce((s, w) => s + w.gider, 0),
    closingNet: weeks[WEEK_COUNT - 1].net,
    lowest,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cashflow`
Expected: PASS (7 test)

"NET kümülatiftir" testi düşerse önce kaynak kitabın `V` sütununu incele: ilk satırın formülü `W−X`, sonrakiler `V(önceki)+(W−X)` olmalı. Testin varsayımı bu; kitap değiştiyse testi kitaba göre düzelt, `readCashflow`'a hesap ekleme.

- [ ] **Step 5: Commit**

```bash
git add lib/precalc/cashflow.ts lib/precalc/__tests__/cashflow.test.ts
git commit -m "feat(precalc): haftalik nakit akisini motordan okuyan cashflow modulu"
```

---

### Task 10: Excel'e CASHFLOW sayfası ekle

**Files:**
- Create: `lib/precalc/export/cashflowSheet.ts`
- Create: `lib/precalc/__tests__/cashflowSheet.test.ts`
- Modify: `lib/precalc/export/index.ts` (2. sıraya CASHFLOW)

**Interfaces:**
- Consumes: `readCashflow` (Task 9), `cellFor`/`styledBlank` (`export/cells.ts`), stiller (`exportStyle.ts`)
- Produces:
  ```ts
  const CASHFLOW_SHEET = 'CASHFLOW';
  /** Grafiğin bağlanacağı hücre aralıkları — Task 11 bunları kullanır. */
  interface CashflowLayout { firstWeekRow: number; lastWeekRow: number; netHeaderRow: number }
  function buildCashflowSheet(engine: PrecalcEngine): { sheet: XLSX.WorkSheet; layout: CashflowLayout }
  ```

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/cashflowSheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { buildCashflowSheet, CASHFLOW_SHEET } from '../export/cashflowSheet';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

function quoted() {
  const engine = new PrecalcEngine(workbook);
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  engine.setCell('PRECALCULATION', 'F' + item.r, 10);
  engine.setCell('PRECALCULATION', 'I' + item.r, 1000);
  engine.setCell('PRECALCULATION', engine.paramAddr('salesPrice')!, 200000);
  engine.settle();
  return engine;
}

describe('CASHFLOW sayfası', () => {
  it('sayfa adı sabittir', () => {
    expect(CASHFLOW_SHEET).toBe('CASHFLOW');
  });

  it('haftalık tablonun başlıkları ve 52 satırı vardır', () => {
    const { sheet, layout } = buildCashflowSheet(quoted());
    const head = layout.netHeaderRow;

    expect(sheet['A' + head]?.v).toBe('HAFTA');
    expect(sheet['B' + head]?.v).toBe('GELİR');
    expect(sheet['C' + head]?.v).toBe('GİDER');
    expect(sheet['D' + head]?.v).toBe('NET');

    expect(layout.lastWeekRow - layout.firstWeekRow + 1).toBe(52);
    expect(sheet['A' + layout.firstWeekRow]?.v).toBe(1);
    expect(sheet['A' + layout.lastWeekRow]?.v).toBe(52);
  });

  it('NET sütunu motordaki kümülatif değerle aynıdır', () => {
    const engine = quoted();
    const { sheet, layout } = buildCashflowSheet(engine);
    const { subtotalRow } = engine.anchors;

    expect(sheet['D' + layout.firstWeekRow]?.v)
      .toBeCloseTo(engine.num('V' + (subtotalRow + 20)), 6);
    expect(sheet['D' + layout.lastWeekRow]?.v)
      .toBeCloseTo(engine.num('V' + (subtotalRow + 71)), 6);
  });

  it('ödeme planı bloğu sekiz aşama ve toplam satırı taşır', () => {
    const { sheet } = buildCashflowSheet(quoted());
    // Ödeme planı üstte: başlık 3. satır, aşamalar 5–12, toplam 13.
    expect(sheet['A4']?.v).toBe('Aşama');
    expect(sheet['A5']?.v).toBe('PRE-PAYMENT');
    expect(sheet['A13']?.v).toBe('TOPLAM');
  });

  it('!ref ve sütun genişlikleri kurulur', () => {
    const { sheet, layout } = buildCashflowSheet(quoted());
    expect(sheet['!ref']).toBe(`A1:E${layout.lastWeekRow}`);
    expect(sheet['!cols']).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cashflowSheet`
Expected: FAIL — `Failed to resolve import "../export/cashflowSheet"`

- [ ] **Step 3: Implement**

`lib/precalc/export/cashflowSheet.ts`:

```ts
import * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { readCashflow } from '../cashflow';
import {
  S_BLOCK_TITLE, S_HEAD, itemStyle, totalStyle, type NumFmtKey,
} from '../exportStyle';
import { cellFor, styledBlank, type Style } from './cells';

export const CASHFLOW_SHEET = 'CASHFLOW';

/** Grafiğin bağlanacağı satırlar — chart XML'i bunlara referans verir. */
export interface CashflowLayout {
  /** Haftalık tablonun başlık satırı (1 tabanlı). */
  netHeaderRow: number;
  firstWeekRow: number;
  lastWeekRow: number;
}

/** Yerleşim sabitleri — testler ve chart aynı sayıları okusun diye burada. */
const PLAN_HEAD_ROW = 4;
const PLAN_FIRST_ROW = 5;
const PLAN_COUNT = 8;

/**
 * CASHFLOW sayfası: üstte ödeme planı, altında 52 haftalık nakit akışı.
 *
 * Değerler kitabın kendi formüllerinden gelir (bkz. lib/precalc/cashflow.ts);
 * burada yalnızca biçimlendirilip yerleştirilir. Grafik bu sayfaya Task 11'de,
 * dosya paketlendikten sonra enjekte edilir — SheetJS grafik yazamıyor.
 */
export function buildCashflowSheet(engine: PrecalcEngine): {
  sheet: XLSX.WorkSheet;
  layout: CashflowLayout;
} {
  const data = readCashflow(engine);
  const sheet: XLSX.WorkSheet = {};

  /** 1 tabanlı satır/sütuna yazar. */
  const put = (row: number, col: number, value: unknown, style?: Style) => {
    const cell = style ? (cellFor(value, style) ?? styledBlank(style)) : cellFor(value);
    if (cell) sheet[XLSX.utils.encode_cell({ r: row - 1, c: col })] = cell;
  };
  /** Bir satırı baştan sona tek stille doldurur — şerit yarım kalmasın. */
  const band = (row: number, values: unknown[], style: Style) => {
    for (let c = 0; c < 5; c++) put(row, c, values[c] ?? '', style);
  };

  band(1, ['CASHFLOW', '', '', '', ''], S_BLOCK_TITLE);
  band(3, ['ÖDEME PLANI', '', '', '', ''], S_BLOCK_TITLE);

  ['Aşama', 'Oran', 'Hafta', 'Tutar', 'Tahsilat Haftası']
    .forEach((h, c) => put(PLAN_HEAD_ROW, c, h, S_HEAD));

  const PLAN_FMT: (NumFmtKey | undefined)[] = [undefined, 'percent', 'int', 'money', 'int'];
  data.stages.forEach((s, i) => {
    const row = PLAN_FIRST_ROW + i;
    [s.label, s.ratio, s.week, s.amount, s.collectWeek].forEach((v, c) => put(row, c, v, itemStyle({
      fmt: PLAN_FMT[c],
      align: c === 0 ? 'left' : 'right',
      computed: c > 0,
      striped: i % 2 === 1,
    })));
  });

  const planTotalRow = PLAN_FIRST_ROW + PLAN_COUNT;   // 13
  ['TOPLAM', '', '', data.stageTotal, ''].forEach((v, c) => put(
    planTotalRow, c, v, totalStyle({ fmt: c === 3 ? 'money' : undefined, grand: true }),
  ));

  const netHeaderRow = planTotalRow + 3;              // 16
  band(netHeaderRow - 1, ['HAFTALIK NAKİT AKIŞI', '', '', '', ''], S_BLOCK_TITLE);
  ['HAFTA', 'GELİR', 'GİDER', 'NET', '']
    .forEach((h, c) => put(netHeaderRow, c, h, S_HEAD));

  const firstWeekRow = netHeaderRow + 1;
  data.weeks.forEach((w, i) => {
    const row = firstWeekRow + i;
    [w.week, w.gelir, w.gider, w.net].forEach((v, c) => put(row, c, v, itemStyle({
      fmt: c === 0 ? 'int' : 'money',
      align: 'right',
      computed: c === 3,
      striped: i % 2 === 1,
    })));
  });

  const lastWeekRow = firstWeekRow + data.weeks.length - 1;

  sheet['!ref'] = `A1:E${lastWeekRow}`;
  sheet['!cols'] = [{ wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  sheet['!freeze'] = { xSplit: 0, ySplit: netHeaderRow };

  return { sheet, layout: { netHeaderRow, firstWeekRow, lastWeekRow } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cashflowSheet`
Expected: PASS (5 test)

- [ ] **Step 5: Kitaba ekle**

`lib/precalc/export/index.ts` — Task 8'deki "2 — CASHFLOW" yorumunun yerine:

```ts
const cashflow = buildCashflowSheet(engine);
XLSX.utils.book_append_sheet(book, cashflow.sheet, CASHFLOW_SHEET);
```

`buildPrecalcWorkbook`'un dönüş değeri değişmez, ancak Task 11 grafiği yerleştirebilmek için yerleşimi bilmek zorunda. Bunun için modül düzeyinde bir dışa aktarım eklenir:

```ts
/** Son üretilen kitabın CASHFLOW yerleşimi — grafik enjeksiyonu bunu okur. */
export function cashflowLayoutFor(engine: PrecalcEngine): CashflowLayout {
  return buildCashflowSheet(engine).layout;
}
```

Bu ikinci kez sayfa kurar; 52 satırlık bir tablo için maliyeti ihmal edilebilir ve `buildPrecalcWorkbook`'un imzasını kirletmekten iyidir.

- [ ] **Step 6: export testini güncelle ve çalıştır**

`lib/precalc/__tests__/export.test.ts` içindeki sıra testine CASHFLOW eklenir:

```ts
expect(book.SheetNames[0]).toBe('ÖZET');
expect(book.SheetNames[1]).toBe('CASHFLOW');
```

Run: `npm test && npm run type-check`
Expected: hepsi PASS

- [ ] **Step 7: Commit**

```bash
git add lib/precalc/export/cashflowSheet.ts lib/precalc/__tests__/cashflowSheet.test.ts lib/precalc/export/index.ts lib/precalc/__tests__/export.test.ts
git commit -m "feat(precalc): Excel'e CASHFLOW sayfasi ekle"
```

---

### Task 11: CASHFLOW sayfasına native Excel grafiği enjekte et

SheetJS grafik yazmaz. Chart parçaları paketlenmiş dosyaya `pizzip` ile eklenir. Seriler hücrelere bağlanır, böylece grafik Excel'de canlı kalır.

**Files:**
- Modify: `lib/precalc/xlsxPost.ts` (`injectLineChart` eklenir)
- Modify: `lib/precalc/__tests__/xlsxPost.test.ts`
- Modify: `app/api/precalc/export/route.ts`

**Interfaces:**
- Consumes: `sheetPartName`, `applySheetSetup` (Task 6); `CashflowLayout`, `CASHFLOW_SHEET` (Task 10)
- Produces:
  ```ts
  interface LineChartSpec {
    sheet: string;            // grafiğin konacağı sayfa
    title: string;
    catRef: string;           // "CASHFLOW!$A$17:$A$68"
    series: { nameRef: string; valRef: string; colorRGB: string }[];
    anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number }; // 0 tabanlı
  }
  function injectLineChart(buffer: Buffer, spec: LineChartSpec): Buffer
  ```

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/xlsxPost.test.ts` dosyasına ekle:

```ts
import { injectLineChart } from '../xlsxPost';

function chartSpec() {
  return {
    sheet: 'AYRINTI',
    title: 'HAFTA',
    catRef: 'AYRINTI!$A$2:$A$5',
    series: [{ nameRef: 'AYRINTI!$D$1', valRef: 'AYRINTI!$D$2:$D$5', colorRGB: 'ED7D31' }],
    anchor: { fromCol: 6, fromRow: 2, toCol: 18, toRow: 27 },
  };
}

describe('grafik enjeksiyonu', () => {
  it('chart ve drawing parçalarını ekler', () => {
    const zip = new PizZip(injectLineChart(sampleBook(), chartSpec()));
    expect(zip.file('xl/charts/chart1.xml')).toBeTruthy();
    expect(zip.file('xl/drawings/drawing1.xml')).toBeTruthy();
    expect(zip.file('xl/drawings/_rels/drawing1.xml.rels')).toBeTruthy();
    expect(zip.file('xl/worksheets/_rels/sheet2.xml.rels')).toBeTruthy();
  });

  it('seri hücrelere bağlıdır — değerler gömülü değil', () => {
    const xml = new PizZip(injectLineChart(sampleBook(), chartSpec()))
      .file('xl/charts/chart1.xml')!.asText();
    expect(xml).toContain('<c:f>AYRINTI!$D$2:$D$5</c:f>');
    expect(xml).toContain('<c:f>AYRINTI!$A$2:$A$5</c:f>');
    expect(xml).toContain('ED7D31');
  });

  it('sayfaya <drawing> düğümü, kapanış etiketinden hemen önce eklenir', () => {
    const xml = new PizZip(injectLineChart(sampleBook(), chartSpec()))
      .file('xl/worksheets/sheet2.xml')!.asText();
    expect(xml).toMatch(/<drawing r:id="[^"]+"\/><\/worksheet>$/);
  });

  it('içerik tipleri chart ve drawing için Override taşır', () => {
    const types = new PizZip(injectLineChart(sampleBook(), chartSpec()))
      .file('[Content_Types].xml')!.asText();
    expect(types).toContain('/xl/charts/chart1.xml');
    expect(types).toContain('drawingml.chart+xml');
    expect(types).toContain('/xl/drawings/drawing1.xml');
  });

  it('sonuç SheetJS ile geri okunabilir', () => {
    const out = injectLineChart(sampleBook(), chartSpec());
    expect(XLSX.read(out, { type: 'buffer' }).SheetNames).toEqual(['BIRINCI', 'AYRINTI']);
  });

  it('bilinmeyen sayfada dosyayı olduğu gibi döndürür', () => {
    const before = sampleBook();
    const out = injectLineChart(before, { ...chartSpec(), sheet: 'YOK' });
    expect(new PizZip(out).file('xl/charts/chart1.xml')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- xlsxPost`
Expected: FAIL — `injectLineChart is not a function`

- [ ] **Step 3: Implement**

`lib/precalc/xlsxPost.ts` sonuna ekle:

```ts
export interface ChartSeries {
  /** Seri adının okunacağı hücre ("CASHFLOW!$D$16"). */
  nameRef: string;
  valRef: string;
  /** Çizgi rengi, altı haneli RGB (ör. turuncu "ED7D31"). */
  colorRGB: string;
}

export interface LineChartSpec {
  sheet: string;
  title: string;
  /** Kategori (X) ekseninin aralığı. */
  catRef: string;
  series: ChartSeries[];
  /** Grafiğin oturacağı hücre dikdörtgeni (0 tabanlı). */
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
}

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XDR_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

/** İki eksen kimliği; dosyada benzersiz olmaları yeterli. */
const CAT_AX = '811811811';
const VAL_AX = '822822822';

function chartXml(spec: LineChartSpec): string {
  const sers = spec.series.map((s, i) => `<c:ser>`
    + `<c:idx val="${i}"/><c:order val="${i}"/>`
    + `<c:tx><c:strRef><c:f>${s.nameRef}</c:f></c:strRef></c:tx>`
    + `<c:spPr><a:ln w="28575" cap="rnd">`
    + `<a:solidFill><a:srgbClr val="${s.colorRGB}"/></a:solidFill><a:round/></a:ln></c:spPr>`
    + `<c:marker><c:symbol val="none"/></c:marker>`
    + `<c:cat><c:numRef><c:f>${spec.catRef}</c:f></c:numRef></c:cat>`
    + `<c:val><c:numRef><c:f>${s.valRef}</c:f></c:numRef></c:val>`
    + `<c:smooth val="0"/>`
    + `</c:ser>`).join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}">`
    + '<c:chart>'
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>`
    + `<a:t>${spec.title}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + '<c:autoTitleDeleted val="0"/>'
    + '<c:plotArea><c:layout/>'
    + `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}`
    + `<c:marker val="0"/><c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:lineChart>`
    + `<c:catAx><c:axId val="${CAT_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AX}"/></c:catAx>`
    + `<c:valAx><c:axId val="${VAL_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + '<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>'
    + '<c:numFmt formatCode="#,##0" sourceLinked="0"/>'
    + `<c:crossAx val="${CAT_AX}"/></c:valAx>`
    + '</c:plotArea>'
    + '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>'
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>'
    + '</c:chart></c:chartSpace>';
}

function drawingXml(spec: LineChartSpec): string {
  const { fromCol, fromRow, toCol, toRow } = spec.anchor;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}">`
    + '<xdr:twoCellAnchor>'
    + `<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff>`
    + `<xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff>`
    + `<xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + '<xdr:graphicFrame macro="">'
    + '<xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Cashflow"/>'
    + '<xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'
    + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
    + `<a:graphic><a:graphicData uri="${CHART_NS}">`
    + `<c:chart xmlns:c="${CHART_NS}" xmlns:r="${R_NS}" r:id="rId1"/>`
    + '</a:graphicData></a:graphic>'
    + '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';
}

/**
 * CASHFLOW sayfasına Excel'in kendi çizgi grafiğini ekler.
 *
 * Seriler hücre aralıklarına bağlanır — grafik gömülü bir resim değil, canlı
 * bir Excel nesnesidir: kullanıcı rakamı değiştirdiğinde çizgi de değişir,
 * biçimini kendi düzenleyebilir.
 *
 * Grafik parçaları SheetJS'in ürettiği pakette hiç yok; hepsi burada
 * oluşturulup ilişki ve içerik tipi kayıtlarıyla birlikte eklenir.
 */
export function injectLineChart(buffer: Buffer, spec: LineChartSpec): Buffer {
  const zip = new PizZip(buffer);

  const part = sheetPartName(zip, spec.sheet);
  if (!part) return buffer;                    // sayfa yoksa dosyaya dokunma

  zip.file('xl/charts/chart1.xml', chartXml(spec));
  zip.file('xl/drawings/drawing1.xml', drawingXml(spec));
  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="${R_NS}/chart" Target="../charts/chart1.xml"/>`
    + '</Relationships>',
  );

  // Sayfa → çizim ilişkisi. SheetJS bu sayfa için rels dosyası üretmediği
  // için ilk ilişki rId1 olur.
  const relPart = part.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels';
  zip.file(
    relPart,
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="${R_NS}/drawing" Target="../drawings/drawing1.xml"/>`
    + '</Relationships>',
  );

  // <drawing> şema sırasında en sonda durur.
  const sheetXml = zip.file(part)!.asText();
  zip.file(part, sheetXml.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>'));

  // İçerik tipleri
  const typesPath = '[Content_Types].xml';
  const types = zip.file(typesPath)!.asText();
  zip.file(typesPath, types.replace(
    '</Types>',
    '<Override PartName="/xl/charts/chart1.xml"'
    + ' ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>'
    + '<Override PartName="/xl/drawings/drawing1.xml"'
    + ' ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
    + '</Types>',
  ));

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- xlsxPost`
Expected: PASS (12 test)

- [ ] **Step 5: API ucunda grafiği bağla**

`app/api/precalc/export/route.ts` — son işlem zinciri:

```ts
import { applySheetSetup, injectLineChart } from '@/lib/precalc/xlsxPost';
import { CASHFLOW_SHEET, cashflowLayoutFor, DETAILED_SHEET } from '@/lib/precalc/export';
import { PrecalcEngine } from '@/lib/precalc/engine';
// …
const engine = new PrecalcEngine(workbook);
engine.setEntries(parsed.data.entries);
engine.settle();
const layout = cashflowLayoutFor(engine);

const raw: Buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
const withSetup = applySheetSetup(raw, [{ sheet: DETAILED_SHEET, a4FitToWidth: true }]);
const buffer = injectLineChart(withSetup, {
  sheet: CASHFLOW_SHEET,
  title: 'HAFTA',
  catRef: `${CASHFLOW_SHEET}!$A$${layout.firstWeekRow}:$A$${layout.lastWeekRow}`,
  series: [{
    nameRef: `${CASHFLOW_SHEET}!$D$${layout.netHeaderRow}`,
    valRef: `${CASHFLOW_SHEET}!$D$${layout.firstWeekRow}:$D$${layout.lastWeekRow}`,
    // Kaynak Excel'deki turuncu çizgiyle aynı renk.
    colorRGB: 'ED7D31',
  }],
  anchor: { fromCol: 6, fromRow: layout.netHeaderRow - 1, toCol: 20, toRow: layout.netHeaderRow + 24 },
});
```

`cashflowLayoutFor` içeride motoru yeniden kurmaz — parametre olarak alır (Task 10, Step 5).

- [ ] **Step 6: Excel'de doğrula (bu görevin asıl kabul testi)**

Teklif oluştur, dosyayı **Excel'de** aç:

1. Uyarı çıkmamalı ("onarılması gerekiyor" mesajı = XML sırası bozuk, Step 3'e dön).
2. **CASHFLOW** sayfasında G sütununun sağında turuncu çizgi grafiği görünmeli.
3. Grafiğe tıkla → `Grafik Tasarımı ▸ Veri Seç`: seri `=CASHFLOW!$D$17:$D$68` olmalı.
4. `D20` hücresine elle farklı bir sayı yaz: çizgi anında değişmeli (canlı bağ).
5. LibreOffice Calc ile de aç (varsa) — grafik orada da çizilmeli.

- [ ] **Step 7: Commit**

```bash
git add lib/precalc/xlsxPost.ts lib/precalc/__tests__/xlsxPost.test.ts app/api/precalc/export/route.ts
git commit -m "feat(precalc): CASHFLOW sayfasina native Excel cizgi grafigi ekle"
```

---

### Task 12: Cashflow sekmesi (UI)

**Files:**
- Create: `components/precalc/CashflowPanel.tsx`
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx` (yeni sekme sabiti, düğme, gövde)

**Interfaces:**
- Consumes: `readCashflow`, `CashflowData` (Task 9); `EditableCell`; `recharts`
- Produces: `CashflowPanel` bileşeni — `{ engine, settledVersion, calculating, currency, onSetCell }`

- [ ] **Step 1: Bileşeni yaz**

`components/precalc/CashflowPanel.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import type { RawValue } from '@/lib/precalc/types';
import { readCashflow } from '@/lib/precalc/cashflow';
import { cn, formatNumberTR } from '@/lib/utils';
import { EditableCell } from './EditableCell';

interface Props {
  engine: PrecalcEngine;
  /** Gecikmeli sürüm — ağır hesap durunca tazelenir. */
  settledVersion: number;
  calculating: boolean;
  currency: string;
  onSetCell: (addr: string, value: RawValue) => void;
}

/** Kaynak Excel'deki grafiğin turuncusu. */
const NET_COLOR = '#ED7D31';
const GELIR_COLOR = '#2E7D32';
const GIDER_COLOR = '#C62828';

/**
 * Projenin haftalık nakit akışı.
 *
 * Değerler kitabın kendi formüllerinden okunur (lib/precalc/cashflow.ts);
 * Excel'e giden CASHFLOW sayfası da aynı fonksiyonu kullanır, bu yüzden
 * ekrandaki çizgi ile dosyadaki çizgi hiçbir zaman ayrışmaz.
 */
export default function CashflowPanel({
  engine, settledVersion, calculating, currency, onSetCell,
}: Props) {
  const [showGelir, setShowGelir] = useState(false);
  const [showGider, setShowGider] = useState(false);

  // settledVersion kasıtlı bağımlılıktır: motor sonuçları mutasyonla değişir.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => readCashflow(engine), [engine, settledVersion]);

  const money = (n: number) => (n === 0 ? '—' : formatNumberTR(n, { decimals: 2 }));
  const short = (n: number) => formatNumberTR(Math.round(n), { decimals: 0 });

  return (
    <div className={cn('space-y-3 transition-opacity', calculating && 'opacity-60')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`Toplam Gelir (${currency})`} value={money(data.totalGelir)} tone="emerald" />
        <Stat label={`Toplam Gider (${currency})`} value={money(data.totalGider)} tone="rose" />
        <Stat
          label={`En Düşük Net (${currency})`}
          value={`${money(data.lowest.net)} · ${data.lowest.week}. hafta`}
          tone={data.lowest.net < 0 ? 'rose' : 'slate'}
        />
        <Stat label={`Kapanış Net (${currency})`} value={money(data.closingNet)} tone="slate" />
      </div>

      {/* Ödeme planı — oran ve hafta düzenlenebilir, tutar formülden gelir */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-semibold text-slate-700">Ödeme Planı</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-slate-500 border-b border-slate-100">
              <th className="text-left font-medium px-4 py-1.5">Aşama</th>
              <th className="text-right font-medium px-2 py-1.5 w-28">Oran</th>
              <th className="text-right font-medium px-2 py-1.5 w-24">Hafta</th>
              <th className="text-right font-medium px-4 py-1.5 w-36">Tutar</th>
              <th className="text-right font-medium px-4 py-1.5 w-32">Tahsilat Haftası</th>
            </tr>
          </thead>
          <tbody>
            {data.stages.map((s) => (
              <tr key={s.row} className="border-b border-slate-50">
                <td className="px-4 py-1.5 text-slate-600">{s.label}</td>
                <td className="px-2 py-1">
                  <EditableCell
                    value={engine.value('B' + s.row)}
                    format="factor"
                    align="right"
                    edited={engine.isUserEntry('B' + s.row)}
                    onCommit={(v) => onSetCell('B' + s.row, v)}
                  />
                </td>
                <td className="px-2 py-1">
                  {engine.hasFormula('C' + s.row) ? (
                    <div className="px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 font-mono text-[11px] text-right text-violet-700">
                      {s.week || '–'}
                    </div>
                  ) : (
                    <EditableCell
                      value={engine.value('C' + s.row)}
                      format="int"
                      align="right"
                      edited={engine.isUserEntry('C' + s.row)}
                      onCommit={(v) => onSetCell('C' + s.row, v)}
                    />
                  )}
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-slate-600">{money(s.amount)}</td>
                <td className="px-4 py-1.5 text-right font-mono text-slate-400">{s.collectWeek || '–'}</td>
              </tr>
            ))}
            <tr className="bg-slate-100">
              <td className="px-4 py-2 font-bold text-slate-800" colSpan={3}>TOPLAM</td>
              <td className="px-4 py-2 text-right font-mono font-bold text-slate-800">
                {money(data.stageTotal)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Grafik */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-700">Haftalık Nakit Akışı</h3>
          <div className="flex items-center gap-3 text-[11px]">
            <Toggle on={showGelir} onClick={() => setShowGelir((v) => !v)} color={GELIR_COLOR}>Gelir</Toggle>
            <Toggle on={showGider} onClick={() => setShowGider((v) => !v)} color={GIDER_COLOR}>Gider</Toggle>
          </div>
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeks} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={3} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={short} width={70} />
              <Tooltip
                formatter={(v: number) => `${money(v)} ${currency}`}
                labelFormatter={(w) => `${w}. hafta`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="linear" dataKey="net" name="NET" stroke={NET_COLOR} strokeWidth={2} dot={false} />
              {showGelir && (
                <Line type="linear" dataKey="gelir" name="GELİR" stroke={GELIR_COLOR} strokeWidth={1.5} dot={false} />
              )}
              {showGider && (
                <Line type="linear" dataKey="gider" name="GİDER" stroke={GIDER_COLOR} strokeWidth={1.5} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 52 haftalık tablo */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-semibold text-slate-700">Hafta Hafta</h3>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 360 }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-slate-100 bg-white sticky top-0">
                <th className="text-right font-medium px-4 py-1.5 w-20">Hafta</th>
                <th className="text-right font-medium px-4 py-1.5">Gelir</th>
                <th className="text-right font-medium px-4 py-1.5">Gider</th>
                <th className="text-right font-medium px-4 py-1.5">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((w) => (
                <tr key={w.week} className="border-b border-slate-50">
                  <td className="px-4 py-1 text-right font-mono text-slate-400">{w.week}</td>
                  <td className="px-4 py-1 text-right font-mono text-emerald-700">{money(w.gelir)}</td>
                  <td className="px-4 py-1 text-right font-mono text-rose-700">{money(w.gider)}</td>
                  <td className={cn(
                    'px-4 py-1 text-right font-mono font-semibold',
                    w.net < 0 ? 'text-rose-700' : 'text-slate-800',
                  )}>
                    {money(w.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, color, children }: {
  on: boolean; onClick: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors',
        on ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-400',
      )}
    >
      <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: on ? color : '#CBD5E1' }} />
      {children}
    </button>
  );
}

function Stat({ label, value, tone = 'slate' }: {
  label: string; value: string; tone?: 'slate' | 'emerald' | 'rose';
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] text-slate-500 mb-1 leading-tight">{label}</p>
      <p className={cn(
        'text-lg font-semibold font-mono',
        tone === 'emerald' ? 'text-emerald-700' : tone === 'rose' ? 'text-rose-700' : 'text-slate-900',
      )}>
        {value}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Sekmeyi client'a ekle**

`AdvancedPrecalculationClient.tsx`:

1. Import: `import CashflowPanel from '@/components/precalc/CashflowPanel';`
2. `OTHERS_TAB` sabitinin altına:

```ts
/**
 * Nakit akışı sekmesi. Kitapta ödeme planının sağında duran haftalık tablo
 * kendi ekranını hak ediyor: hem 52 satır, hem de asıl okunan şey grafiği.
 */
const CASHFLOW_TAB = '__cashflow__';
```

3. Sekme şeridinde `TOTALS_TAB` düğmesinin **hemen ardına**:

```tsx
<SheetButton
  name={CASHFLOW_TAB}
  label="Cashflow"
  active={activeSheet === CASHFLOW_TAB}
  onClick={() => setActiveSheet(CASHFLOW_TAB)}
/>
```

4. Gövdede `activeSheet === TOTALS_TAB` dalının ardına yeni dal:

```tsx
) : engine && activeSheet === CASHFLOW_TAB ? (
  <CashflowPanel
    engine={engine}
    settledVersion={settledVersion}
    calculating={calculating}
    currency={meta.currency}
    onSetCell={setMainCell}
  />
```

- [ ] **Step 3: Tip denetimi**

Run: `npm run type-check && npm test`
Expected: hata yok, testler PASS

- [ ] **Step 4: Elle doğrulama**

`/advanced-precalculation`:

1. **Cashflow** sekmesi "Genel Giderler & Toplam"ın sağında görünmeli.
2. Boş teklifte tablo 52 satır, hepsi "—" olmalı; grafik düz çizgi.
3. **Genel Giderler & Toplam** sekmesinde `Satış Fiyatı`na 200000 yaz; bir kaleme adet ve liste fiyatı gir. Cashflow'a dön: gelir basamakları ve NET eğrisi görünmeli.
4. Ödeme planında `PRE-PAYMENT` oranını 0,2 → 0,4 yap: grafiğin ilk sıçraması büyümeli.
5. Gelir / Gider düğmeleri çizgileri açıp kapatmalı.
6. Kalem satırında `ÖDEME HAFTASI` (V) hücresi değişince gider haftası kaymalı (bu sütun Task 14'te tabloya gelecek; şimdilik `/precalculation` ekranından denenebilir).

- [ ] **Step 5: Commit**

```bash
git add components/precalc/CashflowPanel.tsx "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx"
git commit -m "feat(precalc): Cashflow sekmesi - odeme plani, haftalik tablo ve NET grafigi"
```

---

## Faz 4 — Katlanır sütun grupları

### Task 13: columnGroups.ts — P–AC ve AD–BO gruplarını kitaptan türet

**Files:**
- Create: `components/precalc/columnGroups.ts`
- Create: `components/precalc/__tests__/columnGroups.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface GroupColumn { col: string; label: string; width: number; format: CellFormat; align?: 'right' }
  interface ColumnGroup { id: 'logistics' | 'technical'; label: string; range: string; from: string; to: string; columns: GroupColumn[] }
  function buildColumnGroups(columns: Record<string, string>): ColumnGroup[]
  function colIndex(col: string): number      // "A" → 1, "AC" → 29
  function formatFor(col: string, header: string): CellFormat
  ```

- [ ] **Step 1: Write the failing test**

`components/precalc/__tests__/columnGroups.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildColumnGroups, colIndex, formatFor } from '../columnGroups';
import workbookData from '@/lib/precalc/workbook.json';
import type { PrecalcWorkbook } from '@/lib/precalc/types';

const workbook = workbookData as unknown as PrecalcWorkbook;
const groups = buildColumnGroups(workbook.columns);

describe('sütun harfi → indeks', () => {
  it('tek ve çift harfli sütunları çevirir', () => {
    expect(colIndex('A')).toBe(1);
    expect(colIndex('Z')).toBe(26);
    expect(colIndex('AA')).toBe(27);
    expect(colIndex('AC')).toBe(29);
    expect(colIndex('BO')).toBe(67);
  });
});

describe('sütun grupları', () => {
  it('iki grup üretir', () => {
    expect(groups.map((g) => g.id)).toEqual(['logistics', 'technical']);
  });

  it('lojistik grubu P–AC, teknik grup AD–BO aralığındadır', () => {
    const [logistics, technical] = groups;
    for (const c of logistics.columns) {
      expect(colIndex(c.col)).toBeGreaterThanOrEqual(colIndex('P'));
      expect(colIndex(c.col)).toBeLessThanOrEqual(colIndex('AC'));
    }
    for (const c of technical.columns) {
      expect(colIndex(c.col)).toBeGreaterThanOrEqual(colIndex('AD'));
      expect(colIndex(c.col)).toBeLessThanOrEqual(colIndex('BO'));
    }
  });

  it('kitapta başlığı olan her sütunu tam olarak bir gruba koyar', () => {
    const placed = groups.flatMap((g) => g.columns.map((c) => c.col));
    expect(new Set(placed).size).toBe(placed.length);

    const expected = Object.keys(workbook.columns).filter((c) => {
      const i = colIndex(c);
      return i >= colIndex('P') && i <= colIndex('BO');
    });
    expect(placed.sort()).toEqual(expected.sort());
  });

  it('sütunları kitaptaki sırayla (soldan sağa) verir', () => {
    for (const g of groups) {
      const idx = g.columns.map((c) => colIndex(c.col));
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
  });

  it('etiketler kitabın başlıklarından gelir', () => {
    const byCol = new Map(groups.flatMap((g) => g.columns).map((c) => [c.col, c.label]));
    expect(byCol.get('P')).toBe('YEDEK PARÇA NO');
    expect(byCol.get('AE')).toBe('MOTOR kW');
  });

  it('başlıktan biçim çıkarır: tarih, para, sayı, metin', () => {
    expect(formatFor('X', 'SİPARİŞ TARİHİ')).toBe('date');
    expect(formatFor('R', 'YEDEK PARÇA FİYAT')).toBe('money');
    expect(formatFor('U', 'TEDARİK SÜRESİ')).toBe('int');
    expect(formatFor('AE', 'MOTOR kW')).toBe('number');
    expect(formatFor('W', 'HEMİTEK OC NO')).toBe('text');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- columnGroups`
Expected: FAIL — `Failed to resolve import "../columnGroups"`

- [ ] **Step 3: Implement**

`components/precalc/columnGroups.ts`:

```ts
import type { CellFormat } from './columns';

/**
 * Katalog tablosunun katlanır sütun grupları.
 *
 * Kitapta P'den sonrası iki ayrı dünyadır: P–AC sipariş ve sevkiyat takibi,
 * AD–BO ise kalemin teknik veri sayfası. Günlük fiyatlandırmada ikisi de
 * gerekmediği için tabloya kapalı gelir, ihtiyaç duyulunca açılır.
 *
 * Sütunlar elle listelenmez — çalışma kitabının kendi başlık haritasından
 * (workbook.columns) türetilir. Yeni fiyat listesi bir sütun eklerse tabloya
 * kendiliğinden gelir; kodda güncellenecek ikinci bir liste kalmaz.
 */

export interface GroupColumn {
  /** Excel sütun harfi. */
  col: string;
  label: string;
  width: number;
  format: CellFormat;
  align?: 'right';
}

export interface ColumnGroup {
  id: 'logistics' | 'technical';
  label: string;
  /** Başlıkta gösterilen aralık ("P–AC"). */
  range: string;
  from: string;
  to: string;
  columns: GroupColumn[];
}

/** "A" → 1, "AC" → 29. */
export function colIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n;
}

/**
 * Sütunun biçimi başlığından çıkarılır: kitapta biçim bilgisi taşıyan bir
 * üstveri yok, ama başlıklar tutarlı bir sözlük kullanıyor.
 */
export function formatFor(col: string, header: string): CellFormat {
  const h = header.toUpperCase();
  if (h.includes('TARİH')) return 'date';
  if (h.includes('FİYAT') || h.includes('FIYAT') || h.includes('MALİYET')) return 'money';
  if (h.includes('SÜRE') || h.includes('HAFTA') || h.includes('NUMBER')) return 'int';
  // Ölçü birimi içeren teknik başlıklar sayısaldır (kW, bar, mm, lt/h …).
  if (/\b(KW|BAR|MM|RPM|LT\/H|KG\/H|KCAL\/H|CP|NL\/H|OC|HOUR\/YEAR)\b/.test(h)) return 'number';
  return 'text';
}

/** Başlık uzunluğuna göre makul bir kolon genişliği (px). */
function widthFor(header: string, format: CellFormat): number {
  if (format === 'date') return 120;
  if (format === 'money') return 125;
  if (format === 'int' || format === 'number') return 100;
  return Math.min(Math.max(header.length * 7 + 24, 110), 260);
}

const RANGES: { id: ColumnGroup['id']; label: string; from: string; to: string }[] = [
  { id: 'logistics', label: 'Sipariş & Sevkiyat', from: 'P', to: 'AC' },
  { id: 'technical', label: 'Teknik Veriler', from: 'AD', to: 'BO' },
];

export function buildColumnGroups(columns: Record<string, string>): ColumnGroup[] {
  return RANGES.map((r) => {
    const lo = colIndex(r.from);
    const hi = colIndex(r.to);

    const cols = Object.entries(columns)
      .filter(([col]) => {
        const i = colIndex(col);
        return i >= lo && i <= hi;
      })
      .sort((a, b) => colIndex(a[0]) - colIndex(b[0]))
      .map(([col, header]): GroupColumn => {
        const format = formatFor(col, header);
        return {
          col,
          label: header,
          format,
          width: widthFor(header, format),
          align: format === 'text' ? undefined : 'right',
        };
      });

    return { ...r, range: `${r.from}–${r.to}`, columns: cols };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- columnGroups`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add components/precalc/columnGroups.ts components/precalc/__tests__/columnGroups.test.ts
git commit -m "feat(precalc): P-AC ve AD-BO sutun gruplarini kitaptan tureten modul"
```

---

### Task 14: Grupları tabloya bağla ve Excel'de de katlanır yap

**Files:**
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx`
- Modify: `lib/precalc/export/precalcSheet.ts` (`EXPORT_COLUMNS` + `outlineLevel`)
- Modify: `lib/precalc/__tests__/export.test.ts`

**Interfaces:**
- Consumes: `buildColumnGroups`, `ColumnGroup` (Task 13); `SheetCell`, `TextSheetCell`, `Column` (client içi)

- [ ] **Step 1: Mevcut dağınık sütunları kaldır**

`AdvancedPrecalculationClient.tsx` içindeki `COLUMNS` dizisinden şu altı girdiyi sil (hepsi artık gruplara giriyor): `sparePartNo`, `sparePartDesc`, `sparePartPrice`, `inletDiameter`, `outletDiameter`, `connections`.

`COLUMN_VIEWS` içindeki `tech` setinden de aynı anahtarları çıkar:

```ts
{
  id: 'tech',
  label: 'Teknik',
  cols: ['placeOfUse', 'machineType', 'supplier', 'standard'],
},
```

- [ ] **Step 2: Grup sütunlarını Column'a çevir**

Sütun haritası (`workbook.columns`) modül yüklenirken değil, `usePrecalc` çalışma kitabını getirdiğinde elde olur. Bu yüzden gruplar **modül düzeyinde değil, bileşen içinde** memo'lanır — `AdvancedPrecalculationClient` gövdesinde, `optionalCols` memo'sunun hemen üstüne:

```ts
const groups = useMemo(
  () => (workbook ? buildColumnGroups(workbook.columns) : []),
  [workbook],
);

const groupColumns = useMemo(() => {
  const out: Record<string, Column[]> = {};
  for (const g of groups) {
    out[g.id] = g.columns.map((c): Column => ({
      key: `g:${c.col}`,
      label: c.label,
      width: c.width,
      align: c.align,
      custom: true,
      hint: `Çalışma kitabının ${c.col} sütunu.`,
      render: (_it, ctx) => (c.format === 'text'
        ? <TextSheetCell ctx={ctx} col={c.col} />
        : <SheetCell ctx={ctx} col={c.col} format={c.format} />),
    }));
  }
  return out;
}, [groups]);
```

`TextSheetCell` yalnızca kaynakta boş olan hücreleri açar (`ctx.isOpenText`), `SheetCell` ise formüllü hücreyi mor/salt okunur yapar — yani "formülsüz olanlar düzenlenebilir" kuralı ek koda gerek kalmadan sağlanır.

- [ ] **Step 3: Açık grupların durumunu tut ve sütunlara ekle**

```ts
/** Açık olan sütun gruplarının kimlikleri. */
const [openGroups, setOpenGroups] = useState<string[]>([]);

const GROUP_STATE_KEY = 'atlas.pricing.groups.v1';

useEffect(() => {
  try {
    const raw = window.localStorage.getItem(GROUP_STATE_KEY);
    if (raw) setOpenGroups(JSON.parse(raw) as string[]);
  } catch { /* bozuk kayıt varsayılana döner */ }
}, []);

function toggleGroup(id: string) {
  setOpenGroups((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    try { window.localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next)); } catch { /* kota */ }
    return next;
  });
}
```

`cols` memo'su grupları sona ekler:

```ts
const cols = useMemo(() => [
  ...LEAD,
  ...optionalCols,
  ...openGroups.flatMap((id) => groupColumns[id] ?? []),
], [optionalCols, openGroups, groupColumns]);
```

- [ ] **Step 4: Katlama düğmelerini şerite koy**

Sütun seti düğmelerinin (`COLUMN_VIEWS`) bulunduğu satıra, "Teklife girilenler" düğmesinin yanına:

```tsx
{groups.map((g) => (
  <button
    key={g.id}
    onClick={() => toggleGroup(g.id)}
    title={`Kitabın ${g.range} sütunları — ${g.columns.length} sütun`}
    className={cn(
      BTN,
      openGroups.includes(g.id)
        ? 'bg-slate-800 text-white'
        : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50',
    )}
  >
    <span className="mr-1.5 font-mono">{openGroups.includes(g.id) ? '−' : '+'}</span>
    {g.label}
    <span className={cn('ml-1.5 font-mono', openGroups.includes(g.id) ? 'text-white/70' : 'text-slate-400')}>
      {g.range}
    </span>
  </button>
))}
```

- [ ] **Step 5: Excel'de de katlanır yap**

`lib/precalc/export/precalcSheet.ts` — `EXPORT_COLUMNS`'a grup bilgisi ekle. Mevcut girdilerden `P`–`AB` arası olanlara `group: 1` işareti konur ve `AD`–`BO` arası sütunlar listeye eklenir:

```ts
export const EXPORT_COLUMNS: {
  col: string;
  header: string;
  width: number;
  fmt?: NumFmtKey;
  input?: boolean;
  computed?: boolean;
  /** Excel'de katlanır grup seviyesi — dosyada +/− ile açılır. */
  group?: 1;
}[] = [
  // … A–N aynı kalır (group verilmez) …
  { col: 'P', header: 'YEDEK PARÇA NO', width: 16, group: 1 },
  // … P–AB arası mevcut girdilere group: 1 eklenir …
];
```

Sayfanın `!cols` kurulumu grubu yazar:

```ts
sheet['!cols'] = EXPORT_COLUMNS.map((c) => (
  c.group ? { wch: c.width, level: c.group, hidden: true } : { wch: c.width }
));
```

`level` ve `hidden` birlikte verildiğinde Excel grubu **kapalı** açar; kullanıcı `+` ile açar. (Task 6'nın testinde `outlineLevel` özniteliğinin yazıldığı doğrulanmıştı.)

- [ ] **Step 6: Excel testini genişlet**

`lib/precalc/__tests__/export.test.ts` içine:

```ts
it('sipariş/sevkiyat sütunları Excel’de katlanır grup olarak yazılır', () => {
  const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
  const cols = book.Sheets['PRECALCULATION']['!cols'] as { level?: number; hidden?: boolean }[];

  // A–N grupsuz, P ve sonrası grup 1.
  expect(cols[0].level).toBeUndefined();
  const grouped = cols.filter((c) => c.level === 1);
  expect(grouped.length).toBeGreaterThan(5);
  expect(grouped.every((c) => c.hidden)).toBe(true);
});
```

- [ ] **Step 7: Testler ve tip denetimi**

Run: `npm test && npm run type-check`
Expected: PASS

- [ ] **Step 8: Elle doğrulama**

`/advanced-precalculation` → **Kalemler**:

1. Filtre şeridinde `+ Sipariş & Sevkiyat P–AC` ve `+ Teknik Veriler AD–BO` düğmeleri görünmeli.
2. Birine tıkla: sütunlar tablonun sağına eklenmeli, yatay kaydırmayla gezilebilmeli.
3. `HEMİTEK OC NO` gibi formülsüz bir hücreye yaz — kabul etmeli, sarı olmalı.
4. `TAHMİNİ YÜKLEME TARİHİ` mor ve salt okunur olmalı (formüllü).
5. `ÖDEME HAFTASI` (V) hücresini değiştir → **Cashflow** sekmesinde gider haftası kaymalı.
6. Sayfayı yenile: açık gruplar açık kalmalı.
7. Eskiden ayrı duran "Yedek Parça No" sütunu artık **yalnızca** grupta görünmeli, "Teknik" setinde değil.
8. Excel çıktısında P sütununun solunda `+` düğmesi olmalı; tıklayınca P–AB açılmalı.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx" lib/precalc/export/precalcSheet.ts lib/precalc/__tests__/export.test.ts
git commit -m "feat(precalc): P-AC ve AD-BO sutun gruplari - tabloda ve Excel'de katlanir"
```

---

## Faz 5 — Revizyon zinciri

### Task 15: precalcNo.ts — revizyon kodunu ayrıştır

**Files:**
- Create: `lib/precalc/precalcNo.ts`
- Create: `lib/precalc/__tests__/precalcNo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface RevisionCode { base: string; code: string; seq: number; full: string }
  function parseRevisionCode(precalcNo: string): RevisionCode | null
  function nextRevisionNo(precalcNo: string): string
  ```

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/precalcNo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextRevisionNo, parseRevisionCode } from '../precalcNo';

describe('revizyon kodu ayrıştırma', () => {
  it('sondaki RE-00 kodunu ayırır', () => {
    expect(parseRevisionCode('PRE-2026-114 RE-00')).toEqual({
      base: 'PRE-2026-114', code: 'RE', seq: 0, full: 'RE-00',
    });
  });

  it('RS gibi başka iki harfli kodları da tanır', () => {
    expect(parseRevisionCode('2026-114 RS-12')?.code).toBe('RS');
    expect(parseRevisionCode('2026-114 RS-12')?.seq).toBe(12);
  });

  it('kod yoksa null döner', () => {
    expect(parseRevisionCode('PRE-2026-114')).toBeNull();
    expect(parseRevisionCode('')).toBeNull();
    expect(parseRevisionCode('   ')).toBeNull();
  });

  it('kodu yalnızca sonda arar — ortadaki benzer metni yakalamaz', () => {
    expect(parseRevisionCode('RE-01 PROJESI')).toBeNull();
  });

  it('araya konan boşlukları ve büyük/küçük harfi hoş görür', () => {
    expect(parseRevisionCode('PRE-114  re-03')?.full).toBe('RE-03');
    expect(parseRevisionCode('PRE-114 Re-3')?.seq).toBe(3);
  });
});

describe('sonraki revizyon numarası', () => {
  it('sıra numarasını bir artırır, iki hane korunur', () => {
    expect(nextRevisionNo('PRE-2026-114 RE-00')).toBe('PRE-2026-114 RE-01');
    expect(nextRevisionNo('PRE-2026-114 RE-09')).toBe('PRE-2026-114 RE-10');
  });

  it('kodu olmayan numaraya RE-01 ekler', () => {
    expect(nextRevisionNo('PRE-2026-114')).toBe('PRE-2026-114 RE-01');
  });

  it('iki haneyi aşan sıra numarasını kırpmaz', () => {
    expect(nextRevisionNo('PRE-114 RE-99')).toBe('PRE-114 RE-100');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- precalcNo`
Expected: FAIL — `Failed to resolve import "../precalcNo"`

- [ ] **Step 3: Implement**

`lib/precalc/precalcNo.ts`:

```ts
/**
 * Precalculation numarasındaki revizyon kodu.
 *
 * Numaralar "PRE-2026-114 RE-00" biçimindedir: sondaki iki harfli kod ve
 * sıra numarası, teklifin kaçıncı revizyonu olduğunu söyler. Versiyon
 * denetimi kullanıcının elinde — numarayı kendisi ilerletir, sistem de
 * o an neyin değiştiğini kaydeder.
 *
 * Kod yalnızca metnin SONUNDA aranır: "RE-01 PROJESİ" gibi bir başlık
 * yanlışlıkla revizyon sanılmamalı.
 */

export interface RevisionCode {
  /** Koddan önceki bölüm ("PRE-2026-114"). */
  base: string;
  /** İki harfli kod, büyük harfe çevrilmiş ("RE", "RS"). */
  code: string;
  seq: number;
  /** Normalleştirilmiş kod ("RE-00"). */
  full: string;
}

const CODE_RE = /^(.*?)\s+([A-Za-z]{2})-(\d{1,3})\s*$/;

export function parseRevisionCode(precalcNo: string): RevisionCode | null {
  const m = CODE_RE.exec(precalcNo ?? '');
  if (!m) return null;

  const base = m[1].trim();
  if (!base) return null;

  const code = m[2].toUpperCase();
  const seq = Number(m[3]);
  return { base, code, seq, full: `${code}-${String(seq).padStart(2, '0')}` };
}

/**
 * Bir sonraki revizyonun numarası — kaydetme diyaloğunda hazır önerilir.
 * Kodu olmayan numara ilk revizyonunu alır.
 */
export function nextRevisionNo(precalcNo: string): string {
  const parsed = parseRevisionCode(precalcNo);
  if (!parsed) return `${(precalcNo ?? '').trim()} RE-01`.trim();
  return `${parsed.base} ${parsed.code}-${String(parsed.seq + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- precalcNo`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add lib/precalc/precalcNo.ts lib/precalc/__tests__/precalcNo.test.ts
git commit -m "feat(precalc): precalculation numarasindaki revizyon kodunu ayristir"
```

---

### Task 16: revisionDiff.ts — iki sürüm arasındaki farkı Türkçe metne çevir

**Files:**
- Create: `lib/precalc/revisionDiff.ts`
- Create: `lib/precalc/__tests__/revisionDiff.test.ts`

**Interfaces:**
- Consumes: `catalog.json` (satır → kalem adı), `workbook.json` (`params`, `anchors`)
- Produces:
  ```ts
  type ChangeKind = 'added' | 'removed' | 'qty' | 'price' | 'factor' | 'overhead' | 'param' | 'identity';
  interface RevisionChange { kind: ChangeKind; addr: string; label: string; before: RawValue; after: RawValue; text: string }
  function diffEntries(before: PrecalcEntries, after: PrecalcEntries): RevisionChange[]
  function formatRevision(changes: RevisionChange[], opts: { code: string; author: string; date: Date; limit?: number }): string
  ```

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/revisionDiff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diffEntries, formatRevision } from '../revisionDiff';
import type { PrecalcEntries, PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;
const ITEM = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!.r;
const { subtotalRow } = workbook.meta.anchors;

const K = (addr: string) => 'PRECALCULATION!' + addr;

describe('girdi farkı', () => {
  it('değişiklik yoksa boş liste döner', () => {
    const e: PrecalcEntries = { [K('F' + ITEM)]: 5 };
    expect(diffEntries(e, e)).toEqual([]);
  });

  it('adet 0’dan yukarı çıkınca "eklendi" der', () => {
    const [c] = diffEntries({}, { [K('F' + ITEM)]: 5 });
    expect(c.kind).toBe('added');
    expect(c.text).toMatch(/^5 Adet /);
    expect(c.text).toMatch(/ eklendi$/);
  });

  it('adet sıfırlanınca "çıkarıldı" der', () => {
    const [c] = diffEntries({ [K('F' + ITEM)]: 2 }, { [K('F' + ITEM)]: 0 });
    expect(c.kind).toBe('removed');
    expect(c.text).toMatch(/^2 Adet /);
    expect(c.text).toMatch(/ çıkarıldı$/);
  });

  it('adet değişimini eski → yeni olarak yazar', () => {
    const [c] = diffEntries({ [K('F' + ITEM)]: 3 }, { [K('F' + ITEM)]: 5 });
    expect(c.kind).toBe('qty');
    expect(c.text).toMatch(/adedi 3 → 5 oldu$/);
  });

  it('liste fiyatı değişimini para biçiminde yazar', () => {
    const [c] = diffEntries({ [K('I' + ITEM)]: 1200 }, { [K('I' + ITEM)]: 1350 });
    expect(c.kind).toBe('price');
    expect(c.text).toContain('1.200,00 → 1.350,00');
  });

  it('kâr çarpanı değişimini adıyla yazar', () => {
    const addr = workbook.params.find((p) => p.key === 'profitMultiplier')!.addr;
    const [c] = diffEntries({ [K(addr)]: 0.7 }, { [K(addr)]: 0.85 });
    expect(c.kind).toBe('param');
    expect(c.text).toBe('Kâr Oranı 0,70 → 0,85 olarak güncellendi');
  });

  it('genel gider satırını adıyla tanır', () => {
    const risk = 'F' + (subtotalRow + 8);   // RISK satırı
    const [c] = diffEntries({ [K(risk)]: 1 }, { [K(risk)]: 0 });
    expect(c.kind).toBe('overhead');
    expect(c.text).toContain('Risk');
  });

  it('kimlik alanı değişimini tırnaklı yazar', () => {
    const [c] = diffEntries({ [K('B1')]: 'X A.Ş.' }, { [K('B1')]: 'Y A.Ş.' });
    expect(c.kind).toBe('identity');
    expect(c.text).toBe('Müşteri "X A.Ş." → "Y A.Ş." olarak güncellendi');
  });

  it('değişiklikleri kitaptaki satır sırasına göre verir', () => {
    const a = workbook.outline.filter((r) => r.kind === 'item').slice(0, 3).map((r) => r.r);
    const after = Object.fromEntries(a.map((r) => [K('F' + r), 1]));
    const rows = diffEntries({}, after).map((c) => Number(/(\d+)$/.exec(c.addr)![1]));
    expect([...rows].sort((x, y) => x - y)).toEqual(rows);
  });
});

describe('revizyon metni', () => {
  const change = (text: string) => ({
    kind: 'qty' as const, addr: 'F1', label: 'X', before: 1, after: 2, text,
  });

  it('kod, değişiklikler, yazar ve tarihi noktalı virgülle ayırır', () => {
    const out = formatRevision([change('A eklendi'), change('B güncellendi')], {
      code: 'RE-01',
      author: 'Süleyman Altındal',
      date: new Date(2026, 7, 31),
    });
    expect(out).toBe('RE-01 : A eklendi, B güncellendi. ; Süleyman Altındal ; 31.08.2026');
  });

  it('sınırı aşan değişiklikleri sayıya indirir', () => {
    const many = Array.from({ length: 34 }, (_, i) => change('değişiklik ' + i));
    const out = formatRevision(many, {
      code: 'RE-02', author: 'A', date: new Date(2026, 7, 31), limit: 20,
    });
    expect(out).toContain('…ve 14 değişiklik daha');
    expect(out.split(', ').length).toBe(21);
  });

  it('değişiklik yoksa bunu açıkça söyler', () => {
    const out = formatRevision([], { code: 'RE-03', author: 'A', date: new Date(2026, 7, 31) });
    expect(out).toContain('değişiklik kaydedilmedi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- revisionDiff`
Expected: FAIL — `Failed to resolve import "../revisionDiff"`

- [ ] **Step 3: Implement**

`lib/precalc/revisionDiff.ts`:

```ts
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

/** Genel gider satırları — ara toplama olan uzaklıklarıyla (TotalsPanel ile aynı). */
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

/** "PRECALCULATION!F1234" → { addr: "F1234", col: "F", row: 1234 } */
function split(key: string) {
  const addr = key.includes('!') ? key.slice(key.indexOf('!') + 1) : key;
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  return m ? { addr, col: m[1], row: Number(m[2]) } : { addr, col: '', row: 0 };
}

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- revisionDiff`
Expected: PASS (12 test)

"genel gider satırını adıyla tanır" testi düşerse `OVERHEAD_LABELS` ofsetlerini `components/precalc/TotalsPanel.tsx`'teki `OVERHEAD_ROWS` ile karşılaştır — ikisi aynı sayıları kullanmalı.

- [ ] **Step 5: Commit**

```bash
git add lib/precalc/revisionDiff.ts lib/precalc/__tests__/revisionDiff.test.ts
git commit -m "feat(precalc): iki surum arasindaki farki turkce revizyon metnine ceviren modul"
```

---

### Task 17: Veritabanı — revizyon zinciri alanları

**Files:**
- Modify: `prisma/schema.prisma:394-422`
- Create: `prisma/migrations/<zaman>_add_precalc_revision_chain/migration.sql` (Prisma üretir)

**Interfaces:**
- Produces: `SavedPrecalculation.parentId`, `.revisionCode`, `.revisionNote`, `.revisionChanges`, `.parent`, `.revisions`

- [ ] **Step 1: Şemayı düzenle**

`prisma/schema.prisma` — `SavedPrecalculation` modeline `version` alanının ardına ekle:

```prisma
  /**
   * Bu kaydın türediği revizyon. Zincir buradan okunur: RE-01'in ebeveyni
   * RE-00'dır. Kayıt silinirse çocukları köksüz kalır (SetNull), zincir
   * kopar ama kayıtlar durur.
   */
  parentId        String?
  parent          SavedPrecalculation?  @relation("PrecalcRevision", fields: [parentId], references: [id], onDelete: SetNull)
  revisions       SavedPrecalculation[] @relation("PrecalcRevision")
  /** precalcNo'dan ayrıştırılan revizyon kodu ("RE-01"); yoksa boş. */
  revisionCode    String   @default("")
  /** Kaydeden kişinin onayladığı revizyon açıklaması (tek satır). */
  revisionNote    String   @default("")
  /** Otomatik üretilen fark listesi — RevisionChange[]. */
  revisionChanges Json?
```

Model sonundaki index bloğuna ekle:

```prisma
  @@index([createdAt])
  @@index([parentId])
```

- [ ] **Step 2: Migration üret**

```bash
npm run db:migrate -- --name add_precalc_revision_chain
```

Beklenen: `prisma/migrations/…_add_precalc_revision_chain/migration.sql` oluşur, dört sütun `ALTER TABLE` ile eklenir. Var olan satırlar `parentId = NULL`, `revisionCode = ''` alır — hiçbiri bozulmaz.

- [ ] **Step 3: İstemciyi yeniden üret ve doğrula**

```bash
npm run db:generate
npm run type-check
```

Expected: tip hatası yok.

- [ ] **Step 4: Şemanın uygulandığını doğrula**

```bash
npx prisma studio
```

`SavedPrecalculation` tablosunda dört yeni sütun görünmeli. Var olan bir kaydı aç: `revisionCode` boş, `parentId` boş olmalı ve kayıt hâlâ okunabilmeli.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(precalc): SavedPrecalculation'a revizyon zinciri alanlari"
```

---

### Task 18: API — revizyon olarak kaydetme ve zinciri okuma

**Files:**
- Modify: `app/api/precalc/saved/route.ts` (POST: `parentId`, fark, revizyon alanları)
- Modify: `app/api/precalc/saved/[id]/route.ts` (PATCH: aynı numaraya izin verme; GET: zincir)
- Modify: `lib/precalc/savedClient.ts` (istek gövdesi ve sonuç tipleri)

**Interfaces:**
- Consumes: `diffEntries`, `formatRevision` (Task 16); `parseRevisionCode` (Task 15); `summarizePrecalc`
- Produces:
  - `POST /api/precalc/saved` gövdesi: `{ entries, parentId?, revisionNote? }`
  - `GET /api/precalc/saved/[id]` yanıtına `revisions: RevisionRow[]` eklenir (kökten bu kayda kadar zincir, eskiden yeniye)
  - `savePrecalculation(doc, entries, opts?: { parentId?: string; revisionNote?: string })`

- [ ] **Step 1: POST'a revizyon mantığını ekle**

`app/api/precalc/saved/route.ts`:

```ts
import { diffEntries, formatRevision } from '@/lib/precalc/revisionDiff';
import { parseRevisionCode } from '@/lib/precalc/precalcNo';

const saveSchema = z.object({
  entries: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  /** Bu kayıt hangi revizyondan türedi. */
  parentId: z.string().cuid().optional(),
  /** Kullanıcının düzenlediği revizyon açıklaması; boşsa otomatik metin yazılır. */
  revisionNote: z.string().max(4000).optional(),
});
```

Duplicate denetiminden **sonra**, `create` çağrısından **önce**:

```ts
/*
 * Revizyon kaydı: ebeveynin girdileriyle fark alınır ve okunabilir bir
 * cümleye çevrilir. Fark sunucuda hesaplanır — istemcinin gönderdiği
 * açıklamaya güvenmek, kimin neyi değiştirdiğini kaydın kendisinden
 * doğrulanamaz hâle getirirdi.
 */
let revisionChanges: unknown = null;
let revisionNote = parsed.data.revisionNote?.trim() ?? '';
const revisionCode = parseRevisionCode(summary.precalcNo)?.full ?? '';

if (parsed.data.parentId) {
  const parent = await prisma.savedPrecalculation.findUnique({
    where: { id: parsed.data.parentId },
    select: { id: true, entries: true },
  });
  if (!parent) {
    return NextResponse.json(
      { success: false, error: 'Revizyonun türetileceği kayıt bulunamadı.' },
      { status: 400 },
    );
  }

  const changes = diffEntries(
    (parent.entries ?? {}) as PrecalcEntries,
    parsed.data.entries,
  );
  revisionChanges = changes;
  if (!revisionNote) {
    revisionNote = formatRevision(changes, {
      code: revisionCode || summary.precalcNo,
      author: user.name ?? 'bilinmiyor',
      date: new Date(),
    });
  }
}
```

`create` çağrısı yeni alanları taşır:

```ts
const saved = await prisma.savedPrecalculation.create({
  data: {
    ...summary,
    entries: parsed.data.entries,
    createdById: user.id,
    updatedById: user.id,
    parentId: parsed.data.parentId ?? null,
    revisionCode,
    revisionNote,
    revisionChanges: revisionChanges as never,
  },
  select: { id: true, precalcNo: true, version: true, updatedAt: true },
});
```

`PrecalcEntries` tipini içe aktar: `import type { PrecalcEntries } from '@/lib/precalc/types';`

- [ ] **Step 2: PATCH'te aynı numaraya izin verme**

`app/api/precalc/saved/[id]/route.ts` — sürüm denetiminden sonra, `summary.precalcNo !== current.precalcNo` kontrolünün **yerine**:

```ts
/*
 * Üzerine yazma yok: bir kaydı güncellemek numarayı değiştirmeyi gerektirir.
 * Versiyon denetimi kullanıcının elinde — RE-00'ı RE-01 yapan kişi neyin
 * değiştiğini bilerek yapar ve eski sürüm listede durmaya devam eder.
 */
if (summary.precalcNo === current.precalcNo) {
  return NextResponse.json(
    {
      success: false,
      reason: 'same-number',
      error: `"${current.precalcNo}" numarası zaten kayıtlı. Revizyon için `
        + 'Precalculation No\'yu değiştirin (ör. RE-00 → RE-01).',
      existing: { id: current.id, precalcNo: current.precalcNo },
    },
    { status: 409 },
  );
}

const clash = await prisma.savedPrecalculation.findUnique({
  where: { precalcNo: summary.precalcNo },
  select: { id: true, precalcNo: true },
});
if (clash && clash.id !== id) {
  return NextResponse.json(
    {
      success: false,
      reason: 'duplicate',
      error: `"${summary.precalcNo}" numarası başka bir kayıtta kullanılıyor.`,
      existing: clash,
    },
    { status: 409 },
  );
}
```

`updateMany` verisi revizyon kodunu da tazeler:

```ts
data: {
  ...summary,
  entries: parsed.data.entries,
  updatedById: user.id,
  revisionCode: parseRevisionCode(summary.precalcNo)?.full ?? '',
  version: { increment: 1 },
},
```

- [ ] **Step 3: GET'e zinciri ekle**

Aynı dosyadaki `GET` — kaydı okuduktan sonra ebeveyn zincirini yürü:

```ts
/**
 * Revizyon geçmişi: bu kayıttan köke kadar ebeveyn zinciri, eskiden yeniye.
 * Döngüye karşı sayaçla korunur — bozuk veri sunucuyu kilitlemesin.
 */
const chain: unknown[] = [];
let cursor: string | null = row.parentId;
for (let guard = 0; cursor && guard < 50; guard++) {
  const parent = await prisma.savedPrecalculation.findUnique({
    where: { id: cursor },
    select: {
      id: true, precalcNo: true, revisionCode: true, revisionNote: true,
      createdAt: true, parentId: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!parent) break;
  chain.unshift(parent);
  cursor = parent.parentId;
}

return NextResponse.json({
  success: true,
  data: row,
  revisions: [...chain, {
    id: row.id,
    precalcNo: row.precalcNo,
    revisionCode: row.revisionCode,
    revisionNote: row.revisionNote,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  }],
});
```

- [ ] **Step 4: savedClient'ı güncelle**

`lib/precalc/savedClient.ts`:

```ts
export interface RevisionRow {
  id: string;
  precalcNo: string;
  revisionCode: string;
  revisionNote: string;
  createdAt: string;
  createdBy?: { name: string | null } | null;
}

export type SaveResult =
  | { kind: 'ok'; saved: SavedSummary; created: boolean }
  | { kind: 'conflict'; current: SavedSummary; by: string }
  | { kind: 'duplicate'; existing: { id: string; precalcNo: string } }
  /** Numara değişmedi — revizyon için kullanıcının onu ilerletmesi gerekiyor. */
  | { kind: 'same-number'; existing: { id: string; precalcNo: string } }
  | { kind: 'error'; message: string };

export async function savePrecalculation(
  doc: DraftDoc,
  entries: PrecalcEntries,
  opts: { asRevisionOf?: string; revisionNote?: string } = {},
): Promise<SaveResult> {
  // Revizyon her zaman YENİ kayıttır: eski sürüm listede durmalı.
  const creating = !doc.docId || !!opts.asRevisionOf;
  const url = creating ? '/api/precalc/saved' : `/api/precalc/saved/${doc.docId}`;

  const payload = creating
    ? { entries, parentId: opts.asRevisionOf, revisionNote: opts.revisionNote }
    : { entries, expectedVersion: doc.version };
  // … fetch aynı …
}
```

409 gövdesinde `reason === 'same-number'` ise `{ kind: 'same-number', existing }` döndür.

`fetchSaved` yanıtındaki `revisions` da geri verilir:

```ts
export async function fetchSaved(id: string): Promise<{
  doc: DraftDoc;
  entries: PrecalcEntries;
  revisions: RevisionRow[];
} | null> {
  // … mevcut gövde; sona revisions eklenir …
  return {
    doc: { docId: row.id, precalcNo: row.precalcNo, version: row.version },
    entries: row.entries ?? {},
    revisions: (payload?.revisions ?? []) as RevisionRow[],
  };
}
```

- [ ] **Step 5: El testi (bu görevin kabul ölçütü)**

`npm run dev`, ardından sırayla:

1. `/advanced-precalculation` → yeni teklif → Precalculation No `PRE-TEST RE-00` → bir kaleme 3 adet → **Listeye Kaydet**. Beklenen: kayıt oluşur.
2. Aynı ekranda **Kaydı Güncelle** (numara değişmeden). Beklenen: 409 + *"…Precalculation No'yu değiştirin (ör. RE-00 → RE-01)."*
3. Numarayı `PRE-TEST RE-01` yap, adedi 5'e çıkar, kâr çarpanını 0,85 yap → kaydet. Beklenen: **yeni** kayıt oluşur.
4. `/advanced-precalculation-lists`: RE-00 ve RE-01 ayrı satırlar olarak durmalı.
5. `GET /api/precalc/saved/<RE-01 id>` yanıtında `revisions` iki kayıt, `revisionNote` şuna benzemeli:
   `RE-01 : ... adedi 3 → 5 oldu, Kâr Oranı 0,70 → 0,85 olarak güncellendi. ; <ad> ; 31.08.2026`

- [ ] **Step 6: Testler ve tip denetimi**

Run: `npm test && npm run type-check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/precalc/saved lib/precalc/savedClient.ts
git commit -m "feat(precalc): her revizyon yeni kayit - ayni numarayla uzerine yazma engellendi"
```

---

### Task 19: Kaydetme akışı ve revizyon şeridi (UI)

**Files:**
- Create: `components/precalc/RevisionBar.tsx`
- Create: `components/precalc/RevisionDialog.tsx`
- Modify: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx`

**Interfaces:**
- Consumes: `savePrecalculation`, `fetchSaved`, `RevisionRow` (Task 18); `nextRevisionNo` (Task 15)
- Produces: `RevisionBar`, `RevisionDialog` bileşenleri

- [ ] **Step 1: Revizyon şeridini yaz**

`components/precalc/RevisionBar.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RevisionRow } from '@/lib/precalc/savedClient';
import { cn } from '@/lib/utils';

/**
 * Açık kaydın revizyon geçmişi — sekmelerin üstünde katlanır bir şerit.
 *
 * Kapalıyken yalnızca sayıyı gösterir: geçmiş her gün bakılan bir şey değil,
 * ama "bu teklifte ne değişmişti" sorusu geldiğinde elin altında olmalı.
 */
export default function RevisionBar({ revisions, currentId }: {
  revisions: RevisionRow[];
  currentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (revisions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-3 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-[10px] text-slate-400">{open ? '▾' : '▸'}</span>
        <span className="text-xs font-semibold text-slate-700">Revizyonlar</span>
        <span className="text-[11px] font-mono text-slate-400">{revisions.length}</span>
        {!open && (
          <span className="text-[11px] text-slate-400 truncate ml-2">
            son: {revisions[revisions.length - 1].revisionCode || '—'}
          </span>
        )}
      </button>

      {open && (
        <ol className="border-t border-slate-100 divide-y divide-slate-50">
          {[...revisions].reverse().map((r) => (
            <li key={r.id} className={cn('px-3 py-2', r.id === currentId && 'bg-blue-50/50')}>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] font-semibold text-slate-800 shrink-0">
                  {r.revisionCode || r.precalcNo}
                </span>
                {r.id === currentId ? (
                  <span className="text-[10px] text-blue-600 shrink-0">açık</span>
                ) : (
                  <Link
                    href={`/advanced-precalculation?id=${r.id}`}
                    className="text-[10px] text-blue-600 hover:underline shrink-0"
                  >
                    aç
                  </Link>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {r.revisionNote || 'açıklama girilmedi'}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Kaydetme diyaloğunu yaz**

`components/precalc/RevisionDialog.tsx`:

```tsx
'use client';

import { useState } from 'react';

/**
 * Revizyon kaydedilirken açılan onay penceresi.
 *
 * Sistemin ürettiği fark metni hazır gelir; kaydeden kişi düzeltebilir ya da
 * kendi notunu ekleyebilir. Metin, kaydın ÖZET sayfasına da yazılacağı için
 * son sözü insanın söylemesi doğru.
 */
export default function RevisionDialog({ suggestion, precalcNo, onCancel, onConfirm }: {
  suggestion: string;
  precalcNo: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState(suggestion);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Revizyon olarak kaydet</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            <span className="font-mono">{precalcNo}</span> yeni bir kayıt olarak açılacak;
            önceki revizyon listede kalacak.
          </p>
        </div>

        <div className="p-4">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
            Revizyon açıklaması
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Değişiklikler otomatik çıkarıldı. Düzenleyebilir ya da ekleme yapabilirsiniz —
            bu metin Excel'in ÖZET sayfasına da yazılır.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 h-8 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            onClick={() => onConfirm(note.trim())}
            className="px-3 h-8 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Revizyonu Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Client'ın kaydetme akışını değiştir**

`AdvancedPrecalculationClient.tsx`:

```ts
const [revisions, setRevisions] = useState<RevisionRow[]>([]);
const [pendingRevision, setPendingRevision] = useState<{ note: string; no: string } | null>(null);

/** Açık kaydın geçmişini sunucudan tazeler. */
const loadRevisions = useCallback(async (id: string | null) => {
  if (!id) { setRevisions([]); return; }
  const remote = await fetchSaved(id);
  setRevisions(remote?.revisions ?? []);
}, []);

useEffect(() => { void loadRevisions(doc.docId); }, [doc.docId, loadRevisions]);
```

`saveToList` iki dala ayrılır:

```ts
/** Kitaptaki güncel precalculation numarası. */
function currentPrecalcNo(): string {
  const addr = engine?.paramAddr('precalcNo');
  return addr ? engine!.text(addr).trim() : '';
}

async function saveToList() {
  const no = currentPrecalcNo();

  // Kaydedilmemiş taslak: doğrudan yeni kayıt.
  if (!doc.docId) return void runSave({});

  // Açık kayıt: numara değişmediyse sunucuya gitmeye gerek yok.
  if (no === doc.precalcNo) {
    setSaveNotice({
      kind: 'err',
      text: `"${doc.precalcNo}" numarası zaten kayıtlı. Revizyon için Precalculation No'yu `
        + `değiştirin — önerilen: ${nextRevisionNo(doc.precalcNo)}`,
    });
    return;
  }

  // Numara değişti: farkı göster, kullanıcı onaylasın.
  const changes = diffEntries(await parentEntries(doc.docId), getEntries());
  setPendingRevision({
    no,
    note: formatRevision(changes, {
      code: parseRevisionCode(no)?.full ?? no,
      author: currentUserName,
      date: new Date(),
    }),
  });
}

/** Ebeveynin girdileri — fark önizlemesi için. Sunucu farkı yine kendi hesaplar. */
async function parentEntries(id: string): Promise<PrecalcEntries> {
  const remote = await fetchSaved(id);
  return remote?.entries ?? {};
}

/** Asıl kaydetme — hem yeni kayıt hem revizyon buradan geçer. */
async function runSave(opts: { asRevisionOf?: string; revisionNote?: string }) {
  setSaving(true);
  setSaveNotice(null);
  const result = await savePrecalculation(doc, getEntries(), opts);
  setSaving(false);
  setPendingRevision(null);

  if (result.kind === 'ok') {
    const next: DraftDoc = {
      docId: result.saved.id,
      precalcNo: result.saved.precalcNo,
      version: result.saved.version,
    };
    bindSaved(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/advanced-precalculation?id=${result.saved.id}`);
    }
    void loadRevisions(next.docId);
    setSaveNotice({
      kind: 'ok',
      text: opts.asRevisionOf
        ? `${next.precalcNo} yeni revizyon olarak kaydedildi.`
        : `${next.precalcNo} listeye kaydedildi.`,
    });
    return;
  }

  if (result.kind === 'same-number') {
    setSaveNotice({
      kind: 'err',
      text: `"${result.existing.precalcNo}" numarası zaten kayıtlı. Revizyon için `
        + `Precalculation No'yu değiştirin — önerilen: ${nextRevisionNo(result.existing.precalcNo)}`,
    });
    return;
  }

  // conflict / duplicate / error dalları mevcut hâliyle kalır.
}
```

`currentUserName`, sayfa bileşeninden prop olarak gelir: `app/(dashboard)/advanced-precalculation/page.tsx` zaten oturumu okuyorsa oradan geçir; okumuyorsa `requireAuth()` ile kullanıcı adını al ve `userName` prop'u olarak ver. (Bu isim yalnızca **önizleme** metnindedir; kaydedilen metni sunucu kendi yazar.)

- [ ] **Step 4: Düğme etiketi, şerit ve diyaloğu yerleştir**

Kaydet düğmesi:

```tsx
{saving ? 'Kaydediliyor…' : doc.docId ? 'Yeni Revizyon Kaydet' : 'Listeye Kaydet'}
```

`title` metni:

```tsx
title={doc.docId
  ? 'Precalculation No değiştirilmişse yeni bir revizyon kaydı açar; eski sürüm listede kalır.'
  : 'Yeni bir kayıt açar (precalculation numarası zorunludur).'}
```

`QuoteIdentityBar`'ın **hemen ardına**:

```tsx
<RevisionBar revisions={revisions} currentId={doc.docId} />
```

Bileşenin en sonuna:

```tsx
{pendingRevision && (
  <RevisionDialog
    suggestion={pendingRevision.note}
    precalcNo={pendingRevision.no}
    onCancel={() => setPendingRevision(null)}
    onConfirm={(note) => void runSave({ asRevisionOf: doc.docId!, revisionNote: note })}
  />
)}
```

- [ ] **Step 5: Tip denetimi ve testler**

Run: `npm run type-check && npm test`
Expected: PASS

- [ ] **Step 6: Elle doğrulama**

Task 18'deki senaryoyu ekrandan tekrarla:

1. RE-00 kaydet → düğme "Yeni Revizyon Kaydet" olmalı.
2. Değişiklik yapmadan bas: kırmızı şerit, önerilen numara `… RE-01` görünmeli, istek gitmemeli.
3. Numarayı RE-01 yap, adet ve kâr çarpanını değiştir, bas: diyalog açılmalı ve metin gerçekten değişenleri anlatmalı.
4. Metni düzenleyip kaydet: yeşil şerit, adres çubuğunda yeni id.
5. **Revizyonlar (2)** şeridi açılınca iki satır görünmeli; RE-00'ın "aç" bağlantısı eski kaydı açmalı.
6. Sayfayı yenile: şerit yine dolu gelmeli.

- [ ] **Step 7: Commit**

```bash
git add components/precalc/RevisionBar.tsx components/precalc/RevisionDialog.tsx "app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx" "app/(dashboard)/advanced-precalculation/page.tsx"
git commit -m "feat(precalc): revizyon kaydetme akisi ve katlanir revizyon seridi"
```

---

### Task 20: ÖZET sayfasına revizyon geçmişi bloğu

**Files:**
- Modify: `lib/precalc/export/summarySheet.ts`
- Modify: `lib/precalc/export/index.ts` (`ExportOptions.revisions`)
- Modify: `app/api/precalc/export/route.ts` (`docId` alır, zinciri okur)
- Modify: `app/(dashboard)/advanced-precalculation-lists/AdvancedPrecalculationListsClient.tsx` (`docId` gönderir)
- Modify: `app/(dashboard)/precalculation/PrecalculationClient.tsx` (`docId` gönderir)
- Modify: `lib/precalc/__tests__/export.test.ts`

**Interfaces:**
- Consumes: `RevisionRow` (Task 18)
- Produces: `ExportOptions.revisions?: { code: string; note: string; author: string; date: string }[]`

- [ ] **Step 1: Write the failing test**

`lib/precalc/__tests__/export.test.ts` içine:

```ts
it('ÖZET sayfasına revizyon geçmişi yazar', () => {
  const book = buildPrecalcWorkbook(workbook, quoteEntries(), {
    onlyEntered: true,
    revisions: [
      { code: 'RE-00', note: 'İlk sürüm.', author: 'A', date: '30.08.2026' },
      { code: 'RE-01', note: '5 Adet vana eklendi.', author: 'B', date: '31.08.2026' },
    ],
  });

  const cells = Object.values(book.Sheets['ÖZET'])
    .filter((c): c is { v: unknown } => !!c && typeof c === 'object' && 'v' in c)
    .map((c) => String(c.v));

  expect(cells).toContain('REVİZYON GEÇMİŞİ');
  expect(cells).toContain('RE-01');
  expect(cells).toContain('5 Adet vana eklendi.');
  // En yeni üstte.
  expect(cells.indexOf('RE-01')).toBeLessThan(cells.indexOf('RE-00'));
});

it('revizyon yoksa ÖZET blok başlığını hiç yazmaz', () => {
  const book = buildPrecalcWorkbook(workbook, quoteEntries(), { onlyEntered: true });
  const cells = Object.values(book.Sheets['ÖZET'])
    .filter((c): c is { v: unknown } => !!c && typeof c === 'object' && 'v' in c)
    .map((c) => String(c.v));
  expect(cells).not.toContain('REVİZYON GEÇMİŞİ');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- export`
Expected: FAIL — `revisions` seçeneği tanınmıyor, `REVİZYON GEÇMİŞİ` yok

- [ ] **Step 3: Implement**

`lib/precalc/export/index.ts` — `ExportOptions`'a ekle:

```ts
  /**
   * Kaydın revizyon geçmişi, eskiden yeniye. Kayıtla ilişkilendirilmemiş
   * (henüz listeye girmemiş) teklifte boştur.
   */
  revisions?: { code: string; note: string; author: string; date: string }[];
```

ve `buildSummarySheet` çağrısına geçir: `buildSummarySheet(wb, engine, { itemCount, revisions: options.revisions })`.

`lib/precalc/export/summarySheet.ts` — imza genişler ve iki stil daha içe aktarılır:

```ts
import { S_BLOCK_TITLE, S_HEAD, itemStyle, totalStyle, type NumFmtKey } from '../exportStyle';

export interface SummaryOptions {
  itemCount: number;
  /** Kaydın revizyon geçmişi, eskiden yeniye. */
  revisions?: { code: string; note: string; author: string; date: string }[];
}

function buildSummarySheet(
  wb: PrecalcWorkbook,
  engine: PrecalcEngine,
  opts: SummaryOptions,
): XLSX.WorkSheet {
```

Gövdede, mevcut satırların ardına:

```ts
/*
 * Revizyon geçmişi. Teklifin hangi sürümünde neyin değiştiği, dosyayı
 * açan kişinin ilk sorduğu şey; ekranda katlanır şeritte duran metnin
 * aynısı buraya da yazılır ki dosya tek başına da anlaşılsın.
 */
const revisions = opts.revisions ?? [];
if (revisions.length > 0) {
  r += 2;
  [0, 1].forEach((c) => put(c, c === 0 ? 'REVİZYON GEÇMİŞİ' : '', S_BLOCK_TITLE));
  r++;

  ['Revizyon', 'Açıklama', 'Hazırlayan', 'Tarih'].forEach((h, c) => put(c, h, S_HEAD));
  r++;

  // En yeni üstte: son ne olduğu ilk göze çarpsın.
  [...revisions].reverse().forEach((rev, i) => {
    [rev.code, rev.note, rev.author, rev.date].forEach((v, c) => put(c, v, itemStyle({
      align: 'left',
      striped: i % 2 === 1,
    })));
    r++;
  });
}
```

`!ref` ve `!cols` genişletilir:

```ts
sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 3 } });
sheet['!cols'] = [{ wch: 34 }, { wch: 90 }, { wch: 24 }, { wch: 14 }];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- export`
Expected: PASS

- [ ] **Step 5: API ucunu bağla**

`app/api/precalc/export/route.ts` — şemaya `docId` ekle ve zinciri oku:

```ts
const exportSchema = z.object({
  entries: z.record(/* … */),
  onlyEntered: z.boolean().default(true),
  /** Verilirse revizyon geçmişi ÖZET sayfasına yazılır. */
  docId: z.string().cuid().optional(),
  header: z.object({ /* … */ }).optional(),
});
```

```ts
/** Kaydın revizyon zinciri — kökten bu kayda kadar. */
let revisions: { code: string; note: string; author: string; date: string }[] = [];
if (parsed.data.docId) {
  const chain = [];
  let cursor: string | null = parsed.data.docId;
  for (let guard = 0; cursor && guard < 50; guard++) {
    const row = await prisma.savedPrecalculation.findUnique({
      where: { id: cursor },
      select: {
        precalcNo: true, revisionCode: true, revisionNote: true, createdAt: true,
        parentId: true, createdBy: { select: { name: true } },
      },
    });
    if (!row) break;
    chain.unshift(row);
    cursor = row.parentId;
  }
  revisions = chain
    .filter((row) => row.revisionCode || row.revisionNote)
    .map((row) => ({
      code: row.revisionCode || row.precalcNo,
      note: row.revisionNote,
      author: row.createdBy?.name ?? '',
      date: row.createdAt.toLocaleDateString('tr-TR'),
    }));
}
```

`buildPrecalcWorkbook` çağrısına `revisions` geçir. `prisma` importunu ekle.

- [ ] **Step 6: İstemcileri güncelle**

`AdvancedPrecalculationListsClient.tsx` — `exportRow`:

```ts
body: JSON.stringify({ entries, onlyEntered: true, docId: row.id }),
```

`PrecalculationClient.tsx` — `handleExport` (kaydın id'si `state.doc.docId`'de):

```ts
body: JSON.stringify({ entries: state.getEntries(), onlyEntered, docId: state.doc.docId ?? undefined }),
```

- [ ] **Step 7: Testler, tip denetimi ve elle doğrulama**

Run: `npm test && npm run type-check`
Expected: PASS

Excel'de: Task 19'daki RE-01 kaydını listeden dışa aktar → **ÖZET** sayfasında "REVİZYON GEÇMİŞİ" bloğu, RE-01 üstte olacak şekilde iki satır göstermeli, açıklama metni ekrandakiyle birebir aynı olmalı.

- [ ] **Step 8: Commit**

```bash
git add lib/precalc/export app/api/precalc/export/route.ts "app/(dashboard)/advanced-precalculation-lists/AdvancedPrecalculationListsClient.tsx" "app/(dashboard)/precalculation/PrecalculationClient.tsx" lib/precalc/__tests__/export.test.ts
git commit -m "feat(precalc): OZET sayfasina revizyon gecmisi blogu"
```

---

## Kapanış Kontrolü

Bütün görevler bittikten sonra:

- [ ] `npm test` — tüm paketler PASS
- [ ] `npm run type-check` — hata yok
- [ ] `npm run lint` — yeni uyarı yok
- [ ] `npm run build:clean` — üretim derlemesi geçiyor (Tailwind sınıfları için temiz derleme şart)
- [ ] Uçtan uca: yeni teklif → kalem gir → kaydet (RE-00) → revizyon (RE-01) → Precalculation Oluştur → inen dosyanın adı numarayla başlıyor, ÖZET ilk sayfa, CASHFLOW'da grafik var, AYRINTILI FIYATLANDIRMA A4'e sığıyor, PRECALCULATION'da P sütununda `+` düğmesi var.
