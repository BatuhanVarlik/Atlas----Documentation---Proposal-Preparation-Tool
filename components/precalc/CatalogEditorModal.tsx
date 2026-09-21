'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CatalogItem } from '@/lib/precalc/catalog';
import {
  applyCatalogOverridesToItems,
  FIELD_COLUMN,
  OVERRIDE_FIELDS,
  type CatalogOverrideRecord,
  type OverriddenCatalogItem,
  type OverrideField,
} from '@/lib/precalc/catalogOverrides';
import { cn } from '@/lib/utils';

const FIELD_LABELS: Record<OverrideField, string> = {
  techSpec: 'Teknik Açıklama',
  label: 'Etiket',
  supplier: 'Tedarikçi',
  machineType: 'Makine Tipi',
  listPrice: 'Liste Fiyatı',
  priceFactor: 'Çarpan (J)',
  extraFactor: 'Çarpan (K)',
};

const RESULT_LIMIT = 80;

interface Props {
  items: CatalogItem[];
  onClose: () => void;
  /** Bir düzeltme kaydedildiğinde/kaldırıldığında — sunucu bileşenini tazelemek için. */
  onChanged: () => void;
}

/**
 * Katalog düzeltme paneli. Yalnızca düz-değer sütunları (fx'te olmayanlar)
 * düzenlenebilir — formülle üretilen hücreler burada hiç görünmez, motor
 * mantığı bu yoldan asla bozulamaz. Düzeltmeler kaydedilince şablon
 * (catalog.json/workbook.json) değişmez; okuma anında üzerine bindirilir.
 */
export default function CatalogEditorModal({ items, onClose, onChanged }: Props) {
  const [query, setQuery] = useState('');
  const [overrides, setOverrides] = useState<CatalogOverrideRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null); // "catalogKey:field"
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/precalc/catalog-overrides')
      .then((r) => r.json())
      .then((body) => { if (!cancelled) setOverrides(body?.data ?? []); })
      .catch(() => { if (!cancelled) setLoadError('Düzeltmeler okunamadı.'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const merged = useMemo(
    () => applyCatalogOverridesToItems(items, overrides ?? []).items,
    [items, overrides],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return merged
      .filter((it) => (
        `${it.eqNo} ${it.techSpec} ${it.label} ${it.supplier} ${it.machineType}`
          .toLowerCase()
          .includes(q)
      ))
      .slice(0, RESULT_LIMIT);
  }, [merged, query]);

  async function saveField(item: OverriddenCatalogItem, field: OverrideField, value: string) {
    const key = item.catalogKey;
    const busyKey = `${key}:${field}`;
    setBusy(busyKey);
    setNotice(null);
    try {
      const res = await fetch('/api/precalc/catalog-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogKey: key, field, value }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        setNotice({ kind: 'err', text: body?.error ?? 'Kaydedilemedi.' });
        return;
      }
      setOverrides((prev) => {
        const next = (prev ?? []).filter((o) => !(o.catalogKey === key && o.field === field));
        next.push({ catalogKey: key, field, value, updatedByName: body.data.updatedByName, updatedAt: body.data.updatedAt });
        return next;
      });
      setNotice({ kind: 'ok', text: `${FIELD_LABELS[field]} güncellendi.` });
      onChanged();
    } catch {
      setNotice({ kind: 'err', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setBusy(null);
    }
  }

  async function revertField(item: OverriddenCatalogItem, field: OverrideField) {
    const key = item.catalogKey;
    const busyKey = `${key}:${field}`;
    setBusy(busyKey);
    setNotice(null);
    try {
      const res = await fetch('/api/precalc/catalog-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogKey: key, field }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        setNotice({ kind: 'err', text: body?.error ?? 'Geri alınamadı.' });
        return;
      }
      setOverrides((prev) => (prev ?? []).filter((o) => !(o.catalogKey === key && o.field === field)));
      setNotice({ kind: 'ok', text: `${FIELD_LABELS[field]} şablon değerine döndü.` });
      onChanged();
    } catch {
      setNotice({ kind: 'err', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setBusy(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Katalog Düzelt</h2>
            <p className="text-[11px] text-slate-400">
              Burada yapılan düzeltmeler kataloğun kendisini (tüm gelecek teklifleri) etkiler —
              formülle üretilen hücreler asla değiştirilemez.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ekipman no, teknik açıklama, etiket veya tedarikçiye göre ara…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          {loadError && <p className="mt-2 text-xs text-red-600">{loadError}</p>}
          {notice && (
            <p className={cn('mt-2 text-xs', notice.kind === 'ok' ? 'text-emerald-600' : 'text-red-600')}>
              {notice.text}
            </p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto border-t border-slate-100 px-5 pb-5">
          {!query.trim() ? (
            <p className="py-8 text-center text-xs text-slate-400">Aramaya başlamak için yazın.</p>
          ) : overrides === null ? (
            <p className="py-8 text-center text-xs text-slate-400">Yükleniyor…</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Sonuç yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((it) => {
                const key = it.catalogKey;
                const open = openKey === key;
                return (
                  <li key={it.id} className="py-2.5">
                    <button
                      onClick={() => setOpenKey(open ? null : key)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {it.techSpec || it.machineType || '(açıklama yok)'}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {[it.eqNo, it.label, it.supplier].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        {it.overriddenFields.length > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            {it.overriddenFields.length} düzeltme
                          </span>
                        )}
                        <span className="text-slate-300">{open ? '▲' : '▼'}</span>
                      </span>
                    </button>

                    {open && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-3">
                        {OVERRIDE_FIELDS.map((field) => {
                          const isFormula = it.fx.includes(FIELD_COLUMN[field]);
                          const overridden = it.overriddenFields.includes(field);
                          const currentValue = String(it[field] ?? '');
                          const draftKey = `${key}:${field}`;
                          const draftValue = drafts[draftKey] ?? currentValue;
                          const busyKey = `${key}:${field}`;

                          if (isFormula) {
                            return (
                              <div key={field} className="flex items-center justify-between py-1 text-[11px] text-slate-400">
                                <span>{FIELD_LABELS[field]}</span>
                                <span className="italic">formülle üretiliyor — düzenlenemez</span>
                              </div>
                            );
                          }

                          return (
                            <div key={field} className="flex items-center gap-2 py-1">
                              <span className="w-32 shrink-0 text-[11px] text-slate-500">{FIELD_LABELS[field]}</span>
                              <input
                                value={draftValue}
                                onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))}
                                disabled={busy === busyKey}
                                className={cn(
                                  'h-7 min-w-0 flex-1 rounded border px-2 text-xs outline-none',
                                  overridden ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white',
                                )}
                              />
                              <button
                                onClick={() => saveField(it, field, draftValue)}
                                disabled={busy === busyKey || draftValue.trim() === '' || draftValue === currentValue}
                                className="h-7 shrink-0 rounded bg-blue-600 px-2 text-[11px] font-medium text-white disabled:opacity-40"
                              >
                                Kaydet
                              </button>
                              {overridden && (
                                <button
                                  onClick={() => revertField(it, field)}
                                  disabled={busy === busyKey}
                                  title="Şablon değerine dön"
                                  className="h-7 shrink-0 rounded border border-slate-300 px-2 text-[11px] text-slate-500 hover:bg-white disabled:opacity-40"
                                >
                                  ↺
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
              {results.length === RESULT_LIMIT && (
                <li className="py-2 text-center text-[11px] text-slate-400">
                  İlk {RESULT_LIMIT} sonuç gösteriliyor — daraltmak için aramayı belirginleştirin.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
