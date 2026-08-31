'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import { indexToCol, isError } from '@/lib/precalc/formula';
import type { PrecalcEntries, RawValue } from '@/lib/precalc/types';
import { downloadSheetExcel } from '@/lib/precalc/sheetExportClient';
import { cn, formatNumberTR } from '@/lib/utils';
import { parseEditText } from './cellFormat';

interface Props {
  engine: PrecalcEngine;
  sheetName: string;
  version: number;
  /**
   * Verilirse formülsüz hücreler düzenlenebilir olur. Girilen değer çalışma
   * kitabına yazılır ve bağlı bütün sayfalar (PRECALCULATION dahil) yeniden
   * hesaplanır. Verilmezse ızgara salt okunurdur.
   */
  onSetCell?: (sheet: string, addr: string, value: RawValue) => void;
  /**
   * Verilirse sayfa Excel'e aktarılabilir. Dosya sunucuda üretildiği için
   * hesap orada yeniden koşar; buradan yalnızca kullanıcı girdileri gider.
   */
  getEntries?: () => PrecalcEntries;
}

/** Bir hücrenin ekrandaki metni. */
function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (isError(v)) return v.code;
  if (typeof v === 'boolean') return v ? 'EVET' : 'HAYIR';
  if (typeof v === 'number') {
    if (v === 0) return '0';
    const rounded = Math.round(v * 100) / 100;
    return Number.isInteger(rounded)
      ? formatNumberTR(rounded, { decimals: 0 })
      : formatNumberTR(rounded, { decimals: 2 });
  }
  return String(v);
}

/** Düzenleme kutusuna konacak ham metin. */
function editText(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (isError(v)) return '';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return String(v);
}

/**
 * PRECALCULATION dışındaki sayfaları hücre ızgarasında gösterir.
 * Değerler hesap motorundan gelir: PRECALCULATION'a girilen miktarlar
 * buradaki formülleri, buraya girilen değerler de PRECALCULATION'ı besler.
 */
