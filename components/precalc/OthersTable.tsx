'use client';

import { useMemo, useState } from 'react';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import type { RawValue, RowMeta } from '@/lib/precalc/types';
import { cn } from '@/lib/utils';
import { EditableCell } from './EditableCell';
import { formatCell } from './cellFormat';
import type { CellFormat } from './columns';

interface Props {
  engine: PrecalcEngine;
  /** settledVersion — hesap durunca değerleri tazelemek için. */
  version: number;
  currency: string;
  onSetCell: (addr: string, value: RawValue) => void;
}

/**
 * OTHERS bölümünün sütun düzeni.
 *
 * Kitabın asıl değerleri F–N arasındadır (miktar, kalem adı, birim fiyat,
 * çarpanlar, maliyet, satış); kimlik sütunları A–E bu blokta çoğu satırda
 * boştur. Bu yüzden önce F–N, sonra A–E, en sonda O gösterilir. Blok dar
 * olduğu için hiçbir sütun sola sabitlenmez — tablo bir bütün olarak kayar.
 */
const OTHERS_COLUMNS: {
  col: string; label: string; width: number; format: CellFormat; align?: 'right';
}[] = [
  { col: 'F', label: 'Miktar (F)', width: 110, format: 'number', align: 'right' },
  { col: 'G', label: 'Kaynak (G)', width: 95, format: 'number', align: 'right' },
  { col: 'H', label: 'Kalem (H)', width: 330, format: 'text' },
  { col: 'I', label: 'Birim / Matrah (I)', width: 135, format: 'money', align: 'right' },
  { col: 'J', label: 'Çarpan (J)', width: 105, format: 'number', align: 'right' },
  { col: 'K', label: 'Ek Çarpan (K)', width: 110, format: 'number', align: 'right' },
  { col: 'L', label: 'Nakliye (L)', width: 115, format: 'money', align: 'right' },
  { col: 'M', label: 'Maliyet (M)', width: 130, format: 'money', align: 'right' },
  { col: 'N', label: 'Satış (N)', width: 130, format: 'money', align: 'right' },

  { col: 'A', label: 'Kullanım Yeri (A)', width: 190, format: 'text' },
  { col: 'B', label: 'Ekipman No (B)', width: 150, format: 'text' },
  { col: 'C', label: 'Teknik Açıklama (C)', width: 260, format: 'text' },
  { col: 'D', label: 'Etiket (D)', width: 110, format: 'text' },
  { col: 'E', label: 'Tedarikçi (E)', width: 160, format: 'text' },

  { col: 'O', label: 'Fiyat Uyarısı (O)', width: 120, format: 'number', align: 'right' },
];

/** Ağaç sütununun (satır no + katlama düğmesi) genişliği. */
const TREE_WIDTH = 138;

/** Bir OTHERS satırı ve Excel gruplamasından gelen çocukları. */
interface OthersNode {
  row: RowMeta;
  /** Excel satır gruplama seviyesi — girinti ve kalınlık buradan gelir. */
  depth: number;
  children: OthersNode[];
}

