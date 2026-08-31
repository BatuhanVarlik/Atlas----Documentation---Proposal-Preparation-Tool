'use client';

import type { PrecalcEntries } from '@/lib/precalc/types';

/**
 * Precalculation taslaklarının tarayıcıdaki saklama düzeni.
 *
 * Taslak KAYIT BAŞINA tutulur. Tek bir ortak taslak vardı ve listeden bir
 * precalculation açmak onu eziyordu: iki kayıt arasında gidip gelen kişi
 * kendi işini kaybediyor, iki kişi aynı kaydı açtığında ikincisi birincinin
 * üzerine yazıyordu. Artık her kaydın kendi taslağı var ve taslak, ait olduğu
 * sunucu kaydının kimliğini (docId) ve sürümünü taşıyor; kaydetme isteği bu
 * sürümü gönderir, sunucu tutmuyorsa reddeder.
 */

/** Henüz kaydedilmemiş taslağın anahtarı. */
export const NEW_DOC = 'new';

const CURRENT_KEY = 'atlas.precalc.current';
const DRAFT_PREFIX = 'atlas.precalc.draft.v2:';
/** Kayıt başına taslaktan önceki tek ortak taslak — bir kez devralınır. */
const LEGACY_KEY = 'atlas.precalc.draft.v1';

/** Taslağın bağlı olduğu sunucu kaydı. */
export interface DraftDoc {
  /** Kaydedilmiş precalculation'ın id'si; kaydedilmemiş taslakta null. */
  docId: string | null;
  /** Listede görünen numara — yalnızca gösterim içindir. */
  precalcNo: string;
  /** Okunduğu andaki sunucu sürümü; çakışma denetimi bununla yapılır. */
  version: number;
}

export interface Draft extends DraftDoc {
  entries: PrecalcEntries;
  savedAt: string | null;
}

export const EMPTY_DOC: DraftDoc = { docId: null, precalcNo: '', version: 0 };

const storage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Gizli sekme / kapalı depolama: hesap yine çalışır, taslak saklanmaz.
    return null;
  }
};

const keyFor = (docId: string | null) => DRAFT_PREFIX + (docId ?? NEW_DOC);

/** Şu an açık olan kaydın id'si — kaydedilmemiş taslakta null. */
export function readCurrentDocId(): string | null {
  const s = storage();
  const raw = s?.getItem(CURRENT_KEY);
  return !raw || raw === NEW_DOC ? null : raw;
}

export function setCurrentDocId(docId: string | null) {
  storage()?.setItem(CURRENT_KEY, docId ?? NEW_DOC);
}

export function readDraft(docId: string | null): Draft | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(keyFor(docId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft> | null;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') return null;
    return {
      docId: parsed.docId ?? docId,
      precalcNo: parsed.precalcNo ?? '',
      version: typeof parsed.version === 'number' ? parsed.version : 0,
      entries: (parsed.entries ?? {}) as PrecalcEntries,
      savedAt: parsed.savedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function writeDraft(draft: Draft) {
  try {
    storage()?.setItem(keyFor(draft.docId), JSON.stringify(draft));
  } catch {
    // kota dolmuşsa sessizce geç — hesap yine de çalışır
  }
}

export function clearDraft(docId: string | null) {
  storage()?.removeItem(keyFor(docId));
}

/**
 * Kayıt başına taslağa geçmeden önce tutulan tek ortak taslağı devralır.
 * Kullanıcının yarım kalan işi sürüm geçişinde kaybolmasın diye; bir kez
 * çalışır, eski anahtarı siler.
 */
export function adoptLegacyDraft() {
  const s = storage();
  if (!s) return;
  const raw = s.getItem(LEGACY_KEY);
  if (!raw) return;
  s.removeItem(LEGACY_KEY);
  if (readDraft(null)) return;                     // yeni taslak zaten var
  try {
    const parsed = JSON.parse(raw) as { entries?: PrecalcEntries; savedAt?: string };
    if (!parsed?.entries || Object.keys(parsed.entries).length === 0) return;
    writeDraft({
      ...EMPTY_DOC,
      entries: parsed.entries,
      savedAt: parsed.savedAt ?? null,
    });
  } catch {
    // bozuk kayıt: devralınacak bir şey yok
  }
}
