'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  filepath: string;
  placeholders: unknown;
  isActive: boolean;
  createdAt: Date | string;
}

interface Props {
  initialTemplates: Template[];
}

export default function TemplatesClient({ initialTemplates }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !name.trim()) { setUploadError('Dosya ve şablon adı gerekli'); return; }
    if (!file.name.endsWith('.docx')) { setUploadError('Yalnızca .docx dosyası yüklenebilir'); return; }

    setUploading(true); setUploadError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name.trim());
    fd.append('description', description.trim());

    try {
      const res = await fetch('/api/templates', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) { setUploadError(json.error ?? 'Hata'); return; }
      setTemplates((prev) => [json.data, ...prev]);
      setShowUpload(false);
      setName(''); setDescription('');
      if (fileRef.current) fileRef.current.value = '';
    } finally { setUploading(false); }
  }

  async function handleToggle(id: string, isActive: boolean) {
    const res = await fetch(`/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const json = await res.json();
    if (json.success) {
      setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, isActive: !isActive } : t));
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" şablonunu silmek istiyor musunuz? Bu işlem geri alınamaz.`)) return;
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    }
  }

  const placeholders = (t: Template) =>
    Array.isArray(t.placeholders) ? (t.placeholders as string[]) : [];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Şablonlar</h1>
          <p className="text-slate-500 text-sm mt-0.5">.docx teklif şablonlarını yönetin</p>
        </div>
        <button
          onClick={() => { setShowUpload(true); setUploadError(''); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >+ Şablon Yükle</button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Yeni Şablon</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Şablon Adı *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="örn: Standart Teklif Şablonu v2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Opsiyonel açıklama" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">.docx Dosyası *</label>
              <input ref={fileRef} type="file" accept=".docx"
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
            {uploadError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>
            )}
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setShowUpload(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
              <button onClick={handleUpload} disabled={uploading}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors">
                {uploading ? 'Yükleniyor...' : 'Yükle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">Henüz şablon yok. "+ Şablon Yükle" ile başlayın.</p>
          <p className="text-slate-400 text-xs mt-2">
            Word şablonunuzda <code className="bg-slate-100 px-1 rounded">{'{module.name}'}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{'{#fillingLines}...{/fillingLines}'}</code> gibi placeholder'lar kullanın.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-slate-800 text-sm">{t.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-slate-500 mb-2">{t.description}</p>
                  )}
                  <p className="text-xs text-slate-400 font-mono mb-2">{t.filename}</p>
                  {placeholders(t).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {placeholders(t).map((p) => (
                        <code key={p} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{p}</code>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className="text-xs text-slate-400">{formatDate(t.createdAt)}</span>
                  <button onClick={() => handleToggle(t.id, t.isActive)}
                    className="text-xs px-2.5 py-1 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                    {t.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                  </button>
                  <a href={t.filepath} download
                    className="text-xs px-2.5 py-1 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                    İndir
                  </a>
                  <button onClick={() => handleDelete(t.id, t.name)}
                    className="text-xs px-2.5 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
