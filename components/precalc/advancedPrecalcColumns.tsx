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
  {
    key: 'row', label: 'Satır', width: 62, sortKey: 'row', align: 'right', lead: true,
    hint: "PRECALCULATION sayfasındaki Excel satır numarası. Yanında ∅ varsa bu satır Excel'in genel toplamına girmez.",
    render: (it, ctx) => (
      <span className="font-mono text-[10px] text-slate-400">
        {!ctx.inTotal && (
          <span
            className="mr-1 text-amber-500"
            title="Bu satır Excel'in genel toplamına girmiyor — adet girseniz de teklif toplamını değiştirmez."
          >∅</span>
        )}
        {it.row}
      </span>
    ),
  },
  {
    key: 'eqNo', label: 'Ekipman No', width: 130, sortKey: 'eqNo', lead: true, engineCol: 'B',
    render: (it) => <span className="font-mono text-[11px] text-slate-600">{it.eqNo || '—'}</span>,
  },
  {
    key: 'techSpec', label: 'Teknik Açıklama', width: 330, sortKey: 'techSpec', lead: true, custom: true,
    engineCol: 'C',
    hint: 'Ürünün teknik özelliği (Excel C sütunu). Kaynak dosyada boş bırakılmış '
      + 'satırlarda (ör. CENTRIFUGAL PUMP & FAN) buraya kendiniz yazarsınız; ekipman '
      + 'kodu, motor kW ve çarpan bu metinden türetilir.',
    render: (it, ctx) => (
      <TextSheetCell
        ctx={ctx}
        col="C"
        indent={it.tree.length * 9}
        fallback={it.machineType}
        placeholder="özellik girin…"
      />
    ),
  },
  {
    key: 'qty', label: 'Adet', width: 82, sortKey: 'qty', align: 'right', lead: true, custom: true,
    input: true, engineCol: 'F',
    hint: 'Bu kalemden kaç adet kullanılacak. Excel F sütununa yazılır; mor hücrelerde miktar başka satırlardan hesaplanır.',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="F" format="number" />,
  },
  {
    // Adet ile maliyetin arasında: girilen iki değer (adet, liste) yan yana,
    // sonuç hemen sağlarında okunsun.
    key: 'listPrice', label: 'Liste (€)', width: 118, sortKey: 'listPrice', align: 'right',
    lead: true, custom: true, input: true, engineCol: 'I',
    hint: 'Bir adedin liste fiyatı (Excel I sütunu). Fiyatı boş olan kalemlere elle yazabilirsiniz.',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="I" format="money" placeholder="fiyat yok" />,
  },
  {
    // Girilen adedin karşılığı hemen görünsün diye temel blokta durur.
    key: 'totalCost', label: 'Toplam Maliyet (€)', width: 130, sortKey: 'totalCost',
    align: 'right', lead: true, custom: true, engineCol: 'M',
    hint: 'Bu satırın maliyeti = Adet × Liste × Çarpan × Ek Çarpan  (Excel M sütunu)',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="M" format="money" readOnly strong />,
  },
  {
    // Maliyetin hemen sağında: kâr çarpanı değiştikçe ikisi birlikte okunur.
    key: 'salesPrice', label: 'Satış (€)', width: 135, sortKey: 'salesPrice', align: 'right',
    lead: true, custom: true, engineCol: 'N',
    hint: 'Müşteriye satış bedeli = Toplam Maliyet ÷ Kâr çarpanı  (Excel N sütunu)',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="N" format="money" readOnly strong />,
  },
  {
    key: 'placeOfUse', label: 'Kullanım Yeri', width: 190, engineCol: 'A',
    render: (it) => <span className="text-slate-600">{it.placeOfUse}</span>,
  },
  {
    key: 'machineType', label: 'Makine / Ekipman', width: 210, custom: true, engineCol: 'H',
    hint: 'Ekipmanın tipi (Excel H sütunu). Boş satırlarda yazılabilir — ör. "Centrifugal Pump".',
    render: (_it, ctx) => <TextSheetCell ctx={ctx} col="H" placeholder="ekipman tipi" />,
  },
  {
    key: 'label', label: 'Etiket', width: 90, custom: true, engineCol: 'D',
    hint: 'Marka / etiket (Excel D sütunu). Boş satırlarda yazılabilir — "APV" yazılırsa '
      + 'Excel çarpanı kendiliğinden 0,38 olur.',
    render: (_it, ctx) => <TextSheetCell ctx={ctx} col="D" placeholder="marka" />,
  },
  {
    key: 'supplier', label: 'Tedarikçi', width: 150, sortKey: 'supplier', custom: true, engineCol: 'E',
    hint: 'Tedarikçi firma (Excel E sütunu). Boş satırlarda yazılabilir.',
    render: (_it, ctx) => <TextSheetCell ctx={ctx} col="E" placeholder="tedarikçi" />,
  },
  {
    key: 'standard', label: 'Std.', width: 62,
    render: (it) => it.standard ? (
      <span className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-medium',
        it.standard === 'DIN' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
      )}>{it.standard}</span>
    ) : null,
  },
  {
    key: 'topCategory', label: 'Üst Kategori', width: 200,
    render: (it) => <span className="text-slate-500 text-[11px]">{it.topCategory}</span>,
  },
  {
    key: 'subCategory', label: 'Alt Kategori', width: 210,
    render: (it) => <span className="text-slate-500 text-[11px]">{it.subCategory}</span>,
  },
  {
    key: 'productType', label: 'Ürün Tipi', width: 200, sortKey: 'productType',
    render: (it) => <span className="text-slate-500 text-[11px]">{it.productType}</span>,
  },
  {
    key: 'priceFactor', label: 'Çarpan', width: 85, align: 'right', custom: true, engineCol: 'J',
    hint: 'Liste fiyatının ödenen oranı — 0,33 ise listenin %33\'i ödenir (Excel J sütunu).',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="J" format="factor" readOnly />,
  },
  {
    key: 'extraFactor', label: 'Ek Çarpan', width: 95, align: 'right', custom: true, engineCol: 'K',
    hint: 'İkinci çarpan (Excel K sütunu). Genelde 1\'dir.',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="K" format="factor" readOnly />,
  },
  {
    key: 'discount', label: 'İskonto', width: 80, align: 'right', custom: true,
    hint: 'Gerçek iskonto oranı = 1 − Çarpan × Ek Çarpan',
    render: (_it, ctx) => {
      const d = 1 - ctx.num('J') * ctx.num('K');
      return (
        <span className="text-slate-500 text-[11px] block text-right">
          {Math.abs(d) < 0.0001 ? '—' : `%${formatNumberTR(d * 100, { decimals: 0 })}`}
        </span>
      );
    },
  },
  {
    key: 'netPrice', label: 'Birim Net (€)', width: 110, sortKey: 'netPrice', align: 'right', custom: true,
    hint: 'Bir adedin net fiyatı = Liste × Çarpan × Ek Çarpan. Adetten bağımsızdır.',
    render: (_it, ctx) => (
      <span className="font-mono text-emerald-700 block text-right">
        {ctx.unitNet === 0 ? '—' : money(ctx.unitNet)}
      </span>
    ),
  },
  {
    key: 'transportCost', label: 'Nakliye (€)', width: 115, align: 'right', custom: true, engineCol: 'L',
    hint: 'Nakliye payı = Birim net × Nakliye çarpanı × Adet  (Excel L sütunu)',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="L" format="money" readOnly />,
  },
  {
    key: 'sparePartNo', label: 'Yedek Parça No', width: 130, engineCol: 'P',
    render: (it) => <span className="font-mono text-[11px] text-slate-500">{it.sparePartNo}</span>,
  },
  {
    key: 'sparePartDesc', label: 'Yedek Parça Tanım', width: 220, engineCol: 'Q',
    render: (it) => <span className="text-slate-500 text-[11px]">{it.sparePartDesc}</span>,
  },
  {
    key: 'sparePartPrice', label: 'Yedek Parça Fiyat (€)', width: 120, align: 'right', engineCol: 'R',
    render: (it) => <span className="font-mono text-slate-500 text-[11px]">{money(it.sparePartPrice)}</span>,
  },
  {
    key: 'inletDiameter', label: 'Giriş Ø', width: 80, engineCol: 'AY',
    render: (it) => <span className="text-slate-500 text-[11px]">{it.inletDiameter}</span>,
  },
  {
    key: 'outletDiameter', label: 'Çıkış Ø', width: 80, engineCol: 'AZ',
    render: (it) => <span className="text-slate-500 text-[11px]">{it.outletDiameter}</span>,
  },
  {
    key: 'connections', label: 'Bağlantı', width: 80, align: 'right', engineCol: 'BA',
    render: (it) => <span className="font-mono text-slate-500 text-[11px]">{it.connections ?? ''}</span>,
  },
];

