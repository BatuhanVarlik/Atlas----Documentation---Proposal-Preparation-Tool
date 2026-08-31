'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import type { RawValue, RowMeta } from '@/lib/precalc/types';
import { cn } from '@/lib/utils';
import { formatCell } from './cellFormat';
import {
  PRECALC_COLUMNS,
  ROW_HEIGHT,
  ROW_NO_WIDTH,
  SCROLL_COLUMNS,
  SCROLL_WIDTH,
  STICKY_COLUMNS,
  STICKY_WIDTH,
  type PrecalcColumn,
} from './columns';
import { EditableCell } from './EditableCell';

interface Props {
  engine: PrecalcEngine;
  rows: RowMeta[];
  /** Girdi değiştikçe artan sürüm — hücrelerin tazelenmesini tetikler. */
  version: number;
  onSetCell: (addr: string, value: RawValue) => void;
}

/** Ekranın dışında da render edilecek satır sayısı (kaydırma pürüzsüzlüğü). */
const OVERSCAN = 12;

const SECTION_STYLE: Record<number, string> = {
  1: 'bg-slate-700 text-white font-semibold text-[11px] tracking-wide uppercase',
  2: 'bg-slate-200 text-slate-800 font-semibold text-[11px]',
  3: 'bg-slate-100 text-slate-700 font-medium text-[11px]',
  4: 'bg-blue-50 text-blue-800 font-medium text-[11px]',
};

export default function PrecalcTable({ engine, rows, version, onSetCell }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const resize = () => setViewportHeight(el.clientHeight);
    resize();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Filtre değişince başa dön
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [rows]);

  const { start, end, offsetY } = useMemo(() => {
    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visible = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const last = Math.min(rows.length, first + visible);
    return { start: first, end: last, offsetY: first * ROW_HEIGHT };
  }, [scrollTop, viewportHeight, rows.length]);

  const slice = rows.slice(start, end);
  const totalHeight = rows.length * ROW_HEIGHT;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      {/* Başlık satırı */}
      <div className="flex border-b-2 border-slate-300 bg-slate-50 shrink-0">
        <div
          className="flex shrink-0 sticky left-0 z-20 bg-slate-50 border-r-2 border-slate-300"
          style={{ width: STICKY_WIDTH }}
        >
          <HeaderCell width={ROW_NO_WIDTH} label="Satır" align="right" />
          {STICKY_COLUMNS.map((c) => (
            <HeaderCell key={c.col} width={c.width} label={c.label} col={c.col} editable={c.editable} />
          ))}
        </div>
        <div className="flex" style={{ width: SCROLL_WIDTH }}>
          {SCROLL_COLUMNS.map((c) => (
            <HeaderCell
              key={c.col}
              width={c.width}
              label={c.label}
              col={c.col}
              align={c.align}
              editable={c.editable}
              computed={c.computed}
            />
          ))}
        </div>
      </div>

      {/* Gövde */}
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: '62vh' }}>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Filtreye uyan satır yok.
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative', width: STICKY_WIDTH + SCROLL_WIDTH }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {slice.map((row) => (
                <Row
                  key={row.r}
                  row={row}
                  engine={engine}
                  version={version}
                  onSetCell={onSetCell}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HeaderCell({
  width, label, col, align = 'left', editable, computed,
}: {
  width: number; label: string; col?: string;
  align?: 'left' | 'right' | 'center'; editable?: boolean; computed?: boolean;
}) {
  return (
    <div
      className={cn(
        'shrink-0 px-2 py-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 leading-tight',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        editable && 'text-blue-700',
        computed && 'text-slate-400',
      )}
      style={{ width }}
      title={col ? `Excel sütunu: ${col}${editable ? ' · veri girişi' : computed ? ' · formülle hesaplanır' : ''}` : undefined}
    >
      {label}
      {col && <span className="ml-1 font-normal text-slate-300">{col}</span>}
    </div>
  );
}

