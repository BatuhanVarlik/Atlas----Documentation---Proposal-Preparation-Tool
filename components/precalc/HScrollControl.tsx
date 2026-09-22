'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';

/** Bir kayan kutunun thumb konum/genişliğini (0-1 oranında) hesaplar. */
export function computeThumbRect(state: { scrollLeft: number; scrollWidth: number; clientWidth: number }) {
  const { scrollLeft, scrollWidth, clientWidth } = state;
  if (scrollWidth <= clientWidth) return { left: 0, width: 1 };
  const width = Math.max(0.08, clientWidth / scrollWidth);
  const maxLeft = 1 - width;
  const range = scrollWidth - clientWidth;
  const left = range > 0 ? maxLeft * (scrollLeft / range) : 0;
  return { left, width };
}

const STEP = 160;

interface Props {
  /** Yatay kaydırılan hedef elementin ref'i (ör. tabloyu saran overflow-x kutusu). */
  targetRef: RefObject<HTMLElement | null>;
  /** Hedefin içeriği değişince (sütun sayısı vb.) yeniden ölçmek için. */
  watch?: unknown;
}

/**
 * Ekranın altına sabit, kompakt yatay kaydırma kontrolü. Hedef elementin
 * native `overflow-x: auto` scroll'unu okur/yazar — kaydırma fiziği
 * (trackpad, shift+wheel, klavye) native scrollbar'dan devralınır, yalnızca
 * görsel scrollbar bu bileşenle değiştirilir (bkz. globals.css `.hscroll-hidden`).
 */
export default function HScrollControl({ targetRef, watch }: Props) {
  const [state, setState] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    setState({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [targetRef, measure, watch]);

  function scrollByStep(dir: 1 | -1) {
    targetRef.current?.scrollBy({ left: dir * STEP, behavior: 'smooth' });
  }

  function moveTo(clientX: number) {
    const track = trackRef.current;
    const el = targetRef.current;
    if (!track || !el) return;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  }

  function onTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  }
  function onTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    moveTo(e.clientX);
  }
  function onTrackPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    trackRef.current?.releasePointerCapture(e.pointerId);
  }

  const canScroll = state.scrollWidth > state.clientWidth + 1;
  if (!canScroll) return null;

  const thumb = computeThumbRect(state);

  return (
    <div
      className={cn(
        'fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1',
        'rounded-full border border-slate-200 bg-slate-50/95 backdrop-blur px-1.5 py-1 shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={() => scrollByStep(-1)}
        aria-label="Sola kaydır"
        className="w-5 h-5 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 text-xs leading-none"
      >
        ‹
      </button>
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        className="relative w-28 h-2 rounded-full bg-slate-200 cursor-pointer"
      >
        <div
          className="absolute top-0 h-2 rounded-full bg-slate-500"
          style={{ left: `${thumb.left * 100}%`, width: `${thumb.width * 100}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => scrollByStep(1)}
        aria-label="Sağa kaydır"
        className="w-5 h-5 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 text-xs leading-none"
      >
        ›
      </button>
    </div>
  );
}
