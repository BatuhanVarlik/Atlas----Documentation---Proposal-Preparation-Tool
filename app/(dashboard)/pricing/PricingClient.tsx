'use client';

import { useMemo, useState } from 'react';
import type { PricingItem, PricingMeta } from '@/lib/pricing/loader';
import { formatNumberTR } from '@/lib/utils';

interface Props {
  items: PricingItem[];
  meta: PricingMeta;
}

type SortKey = 'eqNo' | 'techSpec' | 'productType' | 'listPrice' | 'netPrice';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

export default function PricingClient({ items, meta }: Props) {
  const [search, setSearch] = useState('');
  const [topCategory, setTopCategory] = useState<string>('');
  const [subCategory, setSubCategory] = useState<string>('');
  const [productType, setProductType] = useState<string>('');
  const [standard, setStandard] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('eqNo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  // Filter options
  const topCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.topCategory) set.add(i.topCategory); });
    return Array.from(set).sort();
  }, [items]);

  const subCategories = useMemo(() => {
    const set = new Set<string>();
    items
      .filter((i) => !topCategory || i.topCategory === topCategory)
      .forEach((i) => { if (i.subCategory) set.add(i.subCategory); });
    return Array.from(set).sort();
  }, [items, topCategory]);

  const productTypes = useMemo(() => {
    const set = new Set<string>();
    items
      .filter((i) => (!topCategory || i.topCategory === topCategory) && (!subCategory || i.subCategory === subCategory))
      .forEach((i) => { if (i.productType) set.add(i.productType); });
    return Array.from(set).sort();
  }, [items, topCategory, subCategory]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.supplier) set.add(i.supplier); });
    return Array.from(set).sort();
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minPrice.trim() ? parseFloat(minPrice.replace(',', '.')) : null;
    const max = maxPrice.trim() ? parseFloat(maxPrice.replace(',', '.')) : null;

    return items.filter((i) => {
      if (topCategory && i.topCategory !== topCategory) return false;
      if (subCategory && i.subCategory !== subCategory) return false;
      if (productType && i.productType !== productType) return false;
      if (standard && i.standard !== standard) return false;
      if (supplier && i.supplier !== supplier) return false;
      if (min !== null && !isNaN(min) && i.listPrice < min) return false;
      if (max !== null && !isNaN(max) && i.listPrice > max) return false;
      if (q) {
        const hay = `${i.eqNo} ${i.techSpec} ${i.productType} ${i.subCategory} ${i.topCategory} ${i.supplier} ${i.label} ${i.machineType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, topCategory, subCategory, productType, standard, supplier, minPrice, maxPrice]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'tr');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Stats
  const totalListValue = filtered.reduce((s, i) => s + i.listPrice, 0);
  const totalNetValue = filtered.reduce((s, i) => s + i.netPrice, 0);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  function resetFilters() {
    setSearch(''); setTopCategory(''); setSubCategory(''); setProductType('');
    setStandard(''); setSupplier(''); setMinPrice(''); setMaxPrice(''); setPage(1);
  }

  function sortIndicator(k: SortKey) {
    if (sortKey !== k) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fiyat Kataloğu</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            PRECALCULATION sheet&apos;inden çıkarılmış {meta.totalItems.toLocaleString('tr-TR')} ürün ·
            Para birimi: {meta.currency}
          </p>
        </div>
        <button
          onClick={resetFilters}
          className="px-3 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
        >
          Filtreleri Temizle
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Arama</label>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Kod, açıklama, kategori, tedarikçi..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Standart</label>
            <select
              value={standard}
              onChange={(e) => { setStandard(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tümü</option>
              <option value="DIN">DIN</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tedarikçi</label>
            <select
              value={supplier}
              onChange={(e) => { setSupplier(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tümü ({suppliers.length})</option>
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Üst Kategori</label>
            <select
              value={topCategory}
              onChange={(e) => { setTopCategory(e.target.value); setSubCategory(''); setProductType(''); setPage(1); }}
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tümü ({topCategories.length})</option>
              {topCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Alt Kategori</label>
            <select
              value={subCategory}
              onChange={(e) => { setSubCategory(e.target.value); setProductType(''); setPage(1); }}
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tümü ({subCategories.length})</option>
              {subCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ürün Tipi</label>
            <select
              value={productType}
              onChange={(e) => { setProductType(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tümü ({productTypes.length})</option>
              {productTypes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Min Fiyat ({meta.currency})</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Maks Fiyat ({meta.currency})</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="∞"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Eşleşen ürün" value={filtered.length.toLocaleString('tr-TR')} />
        <StatCard label={`Toplam Liste (${meta.currency})`} value={formatNumberTR(totalListValue, { decimals: 2 })} />
        <StatCard label={`Toplam Net (${meta.currency})`} value={formatNumberTR(totalNetValue, { decimals: 2 })} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th onClick={() => toggleSort('eqNo')} className="w-32">Eq. No {sortIndicator('eqNo')}</Th>
                <Th onClick={() => toggleSort('techSpec')}>Teknik Açıklama {sortIndicator('techSpec')}</Th>
                <Th onClick={() => toggleSort('productType')} className="w-44">Ürün Tipi {sortIndicator('productType')}</Th>
                <Th className="w-20">Std.</Th>
                <Th className="w-32">Tedarikçi</Th>
                <Th onClick={() => toggleSort('listPrice')} className="w-28 text-right">Liste {sortIndicator('listPrice')}</Th>
                <Th className="w-20 text-right">İsk.%</Th>
                <Th onClick={() => toggleSort('netPrice')} className="w-28 text-right">Net {sortIndicator('netPrice')}</Th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">Eşleşen ürün yok.</td></tr>
              ) : paged.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">{it.eqNo}</td>
                  <td className="py-2 px-3 text-slate-800">
                    <div>{it.techSpec}</div>
                    {(it.topCategory || it.subCategory) && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {it.topCategory}{it.subCategory ? ` › ${it.subCategory}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-600 text-xs">
                    <div>{it.productType}</div>
                    {it.machineType && it.machineType !== it.productType && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{it.machineType}</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-xs">
                    {it.standard && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        it.standard === 'DIN' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>{it.standard}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-600 text-xs whitespace-nowrap">{it.supplier}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700">{formatNumberTR(it.listPrice, { decimals: 2 })}</td>
                  <td className="py-2 px-3 text-right text-slate-500 text-xs">{(it.discount * 100).toFixed(0)}%</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">{formatNumberTR(it.netPrice, { decimals: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500">
              {((safePage - 1) * PAGE_SIZE + 1).toLocaleString('tr-TR')} – {Math.min(safePage * PAGE_SIZE, sorted.length).toLocaleString('tr-TR')} / {sorted.length.toLocaleString('tr-TR')}
            </div>
            <div className="flex gap-1">
              <PageButton onClick={() => setPage(1)} disabled={safePage === 1}>«</PageButton>
              <PageButton onClick={() => setPage(safePage - 1)} disabled={safePage === 1}>‹</PageButton>
              <span className="px-3 py-1 text-xs text-slate-600">Sayfa {safePage} / {pageCount}</span>
              <PageButton onClick={() => setPage(safePage + 1)} disabled={safePage === pageCount}>›</PageButton>
              <PageButton onClick={() => setPage(pageCount)} disabled={safePage === pageCount}>»</PageButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-900 font-mono">{value}</p>
    </div>
  );
}

function Th({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={`py-2.5 px-3 text-left text-xs font-semibold text-slate-600 ${onClick ? 'cursor-pointer hover:bg-slate-100 select-none' : ''} ${className}`}
    >
      {children}
    </th>
  );
}

function PageButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 text-xs border border-slate-300 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed bg-white"
    >
      {children}
    </button>
  );
}
