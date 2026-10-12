'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

/** Görünür aralığın üstüne/altına fazladan çizilen satır sayısı. */
const OVERSCAN = 10;

/**
 * Kalemler tablosundaki sanallaştırmanın (AdvancedPrecalculationClient)
 * diğer sekmeler için ortak hâli: tablo sayfayla birlikte akar (tek native
 * dikey scroll), yalnızca ekrandaki satır aralığı çizilir; üst/alt boşluk
 * dolgu satırlarıyla korunur.
 *
 * `rowHeights` her satırın sabit yüksekliğidir (px). `tableRef` gövde
 * tablosunu saran kutudur; viewport'a göre üst kenarı ölçülür.
 */
export function useWindowVirtualRows(
  tableRef: RefObject<HTMLElement | null>,
  rowHeights: number[],
  /** Değişince ölçüm yeniden kurulur (ör. sekme / sayfa adı). */
  resetKey?: unknown,
) {
  const [viewport, setViewport] = useState({ top: 0, height: 800 });
  const frameRef = useRef(0);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const measure = () => {
      frameRef.current = 0;
      // Elementin üst kenarı ekranın üstünün ne kadar üzerindeyse o kadar
      // satır "geçilmiş" demektir.
      const top = Math.max(0, -el.getBoundingClientRect().top);
      const height = window.innerHeight;
      setViewport((prev) => (prev.top === top && prev.height === height ? prev : { top, height }));
    };
    const schedule = () => { if (!frameRef.current) frameRef.current = requestAnimationFrame(measure); };
    measure();
    // capture: sayfanın gerçek kaydırma kutusu dashboard'daki <main>;
    // scroll olayı kabarcıklanmadığı için yakalama fazında dinlenir
    // (ayrıntı: AdvancedPrecalculationClient viewport effect'i).
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [tableRef, resetKey]);

  /** Önek toplamı: offsets[i] = i. satırın üst kenarı. */
  const offsets = useMemo(() => {
    const out = new Array<number>(rowHeights.length + 1);
    let y = 0;
    for (let i = 0; i < rowHeights.length; i++) { out[i] = y; y += rowHeights[i]; }
    out[rowHeights.length] = y;
    return out;
  }, [rowHeights]);

  return useMemo(
    () => sliceWindow(offsets, viewport.top, viewport.height, OVERSCAN),
    [offsets, viewport],
  );
}

/**
 * Önek toplamı dizisinde [top, top+height] aralığını kapsayan satırlar.
 * Saf fonksiyon — test edilebilir.
 */
export function sliceWindow(offsets: number[], top: number, height: number, overscan: number) {
  const count = offsets.length - 1;
  const seek = (target: number) => {
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] < target) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  const start = Math.max(0, seek(top) - overscan);
  const end = Math.min(count, seek(top + height) + overscan);
  return {
    start,
    end,
    padTop: offsets[start] ?? 0,
    padBottom: (offsets[count] ?? 0) - (offsets[end] ?? 0),
  };
}

/**
 * Başlık şeridini gövdenin yatay konumuna eşler (başlık sticky olabilsin
 * diye gövdeden ayrı bir kutudadır — bkz. AdvancedPrecalculationClient).
 */
export function useSyncHeaderScroll(
  bodyRef: RefObject<HTMLElement | null>,
  headRef: RefObject<HTMLElement | null>,
  resetKey?: unknown,
) {
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const sync = () => {
      const head = headRef.current;
      if (head && head.scrollLeft !== body.scrollLeft) head.scrollLeft = body.scrollLeft;
    };
    sync();
    body.addEventListener('scroll', sync, { passive: true });
    return () => body.removeEventListener('scroll', sync);
  }, [bodyRef, headRef, resetKey]);
}
