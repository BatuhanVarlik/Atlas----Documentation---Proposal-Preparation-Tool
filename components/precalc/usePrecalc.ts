'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrecalcEngine } from '@/lib/precalc/engine';
import type { PrecalcEntries, PrecalcWorkbook, RawValue } from '@/lib/precalc/types';
import {
  EMPTY_DOC,
  adoptLegacyDraft,
  clearDraft,
  readCurrentDocId,
  readDraft,
  setCurrentDocId,
  writeDraft,
  type DraftDoc,
} from './precalcDraft';

/* ------------------------------------------------------------------ */
/* Ana kanca                                                           */
/* ------------------------------------------------------------------ */

export interface PrecalcState {
  workbook: PrecalcWorkbook | null;
  engine: PrecalcEngine | null;
  loading: boolean;
  error: string | null;
  /** Her girdi değişiminde artar — tabloyu yeniden çizdirmek için. */
  version: number;
  /** Toplam panelinin beklediği, gecikmeli sürüm. */
  settledVersion: number;
  /** Ağır toplamlar hesaplanıyor mu? */
  calculating: boolean;
  entryCount: number;
  savedAt: string | null;

  /**
   * Ekranda açık olan kayıt. docId null ise teklif henüz listeye
   * kaydedilmemiştir; kaydedilince buraya bağlanır.
   */
  doc: DraftDoc;

  setCell: (addr: string, value: RawValue, sheet?: string) => void;
  reset: () => void;
  getEntries: () => PrecalcEntries;

  /** Kaydetme başarılı olduğunda kaydın yeni sürümüne bağlanır. */
  bindSaved: (doc: DraftDoc) => void;
  /** Sunucudaki sürümü yükler — çakışma sonrası "onlarınkini al" yolu. */
  adoptRemote: (doc: DraftDoc, entries: PrecalcEntries) => void;
  /** Kayıtla bağı koparıp boş bir teklife geçer. */
  startNew: () => void;
}

/** Toplamların yeniden hesaplanması için beklenen süre (ms). */
const SETTLE_DELAY = 500;

/**
 * @param requestedDocId Açılması istenen kayıt (ör. URL'deki `?id=`).
 *   Verilmezse tarayıcıda en son açık olan kayıtla devam edilir; böylece
 *   Advanced Precalculation ve Precalculation ekranları aynı teklifi gösterir.
 */
