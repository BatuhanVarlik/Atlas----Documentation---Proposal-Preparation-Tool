'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { CatalogItem, CatalogMeta } from '@/lib/precalc/catalog';
import type { CellValue } from '@/lib/precalc/formula';
import type { RawValue } from '@/lib/precalc/types';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import { cn, formatNumberTR } from '@/lib/utils';
import { usePrecalc } from '@/components/precalc/usePrecalc';
import ContextMenu, { MENU_WIDTH, type ContextMenuEntry } from '@/components/ui/ContextMenu';
import type { DraftDoc } from '@/components/precalc/precalcDraft';
import { fetchSaved, savePrecalculation } from '@/lib/precalc/savedClient';
import { formatCell, formatTrimmed } from '@/components/precalc/cellFormat';
import { FACTOR_DECIMALS, type CellFormat } from '@/components/precalc/columns';
import { EditableCell } from '@/components/precalc/EditableCell';
import SheetGrid from '@/components/precalc/SheetGrid';
import OthersTable from '@/components/precalc/OthersTable';
import TotalsPanel from '@/components/precalc/TotalsPanel';
import { parseSumRanges, weightOf } from '@/lib/precalc/totals';

interface Props {
  items: CatalogItem[];
  meta: CatalogMeta;
  /**
   * URL'deki `?id=` — listeden açılan kayıt. Boşsa tarayıcıda en son açık
   * olan teklifle devam edilir.
   */
  docId: string | null;
}

/** Kaydetmeden sonra gösterilen bilgi şeridi. */
type SaveNotice =
  | { kind: 'ok'; text: string }
  | { kind: 'err'; text: string }
  /** Araya başka biri girdi — sunucudaki sürümü yükleme yolu sunulur. */
  | { kind: 'conflict'; text: string; recordId: string };

type SortKey = 'row' | 'eqNo' | 'techSpec' | 'productType' | 'supplier'
  | 'listPrice' | 'netPrice' | 'qty' | 'totalCost' | 'salesPrice';
type SortDir = 'asc' | 'desc';

/** Sanallaştırma için sabit satır yükseklikleri (px). */
const ITEM_ROW_HEIGHT = 37;
const NODE_ROW_HEIGHT = 33;

/** Görünen pencerenin dışında da çizilen satır sayısı (kaydırma pürüzsüzlüğü). */
const OVERSCAN = 10;

/** Tablo kutusunun yüksekliği — başlık ve yatay çubuk hep ekranda kalsın diye. */
const TABLE_HEIGHT = 'calc(100vh - 17rem)';

/*
 * Araç çubuğu düğmelerinin ortak ölçüsü.
 *
 * Hepsi aynı yükseklikte ve TEK SATIR: sabit yükseklik + whitespace-nowrap
 * olmadan "Yeni Precalculation" gibi iki kelimelik etiketler dar ekranda
 * düğmenin içinde alt satıra kaçıyor, satır yüksekliği büyüyor ve şerit
 * dağılıyordu.
 */
const BTN = 'inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap '
  + 'transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GHOST = BTN + ' bg-white text-slate-600 border border-slate-300 hover:bg-slate-50';
const BTN_PRIMARY = BTN + ' bg-blue-600 text-white hover:bg-blue-700';
const BTN_DARK = BTN + ' bg-slate-800 text-white hover:bg-slate-900';

/** Ağaçtaki bir grup — Excel'in satır gruplamasındaki bir başlık. */
interface TreeNode {
  /** Tam yol ("PROCESS VALVES / MANUEL BUTTERFLY VALVE"). */
  key: string;
  title: string;
  depth: number;
  /** Alt gruplar ve doğrudan kalemler — Excel'deki sırayla. */
  entries: TreeEntry[];
  /** Alt ağaçtaki toplam kalem sayısı. */
  count: number;
  /** Alt ağaçtaki toplam adet ve maliyet (M). */
  qty: number;
  cost: number;
}

type TreeEntry =
  | { t: 'node'; node: TreeNode }
  | { t: 'item'; item: CatalogItem };

/** Ekranda çizilecek satır: grup başlığı ya da kalem. */
type VisibleRow =
  | { t: 'node'; node: TreeNode }
  | { t: 'item'; item: CatalogItem };

/** Katalog tablosunun gösterildiği ana sayfa. */
const MAIN_SHEET = 'PRECALCULATION';

/**
 * Genel gider / toplam bloğu (ara toplamdan genel toplama). Bunlar kalem değil
 * özet satırları olduğu için katalog listesinde yer almaz; kendi sekmesinde
 * gösterilir.
 */
const TOTALS_TAB = '__totals__';

/**
 * OTHERS bölümü (nakliye, sigorta, pano, lisans, mühendislik/montaj).
 *
 * Kitapta bu satırların A–E kimlik sütunları boştur ve değerler H–O arasında
 * durur; katalog ağacının sütun düzeni burada boş bir duvara dönüşüyordu.
 * Bu yüzden kendi tablosunda, kendi sütun sırasıyla gösterilir.
 */
const OTHERS_TAB = '__others__';

/** Sütun genişliği/sırası tercihinin saklandığı anahtar. */
const COLUMN_LAYOUT_KEY = 'atlas.pricing.columns.v1';

/** Bir sütunun küçültülebileceği en dar genişlik (px). */
const MIN_COL_WIDTH = 48;

/**
 * Bir satırın PRECALCULATION hücrelerine erişimi. Hesap motoru yüklendiğinde
 * değerler canlı formül sonuçlarıdır; yüklenene kadar kaynak dosyanın
 * (Excel'in son kaydettiği) değerleri gösterilir.
 */
interface RowCtx {
  /** Hesap motoru hazır mı — hazır değilken hücreler salt okunurdur. */
  ready: boolean;
  /** Excel sütununun değeri (F, I, J, K, L, M, N). */
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
  /**
   * Tanım sütunu (C/D/E/H) kaynakta boş mu — yani kullanıcıya açık mı.
   * Dolu katalog hücreleri kapalıdır; kaynak veri yanlışlıkla ezilmesin.
   */
  isOpenText: (col: string) => boolean;
}

/** Tablo sütunları — PRECALCULATION sayfasındaki tüm detaylar. */
interface Column {
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
  render: (it: CatalogItem, ctx: RowCtx) => React.ReactNode;
}

const money = (v: number | null) => (v === null ? '—' : formatNumberTR(v, { decimals: 2 }));

