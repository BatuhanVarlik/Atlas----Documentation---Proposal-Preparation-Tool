'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';

interface DetectedChange {
  field: string;
  before: string;
  after: string;
}

interface Props {
  moduleId: string;
}

export default function SaveRevisionButton({ moduleId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [hintChanges, setHintChanges] = useState<DetectedChange[]>([]);
  const [hintNextLabel, setHintNextLabel] = useState('RV-01');
  const [hintLoading, setHintLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setDescription('');
    setError('');
    setSavedLabel(null);
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
      setSavedLabel(json.data.label as string);
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Sayfa akışından bağımsız, ekranın sağ üst köşesinde sabit */}
      <div className="fixed top-16 right-6 z-30">
        <button
          onClick={openModal}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Değişiklikleri Kaydet
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => { if (!saving) setOpen(false); }}
        title={`Yeni Revizyon — ${hintNextLabel}`}
      >
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

          {savedLabel && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              ✓ {savedLabel} kaydedildi.
            </p>
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
              disabled={!description.trim() || saving || !!savedLabel}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
