'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatNumberTR } from '@/lib/utils';

export interface PricingRowView {
  /** Satır için kararlı anahtar — override'ları kalıcı eşlemek için */
  key: string;
  category: string;
  description: string;
  /** Açıklamanın altındaki küçük gri satır (eqNo · techSpec veya eşleşmeme nedeni) */
  subText?: string;
  size: string | null;
  quantity: number;
  /** Katalog liste fiyatı — yalnızca gösterim; eşleşmeyen satırlarda null */
  unitListPrice: number | null;
  /** Katalog net fiyatı — eşleşmeyen satırlarda null */
  baseUnitNet: number | null;
}

interface Props {
  saveUrl: string;
  rows: PricingRowView[];
  initialOverrides: Record<string, number>;
  initialMultiplier: number;
  /** Eşleşen satır sayısı bilgisi (başlık altı) */
  matchedCount: number;
  footerNote?: React.ReactNode;
}

const EUR = (v: number) => `${formatNumberTR(v, { decimals: 2 })}`;

export function EditablePricingCard({
  saveUrl,
  rows,
  initialOverrides,
  initialMultiplier,
  matchedCount,
  footerNote,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Düzenleme taslağı — input'lar string tutar (boş alana izin vermek için)
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({});
  const [multiplierDraft, setMultiplierDraft] = useState<string>(String(initialMultiplier));

  // Kaydedilmiş değerler (sunucudan gelen, refresh sonrası güncellenir)
  const overrides = initialOverrides ?? {};
  const multiplier = initialMultiplier ?? 1;

  /** Bir satırın geçerli (kaydedilmiş) birim net fiyatı */
  function savedUnit(row: PricingRowView): number {
    const o = overrides[row.key];
    if (typeof o === 'number' && Number.isFinite(o)) return o;
    return row.baseUnitNet ?? 0;
  }

  /** Düzenleme modunda gösterilecek birim net fiyat (taslak öncelikli) */
  function draftUnit(row: PricingRowView): number {
    const d = overrideDraft[row.key];
    if (d !== undefined) {
      const n = parseFloat(d.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return savedUnit(row);
  }

  const effMultiplier = useMemo(() => {
    if (!editing) return multiplier;
    const n = parseFloat(multiplierDraft.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [editing, multiplier, multiplierDraft]);

  const unitFor = (row: PricingRowView) => (editing ? draftUnit(row) : savedUnit(row));

  const subtotal = useMemo(
    () => rows.reduce((s, r) => s + unitFor(r) * r.quantity, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, editing, overrideDraft, overrides],
  );
  const grandTotal = subtotal * effMultiplier;

  function startEdit() {
    setOverrideDraft({});
    setMultiplierDraft(String(multiplier));
    setError(null);
    setEditing(true);
    setOpen(true);
  }

  function cancelEdit() {
    setOverrideDraft({});
    setMultiplierDraft(String(multiplier));
    setError(null);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    // Override haritasını derle: yalnızca taban net'ten farklı / manuel girilen değerleri tut.
    const nextOverrides: Record<string, number> = { ...overrides };
    for (const row of rows) {
      const raw = overrideDraft[row.key];
      if (raw === undefined) continue; // bu satıra dokunulmadı
      const trimmed = raw.trim();
      if (trimmed === '') {
        // Boş bırakıldı → override'ı kaldır (kataloğa dön)
        delete nextOverrides[row.key];
        continue;
      }
      const n = parseFloat(trimmed.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        setError(`Geçersiz fiyat: ${row.description}`);
        setSaving(false);
        return;
      }
      if (row.baseUnitNet !== null && Math.abs(n - row.baseUnitNet) < 1e-9) {
        // Katalog fiyatıyla aynı → override saklamaya gerek yok
        delete nextOverrides[row.key];
      } else {
        nextOverrides[row.key] = n;
      }
    }

    const mult = parseFloat(multiplierDraft.replace(',', '.'));
    if (!Number.isFinite(mult) || mult <= 0) {
      setError('Çarpan 0\'dan büyük olmalıdır.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(saveUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier: mult, overrides: nextOverrides }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Kaydedilemedi');
      }
      setEditing(false);
      setOverrideDraft({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
      {/* Başlık */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 text-left"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">Fiyatlandırma</span>
          <span className="text-xs text-slate-500">{matchedCount} / {rows.length} eşleşti</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-slate-800 font-mono">{EUR(grandTotal)} EUR</span>
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-300 hover:bg-blue-50 rounded-lg transition-colors"
            >
              ✎ Düzenle
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="px-6 pb-6 pt-3">
          {error && (
            <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Çarpan satırı */}
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Ara Toplam:</span>
              <span className="font-mono text-slate-800">{EUR(subtotal)} EUR</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Çarpan:</span>
              {editing ? (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={multiplierDraft}
                  onChange={(e) => setMultiplierDraft(e.target.value)}
                  className="w-24 px-2 py-1 text-sm font-mono border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 text-right"
                />
              ) : (
                <span className="font-mono text-slate-800">× {formatNumberTR(multiplier, { decimals: 2 })}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Genel Toplam:</span>
              <span className="font-mono font-bold text-slate-900">{EUR(grandTotal)} EUR</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600 w-28">Kategori</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">Ekipman</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600 w-24">Çap</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-16">Adet</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-28">Birim Liste</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-32">Birim Net</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600 w-28">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const unit = unitFor(r);
                  const isOverridden = typeof overrides[r.key] === 'number';
                  const rowTotal = unit * r.quantity;
                  return (
                    <tr key={r.key} className="border-b border-slate-100">
                      <td className="py-2 px-3">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {r.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-800">
                        <div>{r.description}</div>
                        {r.subText && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{r.subText}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-600 font-mono">{r.size ?? '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{r.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {r.unitListPrice !== null ? formatNumberTR(r.unitListPrice, { decimals: 2 }) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {editing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              overrideDraft[r.key] !== undefined
                                ? overrideDraft[r.key]
                                : (typeof overrides[r.key] === 'number'
                                    ? String(overrides[r.key])
                                    : (r.baseUnitNet !== null ? String(r.baseUnitNet) : ''))
                            }
                            placeholder={r.baseUnitNet !== null ? undefined : 'fiyat gir'}
                            onChange={(e) =>
                              setOverrideDraft((d) => ({ ...d, [r.key]: e.target.value }))
                            }
                            className="w-28 px-2 py-1 text-sm font-mono border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 text-right"
                          />
                        ) : (
                          <span className={isOverridden ? 'text-blue-700 font-semibold' : 'text-slate-700'}>
                            {unit > 0 || isOverridden ? formatNumberTR(unit, { decimals: 2 }) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                        {unit > 0 ? formatNumberTR(rowTotal, { decimals: 2 }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td colSpan={6} className="py-2 px-3 text-right text-xs font-semibold text-slate-700">
                    Ara Toplam (EUR)
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">{EUR(subtotal)}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td colSpan={6} className="py-1 px-3 text-right text-xs text-slate-500">
                    Çarpan × {formatNumberTR(effMultiplier, { decimals: 2 })}
                  </td>
                  <td className="py-1 px-3 text-right font-mono text-xs text-slate-500">—</td>
                </tr>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={6} className="py-3 px-3 text-right text-sm font-semibold text-slate-700">
                    Genel Toplam (EUR)
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-lg">{EUR(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {editing && (
            <p className="mt-3 text-[11px] text-slate-500">
              Birim net fiyatı elle değiştirebilir, katalogda eşleşmeyen satırlara fiyat girebilirsiniz. Alanı boş
              bırakırsanız katalog fiyatına döner. Kaydedilen değerler bu modül için kalıcıdır.
            </p>
          )}
          {!editing && footerNote && (
            <p className="mt-3 text-[11px] text-slate-500">{footerNote}</p>
          )}
        </div>
      )}
    </div>
  );
}
