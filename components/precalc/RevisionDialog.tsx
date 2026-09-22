'use client';

import { useState } from 'react';

/**
 * Revizyon kaydedilirken açılan onay penceresi.
 *
 * Sistemin ürettiği fark metni hazır gelir; kaydeden kişi düzeltebilir ya da
 * kendi notunu ekleyebilir. Metin, kaydın ÖZET sayfasına da yazılacağı için
 * son sözü insanın söylemesi doğru.
 */
export default function RevisionDialog({ suggestion, precalcNo, onCancel, onConfirm }: {
  suggestion: string;
  precalcNo: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState(suggestion);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Revizyon olarak kaydet</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            <span className="font-mono">{precalcNo}</span> yeni bir kayıt olarak açılacak;
            önceki revizyon listede kalacak.
          </p>
        </div>

        <div className="p-4">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
            Revizyon açıklaması
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Değişiklikler otomatik çıkarıldı. Düzenleyebilir ya da ekleme yapabilirsiniz —
            bu metin Excel&apos;in ÖZET sayfasına da yazılır.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 h-8 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            onClick={() => onConfirm(note.trim())}
            className="px-3 h-8 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Revizyonu Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