const COLUMNS: Column[] = [
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
    key: 'eqNo', label: 'Ekipman No', width: 130, sortKey: 'eqNo', lead: true,
    render: (it) => <span className="font-mono text-[11px] text-slate-600">{it.eqNo || '—'}</span>,
  },
  {
    key: 'techSpec', label: 'Teknik Açıklama', width: 330, sortKey: 'techSpec', lead: true, custom: true,
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
    input: true,
    hint: 'Bu kalemden kaç adet kullanılacak. Excel F sütununa yazılır; mor hücrelerde miktar başka satırlardan hesaplanır.',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="F" format="number" />,
  },
  {
    // Adet ile maliyetin arasında: girilen iki değer (adet, liste) yan yana,
    // sonuç hemen sağlarında okunsun.
    key: 'listPrice', label: 'Liste (€)', width: 118, sortKey: 'listPrice', align: 'right',
    lead: true, custom: true, input: true,
    hint: 'Bir adedin liste fiyatı (Excel I sütunu). Fiyatı boş olan kalemlere elle yazabilirsiniz.',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="I" format="money" placeholder="fiyat yok" />,
  },
  {
    // Girilen adedin karşılığı hemen görünsün diye temel blokta durur.
    key: 'totalCost', label: 'Toplam Maliyet (€)', width: 130, sortKey: 'totalCost',
    align: 'right', lead: true, custom: true,
    hint: 'Bu satırın maliyeti = Adet × Liste × Çarpan × Ek Çarpan  (Excel M sütunu)',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="M" format="money" readOnly strong />,
  },
  {
    // Maliyetin hemen sağında: kâr çarpanı değiştikçe ikisi birlikte okunur.
    key: 'salesPrice', label: 'Satış (€)', width: 135, sortKey: 'salesPrice', align: 'right',
    lead: true, custom: true,
    hint: 'Müşteriye satış bedeli = Toplam Maliyet ÷ Kâr çarpanı  (Excel N sütunu)',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="N" format="money" readOnly strong />,
  },
  {
    key: 'placeOfUse', label: 'Kullanım Yeri', width: 190,
    render: (it) => <span className="text-slate-600">{it.placeOfUse}</span>,
  },
  {
    key: 'machineType', label: 'Makine / Ekipman', width: 210, custom: true,
    hint: 'Ekipmanın tipi (Excel H sütunu). Boş satırlarda yazılabilir — ör. "Centrifugal Pump".',
    render: (_it, ctx) => <TextSheetCell ctx={ctx} col="H" placeholder="ekipman tipi" />,
  },
  {
    key: 'label', label: 'Etiket', width: 90, custom: true,
    hint: 'Marka / etiket (Excel D sütunu). Boş satırlarda yazılabilir — "APV" yazılırsa '
      + 'Excel çarpanı kendiliğinden 0,38 olur.',
    render: (_it, ctx) => <TextSheetCell ctx={ctx} col="D" placeholder="marka" />,
  },
  {
    key: 'supplier', label: 'Tedarikçi', width: 150, sortKey: 'supplier', custom: true,
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
    key: 'priceFactor', label: 'Çarpan', width: 85, align: 'right', custom: true,
    hint: 'Liste fiyatının ödenen oranı — 0,33 ise listenin %33\'i ödenir (Excel J sütunu).',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="J" format="factor" readOnly />,
  },
  {
    key: 'extraFactor', label: 'Ek Çarpan', width: 95, align: 'right', custom: true,
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
    key: 'transportCost', label: 'Nakliye (€)', width: 115, align: 'right', custom: true,
    hint: 'Nakliye payı = Birim net × Nakliye çarpanı × Adet  (Excel L sütunu)',
    render: (_it, ctx) => <SheetCell ctx={ctx} col="L" format="money" readOnly />,
  },
  {
    key: 'sparePartNo', label: 'Yedek Parça No', width: 130,
    render: (it) => <span className="font-mono text-[11px] text-slate-500">{it.sparePartNo}</span>,
  },
  {
    key: 'sparePartDesc', label: 'Yedek Parça Tanım', width: 220,
    render: (it) => <span className="text-slate-500 text-[11px]">{it.sparePartDesc}</span>,
  },
  {
    key: 'sparePartPrice', label: 'Yedek Parça Fiyat (€)', width: 120, align: 'right',
    render: (it) => <span className="font-mono text-slate-500 text-[11px]">{money(it.sparePartPrice)}</span>,
  },
  {
    key: 'inletDiameter', label: 'Giriş Ø', width: 80,
    render: (it) => <span className="text-slate-500 text-[11px]">{it.inletDiameter}</span>,
  },
  {
    key: 'outletDiameter', label: 'Çıkış Ø', width: 80,
    render: (it) => <span className="text-slate-500 text-[11px]">{it.outletDiameter}</span>,
  },
  {
    key: 'connections', label: 'Bağlantı', width: 80, align: 'right',
    render: (it) => <span className="font-mono text-slate-500 text-[11px]">{it.connections ?? ''}</span>,
  },
];

const LEAD = COLUMNS.filter((c) => c.lead);
const OPTIONAL = COLUMNS.filter((c) => !c.lead);

/**
 * Hazır sütun setleri. Temel sütunlar (Satır → Toplam Maliyet) her sette
 * görünür; buradaki anahtarlar yalnızca onların sağındaki sütunları belirler.
 * Yalnızca görünümdür — gizlenen sütunun hesabı yine de çalışır.
 */
