'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Bu kadar aşağı inilince düğme görünür (px). */
const SHOW_AFTER = 600;

/**
 * Sağ alt köşede küçük "en üste çık" düğmesi.
 *
 * Sayfanın gerçek kaydırma kutusu belge değil, dashboard layout'undaki
 * `<main class="overflow-y-auto">`; scroll olayı kabarcıklanmadığı için
 * yakalama fazında dinlenir ve kaydıran kutu olayın hedefinden alınır.
 * Sanallaştırılmış uzun tablolarda yumuşak kaydırma binlerce satırı
 * tek tek çizdirip yavaşladığı için atlama anlık yapılır.
 */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const scrollerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollerRef.current = document.querySelector('main');
    const onScroll = (e: Event) => {
      const t = e.target;
      // Yalnızca sayfa kutusu (ya da belge) — tablo içi yatay kaydırmalar sayılmaz
      if (t instanceof HTMLElement && t.tagName === 'MAIN') scrollerRef.current = t;
      else if (t !== document) return;
      const top = scrollerRef.current?.scrollTop ?? window.scrollY;
      setVisible(Math.max(top, window.scrollY) > SHOW_AFTER);
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  function goTop() {
    scrollerRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="En üste çık"
      title="En üste çık"
      className={cn(
        'fixed right-4 z-40 w-8 h-8 rounded-full flex items-center justify-center',
        'bg-slate-800/80 text-white text-sm shadow-md hover:bg-slate-900 transition-opacity',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      tabIndex={visible ? 0 : -1}
    >
      ↑
    </button>
  );
}