export function usePrecalc(requestedDocId?: string | null): PrecalcState {
  const [workbook, setWorkbook] = useState<PrecalcWorkbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [settledVersion, setSettledVersion] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [doc, setDoc] = useState<DraftDoc>(EMPTY_DOC);

  const engineRef = useRef<PrecalcEngine | null>(null);
  const docRef = useRef<DraftDoc>(EMPTY_DOC);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Taslağı, motorun o anki girdileriyle diske yazar. */
  const persist = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const at = new Date().toISOString();
    writeDraft({ ...docRef.current, entries: engine.getEntries(), savedAt: at });
    setSavedAt(at);
  }, []);

  const applyDoc = useCallback((next: DraftDoc) => {
    docRef.current = next;
    setDoc(next);
    setCurrentDocId(next.docId);
  }, []);

  /* ---- çalışma kitabı + açılacak taslak ---- */
  useEffect(() => {
    let cancelled = false;

    /*
     * Bekleyen taslak yazımını iptal et. Başka bir kayda geçilirken bu zamanlayıcı
     * ateşlenirse, ÖNCEKİ teklifin girdilerini YENİ kaydın anahtarına yazardı.
     */
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }

    (async () => {
      try {
        adoptLegacyDraft();

        const res = await fetch('/api/precalc/workbook');
        if (!res.ok) throw new Error('Çalışma kitabı yüklenemedi (' + res.status + ')');
        const data = (await res.json()) as PrecalcWorkbook;
        if (cancelled) return;

        // Hangi kayıt açılacak: URL'deki id, yoksa en son açık olan.
        const wantedId = requestedDocId ?? readCurrentDocId();
        let nextDoc: DraftDoc = { ...EMPTY_DOC, docId: wantedId };
        let entries: PrecalcEntries = {};

        const local = readDraft(wantedId);
        if (local) {
          nextDoc = { docId: local.docId, precalcNo: local.precalcNo, version: local.version };
          entries = local.entries;
        }

        /*
         * Kayıt sunucudan tazelenir. Yerel taslak varsa girdileri değil
         * yalnızca sürüm bilgisi güncellenir: kullanıcının yarım kalan işi
         * sunucudaki kopyayla ezilmemeli. Sürüm ilerlemişse kaydetme
         * denemesinde çakışma olarak görünür ve kullanıcı karar verir.
         */
        if (wantedId) {
          try {
            const r = await fetch(`/api/precalc/saved/${wantedId}`);
            if (r.ok) {
              const body = await r.json();
              const row = body?.data;
              if (row) {
                nextDoc = { docId: row.id, precalcNo: row.precalcNo, version: row.version };
                if (!local) entries = (row.entries ?? {}) as PrecalcEntries;
              }
            } else if (r.status === 404 && !local) {
              // Kayıt silinmiş: boş teklifle devam et.
              nextDoc = EMPTY_DOC;
            }
          } catch {
            // Sunucuya ulaşılamadı: yerel taslakla çalışmaya devam.
          }
        }
        if (cancelled) return;

        const engine = new PrecalcEngine(data);
        if (Object.keys(entries).length) engine.setEntries(entries);

        engineRef.current = engine;
        docRef.current = nextDoc;
        setDoc(nextDoc);
        setCurrentDocId(nextDoc.docId);
        if (!local) writeDraft({ ...nextDoc, entries, savedAt: null });

        setWorkbook(data);
        setEntryCount(engine.entryCount);
        setLoading(false);
        setVersion((v) => v + 1);
        // İlk sabitleme ilk çizimi bloklamasın diye geciktirilir.
        settleTimer.current = setTimeout(() => {
          engine.settle();
          setSettledVersion((v) => v + 1);
        }, 0);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [requestedDocId]);

  /* ---- girdi değişince: anında sürüm artır, toplamları geciktir ---- */
  const bump = useCallback(() => {
    setVersion((v) => v + 1);

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      // Kitap yinelemeli hesapla kaydedilmiş (calcPr iterate="1"); döngüsel
      // hücreler sabitlenmeden toplamlar #DIV/0! kalır.
      engineRef.current?.settle();
      setSettledVersion((v) => v + 1);
    }, SETTLE_DELAY);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, SETTLE_DELAY);
  }, [persist]);

  const setCell = useCallback((addr: string, value: RawValue, sheet = 'PRECALCULATION') => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setCell(sheet, addr, value);
    setEntryCount(engine.entryCount);
    bump();
  }, [bump]);

  const reset = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.reset();
    setEntryCount(0);
    setSavedAt(null);
    clearDraft(docRef.current.docId);
    setVersion((v) => v + 1);
    setSettledVersion((v) => v + 1);
  }, []);

  const getEntries = useCallback((): PrecalcEntries => {
    return engineRef.current?.getEntries() ?? {};
  }, []);

  const bindSaved = useCallback((next: DraftDoc) => {
    const previous = docRef.current.docId;
    applyDoc(next);
    // Kaydedilmemiş taslak artık bir kayda bağlandı: eski anahtarı bırakma.
    if (previous !== next.docId) clearDraft(previous);
    persist();
  }, [applyDoc, persist]);

  const adoptRemote = useCallback((next: DraftDoc, entries: PrecalcEntries) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setEntries(entries);
    setEntryCount(engine.entryCount);
    applyDoc(next);
    writeDraft({ ...next, entries, savedAt: new Date().toISOString() });
    setVersion((v) => v + 1);
    setSettledVersion((v) => v + 1);
  }, [applyDoc]);

  const startNew = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.reset();
    setEntryCount(0);
    setSavedAt(null);
    applyDoc(EMPTY_DOC);
    clearDraft(null);
    setVersion((v) => v + 1);
    setSettledVersion((v) => v + 1);
  }, [applyDoc]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  return useMemo(() => ({
    workbook,
    engine: engineRef.current,
    loading,
    error,
    version,
    settledVersion,
    calculating: version !== settledVersion,
    entryCount,
    savedAt,
    doc,
    setCell,
    reset,
    getEntries,
    bindSaved,
    adoptRemote,
    startNew,
  }), [workbook, loading, error, version, settledVersion, entryCount, savedAt, doc,
    setCell, reset, getEntries, bindSaved, adoptRemote, startNew]);
}
