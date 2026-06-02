'use client';

import { useState } from 'react';
import { formatNumberTR } from '@/lib/utils';

export interface CustomItem {
  id: string;
  kind: string;
  name: string;
  standard: string;
  size: string | null;
  listPrice: number;
  discount: number;
}

const KINDS: { value: string; label: string }[] = [
  { value: 'MILK_CLARIFIER', label: 'Milk Clarifier (Separatör)' },
  { value: 'PHE', label: 'Plate Heat Exchanger (PHE)' },
  { value: 'PUMP', label: 'Pompa (W+ vb.)' },
  { value: 'OTHER', label: 'Diğer' },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export default function CustomCatalogManager({ initialItems }: { initialItems: CustomItem[] }) {
  const [items, setItems] = useState<CustomItem[]>(initialItems);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [kind, setKind] = useState('PUMP');
  const [name, setName] = useState('');
  const [standard, setStandard] = useState('');
  const [size, setSize] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [discount, setDiscount] = useState('');

  function resetForm() {
    setKind('PUMP'); setName(''); setStandard(''); setSize(''); setListPrice(''); setDiscount(''); setError('');
  }

  async function handleAdd() {
    setError('');
    const lp = parseFloat(listPrice.replace(',', '.'));
    const disc = discount.trim() ? parseFloat(discount.replace(',', '.')) / 100 : 0;
    if (!name.trim()) { setError('Ürün adı zorunlu.'); return; }
    if (!Number.isFinite(lp) || lp <= 0) { setError('Geçerli bir liste fiyatı girin.'); return; }
    if (!Number.isFinite(disc) || disc < 0 || disc >= 1) { setError('İskonto 0–99 arası olmalı.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: name.trim(), standard, size: size.trim() || null, listPrice: lp, discount: disc }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Eklenemedi');
      setItems((prev) => [json.data as CustomItem, ...prev]);
      setShowAdd(false);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/catalog/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-6">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Özel Katalog</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Excel&apos;de karşılığı olmayan ürünler (Milk Clarifier, PHE, W+ pompalar). Fiyatlandırma bunlardan otomatik çeker.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Ürün Ekle
        </button>
      </div>

      <div className="px-6 py-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4 text-center">
            Henüz özel ürün eklenmedi. Eşleşmeyen bir ürünü &quot;+ Ürün Ekle&quot; ile ekleyin; sonraki tekliflerde otomatik fiyatlanır.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600 w-44">Tür</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">Ürün Adı</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600 w-20">Std.</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600 w-28">Çap/Model</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-28">Liste (EUR)</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-16">İsk.%</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-28">Net (EUR)</th>
                  <th className="py-2 px-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {KIND_LABEL[it.kind] ?? it.kind}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800">{it.name}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{it.standard || 'Her ikisi'}</td>
                    <td className="py-2 px-3 text-xs text-slate-600 font-mono">{it.size ?? '—'}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{formatNumberTR(it.listPrice, { decimals: 2 })}</td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500">{(it.discount * 100).toFixed(0)}%</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                      {formatNumberTR(it.listPrice * (1 - it.discount), { decimals: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Kataloğa Ürün Ekle</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tür</label>
                <select value={kind} onChange={(e) => setKind(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ürün Adı / Model</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. APV W+ 30/200 5.5kW veya Milk Clarifier BRPX"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Standart</label>
                  <select value={standard} onChange={(e) => setStandard(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Her ikisi</option>
                    <option value="DIN">DIN</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Çap / Model (ops.)</label>
                  <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="ör. DN50 / 51 SMS"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Liste Fiyatı (EUR)</label>
                  <input type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">İskonto (%)</label>
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} disabled={saving}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50">
                İptal
              </button>
              <button onClick={handleAdd} disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                {saving ? 'Ekleniyor…' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
