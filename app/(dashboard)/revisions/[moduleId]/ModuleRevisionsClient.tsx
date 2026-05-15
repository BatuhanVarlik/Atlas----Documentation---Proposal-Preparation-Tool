'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils';

interface DetectedChange {
  field: string;
  before: string;
  after: string;
}

interface Revision {
  id: string;
  revisionNumber: number;
  label: string;
  description: string;
  detectedChanges: unknown;
  createdAt: string;
  createdBy: { id: string; name: string };
}

interface Props {
  moduleId: string;
  revisions: Revision[];
}

export default function ModuleRevisionsClient({ moduleId, revisions }: Props) {
  const router = useRouter();
  const [confirmRestore, setConfirmRestore] = useState<Revision | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');

  async function performRestore() {
    if (!confirmRestore) return;
    setRestoring(true);
    setError('');
    try {
      const res = await fetch(
        `/api/modules/${moduleId}/revisions/${confirmRestore.id}/restore`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Geri yüklenemedi');
        return;
      }
      setConfirmRestore(null);
      router.refresh();
    } finally {
      setRestoring(false);
    }
  }

  if (revisions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400">
        Bu modül için henüz revizyon kaydedilmemiş.
      </div>
    );
  }

  return (
    <>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
        {revisions.map((r, idx) => {
          const changes = Array.isArray(r.detectedChanges)
            ? (r.detectedChanges as DetectedChange[])
            : [];
          return (
            <div key={r.id} className="px-5 py-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-slate-800">{r.label}</span>
                    {idx === 0 && (
                      <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        Mevcut
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {formatDate(r.createdAt)} · {r.createdBy.name}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-1">{r.description}</p>
                  {changes.length > 0 && (
                    <details>
                      <summary className="text-xs text-slate-500 cursor-pointer select-none hover:text-slate-700">
                        {changes.length} değişiklik
                      </summary>
                      <ul className="mt-2 ml-3 space-y-0.5">
                        {changes.map((c, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            <span className="font-medium">{c.field}:</span>{' '}
                            <span className="text-slate-400 font-mono">{c.before}</span>
                            {' → '}
                            <span className="text-slate-700 font-mono">{c.after}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                {idx !== 0 && (
                  <button
                    onClick={() => setConfirmRestore(r)}
                    className="shrink-0 text-xs px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    Bu sürüme dön
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmRestore !== null}
        title="Önceki sürüme dön"
        message={
          confirmRestore && (
            <>
              <strong>{confirmRestore.label}</strong> sürümüne dönülecek. Mevcut tüm değişiklikler
              bu snapshot ile değiştirilecek. Bu işlem geri alınamaz; ancak dönmeden önce bir
              revizyon kaydederseniz oraya geri dönebilirsiniz.
            </>
          )
        }
        confirmLabel="Geri Yükle"
        loading={restoring}
        onConfirm={performRestore}
        onCancel={() => { if (!restoring) setConfirmRestore(null); }}
      />
    </>
  );
}