function Row({
  row, engine, version, onSetCell,
}: {
  row: RowMeta; engine: PrecalcEngine; version: number; onSetCell: (addr: string, v: RawValue) => void;
}) {
  if (row.kind === 'section') {
    return (
      <div
        className={cn('flex items-center px-3 border-b border-slate-200 sticky left-0', SECTION_STYLE[row.level ?? 3])}
        style={{ height: ROW_HEIGHT, width: STICKY_WIDTH + SCROLL_WIDTH }}
      >
        <span className="sticky left-3">
          {row.title}
          {row.abbr && <span className="ml-2 opacity-60 font-normal">({row.abbr})</span>}
        </span>
      </div>
    );
  }

  const hasQty = engine.num('F' + row.r) > 0;
  const missingPrice = hasQty && engine.num('I' + row.r) === 0;

  return (
    <div
      className={cn(
        'flex border-b border-slate-100 group',
        hasQty ? 'bg-emerald-50/60' : 'hover:bg-slate-50',
      )}
      style={{ height: ROW_HEIGHT }}
    >
      <div
        className={cn(
          'flex shrink-0 sticky left-0 z-10 border-r-2 border-slate-200',
          hasQty ? 'bg-emerald-50' : 'bg-white group-hover:bg-slate-50',
        )}
        style={{ width: STICKY_WIDTH }}
      >
        <div
          className="shrink-0 px-2 flex items-center justify-end text-[10px] text-slate-400 font-mono border-r border-slate-100"
          style={{ width: ROW_NO_WIDTH }}
        >
          {row.r}
        </div>
        {STICKY_COLUMNS.map((c) => (
          <Cell key={c.col} column={c} row={row} engine={engine} version={version} onSetCell={onSetCell} />
        ))}
      </div>

      <div className="flex" style={{ width: SCROLL_WIDTH }}>
        {SCROLL_COLUMNS.map((c) => (
          <Cell
            key={c.col}
            column={c}
            row={row}
            engine={engine}
            version={version}
            onSetCell={onSetCell}
            warn={c.col === 'I' && missingPrice}
          />
        ))}
      </div>
    </div>
  );
}

function Cell({
  column, row, engine, onSetCell, warn,
}: {
  column: PrecalcColumn; row: RowMeta; engine: PrecalcEngine;
  version: number; onSetCell: (addr: string, v: RawValue) => void; warn?: boolean;
}) {
  const addr = column.col + row.r;
  const value = engine.value(addr);

  // Excel'de formüllü hücreler kullanıcıya kapalıdır; kalan sütunlar açıktır.
  const isEditable = !!column.editable && !engine.hasFormula(addr)
    && (row.kind === 'item' || row.kind === 'summary');

  if (isEditable) {
    return (
      <div
        className={cn('shrink-0 border-r border-slate-100 flex items-center', warn && 'bg-red-50')}
        style={{ width: column.width }}
        title={warn ? 'Miktar girildi ama liste fiyatı boş — fiyatı elle girin.' : undefined}
      >
        <EditableCell
          value={value}
          format={column.format}
          align={column.align}
          edited={engine.isUserEntry(addr)}
          onCommit={(v) => onSetCell(addr, v)}
        />
      </div>
    );
  }

  const text = formatCell(value, column.format);

  return (
    <div
      className={cn(
        'shrink-0 px-2 border-r border-slate-100 flex items-center text-xs truncate',
        column.align === 'right' && 'justify-end font-mono',
        column.align === 'center' && 'justify-center',
        column.computed ? 'text-slate-500' : 'text-slate-700',
        column.col === 'M' && 'font-semibold text-slate-800',
        column.col === 'N' && 'font-semibold text-emerald-700',
      )}
      style={{ width: column.width }}
      title={text || undefined}
    >
      <span className="truncate">{text}</span>
    </div>
  );
}

export { PRECALC_COLUMNS };