export default function OthersTable({ engine, version, currency, onSetCell }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  /* ---- Excel'in satır gruplamasından ağaç ---- */
  const { tree, parents } = useMemo(() => {
    const { othersRow, subtotalRow } = engine.anchors;
    const rows = engine.workbook.outline.filter(
      (r) => r.r > othersRow && r.r < subtotalRow && r.kind === 'item',
    );

    const roots: OthersNode[] = [];
    /** Açık dalların yığını — seviye düştükçe geri sarılır. */
    const stack: OthersNode[] = [];
    const withChildren: number[] = [];

    for (const row of rows) {
      const depth = Math.max(1, row.lvl ?? 1);
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      const node: OthersNode = { row, depth, children: [] };
      const parent = stack[stack.length - 1];
      if (parent) {
        if (parent.children.length === 0) withChildren.push(parent.row.r);
        parent.children.push(node);
      } else {
        roots.push(node);
      }
      stack.push(node);
    }

    return { tree: roots, parents: withChildren };
  }, [engine]);

  /** Görünen satırlar — kapalı dalların çocukları çizilmez. */
  const visible = useMemo(() => {
    const out: OthersNode[] = [];
    const walk = (nodes: OthersNode[]) => {
      for (const n of nodes) {
        out.push(n);
        if (n.children.length > 0 && expanded.has(n.row.r)) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree, expanded]);

  const totalWidth = TREE_WIDTH + OTHERS_COLUMNS.reduce((s, c) => s + c.width, 0);
  const { manualFormulaStart, manualFormulaEnd, gateRows } = engine.anchors;
  const gates = new Set(gateRows);

  /*
   * Açık pano anahtarları. Üç pano tipi gerçekte birbirinin alternatifidir;
   * birden fazlası seçilirse hepsi fiyata girer ve teklif şişer. Formül
   * bunu engellemez (kullanıcı isterse ikisini de açabilmeli), ama sessiz
   * kalmak yanlış — durum şeritte söylenir.
   */
  const openGates = gateRows.filter((r) => engine.num('F' + r) === 1);

  function toggle(row: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setExpanded(new Set(parents))}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 transition-colors"
        >
          Tümünü Aç
        </button>
        <button
          onClick={() => setExpanded(new Set())}
          disabled={expanded.size === 0}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          Tümünü Kapat
        </button>
        {openGates.length > 1 && (
          <span
            title="Pano tipleri birbirinin alternatifidir; ikisi de açıkken ikisinin de malzemesi teklife girer."
            className="px-2 py-1 rounded-md bg-amber-50 border border-amber-300 text-[11px] text-amber-900"
          >
            ⚠ {openGates.length} pano bloğu birden açık ({openGates.join(', ')}) — tutarlar toplanıyor
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border border-violet-200 bg-violet-50 inline-block" />
            formül
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border border-amber-300 bg-amber-50 inline-block" />
            elle girildi · ↺ şablona döner
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border border-blue-300 bg-blue-50 inline-block" />
            blok anahtarı
          </span>
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Yatayda hiçbir sütun sabitlenmez: blok bir bütün olarak kayar. */}
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
          <table
            className="text-xs table-fixed border-separate"
            style={{ borderSpacing: 0, width: '100%', minWidth: totalWidth }}
          >
            <colgroup>
              <col style={{ width: TREE_WIDTH }} />
              {OTHERS_COLUMNS.map((c) => <col key={c.col} style={{ width: c.width }} />)}
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-300 border-r border-r-slate-200 px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600">
                  Satır
                </th>
                {OTHERS_COLUMNS.map((c) => (
                  <th
                    key={c.col}
                    className={cn(
                      'sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-300 border-r border-r-slate-200',
                      'px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 whitespace-nowrap',
                      c.align === 'right' && 'text-right',
                    )}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-300" />
              </tr>
            </thead>
            <tbody>
              {visible.map((node) => (
                <OthersRow
                  key={node.row.r}
                  node={node}
                  engine={engine}
                  version={version}
                  open={expanded.has(node.row.r)}
                  isGate={gates.has(node.row.r)}
                  manualStart={manualFormulaStart}
                  manualEnd={manualFormulaEnd}
                  onToggle={() => toggle(node.row.r)}
                  onSetCell={onSetCell}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        OTHERS bölümü nakliye, sigorta, pano, lisans ve mühendislik / montaj kalemlerini
        taşır. Satırlar Excel&apos;in kendi gruplamasıyla ağaç olarak listelenir; koyu
        başlıklar açılıp kapanır. Pano başlıkları ({gateRows.join(', ')}) birer anahtardır:
        Miktar (F) hücresine <span className="font-mono">1</span> yazdığınızda o bloğun
        formülleri çalışır, yazmadığınızda blok teklife girmez. Anahtar yalnızca kendi
        bloğunu açar; birden fazlasını açarsanız hepsi hesaplanır ve tutarlar toplanır.
        {' '}{manualFormulaStart}–{manualFormulaEnd} arası mühendislik / montaj satırlarında
        formülün verdiği adam-gün sayısının üzerine yazabilirsiniz; ↺ şablondaki formülü
        geri getirir. Tutarlar {currency} cinsindendir.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Derinliğe göre satır görünümü — Excel'deki koyu başlık kırılımı. */
const DEPTH_TONE = [
  { row: 'bg-blue-50/70', text: 'font-semibold text-blue-900' },
  { row: 'bg-slate-50', text: 'font-semibold text-slate-800' },
  { row: 'bg-white', text: 'text-slate-700' },
];

function OthersRow({
  node, engine, version, open, isGate, manualStart, manualEnd, onToggle, onSetCell,
}: {
  node: OthersNode;
  engine: PrecalcEngine;
  version: number;
  open: boolean;
  /** F hücresine 1 yazılmadıkça altındaki blok hesaplanmayan başlık mı. */
  isGate: boolean;
  manualStart: number;
  manualEnd: number;
  onToggle: () => void;
  onSetCell: (addr: string, value: RawValue) => void;
}) {
  const r = node.row.r;
  const tone = DEPTH_TONE[Math.min(node.depth - 1, DEPTH_TONE.length - 1)];
  const hasChildren = node.children.length > 0;
  const manual = r >= manualStart && r <= manualEnd;

  return (
    <tr className={cn('group', tone.row, 'hover:bg-slate-100/70')}>
      <td className="px-2 py-1 border-r border-b border-slate-100 align-middle">
        <div className="flex items-center gap-1" style={{ paddingLeft: (node.depth - 1) * 12 }}>
          {hasChildren ? (
            <button
              onClick={onToggle}
              aria-expanded={open}
              className="w-4 h-4 flex items-center justify-center rounded text-[9px] text-slate-500 hover:bg-black/10 shrink-0"
            >
              {open ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="font-mono text-[10px] text-slate-400">{r}</span>
          {isGate && (
            <span
              title="Blok anahtarı — Miktar (F) hücresine 1 yazdığınızda bu bloğun formülleri çalışır; yazmadıkça blok 0 döndürür."
              className="ml-0.5 text-[9px] px-1 rounded bg-blue-100 text-blue-700 font-medium shrink-0"
            >
              anahtar
            </span>
          )}
        </div>
      </td>

      {OTHERS_COLUMNS.map((c) => (
        <td
          key={c.col}
          className={cn(
            'px-2 py-1 border-r border-b border-slate-100 align-middle overflow-hidden',
            c.align === 'right' && 'text-right',
            // Kalem adı satırın başlığıdır: gruplama kalınlığını o taşır.
            c.col === 'H' && tone.text,
          )}
        >
          <OthersCell
            engine={engine}
            version={version}
            addr={c.col + r}
            format={c.format}
            align={c.align ?? (c.format === 'text' ? 'left' : 'right')}
            manual={manual}
            highlight={isGate && c.col === 'F'}
            onSetCell={onSetCell}
          />
        </td>
      ))}
      <td className="border-b border-slate-100" />
    </tr>
  );
}

/**
 * OTHERS hücresi.
 *
 * Formülsüz hücreler doğrudan yazılabilir. Formüllü hücreler kural olarak
 * salt okunurdur; yalnızca mühendislik / montaj bloğunda (manual) formülün
 * üzerine yazılabilir — orada hesabın verdiği adam-gün sayısı teklifin
 * kapsamına göre elle düzeltilir. Elle yazılmış her hücrede ↺ vardır ve
 * şablondaki formülü geri getirir.
 */
function OthersCell({
  engine, addr, format, align, manual, highlight, onSetCell,
}: {
  engine: PrecalcEngine;
  /** Yeniden çizim tetikleyicisi — motor sonuçları mutasyonla değişir. */
  version: number;
  addr: string;
  format: CellFormat;
  align: 'left' | 'right';
  manual: boolean;
  highlight?: boolean;
  onSetCell: (addr: string, value: RawValue) => void;
}) {
  const value = engine.value(addr);
  const isFormula = engine.hasFormula(addr);
  const edited = engine.isUserEntry(addr);
  const editable = !isFormula || manual;

  if (!editable) {
    const text = formatCell(value, format);
    return (
      <div
        title={`Formülle hesaplanır — düzenlenemez\n=${engine.formulaOf(addr)}`}
        className={cn(
          'px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50',
          'font-mono text-[11px] truncate cursor-default',
          text ? 'text-violet-700' : 'text-violet-300',
          align === 'right' ? 'text-right' : 'text-left',
        )}
      >
        {text || '–'}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', highlight && 'rounded ring-1 ring-blue-300')}>
      <span className="flex-1 min-w-0">
        <EditableCell
          value={value}
          format={format}
          align={align}
          edited={edited}
          onCommit={(v) => onSetCell(addr, v)}
        />
      </span>
      {edited && (
        <button
          onClick={() => onSetCell(addr, null)}
          title={isFormula
            ? `Şablondaki formüle dön\n=${engine.formulaOf(addr)}`
            : 'Şablondaki değere dön'}
          className="shrink-0 w-4 text-[11px] leading-none text-slate-400 hover:text-slate-800"
        >
          ↺
        </button>
      )}
    </div>
  );
}