export const LEAD = COLUMNS.filter((c) => c.lead);
export const OPTIONAL = COLUMNS.filter((c) => !c.lead);

/**
 * Hazır sütun setleri. Temel sütunlar (Satır → Toplam Maliyet) her sette
 * görünür; buradaki anahtarlar yalnızca onların sağındaki sütunları belirler.
 * Yalnızca görünümdür — gizlenen sütunun hesabı yine de çalışır.
 */
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

/**
 * PRECALCULATION hücresi. Formüllü hücreler Excel'deki gibi mor ve salt
 * okunurdur; kalanlar (miktar, liste fiyatı) doğrudan çalışma kitabına yazar.
 */
/**
 * Tanım sütunları için hücre (C/D/E/H — teknik açıklama, marka, tedarikçi,
 * ekipman tipi).
 *
 * Kaynakta dolu olan hücreler salt okunurdur: katalog verisi kazara
 * değiştirilmemeli. Excel'in boş bıraktığı şablon satırlarında ise
 * (PUMPS altındaki CENTRIFUGAL PUMP & FAN gibi) hücre açılır — mühendis
 * pompanın özelliğini oraya yazar, ekipman kodu/motor kW/çarpan formüllerden
 * kendiliğinden gelir.
 */
export function TextSheetCell({
  ctx, col, indent, fallback, placeholder,
}: {
  ctx: RowCtx;
  col: string;
  /** Ağaç girintisi (yalnızca teknik açıklama sütununda). */
  indent?: number;
  /** Değer boşken gösterilecek yedek metin (ör. makine tipi). */
  fallback?: string;
  placeholder?: string;
}) {
  const value = ctx.value(col);
  const text = value === null || value === undefined ? '' : String(value);
  const open = ctx.isOpenText(col);

  if (!open || !ctx.ready) {
    return (
      <div
        className="truncate text-slate-700"
        style={indent ? { paddingLeft: indent } : undefined}
        title={text || fallback || undefined}
      >
        {text || fallback || '—'}
      </div>
    );
  }

  return (
    <div style={indent ? { paddingLeft: indent } : undefined}>
      <EditableCell
        value={value}
        format="text"
        align="left"
        edited={ctx.isEdited(col)}
        placeholder={placeholder}
        onCommit={(v) => ctx.setCell(col, v)}
      />
    </div>
  );
}

