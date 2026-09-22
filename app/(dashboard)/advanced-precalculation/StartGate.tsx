'use client';

import { useState } from 'react';
import type { CatalogItem, CatalogMeta } from '@/lib/precalc/catalog';
import { clearDraft, readCurrentDocId, setCurrentDocId } from '@/components/precalc/precalcDraft';
import AdvancedPrecalculationClient from './AdvancedPrecalculationClient';

interface Props {
  items: CatalogItem[];
  meta: CatalogMeta;
  canEditCatalog: boolean;
  rawCatalogItems: CatalogItem[];
  userName: string;
}

/**
 * Çıplak `/advanced-precalculation` URL'sinde (yani `?id=` yokken) önce iki
 * büyük butonla karşılar: yeni bir teklife mi başlanacak, yoksa tarayıcıda
 * kayıtlı en son taslakla mı devam edilecek. `?id=` ile belirli bir kayıt
 * açılıyorsa bu ekran hiç gösterilmez — `page.tsx` bu bileşeni yalnızca
 * docId yokken render eder.
 *
 * Seçim yapılana kadar `AdvancedPrecalculationClient` (dolayısıyla
 * `usePrecalc`'ın çalışma kitabı indirmesi) hiç mount edilmez.
 */
export default function StartGate(props: Props) {
  const [started, setStarted] = useState(false);

  function startNew() {
    // Aktif taslağı (ve işaret ettiği kaydı) temizle — usePrecalc mount
    // olduğunda readCurrentDocId() artık null döner, boş bir teklifle başlar.
    // Başka kayıtların kendi taslakları (ör. yarım bırakılmış başka bir
    // teklif) buna dokunulmaz.
    clearDraft(readCurrentDocId());
    setCurrentDocId(null);
    setStarted(true);
  }

  if (!started) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-md w-full">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Advanced Precalculation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
            Nasıl devam etmek istersin?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={startNew}
              className="flex-1 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Yeni Precalculation Oluştur
            </button>
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="flex-1 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Kaldığın Yerden Devam Et
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AdvancedPrecalculationClient {...props} docId={null} />;
}