const COLUMN_VIEWS: { id: string; label: string; cols: string[] | null }[] = [
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

export default function AdvancedPrecalculationClient({ items: allItems, meta, docId }: Props) {
  /*
   * Katalog listesi OTHERS'ı içermez: o blok kendi sekmesinde, kendi sütun
   * düzeniyle gösterilir (bkz. OthersTable). Hesap yine tek kitap üzerinde
   * yürüdüğü için toplamlar ikisini de kapsar.
   */
  const items = useMemo(
    () => allItems.filter((i) => i.row < meta.anchors.othersRow),
    [allItems, meta.anchors.othersRow],
  );

  const [search, setSearch] = useState('');
  const [topCategory, setTopCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [productType, setProductType] = useState('');
  const [standard, setStandard] = useState('');
  const [supplier, setSupplier] = useState('');
  const [group, setGroup] = useState('');
  const [priced, setPriced] = useState<'' | 'yes' | 'no'>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [label, setLabel] = useState('');
  const [activeSheet, setActiveSheet] = useState(MAIN_SHEET);
  /** Açık olan ağaç düğümlerinin tam yolları. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /**
   * Sütun düzeni yalnızca görünümdür — hesaplar Excel sütun harflerine bağlı
   * olduğu için sıralama/genişlik değişikliği hiçbir formülü etkilemez.
   */
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [colOrder, setColOrder] = useState<string[]>([]);
  const [colView, setColView] = useState('quote');
  /** Ayrıntılı filtre paneli açık mı — kapalıyken tabloya daha çok yer kalır. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Yalnızca adet girilmiş kalemleri göster. */
  const [onlyEntered, setOnlyEntered] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('row');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /** "Listeye Kaydet" geri bildirimi. */
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);

  /* ---- tablo kutusu ve sanallaştırma ---- */
  // Tablo sayfayla birlikte değil kendi kutusunda kayar. Böylece başlık
  // (sticky thead) ve yatay kaydırma çubuğu tarayıcının kendi davranışıyla
  // hep ekranda kalır; ayrıca yalnızca görünen satırlar çizilir.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setViewport((prev) => (
        prev.top === el.scrollTop && prev.height === el.clientHeight
          ? prev
          : { top: el.scrollTop, height: el.clientHeight }
      ));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    el.addEventListener('scroll', schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('scroll', schedule);
      ro.disconnect();
    };
  }, [activeSheet]);

  /* ---- sütun düzeni (yalnızca görünüm) ---- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_LAYOUT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        widths?: Record<string, number>; order?: string[]; view?: string;
      };
      if (saved.widths) setColWidths(saved.widths);
      if (saved.order) setColOrder(saved.order);
      if (saved.view && COLUMN_VIEWS.some((v) => v.id === saved.view)) setColView(saved.view);
    } catch {
      // bozuk kayıt varsayılana döner
    }
  }, []);

  function persistLayout(widths: Record<string, number>, order: string[], view = colView) {
    try {
      window.localStorage.setItem(COLUMN_LAYOUT_KEY, JSON.stringify({ widths, order, view }));
    } catch {
      // kota dolmuşsa sessizce geç
    }
  }

  const widthOf = (c: Column) => colWidths[c.key] ?? c.width;

  /** Seçilebilir sütunlar: seçili sete göre süzülür, kullanıcının sırasıyla dizilir. */
  const optionalCols = useMemo(() => {
    const view = COLUMN_VIEWS.find((v) => v.id === colView) ?? COLUMN_VIEWS[COLUMN_VIEWS.length - 1];
    const allowed = view.cols ? new Set(view.cols) : null;
    const base = allowed ? OPTIONAL.filter((c) => allowed.has(c.key)) : OPTIONAL;
    if (colOrder.length === 0) return base;

    const byKey = new Map(base.map((c) => [c.key, c]));
    const out: Column[] = [];
    for (const key of colOrder) {
      const c = byKey.get(key);
      if (c) { out.push(c); byKey.delete(key); }
    }
    // Kayıttan sonra eklenmiş / sete yeni giren sütunlar sona
    for (const c of base) if (byKey.has(c.key)) out.push(c);
    return out;
  }, [colOrder, colView]);

  /**
   * Tabloda o an çizilen sütunlar, soldan sağa. Hiçbiri sabitlenmez; hepsi
   * yatay kaydırmada birlikte kayar.
   */
  const cols = useMemo(() => [...LEAD, ...optionalCols], [optionalCols]);

  /**
   * Dolgu satırlarının colSpan'i. Sondaki "artan alan" sütunu da sayılır.
   */
  const colSpan = cols.length + 1;

  /** Sütun genişliklerinin toplamı — tablo en az bu kadar geniş olmalı. */
  const totalWidth = useMemo(
    () => cols.reduce((sum, c) => sum + (colWidths[c.key] ?? c.width), 0),
    [colWidths, cols],
  );

  function resizeColumn(key: string, width: number) {
    setColWidths((prev) => {
      const next = { ...prev, [key]: Math.max(MIN_COL_WIDTH, Math.round(width)) };
      persistLayout(next, colOrder);
      return next;
    });
  }

  /** Sürüklenen sütunu hedefin önüne taşır (yalnızca seçilebilir sütunlar arasında). */
  function moveColumn(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    const current = optionalCols.map((c) => c.key);
    const from = current.indexOf(fromKey);
    const to = current.indexOf(toKey);
    if (from < 0 || to < 0) return;
    current.splice(to, 0, ...current.splice(from, 1));
    setColOrder(current);
    persistLayout(colWidths, current);
  }

  function selectView(id: string) {
    setColView(id);
    persistLayout(colWidths, colOrder, id);
  }

  function resetLayout() {
    setColWidths({});
    setColOrder([]);
    setColView('quote');
    try { window.localStorage.removeItem(COLUMN_LAYOUT_KEY); } catch { /* yok say */ }
  }

  const layoutChanged = Object.keys(colWidths).length > 0 || colOrder.length > 0 || colView !== 'quote';

  /* ---- PRECALCULATION hesap motoru ---- */
  // Girdiler doğrudan çalışma kitabının hücrelerine yazılır; böylece adet
  // değişince Excel'deki bütün formüller (miktar toplayan mor hücreler,
  // nakliye, toplam maliyet, satış fiyatı) birebir yeniden hesaplanır.
  const {
    engine, workbook, loading: engineLoading, error: engineError,
    version, settledVersion, calculating, entryCount, reset: resetEntries, setCell, getEntries,
    doc, bindSaved, adoptRemote, startNew,
  } = usePrecalc(docId);

  const ready = !!engine && !engineLoading;

  /*
   * Teklifi listeye kaydeder.
   *
   * Sunucuya yalnızca girdiler gider; genel toplam orada yeniden hesaplanır,
   * böylece listedeki rakam Excel çıktısıyla ayrışmaz. Açık bir kayıt varsa
   * O KAYIT güncellenir (numaraya göre değil): kaydın kimliği ve sürümü
   * gönderilir, araya başka biri girdiyse sunucu reddeder ve kullanıcı ne
   * yapacağına karar verir.
   */
  async function saveToList() {
    setSaving(true);
    setSaveNotice(null);
    const result = await savePrecalculation(doc, getEntries());
    setSaving(false);

    if (result.kind === 'ok') {
      const next: DraftDoc = {
        docId: result.saved.id,
        precalcNo: result.saved.precalcNo,
        version: result.saved.version,
      };
      bindSaved(next);
      // Adres çubuğu kaydı göstersin; sayfayı yeniden yüklemeye gerek yok.
      if (result.created && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/advanced-precalculation?id=${result.saved.id}`);
      }
      setSaveNotice({
        kind: 'ok',
        text: result.created
          ? `${next.precalcNo} listeye kaydedildi. Bundan sonra "Listeye Kaydet" bu kaydı günceller.`
          : `${next.precalcNo} güncellendi (sürüm ${next.version}).`,
      });
      return;
    }

    if (result.kind === 'conflict') {
      setSaveNotice({
        kind: 'conflict',
        recordId: result.current.id,
        text: `Bu precalculation siz açtıktan sonra ${result.by} tarafından kaydedildi `
          + `(sunucudaki sürüm ${result.current.version}). Değişiklikleriniz yazılmadı.`,
      });
      return;
    }

    if (result.kind === 'duplicate') {
      setSaveNotice({ kind: 'err', text: result.existing
        ? `"${result.existing.precalcNo}" numarası zaten kayıtlı. Listeden açıp güncelleyin ya da başka bir numara verin.`
        : 'Bu precalculation numarası zaten kayıtlı.' });
      return;
    }

    setSaveNotice({ kind: 'err', text: result.message });
  }

  /** Çakışmada sunucudaki sürümü alır — yereldeki değişiklikler gider. */
  async function loadRemote(id: string) {
    const remote = await fetchSaved(id);
    if (!remote) {
      setSaveNotice({ kind: 'err', text: 'Sunucudaki sürüm okunamadı.' });
      return;
    }
    adoptRemote(remote.doc, remote.entries);
    setSaveNotice({
      kind: 'ok',
      text: `${remote.doc.precalcNo} sunucudaki sürümle (${remote.doc.version}) yenilendi.`,
    });
  }

  /** Kayıtla bağı koparıp boş bir teklife geçer. */
  function beginNew() {
    startNew();
    setSaveNotice(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/advanced-precalculation');
    }
  }

  // Izgara hücreleri memo'lu — geri çağrının kimliği sabit kalmalı.
  const setSheetCell = useCallback(
    (sheet: string, addr: string, value: RawValue) => setCell(addr, value, sheet),
    [setCell],
  );
  const setMainCell = useCallback(
    (addr: string, value: RawValue) => setCell(addr, value),
    [setCell],
  );

  /** Motor yüklenene kadar kaynak dosyanın (Excel'in kaydettiği) değerleri. */
  function bakedValue(it: CatalogItem, col: string): CellValue {
    switch (col) {
      case 'F': return it.qty;
      case 'I': return it.listPrice;
      case 'J': return it.priceFactor;
      case 'K': return it.extraFactor;
      case 'L': return it.transportCost;
      case 'M': return it.totalCost;
      case 'N': return it.salesPrice;
      default: return null;
    }
  }

  function cellValue(it: CatalogItem, col: string): CellValue {
    if (ready && engine) return engine.value(col + it.row);
    return bakedValue(it, col);
  }

  function cellNum(it: CatalogItem, col: string): number {
    const v = cellValue(it, col);
    return typeof v === 'number' ? v : 0;
  }

  /**
   * Birim net fiyat. Her satır F×I×J×K düzeninde değildir — ör. STAINLESS
   * STEEL PRODUCTS satırında M = J×F'tir ve I boştur. Bu yüzden miktar
   * girilmişse birim fiyat Excel'in kendi toplamından (M ÷ F) türetilir;
   * yalnızca miktar yokken I×J×K'ya düşülür.
   */
  function unitNetOf(it: CatalogItem): number {
    const qty = cellNum(it, 'F');
    if (qty > 0) return cellNum(it, 'M') / qty;
    return cellNum(it, 'I') * cellNum(it, 'J') * cellNum(it, 'K');
  }

  /**
   * Kalem ara toplamının satır katsayıları. Maliyet (M) ve satış (N) tarafı
   * ayrı okunur: kitapta maliyet ara toplamı fazladan bir çıkarma içerir, satış
   * içermez. Bu asimetri Excel'in kendi kurgusudur, birebir izlenir.
   */
  const totalWeights = useMemo(() => {
    const sub = engine?.anchors.subtotalRow;
    const cost = parseSumRanges(ready && engine && sub ? engine.formulaOf('M' + sub) : null);
    const sales = parseSumRanges(ready && engine && sub ? engine.formulaOf('N' + sub) : null);
    // Formül okunamadıysa (motor hazır değilken) her satır sayılır.
    return {
      cost: (row: number) => (cost.length === 0 ? 1 : weightOf(cost, row)),
      sales: (row: number) => (sales.length === 0 ? 1 : weightOf(sales, row)),
    };
  }, [engine, ready]);

  function rowCtx(it: CatalogItem): RowCtx {
    return {
      ready,
      value: (col) => cellValue(it, col),
      num: (col) => cellNum(it, col),
      isFormula: (col) => it.fx.includes(col),
      isEdited: (col) => (ready && engine ? engine.isUserEntry(col + it.row) : false),
      formulaOf: (col) => (ready && engine ? engine.formulaOf(col + it.row) : null),
      setCell: (col, v) => setCell(col + it.row, v),
      unitNet: unitNetOf(it),
      inTotal: totalWeights.sales(it.row) > 0,
      isOpenText: (col) => it.open.includes(col),
    };
  }

  /* ---- filtre seçenekleri ---- */
  const topCategories = useMemo(
    () => uniqueSorted(items.map((i) => i.topCategory)),
    [items],
  );
  const subCategories = useMemo(
    () => uniqueSorted(items.filter((i) => !topCategory || i.topCategory === topCategory).map((i) => i.subCategory)),
    [items, topCategory],
  );
  const productTypes = useMemo(
    () => uniqueSorted(items
      .filter((i) => (!topCategory || i.topCategory === topCategory) && (!subCategory || i.subCategory === subCategory))
      .map((i) => i.productType)),
    [items, topCategory, subCategory],
  );
  const suppliers = useMemo(() => uniqueSorted(items.map((i) => i.supplier)), [items]);
  const labels = useMemo(() => uniqueSorted(items.map((i) => i.label)), [items]);

  /* ---- filtreleme ---- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minPrice.trim() ? parseFloat(minPrice.replace(',', '.')) : null;
    const max = maxPrice.trim() ? parseFloat(maxPrice.replace(',', '.')) : null;

    return items.filter((i) => {
      if (group && i.group !== group) return false;
      if (topCategory && i.topCategory !== topCategory) return false;
      if (subCategory && i.subCategory !== subCategory) return false;
      if (productType && i.productType !== productType) return false;
      if (standard && i.standard !== standard) return false;
      if (supplier && i.supplier !== supplier) return false;
      if (label && i.label !== label) return false;
      if (onlyEntered && cellNum(i, 'F') <= 0) return false;

      const hasPrice = i.listPrice !== null && i.listPrice > 0;
      if (priced === 'yes' && !hasPrice) return false;
      if (priced === 'no' && hasPrice) return false;

      if (min !== null && !Number.isNaN(min) && (i.listPrice ?? 0) < min) return false;
      if (max !== null && !Number.isNaN(max) && (i.listPrice ?? 0) > max) return false;

      if (q) {
        const hay = `${i.eqNo} ${i.techSpec} ${i.placeOfUse} ${i.machineType} ${i.productType} ${i.subCategory} ${i.topCategory} ${i.supplier} ${i.label} ${i.sparePartNo} ${i.sparePartDesc}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, group, topCategory, subCategory, productType, standard, supplier,
    label, priced, minPrice, maxPrice, onlyEntered, settledVersion, ready]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    // Hesaplanan sütunlar da sıralamaya yansır.
    const value = (i: CatalogItem): string | number | null => {
      switch (sortKey) {
        case 'qty': return cellNum(i, 'F');
        case 'listPrice': return cellNum(i, 'I');
        case 'netPrice': return unitNetOf(i);
        case 'totalCost': return cellNum(i, 'M');
        case 'salesPrice': return cellNum(i, 'N');
        default: return i[sortKey];
      }
    };
    arr.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      let cmp: number;
      if (av === null && bv === null) cmp = 0;
      else if (av === null) cmp = 1;
      else if (bv === null) cmp = -1;
      else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'tr');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, version, ready]);

  /* ---- ağaç ---- */
  // Kalemler Excel'in satır gruplamasına göre iç içe gruplanır. Sıra
  // `sorted` dizisinden gelir; böylece sıralama seçimi ağaçta da geçerlidir.
  const { root, allKeys } = useMemo(() => {
    const makeNode = (key: string, title: string, depth: number): TreeNode =>
      ({ key, title, depth, entries: [], count: 0, qty: 0, cost: 0 });

    const rootNode = makeNode('', '', -1);
    const index = new Map<string, TreeNode>();

    for (const it of sorted) {
      let node = rootNode;
      let key = '';
      for (let d = 0; d < it.tree.length; d++) {
        key = key ? `${key} / ${it.tree[d]}` : it.tree[d];
        let child = index.get(key);
        if (!child) {
          child = makeNode(key, it.tree[d], d);
          index.set(key, child);
          node.entries.push({ t: 'node', node: child });
        }
        node = child;
      }
      node.entries.push({ t: 'item', item: it });
    }

    // Alt ağaç toplamları (kalem sayısı, adet, maliyet)
    const visit = (node: TreeNode) => {
      let count = 0, qty = 0, cost = 0;
      for (const e of node.entries) {
        if (e.t === 'item') {
          count++;
          qty += cellNum(e.item, 'F');
          cost += cellNum(e.item, 'M');
        } else {
          visit(e.node);
          count += e.node.count;
          qty += e.node.qty;
          cost += e.node.cost;
        }
      }
      node.count = count; node.qty = qty; node.cost = cost;
    };
    visit(rootNode);

    return { root: rootNode, allKeys: [...index.keys()] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, settledVersion, ready]);

  /** Filtre varken eşleşenleri görmek için ağaç kendiliğinden açılır. */
  /** Aramanın dışında kaç filtre etkin — katlanmış paneldeki rozet için. */
  const activeFilterCount = [topCategory, subCategory, productType, standard,
    supplier, label, group, priced, minPrice, maxPrice].filter(Boolean).length
    + (onlyEntered ? 1 : 0);

  const filtering = !!(search || topCategory || subCategory || productType
    || standard || supplier || label || group || priced || minPrice || maxPrice || onlyEntered);

  const visibleRows = useMemo(() => {
    const out: VisibleRow[] = [];
    const walk = (node: TreeNode) => {
      for (const e of node.entries) {
        if (e.t === 'item') { out.push({ t: 'item', item: e.item }); continue; }
        out.push({ t: 'node', node: e.node });
        if (filtering || expanded.has(e.node.key)) walk(e.node);
      }
    };
    walk(root);
    return out;
  }, [root, expanded, filtering]);

  function toggleNode(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function expandAll() { setExpanded(new Set(allKeys)); }
  function collapseAll() { setExpanded(new Set()); }

  /**
   * Teklifin genel toplamı — filtreden bağımsız, hesap çarpanlarının yanında
   * gösterilir. Doğrudan Excel'in kendi genel toplam satırından gelir.
   */
  const quote = useMemo(() => ({
    cost: ready && engine ? engine.num('M' + engine.anchors.grandTotalRow) : 0,
    sales: ready && engine ? engine.num('N' + engine.anchors.grandTotalRow) : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [engine, settledVersion, ready]);

  /** Miktar girilmiş kalem sayısı — "Sadece teklife girilenler" rozetinde. */
  const enteredCount = useMemo(() => {
    let rows = 0;
    for (const i of items) if (cellNum(i, 'F') > 0) rows++;
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, settledVersion, ready]);

  /* ---- sanallaştırma: yalnızca görünen satırlar çizilir ---- */
  // Satır yükseklikleri sabit olduğu için önek toplamıyla kesin konum bulunur.
  const rowOffsets = useMemo(() => {
    const offsets = new Array<number>(visibleRows.length + 1);
    let y = 0;
    for (let i = 0; i < visibleRows.length; i++) {
      offsets[i] = y;
      y += visibleRows[i].t === 'node' ? NODE_ROW_HEIGHT : ITEM_ROW_HEIGHT;
    }
    offsets[visibleRows.length] = y;
    return offsets;
  }, [visibleRows]);

  const { windowRows, padTop, padBottom } = useMemo(() => {
    const seek = (target: number) => {
      let lo = 0;
      let hi = visibleRows.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (rowOffsets[mid] < target) lo = mid + 1; else hi = mid;
      }
      return lo;
    };
    const start = Math.max(0, seek(viewport.top) - OVERSCAN);
    const end = Math.min(visibleRows.length, seek(viewport.top + viewport.height) + OVERSCAN);
    return {
      windowRows: visibleRows.slice(start, end),
      padTop: rowOffsets[start],
      padBottom: rowOffsets[visibleRows.length] - rowOffsets[end],
    };
  }, [visibleRows, rowOffsets, viewport]);

  // Filtre ya da sıralama değişince listenin başına dön. Bağımlılıklar
  // kasıtlı olarak filtre girdileridir: `filtered` her hesap turunda yeni
  // dizi döndürdüğü için onu izlemek, adet girişinden sonra listeyi başa
  // atardı.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [search, topCategory, subCategory, productType, standard, supplier, label,
    group, priced, minPrice, maxPrice, onlyEntered, sortKey, sortDir]);

  function toggleSort(k?: SortKey) {
    if (!k) return;
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  function resetFilters() {
    setSearch(''); setTopCategory(''); setSubCategory(''); setProductType('');
    setStandard(''); setSupplier(''); setLabel(''); setGroup(''); setPriced(''); setOnlyEntered(false);
    setMinPrice(''); setMaxPrice('');
  }

  const onFilterChange = <T,>(setter: (v: T) => void) => (v: T) => setter(v);

  /*
   * Başlıktaki ⋯ menüsü. Bir teklif hazırlarken günde bir kez dokunulan
   * eylemler (ağacı aç/kapat, düzeni sıfırla, girdileri sil) şeridi
   * doldurmasın diye buraya toplanır; sırası kullanım sıklığına göredir.
   */
  const moreActions: ContextMenuEntry[] = [
    ...(doc.docId
      ? [{ label: 'Yeni Precalculation', onClick: beginNew }, { divider: true as const }]
      : []),
    ...(activeSheet === MAIN_SHEET
      ? [
        { label: 'Tümünü Aç', onClick: expandAll, disabled: filtering },
        { label: 'Tümünü Kapat', onClick: collapseAll, disabled: filtering || expanded.size === 0 },
        { label: 'Filtreleri Temizle', onClick: resetFilters, disabled: !filtering },
        ...(layoutChanged ? [{ label: 'Sütun Düzenini Sıfırla', onClick: resetLayout }] : []),
        { divider: true as const },
      ]
      : []),
    { label: 'Girdileri Sıfırla', onClick: resetEntries, variant: 'danger' as const, disabled: !ready || entryCount === 0 },
  ];

  return (
    <div>
      {/*
        Başlık şeridi. Yalnızca iki ana eylem görünür; kalanlar ⋯ menüsünde —
        sekiz düğme yan yana dizilince şerit iki satıra taşıyor ve etiketler
        düğmelerin içinde bölünüyordu.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Advanced Precalculation</h1>
          <p className="text-[11px] text-slate-400 truncate">
            {meta.sourceFile} · {meta.totalItems.toLocaleString('tr-TR')} kalem ·{' '}
            OTHERS ayrı sekmede · {meta.currency}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={saveToList}
            disabled={!ready || saving}
            title={doc.docId
              ? 'Açık kaydı günceller (Advanced Precalculation Lists).'
              : 'Yeni bir kayıt açar (precalculation numarası zorunludur).'}
            className={BTN_PRIMARY}
          >
            {saving ? 'Kaydediliyor…' : doc.docId ? 'Kaydı Güncelle' : 'Listeye Kaydet'}
          </button>
          <Link href="/precalculation" className={BTN_DARK}>
            Precalculation Oluştur
          </Link>
          <MoreMenu items={moreActions} />
        </div>
      </div>

      {saveNotice && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-3 mb-3',
            saveNotice.kind === 'ok' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
            saveNotice.kind === 'err' && 'bg-red-50 border-red-200 text-red-700',
            saveNotice.kind === 'conflict' && 'bg-amber-50 border-amber-300 text-amber-900',
          )}
        >
          <span>{saveNotice.text}</span>
          <span className="flex items-center gap-2 shrink-0">
            {saveNotice.kind === 'conflict' && (
              <button
                onClick={() => loadRemote(saveNotice.recordId)}
                title="Sunucudaki kaydı yükler — bu ekrandaki değişiklikleriniz gider."
                className="px-2.5 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Sunucudaki sürümü yükle
              </button>
            )}
            <button onClick={() => setSaveNotice(null)} className="text-xs opacity-60 hover:opacity-100">
              kapat
            </button>
          </span>
        </div>
      )}

      {/* Teklifin kimliği, motorun durumu ve açık kayıt — hepsi tek şeritte */}
      <QuoteIdentityBar
        engine={engine}
        ready={ready}
        version={version}
        doc={doc}
        engineLoading={engineLoading}
        engineError={engineError}
        calculating={calculating}
        entryCount={entryCount}
        onSetCell={setMainCell}
      />

      {/* Sayfa geçişi — kitabın bütün sayfaları */}
      <div className="flex flex-wrap items-center gap-1 mb-3">
        <SheetButton
          name={MAIN_SHEET}
          label="Kalemler"
          active={activeSheet === MAIN_SHEET}
          onClick={() => setActiveSheet(MAIN_SHEET)}
        />
        <SheetButton
          name={OTHERS_TAB}
          label="OTHERS"
          active={activeSheet === OTHERS_TAB}
          onClick={() => setActiveSheet(OTHERS_TAB)}
        />
        <SheetButton
          name={TOTALS_TAB}
          label="Genel Giderler & Toplam"
          active={activeSheet === TOTALS_TAB}
          onClick={() => setActiveSheet(TOTALS_TAB)}
        />
        {(workbook?.sheetNames ?? [])
          .filter((n) => n !== MAIN_SHEET)
          .map((name) => (
            <SheetButton
              key={name}
              name={name}
              active={activeSheet === name}
              onClick={() => setActiveSheet(name)}
            />
          ))}
        {!workbook && (
          <span className="text-[11px] text-slate-400 px-2">diğer sayfalar yükleniyor…</span>
        )}
      </div>

      {activeSheet === MAIN_SHEET ? (
        <>
          {/* Filtreler — arama hep görünür, ayrıntılar katlanır */}
          <div className="bg-white rounded-xl border border-slate-200 p-2 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => onFilterChange(setSearch)(e.target.value)}
                placeholder="Kod, açıklama, kullanım yeri, tedarikçi, yedek parça…"
                className="flex-1 min-w-60 h-8 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setFiltersOpen((prev) => !prev)}
                className={cn(
                  BTN,
                  activeFilterCount > 0
                    ? 'bg-blue-50 border border-blue-300 text-blue-800'
                    : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50',
                )}
              >
                Filtreler
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 font-mono">{activeFilterCount}</span>
                )}
                <span className="ml-1.5 text-[9px]">{filtersOpen ? '▲' : '▼'}</span>
              </button>
            </div>

            <div className={cn('space-y-3', filtersOpen ? 'mt-3' : 'hidden')}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Standart</Label>
                <Select value={standard} onChange={onFilterChange(setStandard)}>
                  <option value="">Tümü</option>
                  <option value="DIN">DIN</option>
                  <option value="SMS">SMS</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tedarikçi</Label>
                  <Select value={supplier} onChange={onFilterChange(setSupplier)}>
                    <option value="">Tümü ({suppliers.length})</option>
                    {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Marka</Label>
                  <Select value={label} onChange={onFilterChange(setLabel)}>
                    <option value="">Tümü ({labels.length})</option>
                    {labels.map((l) => <option key={l} value={l}>{l}</option>)}
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Üst Kategori</Label>
                <Select
                  value={topCategory}
                  onChange={(v) => { setTopCategory(v); setSubCategory(''); setProductType(''); }}
                >
                  <option value="">Tümü ({topCategories.length})</option>
                  {topCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Alt Kategori</Label>
                <Select value={subCategory} onChange={(v) => { setSubCategory(v); setProductType(''); }}>
                  <option value="">Tümü ({subCategories.length})</option>
                  {subCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Ürün Tipi</Label>
                <Select value={productType} onChange={onFilterChange(setProductType)}>
                  <option value="">Tümü ({productTypes.length})</option>
                  {productTypes.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Bölüm</Label>
                  <Select value={group} onChange={onFilterChange(setGroup)}>
                    <option value="">Tümü</option>
                    <option value="catalog">Ürün</option>
                    <option value="service">Hizmet</option>
                  </Select>
                </div>
                <div>
                  <Label>Fiyat durumu</Label>
                  <Select value={priced} onChange={(v) => onFilterChange(setPriced)(v as '' | 'yes' | 'no')}>
                    <option value="">Tümü</option>
                    <option value="yes">Fiyatı olanlar</option>
                    <option value="no">Fiyatı boş olanlar</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Min Fiyat ({meta.currency})</Label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => onFilterChange(setMinPrice)(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Maks Fiyat ({meta.currency})</Label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => onFilterChange(setMaxPrice)(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="∞"
                />
              </div>
            </div>
            </div>
          </div>

          {/* Satış ve nakliye hesabını yöneten çarpanlar + teklifin genel toplamı */}
          <ParamBar
            engine={engine}
            ready={ready}
            version={settledVersion}
            currency={meta.currency}
            quote={quote}
            calculating={calculating}
            onSetCell={setMainCell}
          />

          {/*
            Görünüm araç çubuğu. Efsane buradan alındı: sağa yaslanmış üç
            açıklama, dar ekranda düğmelerin üstüne biniyordu — artık tablonun
            altında, kendi satırında duruyor.
          */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-[11px] text-slate-500 mr-0.5">Sütunlar:</span>
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
              {COLUMN_VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => selectView(v.id)}
                  className={cn(
                    // Sabit yükseklik + nowrap: "Teklif" / "Teknik" etiketleri
                    // kutunun içinde kırpılıyordu.
                    'inline-flex items-center h-7 px-3 text-[11px] font-medium whitespace-nowrap transition-colors',
                    colView === v.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setOnlyEntered((prev) => !prev)}
              title="Yalnızca adet girilmiş kalemler"
              className={cn(
                'inline-flex items-center h-7 px-2.5 rounded-md border text-[11px] font-medium',
                'whitespace-nowrap transition-colors',
                onlyEntered
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
              )}
            >
              {onlyEntered ? '✓ ' : ''}Teklife girilenler
              {ready && enteredCount > 0 && (
                <span className={cn('ml-1.5 font-mono', onlyEntered ? 'text-white/80' : 'text-slate-400')}>
                  {enteredCount}
                </span>
              )}
            </button>
          </div>

          {/* Tablo — kendi kutusunda kayar: başlık ve yatay çubuk hep ekranda */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div ref={scrollRef} className="overflow-auto" style={{ height: TABLE_HEIGHT }}>
              {/*
                Sabit yerleşim + colgroup: sütun genişliğini yalnızca buradaki
                değerler belirler. Otomatik yerleşimde tarayıcı sütunları başlık
                metnine ve artan boşluğa göre kendi büyütüyor, bu yüzden
                başlıklarla gövde hücreleri birbirinden kayıyordu.
                Sondaki genişliksiz sütun, tablo ekrandan darsa artan boşluğu
                tek başına yutar; gerçek sütunlar bozulmaz.
                Ayrık kenarlık (border-separate) gerekli: çökertilmiş kenarlıklar
                tabloya ait olduğu için başlık dikeyde sabitlenince kaymaz ve
                başlık şeridinde boşluk/çizgi artığı bırakır.
              */}
              <table
                className="text-xs table-fixed border-separate"
                style={{ borderSpacing: 0, width: '100%', minWidth: totalWidth }}
              >
                <colgroup>
                  {cols.map((c) => <col key={c.key} style={{ width: widthOf(c) }} />)}
                  <col />
                </colgroup>
                <thead>
                  <HeadRow
                    cols={cols}
                    widthOf={widthOf}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    onResize={resizeColumn}
                    onMove={moveColumn}
                  />
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="py-12 text-center text-slate-400 text-sm">
                        Eşleşen ürün yok.
                      </td>
                    </tr>
                  ) : null}
                  {padTop > 0 && (
                    <tr aria-hidden style={{ height: padTop }}>
                      <td colSpan={colSpan} className="p-0" />
                    </tr>
                  )}
                  {windowRows.map((row) => {
                    if (row.t === 'node') {
                      return (
                        <TreeRow
                          key={'n:' + row.node.key}
                          node={row.node}
                          colSpan={colSpan}
                          open={filtering || expanded.has(row.node.key)}
                          locked={filtering}
                          currency={meta.currency}
                          onToggle={() => toggleNode(row.node.key)}
                        />
                      );
                    }
                    const it = row.item;
                    const ctx = rowCtx(it);
                    return (
                      <tr
                        key={it.id}
                        className="hover:bg-slate-50 group"
                        style={{ height: ITEM_ROW_HEIGHT }}
                      >
                        {cols.map((c) => (
                          <td
                            key={c.key}
                            className={cn(
                              'px-3 py-1 align-middle overflow-hidden',
                              // Satır alt çizgisi hücrede: ayrık kenarlıkta <tr> kenarlığı çizilmez.
                              'border-r border-b border-slate-100',
                              c.align === 'right' && 'text-right',
                            )}
                            style={{ width: widthOf(c), minWidth: widthOf(c), maxWidth: widthOf(c) }}
                          >
                            <Cell it={it} column={c} ctx={ctx} />
                          </td>
                        ))}
                        <td className="border-b border-slate-100" />
                      </tr>
                    );
                  })}
                  {padBottom > 0 && (
                    <tr aria-hidden style={{ height: padBottom }}>
                      <td colSpan={colSpan} className="p-0" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hücre renklerinin ne anlama geldiği — araç çubuğunu sıkıştırmasın */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="text-blue-500">✎</span> veri girişi
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm border border-violet-200 bg-violet-50 inline-block" />
              formül · salt okunur
            </span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-slate-300">–</span> değer yok
            </span>
            <span className="hidden lg:inline">
              Başlığa gelince ne olduğu yazar · sürükleyerek taşı · kenardan çekerek genişlet
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-1.5 px-1">
            Kalemler Excel&apos;in kendi satır gruplamasıyla (kategori → alt kategori →
            ürün tipi → model → standart) ağaç olarak listelenir; girilmiş adet ve maliyet
            toplamı grup başlığında görünür. Filtre ya da arama yapıldığında ağaç,
            eşleşmeleri göstermek için kendiliğinden açılır.
            Hesaplar PRECALCULATION sayfasının kendi formüllerinden gelir:
            Nakliye (L) = I×J×K×Nakliye çarpanı×F, Toplam Maliyet (M) = F×I×J×K,
            Satış Fiyatı (N) = M ÷ Kâr çarpanı. Birim Net = I×J×K (adetten bağımsız),
            İskonto = 1 − J×K. Mor hücreler formüllüdür ve elle değiştirilemez —
            miktarı başka satırlardan toplanan kalemlerde adet kutusu da mordur.
            Hesap çarpanlarının yanındaki genel toplam Excel&apos;in kendi genel toplam
            satırından gelir; komisyon, garanti ve banka teminatı gibi kalemleri de içerir.
            Excel&apos;in ara toplamı OTHERS bölümündeki bazı seçenek satırlarını saymaz —
            bunlar satır numarasının yanında ∅ ile işaretlidir.
            Girdiler tarayıcıda saklanır ve Precalculation ekranıyla ortaktır;
            kaynak Excel dosyası hiçbir zaman değiştirilmez.
          </p>
        </>
      ) : engine && activeSheet === OTHERS_TAB ? (
        <OthersTable
          engine={engine}
          version={settledVersion}
          currency={meta.currency}
          onSetCell={setMainCell}
        />
      ) : engine && activeSheet === TOTALS_TAB ? (
        <div className="space-y-3">
          <TotalsPanel
            engine={engine}
            settledVersion={settledVersion}
            calculating={calculating}
            currency={meta.currency}
            onSetCell={setMainCell}
          />
          <p className="text-[11px] text-slate-400 px-1">
            Bu blok PRECALCULATION&apos;ın ara toplam ile genel toplam arasıdır: ara toplamın üzerine
            eklenen acente komisyonu, beklenmeyen giderler, garanti, risk, banka
            teminat mektupları ve damga vergisi. Girdi (F) sütunu Excel&apos;deki
            değeri doğrudan değiştirir; Matrah (I) sütunu formülle hesaplanır.
          </p>
        </div>
      ) : engine ? (
        <SheetGrid
          engine={engine}
          sheetName={activeSheet}
          version={settledVersion}
          onSetCell={setSheetCell}
          getEntries={getEntries}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-sm text-slate-400">
          Hesap motoru yükleniyor…
        </div>
      )}

    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Derinliğe göre grup başlığı görünümü (Excel'deki kategori kırılımı). */
const DEPTH_STYLE = [
  { row: 'bg-blue-50 border-blue-200', text: 'text-blue-900 font-semibold text-[11px] uppercase tracking-wide' },
  { row: 'bg-slate-100 border-slate-200', text: 'text-slate-800 font-semibold text-[11px]' },
  { row: 'bg-slate-50 border-slate-200', text: 'text-slate-700 font-medium text-[11px]' },
  { row: 'bg-white border-slate-100', text: 'text-slate-600 font-medium text-[11px]' },
  { row: 'bg-white border-slate-100', text: 'text-slate-500 text-[11px]' },
];

/**
 * Kâr ve nakliye çarpanı. Excel'de bu iki hücre bütün Satış ve Nakliye
 * sütunlarını besler (kâr çarpanına 3.500'den fazla formül atıf verir), ama
 * kataloğu kullanan kişi tekliften teklife bunları değiştirmek ister — bu
 * yüzden Precalculation ekranındaki uzun parametre listesinin yanı sıra
 * burada da doğrudan düzenlenebilir. Girdi ortak taslakta saklandığı için
 * iki ekran aynı değeri gösterir.
 */
function ParamBar({
  engine, ready, version, currency, quote, calculating, onSetCell,
}: {
  engine: PrecalcEngine | null;
  ready: boolean;
  /** settledVersion — hesap bitince değerleri tazelemek için. */
  version: number;
  currency: string;
  /** Excel'in genel toplam satırı — çarpanların sonucu hemen yanlarında görünsün. */
  quote: { cost: number; sales: number };
  calculating: boolean;
  onSetCell: (addr: string, value: RawValue) => void;
}) {
  const items = useMemo(() => {
    if (!ready || !engine) return [];
    return PARAM_FIELDS.map((f) => {
      const addr = engine.paramAddr(f.key);
      if (!addr) return null;
      const value = engine.num(addr);
      const fallback = engine.workbook.params.find((prm) => prm.key === f.key)?.value;
      return {
        ...f,
        addr,
        value,
        edited: engine.isUserEntry(addr),
        original: typeof fallback === 'number' ? fallback : null,
        note: f.note(value),
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, ready, version]);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white rounded-xl border border-slate-200 px-3 py-2 mb-3">
      <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Hesap çarpanları</span>
      {items.map((it) => (
        <label key={it.key} className="flex items-center gap-2 shrink-0" title={it.hint}>
          <span className="text-[11px] text-slate-500 whitespace-nowrap">{it.label}</span>
          <span className="w-24">
            <EditableCell
              value={it.value}
              // Çarpanlar 4 haneye kadar girilebilir: 0,7025 gibi değerler
              // `number` biçiminde 0,70'e yuvarlanıp geri okunamıyordu.
              format="factor"
              align="right"
              edited={it.edited}
              onCommit={(v) => {
                // Kâr çarpanı bölendir: sıfır ya da eksi girilirse tüm Satış
                // sütunu #DIV/0! olur. Geçersiz değeri yazmak yerine yok say.
                if (it.mustBePositive && (typeof v !== 'number' || v <= 0)) return;
                onSetCell(it.addr, v);
              }}
            />
          </span>
          <span className={cn(
            'text-[11px] font-mono whitespace-nowrap',
            it.edited ? 'text-blue-600' : 'text-slate-400',
          )}>
            {it.note}
          </span>
          {it.edited && it.original !== null && (
            <button
              onClick={() => onSetCell(it.addr, null)}
              title={`Şablondaki değere dön (${formatTrimmed(it.original, FACTOR_DECIMALS)})`}
              className="text-[11px] text-slate-400 hover:text-slate-700"
            >
              ↺
            </button>
          )}
        </label>
      ))}
      {/* Çarpanların sonucu: Excel'in kendi genel toplam satırı. Sayfanın
          altına çakılı çubuk yerine buradadır — değiştirilen çarpanla
          değişen tutar aynı satırda görünsün. */}
      <span className="ml-auto flex items-center gap-x-5 shrink-0">
        <TotalMetric
          label={`Genel Toplam Maliyet (${currency})`}
          value={ready ? money(quote.cost) : '…'}
          calculating={calculating}
          hint="Excel genel toplam satırı · genel giderler, garanti ve teminat dahil"
        />
        <TotalMetric
          label={`Genel Toplam Satış (${currency})`}
          value={ready ? money(quote.sales) : '…'}
          calculating={calculating}
          tone="emerald"
          hint="Excel genel toplam satırı · müşteriye verilecek nihai bedel"
        />
      </span>
    </div>
  );
}

/** Hesap çarpanlarının yanındaki genel toplam. */
function TotalMetric({
  label, value, tone, hint, calculating,
}: { label: string; value: string; tone?: 'emerald'; hint?: string; calculating: boolean }) {
  return (
    <span
      className={cn('flex flex-col leading-tight whitespace-nowrap transition-opacity', calculating && 'opacity-60')}
      title={hint}
    >
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className={cn(
        'text-sm font-mono font-semibold',
        tone === 'emerald' ? 'text-emerald-700' : 'text-slate-800',
      )}>
        {value}
      </span>
    </span>
  );
}

/**
 * Teklifin kimliği: proje ve precalculation numarası.
 *
 * İkisi de kitabın başlık bloğuna (CUSTOMER / END USER ile aynı düzen)
 * yazılır; precalculation no ayrıca AYRINTILI FIYATLANDIRMA sayfasının A1
 * hücresinde görünür. Girdi ortak taslakta saklandığı için Precalculation
 * ekranı ve dışa aktarılan Excel aynı numarayı gösterir.
 */
function QuoteIdentityBar({
  engine, ready, version, doc, engineLoading, engineError, calculating, entryCount, onSetCell,
}: {
  engine: PrecalcEngine | null;
  ready: boolean;
  version: number;
  /** Açık kayıt — kaydetmenin nereye gideceğini gösterir. */
  doc: DraftDoc;
  engineLoading: boolean;
  engineError: string | null;
  calculating: boolean;
  entryCount: number;
  onSetCell: (addr: string, value: RawValue) => void;
}) {
  const fields = useMemo(() => {
    if (!ready || !engine) return [];
    return IDENTITY_FIELDS.map((f) => {
      const addr = engine.paramAddr(f.key);
      if (!addr) return null;
      return { ...f, addr, value: engine.value(addr), edited: engine.isUserEntry(addr) };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, ready, version]);

  const status = engineError
    ? { tone: 'bg-red-500', text: 'Motor yüklenemedi', hint: engineError, className: 'text-red-600' }
    : engineLoading
      ? { tone: 'bg-slate-400 animate-pulse', text: 'Yükleniyor…', hint: 'Hücreler motor hazır olunca düzenlenebilir', className: 'text-slate-500' }
      : calculating
        ? { tone: 'bg-blue-500 animate-pulse', text: 'Hesaplanıyor…', hint: 'Girilen değerler kitaba işleniyor', className: 'text-slate-500' }
        : {
          tone: 'bg-emerald-500',
          text: `Hazır · ${entryCount.toLocaleString('tr-TR')} hücre`,
          hint: 'Hesap motoru hazır — elle değiştirilen hücre sayısı',
          className: 'text-slate-500',
        };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white rounded-xl border border-slate-200 px-3 py-2 mb-3">
      {fields.map((f) => (
        <label key={f.key} className="flex items-center gap-2 shrink-0" title={f.hint}>
          <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">{f.label}</span>
          <span className="w-40">
            <EditableCell
              value={f.value}
              format="text"
              align="left"
              edited={f.edited}
              placeholder={f.placeholder}
              onCommit={(v) => onSetCell(f.addr, v)}
            />
          </span>
        </label>
      ))}

      <span className="h-4 w-px bg-slate-200 hidden sm:block" />

      {/* Motorun durumu kendi şeridini kaplamasın diye burada, tek nokta olarak */}
      <span className="flex items-center gap-1.5 shrink-0" title={status.hint}>
        <span className={cn('w-2 h-2 rounded-full shrink-0', status.tone)} />
        <span className={cn('text-[11px] whitespace-nowrap', status.className)}>{status.text}</span>
      </span>

      {/* Kaydetmenin nereye gideceği — sürümüyle birlikte */}
      <span className="ml-auto shrink-0">
        {doc.docId ? (
          <span
            title={'Kayıt ' + doc.docId + ' · sürüm ' + doc.version}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-600 whitespace-nowrap"
          >
            <span className="font-mono font-semibold text-slate-800">{doc.precalcNo || '—'}</span>
            <span className="text-slate-400">v{doc.version}</span>
          </span>
        ) : (
          <span
            title="Bu teklif henüz listeye kaydedilmedi. Kaydedince kendi kaydına bağlanır."
            className="inline-flex items-center px-2 py-1 rounded-md bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-500 whitespace-nowrap"
          >
            Kaydedilmemiş
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Başlıktaki ⋯ düğmesi — seyrek kullanılan eylemleri şeritten çıkarır.
 * Menü gövdeye portallanır (bkz. ContextMenu), böylece kaydırma kutularının
 * kırpma alanına takılmaz.
 */
function MoreMenu({ items }: { items: ContextMenuEntry[] }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <button
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          // Menü düğmenin sağ kenarına hizalanır, hemen altında açılır.
          setAt({ x: r.right - MENU_WIDTH, y: r.bottom + 4 });
        }}
        aria-haspopup="menu"
        aria-expanded={!!at}
        title="Diğer eylemler"
        className={cn(BTN_GHOST, 'px-2.5 text-base leading-none')}
      >
        ⋯
      </button>
      {at && <ContextMenu x={at.x} y={at.y} items={items} onClose={() => setAt(null)} />}
    </>
  );
}

/** Precalculation'a başlarken doldurulan kimlik alanları. */
const IDENTITY_FIELDS: {
  key: string; label: string; placeholder: string; hint: string;
}[] = [
  {
    key: 'projectNo',
    label: 'Proje No',
    placeholder: 'ör. 2026-114',
    hint: 'Teklifin bağlı olduğu proje numarası. Başlık bloğuna yazılır.',
  },
  {
    key: 'precalcNo',
    label: 'Precalculation No',
    placeholder: 'ör. PRE-2026-114-01',
    hint: 'Bu precalculation numarası. Ayrıntılı Fiyatlandırma sayfasının A1 hücresinde de görünür.',
  },
];

/** Katalog ekranında düzenlenebilen çarpanlar. */
const PARAM_FIELDS: {
  key: string;
  label: string;
  hint: string;
  /** Sıfır/eksi değer kabul edilmez (bölen). */
  mustBePositive?: boolean;
  note: (v: number) => string;
}[] = [
  {
    key: 'profitMultiplier',
    label: 'Kâr çarpanı',
    hint: 'Satış Fiyatı = Toplam Maliyet ÷ bu çarpan. 0,70 ise satış, maliyetin 1,43 katıdır (≈ %30 kâr payı).',
    mustBePositive: true,
    note: (v) => (v > 0 ? `≈ %${formatTrimmed((1 - v) * 100, 2, 0)} kâr` : '—'),
  },
  {
    key: 'transportMultiplier',
    label: 'Nakliye çarpanı',
    hint: 'Nakliye payı = Birim net × bu çarpan × adet. 0,05 ise net fiyatın yüzde 5\'i nakliye sayılır.',
    note: (v) => `= %${formatTrimmed(v * 100, 2, 0)}`,
  },
];

/** Grup başlığı satırı — Excel'in satır gruplamasındaki bir düğüm. */
function TreeRow({
  node, colSpan, open, locked, currency, onToggle,
}: {
  node: TreeNode;
  colSpan: number;
  open: boolean;
  /** Filtre açıkken ağaç kilitli (hep açık) gösterilir. */
  locked: boolean;
  currency: string;
  onToggle: () => void;
}) {
  const tone = DEPTH_STYLE[Math.min(node.depth, DEPTH_STYLE.length - 1)];
  return (
    <tr className={tone.row} style={{ height: NODE_ROW_HEIGHT }}>
      {/* Alt çizgi hücrede: ayrık kenarlıkta <tr> kenarlığı çizilmez. */}
      <td colSpan={colSpan} className={cn('p-0 border-b', tone.row)}>
        {/* Yatay kaydırmada başlık ekranda kalsın diye sticky */}
        <div
          className="sticky left-0 inline-flex items-center gap-2 py-1.5 pr-4"
          style={{ paddingLeft: 10 + node.depth * 16 }}
        >
          <button
            onClick={onToggle}
            disabled={locked}
            aria-expanded={open}
            className={cn(
              'w-5 h-5 flex items-center justify-center rounded text-[10px] shrink-0',
              locked ? 'opacity-40 cursor-default' : 'hover:bg-black/10',
            )}
          >
            {open ? '▼' : '▶'}
          </button>
          <span className={cn('truncate', tone.text)}>{node.title}</span>
          {node.qty > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
              {formatNumberTR(node.qty, { decimals: 0 })} adet · {formatNumberTR(node.cost, { decimals: 2 })} {currency}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Sayfa geçiş düğmesi. */
function SheetButton({
  name, label, active, onClick,
}: { name: string; label?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label ? `${label} (${name})` : name}
      className={cn(
        // whitespace-nowrap şart: "OTHERS" / "KABLO" gibi etiketler dar
        // ekranda düğmenin içinde harf ortasından bölünüyordu.
        'inline-flex items-center h-7 px-2.5 rounded-md border text-[11px] font-medium',
        'whitespace-nowrap transition-colors',
        active
          ? 'bg-slate-800 text-white border-slate-800'
          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
      )}
    >
      {label ?? name}
    </button>
  );
}

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
function TextSheetCell({
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

function SheetCell({
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

/** Girdi/çok satırlı hücreler kırpma sarmalayıcısı olmadan basılır. */
function Cell({ it, column, ctx }: { it: CatalogItem; column: Column; ctx: RowCtx }) {
  if (column.custom) return <>{column.render(it, ctx)}</>;
  return <div className="truncate" title={plainText(it, column)}>{column.render(it, ctx)}</div>;
}

function plainText(it: CatalogItem, c: Column): string | undefined {
  const v = (it as unknown as Record<string, unknown>)[c.key];
  if (v === null || v === undefined || v === '') return undefined;
  return String(v);
}

function uniqueSorted(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-slate-600 mb-1">{children}</label>;
}

function Select({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {children}
    </select>
  );
}

/** Tablo başlık satırı — hem gerçek tabloda hem ekrana çakılan kopyada kullanılır. */
function HeadRow({
  cols, widthOf, sortKey, sortDir, onSort, onResize, onMove,
}: {
  cols: Column[];
  widthOf: (c: Column) => number;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k?: SortKey) => void;
  onResize: (key: string, width: number) => void;
  onMove: (fromKey: string, toKey: string) => void;
}) {
  return (
    <tr>
      {cols.map((c) => (
        <Th
          key={c.key}
          column={c}
          width={widthOf(c)}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          onResize={onResize}
          // Temel sütunlar sabit sırada durur; yalnızca ötekiler sürüklenir.
          onMove={c.lead ? undefined : onMove}
        />
      ))}
      {/* Artan alanı yutan sütun — başlık şeridi sağa kadar kesintisiz sürsün */}
      <th className="sticky top-0 z-20 bg-slate-50 border-b-2 border-slate-300" />
    </tr>
  );
}

function Th({
  column, width, sortKey, sortDir, onSort, onResize, onMove,
}: {
  column: Column; width: number; sortKey: SortKey; sortDir: SortDir;
  onSort: (k?: SortKey) => void;
  onResize: (key: string, width: number) => void;
  /** Verilirse sütun sürüklenerek yeniden sıralanabilir. */
  onMove?: (fromKey: string, toKey: string) => void;
}) {
  const sortable = !!column.sortKey;
  const [dropTarget, setDropTarget] = useState(false);

  /** Kenardan sürükleyerek genişlik değiştirme. */
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    const move = (ev: PointerEvent) => onResize(column.key, startWidth + (ev.clientX - startX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'col-resize';
  }

  return (
    <th
      draggable={!!onMove}
      onDragStart={onMove ? (e) => e.dataTransfer.setData('text/plain', column.key) : undefined}
      onDragOver={onMove ? (e) => { e.preventDefault(); setDropTarget(true); } : undefined}
      onDragLeave={onMove ? () => setDropTarget(false) : undefined}
      onDrop={onMove ? (e) => {
        e.preventDefault();
        setDropTarget(false);
        const from = e.dataTransfer.getData('text/plain');
        if (from) onMove(from, column.key);
      } : undefined}
      onClick={() => onSort(column.sortKey)}
      title={[
        column.hint,
        onMove ? 'Sürükleyerek taşı · kenardan çekerek genişlet' : 'Kenardan çekerek genişlet',
      ].filter(Boolean).join('\n\n')}
      className={cn(
        // Yalnızca dikeyde sabit: başlık şeridi ekranda kalır, yatay kaydırmada
        // gövdeyle birlikte kayar. DİKKAT: buraya `relative` eklenmemeli —
        // ikisi de position yazar, hangisinin kazanacağı CSS sırasına kalır.
        // Genişletme tutamacının konumlandırma bağlamını `sticky` zaten kuruyor.
        'sticky top-0 z-20 px-3 py-2.5 text-left text-[11px] font-semibold',
        'bg-slate-50 whitespace-nowrap overflow-hidden',
        'border-b-2 border-slate-300 border-r border-r-slate-200',
        column.input ? 'text-blue-700' : 'text-slate-600',
        sortable && 'cursor-pointer hover:bg-slate-100 select-none',
        column.align === 'right' && 'text-right',
        dropTarget && 'bg-blue-100 ring-2 ring-inset ring-blue-400',
      )}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      {column.input && <span className="mr-1 text-blue-400" title="veri girişi">✎</span>}
      <span className="truncate inline-block max-w-full align-bottom">{column.label}</span>
      {sortable && sortKey === column.sortKey && (
        <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
      {/* Genişletme tutamacı */}
      <span
        onPointerDown={startResize}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/60"
      />
    </th>
  );
}