export function SheetCell({
  ctx, col, format, readOnly, strong, placeholder,
}: {
  ctx: RowCtx;
  col: string;
  format: CellFormat;
  readOnly?: boolean;
  strong?: boolean;
  placeholder?: string;
}) {
  const value = ctx.value(col);
  const text = formatCell(value, format);

  if (ctx.isFormula(col)) {
    const formula = ctx.formulaOf(col);
    return (
      <div
        className={cn(
          'px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50',
          'font-mono text-[11px] text-right truncate cursor-default',
          // Boş sonuç "0" yerine tire: sayfa sıfır duvarına dönmesin.
          text ? 'text-violet-700' : 'text-violet-300',
          strong && text && 'font-semibold',
        )}
        title={formula ? `Formülle hesaplanır — düzenlenemez\n=${formula}` : 'Formülle hesaplanır — düzenlenemez'}
      >
        {text || '–'}
      </div>
    );
  }

  if (readOnly || !ctx.ready) {
    return (
      <div
        className={cn(
          'px-1.5 py-0.5 font-mono text-[11px] text-right truncate',
          text ? (strong ? 'text-slate-800 font-semibold' : 'text-slate-500') : 'text-slate-300',
          !ctx.ready && !readOnly && 'text-slate-400',
        )}
        title={!ctx.ready && !readOnly ? 'Hesap motoru yüklenince düzenlenebilir' : undefined}
      >
        {text || (readOnly ? '–' : placeholder ?? '')}
      </div>
    );
  }

  return (
    <EditableCell
      value={value}
      format={format}
      align="right"
      edited={ctx.isEdited(col)}
      placeholder={placeholder}
      onCommit={(v) => ctx.setCell(col, v)}
    />
  );
}
