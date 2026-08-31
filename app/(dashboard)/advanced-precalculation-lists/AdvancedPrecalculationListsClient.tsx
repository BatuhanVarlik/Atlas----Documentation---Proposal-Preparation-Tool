'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PrecalcEntries } from '@/lib/precalc/types';
import { cn, formatNumberTR } from '@/lib/utils';

export interface SavedRow {
  id: string;
  precalcNo: string;
  projectNo: string;
  customer: string;
  endUser: string;
  preparedBy: string;
  sourceFile: string;
  currency: string;
  totalCost: number;
  totalSales: number;
  entryCount: number;
  /** İyimser kilit sayacı — kaydın kaç kez güncellendiği. */
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  items: SavedRow[];
}

/** İşlemin hangi satırda sürdüğü — düğmeler yalnızca o satırda kilitlenir. */
type Busy = { id: string; what: 'export' | 'delete' } | null;

export default function AdvancedPrecalculationListsClient({ items }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => (
      `${i.precalcNo} ${i.projectNo} ${i.customer} ${i.endUser} ${i.preparedBy} ${i.createdBy} ${i.updatedBy}`
        .toLowerCase()
        .includes(q)
    ));
  }, [items, search]);

  /** Kaydın girdilerini sunucudan alır; iki eylem de buna dayanır. */
  async function fetchEntries(id: string): Promise<PrecalcEntries> {
    const res = await fetch(`/api/precalc/saved/${id}`);
    if (!res.ok) throw new Error('Kayıt okunamadı (' + res.status + ')');
    const body = await res.json();
    return (body?.data?.entries ?? {}) as PrecalcEntries;
  }

  /** Excel çıktısını yeniden üretir — hesap sunucuda çalışır. */
  async function exportRow(row: SavedRow) {
    setBusy({ id: row.id, what: 'export' });
    setNotice(null);
    try {
      const entries = await fetchEntries(row.id);
      const res = await fetch('/api/precalc/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, onlyEntered: true }),
      });
      if (!res.ok) throw new Error('Excel oluşturulamadı (' + res.status + ')');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${row.precalcNo || 'PRECALCULATION'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice({ kind: 'ok', text: `${row.precalcNo} indirildi.` });
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Dışa aktarma başarısız.' });
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: SavedRow) {
    if (confirmDelete !== row.id) {
      setConfirmDelete(row.id);
      setTimeout(() => setConfirmDelete((cur) => (cur === row.id ? null : cur)), 4000);
      return;
    }
    setBusy({ id: row.id, what: 'delete' });
    setNotice(null);
    try {
      const res = await fetch(`/api/precalc/saved/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Silinemedi (' + res.status + ')');
      setNotice({ kind: 'ok', text: `${row.precalcNo} silindi.` });
      router.refresh();
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Silme başarısız.' });
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  }

  const money = (n: number, cur: string) =>
    (n === 0 ? '—' : `${formatNumberTR(n, { decimals: 2 })} ${cur}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Advanced Precalculation Lists</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Oluşturulan precalculation&apos;lar · {items.length.toLocaleString('tr-TR')} kayıt
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Precalculation no, proje no, müşteri…"
          className="min-w-72 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-xl border px-4 py-2.5 text-sm flex items-center justify-between gap-3',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700',
          )}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-xs opacity-60 hover:opacity-100 shrink-0">
            kapat
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200 text-[11px] text-slate-600">
                <th className="text-left font-semibold px-4 py-2.5">Precalculation No</th>
                <th className="text-left font-semibold px-4 py-2.5">Proje No</th>
                <th className="text-left font-semibold px-4 py-2.5">Müşteri</th>
                <th className="text-right font-semibold px-4 py-2.5">Genel Toplam Maliyet</th>
                <th className="text-right font-semibold px-4 py-2.5">Genel Toplam Satış</th>
                <th className="text-left font-semibold px-4 py-2.5">Son kaydeden</th>
                <th className="text-left font-semibold px-4 py-2.5">Güncelleme</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    {items.length === 0
                      ? 'Henüz precalculation oluşturulmadı. Advanced Precalculation ekranında miktarları girip kaydedin.'
                      : 'Aramayla eşleşen kayıt yok.'}
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const rowBusy = busy?.id === row.id;
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono font-semibold text-slate-800">
                      {row.precalcNo}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {row.entryCount.toLocaleString('tr-TR')} hücre · {row.sourceFile}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-600">{row.projectNo || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.customer || '—'}
                      {row.endUser && (
                        <span className="block text-[10px] text-slate-400">{row.endUser}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">
                      {money(row.totalCost, row.currency)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-700">
                      {money(row.totalSales, row.currency)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.updatedBy || row.createdBy || '—'}
                      {row.createdBy && row.updatedBy && row.updatedBy !== row.createdBy && (
                        <span className="block text-[10px] text-slate-400">oluşturan: {row.createdBy}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(row.updatedAt).toLocaleString('tr-TR')}
                      <span className="ml-1.5 font-mono text-[10px] text-slate-400">v{row.version}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/advanced-precalculation?id=${row.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Aç
                        </Link>
                        <button
                          onClick={() => exportRow(row)}
                          disabled={rowBusy}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                        >
                          {busy?.id === row.id && busy.what === 'export' ? 'Hazırlanıyor…' : 'Excel'}
                        </button>
                        <button
                          onClick={() => remove(row)}
                          disabled={rowBusy}
                          className={cn(
                            'px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40',
                            confirmDelete === row.id
                              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                              : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          {confirmDelete === row.id ? 'Emin misiniz?' : 'Sil'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        Her kaydın kendi kimliği vardır; &quot;Aç&quot; o kaydı kendi adresinde
        (<span className="font-mono">?id=…</span>) açar ve düzenlemeler yalnızca o kayda
        yazılır — başka bir precalculation üzerinde çalışırken bu kayıt etkilenmez.
        Yanındaki <span className="font-mono">v</span> numarası kaydın kaçıncı sürümü
        olduğunu gösterir: siz açtıktan sonra başkası kaydederse sürüm ilerler ve sizin
        kaydetme denemeniz, kimin ne zaman kaydettiğini söyleyen bir uyarıyla reddedilir —
        kimsenin işi sessizce silinmez. Saklanan şey hesaplanmış tutarlar değil
        kullanıcının girdiği hücrelerdir; &quot;Excel&quot; hesabı sunucuda yeniden
        çalıştırıp dosyayı üretir.
      </p>
    </div>
  );
}
