'use client';

import { useCallback, useMemo, useState } from 'react';
import PrecalcFilters, { EMPTY_FILTERS, rowMatches, type FilterState } from '@/components/precalc/PrecalcFilters';
import PrecalcTable from '@/components/precalc/PrecalcTable';
import SheetGrid from '@/components/precalc/SheetGrid';
import TotalsPanel from '@/components/precalc/TotalsPanel';
import { usePrecalc } from '@/components/precalc/usePrecalc';
import { savePrecalculation } from '@/lib/precalc/savedClient';
import { EditableCell } from '@/components/precalc/EditableCell';
import type { PrecalcEngine } from '@/lib/precalc/engine';
import type { RawValue, RowMeta } from '@/lib/precalc/types';
import { cn } from '@/lib/utils';

const MAIN_SHEET = 'PRECALCULATION';

export default function PrecalculationClient() {
  const state = usePrecalc();
  const { engine, workbook, loading, error, version, settledVersion, calculating, entryCount } = state;

  const [activeSheet, setActiveSheet] = useState(MAIN_SHEET);
  // Bu ekran teklifin son hâli: varsayılan olarak yalnızca miktar girilmiş
  // kalemler listelenir. Tüm katalog Fiyat Kataloğu ekranındadır.
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS, onlyEntered: true });
  const [exporting, setExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const patchFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  /* ---- filtre seçenekleri ---- */
  const options = useMemo(() => {
    if (!workbook) return { topCategories: [], subCategories: [], productTypes: [] };
    const tops = new Set<string>();
    const subs = new Set<string>();
    const types = new Set<string>();
    for (const row of workbook.outline) {
      if (row.kind !== 'item') continue;
      const p = row.path ?? [];
      if (p[0]) tops.add(p[0]);
      if (p[0] && (!filters.topCategory || p[0] === filters.topCategory) && p[1]) subs.add(p[1]);
      if ((!filters.topCategory || p[0] === filters.topCategory)
        && (!filters.subCategory || p[1] === filters.subCategory) && p[2]) types.add(p[2]);
    }
    const sort = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b, 'tr'));
    return { topCategories: sort(tops), subCategories: sort(subs), productTypes: sort(types) };
  }, [workbook, filters.topCategory, filters.subCategory]);

  /* ---- görüntülenecek satırlar ---- */
  const { rows, itemCount, totalItems } = useMemo(() => {
    if (!engine || !workbook) return { rows: [] as RowMeta[], itemCount: 0, totalItems: 0 };

    const text = (a: string) => engine.text(a);
    const num = (a: string) => engine.num(a);

    const isFiltered = filters.search !== '' || filters.topCategory !== '' || filters.subCategory !== ''
      || filters.productType !== '' || filters.standard !== '' || filters.group !== ''
      || filters.onlyEntered || filters.hideEmptyPrice;

    const total = workbook.outline.filter((r) => r.kind === 'item').length;

    if (!isFiltered) {
      const all = workbook.outline.filter((r) => r.kind === 'section' || r.kind === 'item');
      return { rows: all, itemCount: total, totalItems: total };
    }

    // Eşleşen kalemleri ve onları kapsayan başlıkları koru
    const out: RowMeta[] = [];
    const pending: RowMeta[] = [];
    let matched = 0;

    for (const row of workbook.outline) {
      if (row.kind === 'section') {
        while (pending.length && (pending[pending.length - 1].level ?? 0) >= (row.level ?? 0)) pending.pop();
        pending.push(row);
        continue;
      }
      if (row.kind !== 'item') continue;
      if (!rowMatches(row, filters, text, num)) continue;
      out.push(...pending);
      pending.length = 0;
      out.push(row);
      matched++;
    }

    return { rows: out, itemCount: matched, totalItems: total };
    // version: girdi değişince "yalnızca girilenler" filtresi tazelensin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, workbook, filters, version]);

  /* ---- eylemler ---- */
  const handleSetCell = useCallback((addr: string, value: RawValue) => {
    state.setCell(addr, value);
  }, [state]);

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    state.reset();
    setConfirmReset(false);
    setNotice({ kind: 'ok', text: 'Girilen tüm veriler sıfırlandı.' });
  };

/**
   * Teklifi Advanced Precalculation Lists sayfasına kaydeder.
   *
   * Açık bir kayıt varsa o kayıt güncellenir; yoksa yeni kayıt açılır.
   * Dışa aktarmayı bloklamaz — dosya her hâlükârda üretilir, kaydetme
   * sonucu yalnızca bildirim metnine yansır.
   */
  const saveToList = async (): Promise<
    { ok: true } | { ok: false; why: string }
  > => {
    const result = await savePrecalculation(state.doc, state.getEntries());
    if (result.kind === 'ok') {
      state.bindSaved({
        docId: result.saved.id,
        precalcNo: result.saved.precalcNo,
        version: result.saved.version,
      });
      return { ok: true };
    }
    if (result.kind === 'conflict') {
      return {
        ok: false,
        why: `kayıt ${result.by} tarafından güncellenmiş; Advanced Precalculation ekranından açıp yeniden kaydedin`,
      };
    }
    if (result.kind === 'duplicate') {
      return { ok: false, why: 'bu Precalculation No başka bir kayıtta kullanılıyor' };
    }
    return { ok: false, why: result.message };
  };

  const handleExport = async (onlyEntered: boolean) => {
    setExporting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/precalc/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: state.getEntries(), onlyEntered }),
      });
      if (!res.ok) throw new Error('Sunucu hatası (' + res.status + ')');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const name = match ? decodeURIComponent(match[1]) : 'PRECALCULATION.xlsx';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      /*
       * Oluşturulan teklif Advanced Precalculation Lists sayfasında da
       * görünsün. Kayıt precalculation numarasına bağlıdır; numara
       * girilmemişse dosya yine üretilir, yalnızca listeye düşmez.
       */
      const listed = await saveToList();
      setNotice({
        kind: listed.ok ? 'ok' : 'err',
        text: listed.ok
          ? `Excel dosyası oluşturuldu: ${name} · Advanced Precalculation Lists sayfasına kaydedildi.`
          : `Excel dosyası oluşturuldu: ${name} · listeye KAYDEDİLMEDİ (${listed.why}).`,
      });
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Dışa aktarma başarısız.' });
    } finally {
      setExporting(false);
    }
  };

  /* ---- durumlar ---- */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3" />
        <p className="text-sm">Çalışma kitabı yükleniyor…</p>
        <p className="text-xs mt-1">48.000 formül hücresi hazırlanıyor</p>
      </div>
    );
  }

  if (error || !engine || !workbook) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">
        Precalculation verisi yüklenemedi: {error ?? 'bilinmeyen hata'}
      </div>
    );
  }

  const meta = workbook.meta;

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Precalculation</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {meta.sourceFile} · {meta.counts.items.toLocaleString('tr-TR')} kalem ·{' '}
            {meta.counts.formulas.toLocaleString('tr-TR')} formül · {meta.currency}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {entryCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
              {entryCount} hücrede veri girişi
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={entryCount === 0}
            className={cn(
              'px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              confirmReset
                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                : 'text-slate-600 border-slate-300 hover:bg-slate-50',
            )}
          >
            {confirmReset ? 'Emin misiniz? Tıklayın' : 'Verileri Sıfırla'}
          </button>
          <button
            onClick={() => handleExport(true)}
            disabled={exporting || entryCount === 0}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? 'Oluşturuluyor…' : 'Precalculation Oluştur'}
          </button>
          <button
            onClick={() => handleExport(false)}
            disabled={exporting}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Tam Listeyi Dışa Aktar
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-xl border px-4 py-2.5 text-sm flex items-center justify-between gap-3',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700',
          )}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-xs opacity-60 hover:opacity-100 shrink-0">
            kapat
          </button>
        </div>
      )}

      {/* Teklifin kimliği — dosya adı, başlık bloğu ve liste kaydı bunu kullanır */}
      <QuoteIdentityBar engine={engine} version={version} onSetCell={handleSetCell} />

      {/* Elle güncellenmesi gereken hücreler */}
      {workbook.externalCells.length > 0 && (
        <ExternalNotice cells={workbook.externalCells} />
      )}

      {/* Sayfa butonları */}
      <div className="flex flex-wrap gap-1.5">
        {workbook.sheetNames.map((name) => (
          <button
            key={name}
            onClick={() => setActiveSheet(name)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-lg border transition-colors',
              activeSheet === name
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {activeSheet === MAIN_SHEET ? (
        <>
          <TotalsPanel
            engine={engine}
            settledVersion={settledVersion}
            calculating={calculating}
            currency={meta.currency}
          />
          <PrecalcFilters
            filters={filters}
            onChange={patchFilters}
            onClear={() => setFilters(EMPTY_FILTERS)}
            options={options}
            matchCount={itemCount}
            totalCount={totalItems}
          />
          <PrecalcTable
            engine={engine}
            rows={rows}
            version={version}
            onSetCell={handleSetCell}
          />
          <Legend />
        </>
      ) : (
        <SheetGrid
          engine={engine}
          sheetName={activeSheet}
          version={settledVersion}
          getEntries={state.getEntries}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Proje ve precalculation numarası.
 *
 * Advanced Precalculation ekranıyla aynı hücrelere yazar (girdiler ortak
 * taslakta saklanır), böylece hangi ekrandan girilirse girilsin dışa
 * aktarılan Excel ve liste kaydı aynı numarayı taşır.
 */
function QuoteIdentityBar({
  engine, onSetCell,
}: {
  engine: PrecalcEngine;
  /**
   * Yeniden çizim tetikleyicisi — motor sonuçları mutasyonla değiştiği için
   * okunmaz, yalnızca prop olarak alınması bileşeni tazeler.
   */
  version: number;
  onSetCell: (addr: string, value: RawValue) => void;
}) {
  const fields = [
    { key: 'projectNo', label: 'Proje No', placeholder: 'ör. 2026-114' },
    { key: 'precalcNo', label: 'Precalculation No', placeholder: 'ör. PRE-2026-114-01' },
  ]
    .map((f) => ({ ...f, addr: engine.paramAddr(f.key) }))
    .filter((f): f is typeof f & { addr: string } => !!f.addr);

  if (fields.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5">
      {fields.map((f) => (
        <label key={f.key} className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">{f.label}</span>
          <span className="w-44">
            <EditableCell
              value={engine.value(f.addr)}
              format="text"
              align="left"
              edited={engine.isUserEntry(f.addr)}
              placeholder={f.placeholder}
              onCommit={(v) => onSetCell(f.addr, v)}
            />
          </span>
        </label>
      ))}
      <span className="ml-auto text-[11px] text-slate-400 hidden lg:inline">
        Precalculation no, oluşturulan teklifin Advanced Precalculation Lists&apos;teki kimliğidir
      </span>
    </div>
  );
}

function ExternalNotice({ cells }: { cells: { sheet: string; addr: string; cached: unknown }[] }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-amber-900 mb-1">
        Dış dosyaya bağlı {cells.length} hücre — fiyatları elle güncellemeniz gerekiyor
      </p>
      <p className="text-xs text-amber-800 leading-relaxed">
        Bu hücrelerin fiyatları kaynak dosyada <span className="font-mono">Valveseeker_Active.xlsm</span> ve{' '}
        <span className="font-mono">Precalculation 29.02</span> dosyalarından geliyordu. Şu an Excel&apos;in son
        kaydettiği değer kullanılıyor; tablodan Liste Fiyatı sütununa yazarak güncelleyebilirsiniz.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cells.map((c) => (
          <span key={c.sheet + c.addr} className="px-2 py-0.5 rounded bg-white border border-amber-300 text-[11px] font-mono text-amber-900">
            {c.addr}
            {typeof c.cached === 'number' && c.cached > 0 && (
              <span className="text-amber-600"> · {c.cached}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 px-1">
      <LegendItem className="bg-emerald-50 border-emerald-300" label="Miktar girilmiş satır" />
      <LegendItem className="bg-amber-50 border-amber-300" label="Elle değiştirilmiş hücre" />
      <LegendItem className="bg-red-50 border-red-300" label="Miktar var, fiyat boş" />
      <span className="text-blue-700 font-medium">Mavi başlık</span>
      <span>= veri girişi yapılabilir</span>
      <span className="text-slate-400">Gri başlık</span>
      <span>= formülle hesaplanır</span>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-3 h-3 rounded border', className)} />
      {label}
    </span>
  );
}
