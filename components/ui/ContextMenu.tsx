'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  divider?: never;
}

export interface ContextMenuDivider {
  divider: true;
  label?: never;
  onClick?: never;
  variant?: never;
  disabled?: never;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface Props {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

/** Menü genişliği — açan düğme, menüyü kendi kenarına hizalarken bunu kullanır. */
export const MENU_WIDTH = 200;
const ITEM_HEIGHT = 34;
const DIVIDER_HEIGHT = 9;

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onScroll() { onClose(); }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  useEffect(() => {
    // Ekran kenarından taşmasın
    const estimatedHeight = items.reduce(
      (h, it) => h + ('divider' in it && it.divider ? DIVIDER_HEIGHT : ITEM_HEIGHT),
      8
    );
    const maxLeft = window.innerWidth - MENU_WIDTH - 8;
    const maxTop = window.innerHeight - estimatedHeight - 8;
    setPos({
      left: Math.min(x, maxLeft),
      top: Math.min(y, maxTop),
    });
  }, [x, y, items]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 bg-white dark:bg-[#0a2147] border border-slate-200 dark:border-white/15 rounded-lg shadow-xl py-1 text-sm"
      style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
    >
      {items.map((entry, i) => {
        if ('divider' in entry && entry.divider) {
          return <div key={`d-${i}`} className="my-1 h-px bg-slate-200 dark:bg-white/10" />;
        }
        const item = entry as ContextMenuItem;
        const isDanger = item.variant === 'danger';
        return (
          <button
            key={`i-${i}`}
            role="menuitem"
            onClick={() => { if (!item.disabled) { item.onClick(); onClose(); } }}
            disabled={item.disabled}
            className={`block w-full text-left px-3 py-1.5 transition-colors ${
              item.disabled
                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : isDanger
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
