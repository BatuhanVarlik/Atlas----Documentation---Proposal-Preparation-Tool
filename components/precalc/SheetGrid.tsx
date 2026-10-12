'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import { fontStyleOf, xlFontProps } from '@/lib/precalc/fontStyle';
import { indexToCol, isError } from '@/lib/precalc/formula';
import type { PrecalcEntries, RawValue } from '@/lib/precalc/types';
import { downloadSheetExcel } from '@/lib/precalc/sheetExportClient';
import { cn, formatNumberTR } from '@/lib/utils';
import { parseEditText } from './cellFormat';
import HScrollControl from './HScrollControl';
import { useSyncHeaderScroll, useWindowVirtualRows } from './useWindowVirtualRows';

/** Sabit satır yüksekliği — sanallaştırma konumu bununla hesaplanır. */
const ROW_HEIGHT = 26;
/** Satır numarası sütunu. */
const ROW_HEAD_WIDTH = 48;
const MIN_COL = 70;
const MAX_COL = 320;

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
 *
 * Düzen Kalemler sekmesiyle aynıdır: başlık ayrı (sticky) kutuda, gövde
 * sayfayla birlikte akar (tek dikey scroll), yalnızca ekrandaki satırlar
 * çizilir; yatay kaydırma ekranın altındaki HScrollControl ile yapılır.
 */