export default function SheetGrid({ engine, sheetName, version, onSetCell, getEntries }: Props) {
  /** Şu an düzenlenen hücre — aynı anda yalnızca biri kutuya dönüşür. */
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Hücreler memo'lu; geri çağrıların kimliği sabit kalmalı ki tıklamada
  // binlerce hücre yeniden çizilmesin.
  const startEdit = useCallback((addr: string) => setEditing(addr), []);
  const stopEdit = useCallback(() => setEditing(null), []);

  // Sayfa değişince açık kalmış düzenlemeyi ve hata uyarısını kapat
  useEffect(() => { setEditing(null); setExportError(null); }, [sheetName]);

  async function exportSheet() {
    if (!getEntries) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadSheetExcel(sheetName, getEntries());
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Excel oluşturulamadı.');
    } finally {
      setExporting(false);
    }
  }

  const grid = useMemo(() => {
    const data = engine.workbook.sheets[sheetName];
    if (!data) return null;

    // Dolu hücrelerden gerçek sınırları çıkar (Excel'in !ref'i abartılı olabilir)
    let maxRow = 0;
    let maxCol = 0;
    const addrs = [...Object.keys(data.v), ...Object.keys(data.f)];
    for (const addr of addrs) {
      const m = /^([A-Z]+)(\d+)$/.exec(addr);
      if (!m) continue;
      const row = parseInt(m[2], 10);
      let col = 0;
      for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }
    return { maxRow, maxCol: Math.min(maxCol, 40) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, sheetName, version]);

  if (!grid || grid.maxRow === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-sm text-slate-400">
        Bu sayfa boş.
      </div>
    );
  }

  const rows = Array.from({ length: grid.maxRow }, (_, i) => i + 1);
  const cols = Array.from({ length: grid.maxCol }, (_, i) => indexToCol(i));
  const editable = !!onSetCell;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h3 className="text-xs font-semibold text-slate-700">{sheetName}</h3>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[11px] text-slate-400 text-right">
            {grid.maxRow} satır · değerler PRECALCULATION girdilerine göre canlı hesaplanır
            {editable
              ? ' · formülsüz hücrelere tıklayıp yazabilirsiniz'
              : ' · salt okunur'}
          </span>
          {getEntries && (
            <button
              onClick={exportSheet}
              disabled={exporting}
              title={`"${sheetName}" sayfasını, ekrandaki hesaplanmış değerleriyle Excel dosyası olarak indirir.`}
              className={cn(
                'shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-700',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {exporting ? 'Hazırlanıyor…' : "Excel'e Aktar"}
            </button>
          )}
        </div>
        {exportError && (
          <p className="w-full text-[11px] text-red-600">{exportError}</p>
        )}
      </div>
      <div className="overflow-auto" style={{ maxHeight: '68vh' }}>
        <table className="text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] text-slate-400 font-mono w-12" />
              {cols.map((c) => (
                <th key={c} className="bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] text-slate-400 font-mono font-normal min-w-[90px]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="hover:bg-slate-50">
                <td className="sticky left-0 z-10 bg-slate-50 border border-slate-200 px-2 py-1 text-[10px] text-slate-400 font-mono text-right">
                  {r}
                </td>
                {cols.map((c) => (
                  <GridCell
                    key={c + r}
                    engine={engine}
                    sheetName={sheetName}
                    addr={c + r}
                    editing={editing === c + r}
                    editable={editable}
                    version={version}
                    onEdit={startEdit}
                    onClose={stopEdit}
                    onSetCell={onSetCell}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const GridCell = memo(function GridCell({
  engine, sheetName, addr, editing, editable, onEdit, onClose, onSetCell,
}: {
  engine: PrecalcEngine;
  sheetName: string;
  addr: string;
  editing: boolean;
  editable: boolean;
  /** Yalnızca yeniden çizimi tetiklemek için — motor değerleri buna göre tazelenir. */
  version: number;
  onEdit: (addr: string) => void;
  onClose: () => void;
  onSetCell?: (sheet: string, addr: string, value: RawValue) => void;
}) {
  const value = engine.value(addr, sheetName);
  const text = display(value);
  const isFormula = engine.hasFormula(addr, sheetName);
  const edited = engine.isUserEntry(addr, sheetName);
  const canEdit = editable && !!onSetCell && !isFormula;

  if (editing && canEdit) {
    return (
      <td className="border border-blue-400 p-0" style={{ minWidth: 90 }}>
        <CellInput
          initial={editText(value)}
          onCommit={(raw) => {
            const parsed = parseEditText(raw, 'number');
            if (raw.trim() !== editText(value).trim()) onSetCell!(sheetName, addr, parsed);
            onClose();
          }}
          onCancel={onClose}
        />
      </td>
    );
  }

  return (
    <td
      onClick={canEdit ? () => onEdit(addr) : undefined}
      className={cn(
        'border px-2 py-1 max-w-[300px] truncate',
        typeof value === 'number' ? 'text-right font-mono' : 'text-left',
        // Formüllü hücreler Excel'de mor: hesaplanır, elle değiştirilemez.
        isFormula
          ? 'border-violet-200 bg-violet-50 text-violet-700'
          : edited
            ? 'border-amber-200 bg-amber-50 text-amber-900 font-medium'
            : 'border-slate-100 text-slate-800',
        canEdit && 'cursor-text hover:bg-blue-50',
      )}
      title={
        isFormula
          ? `Formülle hesaplanır — düzenlenemez\n=${engine.formulaOf(addr, sheetName)}`
          : canEdit
            ? `${addr} — yazmak için tıklayın`
            : text || undefined
      }
    >
      {text}
    </td>
  );
});

function CellInput({
  initial, onCommit, onCancel,
}: {
  initial: string;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(draft);
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full px-2 py-1 text-xs font-mono text-right outline-none bg-white"
    />
  );
}
