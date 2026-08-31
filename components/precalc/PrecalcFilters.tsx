'use client';

import type { RowMeta } from '@/lib/precalc/types';

export interface FilterState {
  search: string;
  topCategory: string;
  subCategory: string;
  productType: string;
  standard: string;
  group: string;
  onlyEntered: boolean;
  hideEmptyPrice: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  topCategory: '',
  subCategory: '',
  productType: '',
  standard: '',
  group: '',
  onlyEntered: false,
  hideEmptyPrice: false,
};

interface Props {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  options: {
    topCategories: string[];
    subCategories: string[];
    productTypes: string[];
  };
  matchCount: number;
  totalCount: number;
}

export default function PrecalcFilters({ filters, onChange, onClear, options, matchCount, totalCount }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <Label>Arama</Label>
          <input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Ekipman no, teknik açıklama, tedarikçi, makine…"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <Label>Bölüm</Label>
          <Select value={filters.group} onChange={(v) => onChange({ group: v })}>
            <option value="">Tümü</option>
            <option value="catalog">Ürün kataloğu</option>
            <option value="service">Mühendislik & hizmet</option>
          </Select>
        </div>
        <div>
          <Label>Standart</Label>
          <Select value={filters.standard} onChange={(v) => onChange({ standard: v })}>
            <option value="">Tümü</option>
            <option value="SMS">SMS</option>
            <option value="DIN">DIN</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label>Üst Kategori</Label>
          <Select
            value={filters.topCategory}
            onChange={(v) => onChange({ topCategory: v, subCategory: '', productType: '' })}
          >
            <option value="">Tümü ({options.topCategories.length})</option>
            {options.topCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <Label>Alt Kategori</Label>
          <Select value={filters.subCategory} onChange={(v) => onChange({ subCategory: v, productType: '' })}>
            <option value="">Tümü ({options.subCategories.length})</option>
            {options.subCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <Label>Ürün Tipi</Label>
          <Select value={filters.productType} onChange={(v) => onChange({ productType: v })}>
            <option value="">Tümü ({options.productTypes.length})</option>
            {options.productTypes.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="flex flex-col justify-end gap-1.5 pb-0.5">
          <Check
            checked={filters.onlyEntered}
            onChange={(v) => onChange({ onlyEntered: v })}
            label="Yalnızca miktar girilenler"
          />
          <Check
            checked={filters.hideEmptyPrice}
            onChange={(v) => onChange({ hideEmptyPrice: v })}
            label="Fiyatı boş olanları gizle"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{matchCount.toLocaleString('tr-TR')}</span>
          {' / '}{totalCount.toLocaleString('tr-TR')} kalem gösteriliyor
        </p>
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
        >
          Filtreleri Temizle
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

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

function Check({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

/** Filtreyi tek bir satıra uygular. */
export function rowMatches(
  row: RowMeta,
  filters: FilterState,
  text: (addr: string) => string,
  num: (addr: string) => number,
): boolean {
  if (row.kind !== 'item') return false;
  if (filters.group && row.group !== filters.group) return false;
  if (filters.standard && row.standard !== filters.standard) return false;

  const path = row.path ?? [];
  if (filters.topCategory && path[0] !== filters.topCategory) return false;
  if (filters.subCategory && path[1] !== filters.subCategory) return false;
  if (filters.productType && path[2] !== filters.productType) return false;

  if (filters.onlyEntered && num('F' + row.r) === 0) return false;
  if (filters.hideEmptyPrice && num('I' + row.r) === 0) return false;

  const q = filters.search.trim().toLowerCase();
  if (q) {
    const hay = [
      text('A' + row.r), text('B' + row.r), text('C' + row.r),
      text('D' + row.r), text('E' + row.r), text('H' + row.r),
      ...path,
    ].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }

  return true;
}