export default function SheetGrid({ engine, sheetName, version, onSetCell, getEntries }: Props) {
  /** Şu an düzenlenen hücre — aynı anda yalnızca biri kutuya dönüşür. */
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

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
    maxCol = Math.min(maxCol, 40);

    // Sütun genişliği içerikten tahmin edilir: tablo sabit yerleşimli
    // (başlık ile gövde ayrı tablolar — birbirinden kaymasınlar diye).
    const widths = Array.from({ length: maxCol }, () => MIN_COL);
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 0; c < maxCol; c++) {
        const len = display(engine.value(indexToCol(c) + r, sheetName)).length;
        const px = Math.min(MAX_COL, len * 7 + 18);
        if (px > widths[c]) widths[c] = px;
      }
    }
    return { maxRow, maxCol, widths };
    // Genişlik yalnızca sayfa değişince ölçülür; her hesapta yeniden ölçmek
    // kullanıcı yazarken sütunları oynatırdı.
  }, [engine, sheetName]);

  const maxRow = grid?.maxRow ?? 0;
  const rowHeights = useMemo(() => Array.from({ length: maxRow }, () => ROW_HEIGHT), [maxRow]);
  const { start, end, padTop, padBottom } = useWindowVirtualRows(bodyRef, rowHeights, sheetName);
  const totalWidth = ROW_HEAD_WIDTH + (grid?.widths.reduce((a, b) => a + b, 0) ?? 0);
  useSyncHeaderScroll(bodyRef, headRef, `${sheetName}:${totalWidth}`);

  /** Enter: aynı sütunda aşağıdaki (Shift ile yukarıdaki) ilk formülsüz hücre. */
  const editNeighbor = useCallback((addr: string, dir: 1 | -1) => {
    const m = /^([A-Z]+)(\d+)$/.exec(addr);
    if (!m) { setEditing(null); return; }
    for (let r = parseInt(m[2], 10) + dir; r >= 1 && r <= maxRow; r += dir) {
      if (!engine.hasFormula(m[1] + r, sheetName)) { setEditing(m[1] + r); return; }
    }
    setEditing(null);
  }, [engine, sheetName, maxRow]);

  if (!grid || grid.maxRow === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-sm text-slate-400">
        Bu sayfa boş.
      </div>
    );
  }

  const rows = Array.from({ length: end - start }, (_, i) => start + i + 1);
  const cols = Array.from({ length: grid.maxCol }, (_, i) => indexToCol(i));
  const editable = !!onSetCell;
  const colSpan = cols.length + 2;
  const tableClass = 'text-xs table-fixed border-separate';
  const tableStyle = { borderSpacing: 0, width: '100%', minWidth: totalWidth };
  const colGroup = (
    <colgroup>
      <col style={{ width: ROW_HEAD_WIDTH }} />
      {cols.map((c, i) => <col key={c} style={{ width: grid.widths[i] }} />)}
      <col />
    </colgroup>
  );

  return (
    <div>
      <div className="rounded-t-xl border border-b-0 border-slate-200 px-4 py-2.5 bg-slate-50 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h3 className="text-xs font-semibold text-slate-700">{sheetName}</h3>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[11px] text-slate-400 text-right">
            {grid.maxRow} satır · değerler PRECALCULATION girdilerine göre canlı hesaplanır
            {editable
              ? ' · formülsüz hücrelere tıklayıp yazabilirsiniz · Enter alt satıra geçer'
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

      <div>
        {/* Başlık şeridi: sticky; yatay konumu gövdeden JS ile eşlenir. */}
        <div ref={headRef} className="sticky top-0 z-30 overflow-x-hidden bg-slate-100">
          <table className={tableClass} style={tableStyle}>
            {colGroup}
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] text-slate-400 font-mono" />
                {cols.map((c) => (
                  <th key={c} className="bg-slate-100 border-y border-r border-slate-200 px-2 py-1 text-[10px] text-slate-400 font-mono font-normal">
                    {c}
                  </th>
                ))}
                <th className="bg-slate-100 border-y border-slate-200" />
              </tr>
            </thead>
          </table>
        </div>
        <div ref={bodyRef} className="overflow-x-auto hscroll-hidden bg-white">
          <table className={tableClass} style={tableStyle}>
            {colGroup}
            <tbody>
              {padTop > 0 && (
                <tr aria-hidden style={{ height: padTop }}><td colSpan={colSpan} className="p-0" /></tr>
              )}
              {rows.map((r) => (
                <tr key={r} className="hover:bg-slate-50" style={{ height: ROW_HEIGHT }}>
                  <td className="sticky left-0 z-10 bg-slate-50 border-x border-b border-slate-200 px-2 py-1 text-[10px] text-slate-400 font-mono text-right">
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
                      onNext={editNeighbor}
                      onSetCell={onSetCell}
                    />
                  ))}
                  <td className="border-b border-slate-100" />
                </tr>
              ))}
              {padBottom > 0 && (
                <tr aria-hidden style={{ height: padBottom }}><td colSpan={colSpan} className="p-0" /></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <HScrollControl targetRef={bodyRef} watch={totalWidth} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

const GridCell = memo(function GridCell({
  engine, sheetName, addr, editing, editable, onEdit, onClose, onNext, onSetCell,
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
  /** Enter ile kaydedip aynı sütunda komşu satıra geçer. */
  onNext: (addr: string, dir: 1 | -1) => void;
  onSetCell?: (sheet: string, addr: string, value: RawValue) => void;
}) {
  const value = engine.value(addr, sheetName);
  const text = display(value);
  const isFormula = engine.hasFormula(addr, sheetName);
  const edited = engine.isUserEntry(addr, sheetName);
  const canEdit = editable && !!onSetCell && !isFormula;

  if (editing && canEdit) {
    return (
      <td className="border border-blue-400 p-0">
        <CellInput
          initial={editText(value)}
          onCommit={(raw, move) => {
            const parsed = parseEditText(raw, 'number');
            if (raw.trim() !== editText(value).trim()) onSetCell!(sheetName, addr, parsed);
            if (move) onNext(addr, move); else onClose();
          }}
          onCancel={onClose}
        />
      </td>
    );
  }

  // Şablondaki yazı rengi / kalınlığı (ör. SMS sayfasında kırmızı/mavi sütunlar)
  const xf = xlFontProps(fontStyleOf(engine.workbook, sheetName, addr));

  return (
    <td
      onClick={canEdit ? () => onEdit(addr) : undefined}
      style={xf.style}
      className={cn(
        'border-b border-r px-2 py-1 truncate',
        typeof value === 'number' ? 'text-right font-mono' : 'text-left',
        // Formüllü hücreler Excel'de mor: hesaplanır, elle değiştirilemez.
        isFormula
          ? 'border-violet-200 bg-violet-50 text-violet-700'
          : edited
            ? 'border-amber-200 bg-amber-50 text-amber-900 font-medium'
            : 'border-slate-100 text-slate-800',
        canEdit && 'cursor-text hover:bg-blue-50',
        xf.className,
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
  /** move: Enter'da 1 (alt satır), Shift+Enter'da -1, odak kaybında 0. */
  onCommit: (raw: string, move: 0 | 1 | -1) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  /** Enter zaten kaydetti — ardından gelen blur ikinci kez kaydetmesin. */
  const done = useRef(false);

  useEffect(() => { ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (!done.current) { done.current = true; onCommit(draft, 0); } }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          done.current = true;
          onCommit(draft, e.shiftKey ? -1 : 1);
        }
        if (e.key === 'Escape') { done.current = true; onCancel(); }
      }}
      className="w-full px-2 py-1 text-xs font-mono text-right outline-none bg-white"
    />
  );
}
