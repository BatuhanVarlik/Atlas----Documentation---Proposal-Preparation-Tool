'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
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
  detectedChanges: DetectedChange[] | null;
  createdAt: string | Date;
  createdBy: { id: string; name: string };
}

interface Props {
  moduleId: string;
}

export default function RevisionPanel({ moduleId }: Props) {
  const router = useRouter();

  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);

  // Save modal
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [hintChanges, setHintChanges] = useState<DetectedChange[]>([]);
  const [hintNextLabel, setHintNextLabel] = useState('RV-01');
  const [hintLoading, setHintLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Restore confirm
  const [confirmRestore, setConfirmRestore] = useState<Revision | null>(null);
  const [restoring, setRestoring] = useState(false);

  const currentLabel = revisions[0]?.label ?? '—';

  async function fetchRevisions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/${moduleId}/revisions`);
      const json = await res.json();
      if (json.success) setRevisions(json.data as Revision[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  async function openSaveModal() {
    setOpen(true);
    setDescription('');
    setError('');
    setHintLoading(true);
    setHintChanges([]);
    try {
      const res = await fetch(`/api/modules/${moduleId}/revisions/changes`);
      const json = await res.json();
      if (json.success) {
        setHintChanges(json.data.changes as DetectedChange[]);
        setHintNextLabel(json.data.nextLabel as string);
      }
    } finally {
      setHintLoading(false);
    }
  }

  async function handleSave() {
    if (!description.trim()) {
      setError('Açıklama zorunlu');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/modules/${moduleId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Hata');
        return;
      }
      setOpen(false);
      await fetchRevisions();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function performRestore() {
    if (!confirmRestore) return;
    setRestoring(true);
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

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Revizyon Geçmişi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mevcut revizyon: <span className="font-mono text-slate-700">{currentLabel}</span>{' '}
              {revisions.length > 0 && (
                <span className="text-slate-400">· Son {revisions.length} kayıt tutuluyor</span>
              )}
            </p>
          </div>
          <button
            onClick={openSaveModal}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Değişiklikleri Kaydet
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400">Yükleniyor...</p>
        ) : revisions.length === 0 ? (
          <p className="text-xs text-slate-400">
            Henüz revizyon kaydedilmedi. İlk kaydı oluşturmak için &quot;Değişiklikleri Kaydet&quot;e tıklayın.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {revisions.map((r, idx) => (
              <li key={r.id} className="px-3 py-2.5 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-semibold text-slate-800">{r.label}</span>
                      {idx === 0 && (
                        <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Mevcut
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {formatDate(r.createdAt)} · {r.createdBy.name}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 truncate">{r.description}</p>
                    {r.detectedChanges && r.detectedChanges.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-slate-500 cursor-pointer select-none hover:text-slate-700">
                          {r.detectedChanges.length} değişiklik
                        </summary>
                        <ul className="mt-1 ml-3 space-y-0.5">
                          {r.detectedChanges.map((c, i) => (
                            <li key={i} className="text-[11px] text-slate-600">
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
                      className="shrink-0 text-xs px-2.5 py-1 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg"
                    >
                      Bu sürüme dön
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kaydet Modal */}
      <Modal open={open} onClose={() => { if (!saving) setOpen(false); }} title={`Yeni Revizyon — ${hintNextLabel}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Bu revizyonda yapılan değişiklikleri kısaca yazın..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              💡 İpucu — Tespit edilen değişiklikler
            </p>
            {hintLoading ? (
              <p className="text-xs text-slate-400">Karşılaştırılıyor...</p>
            ) : hintChanges.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Son revizyondan bu yana herhangi bir değişiklik tespit edilmedi.
              </p>
            ) : (
              <ul className="space-y-0.5 max-h-48 overflow-y-auto">
                {hintChanges.map((c, i) => (
                  <li key={i} className="text-xs text-slate-700">
                    <span className="font-medium">{c.field}:</span>{' '}
                    <span className="text-slate-400 font-mono">{c.before}</span>
                    {' → '}
                    <span className="text-slate-700 font-mono">{c.after}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              onClick={() => setOpen(false)}
              disabled={saving}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={!description.trim() || saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRestore !== null}
        title="Önceki sürüme dön"
        message={
          confirmRestore && (
            <>
              <strong>{confirmRestore.label}</strong> sürümüne dönülecek. Mevcut tüm değişiklikler bu
              snapshot ile değiştirilecek. Bu işlem geri alınamaz; ancak dönmeden önce bir revizyon
              kaydederseniz oraya geri dönebilirsiniz.
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
