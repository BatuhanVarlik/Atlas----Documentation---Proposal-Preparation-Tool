'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RevisionRow } from '@/lib/precalc/savedClient';
import { cn } from '@/lib/utils';

/**
 * Açık kaydın revizyon geçmişi — sekmelerin üstünde katlanır bir şerit.
 *
 * Kapalıyken yalnızca sayıyı gösterir: geçmiş her gün bakılan bir şey değil,
 * ama "bu teklifte ne değişmişti" sorusu geldiğinde elin altında olmalı.
 */
export default function RevisionBar({ revisions, currentId }: {
  revisions: RevisionRow[];
  currentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (revisions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-3 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-[10px] text-slate-400">{open ? '▾' : '▸'}</span>
        <span className="text-xs font-semibold text-slate-700">Revizyonlar</span>
        <span className="text-[11px] font-mono text-slate-400">{revisions.length}</span>
        {!open && (
          <span className="text-[11px] text-slate-400 truncate ml-2">
            son: {revisions[revisions.length - 1].revisionCode || '—'}
          </span>
        )}
      </button>

      {open && (
        <ol className="border-t border-slate-100 divide-y divide-slate-50">
          {[...revisions].reverse().map((r) => (
            <li key={r.id} className={cn('px-3 py-2', r.id === currentId && 'bg-blue-50/50')}>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] font-semibold text-slate-800 shrink-0">
                  {r.revisionCode || r.precalcNo}
                </span>
                {r.id === currentId ? (
                  <span className="text-[10px] text-blue-600 shrink-0">açık</span>
                ) : (
                  <Link
                    href={`/advanced-precalculation?id=${r.id}`}
                    className="text-[10px] text-blue-600 hover:underline shrink-0"
                  >
                    aç
                  </Link>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {r.revisionNote || 'açıklama girilmedi'}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
