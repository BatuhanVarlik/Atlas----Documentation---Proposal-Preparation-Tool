'use client';

import { useEffect, useState } from 'react';
import { autoSelectPump, type AutoPumpResult } from '@/lib/pumps/autoSelect';

/**
 * Kapasite (L/h) ve basınç (bar) değiştikçe otomatik pompa önerisi getirir.
 * Debounce'lu — kullanıcı yazarken her tuşta istek atmaz.
 * Önermeyi forma UYGULAMAZ; sadece öneriyi döndürür (uygulama formda yapılır).
 */
export function useAutoPumpSelection(capacityLh: number, pressureBar: number) {
  const [suggestion, setSuggestion] = useState<AutoPumpResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!(capacityLh > 0) || !(pressureBar > 0)) {
      setSuggestion(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await autoSelectPump(capacityLh, pressureBar);
        if (cancelled) return;
        setSuggestion(r);
        setError(r ? null : 'Bu duty point için uygun pompa bulunamadı');
      } catch {
        if (!cancelled) setError('Pompa seçimine ulaşılamadı');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [capacityLh, pressureBar]);

  return { suggestion, loading, error };
}
