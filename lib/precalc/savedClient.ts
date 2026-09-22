import type { DraftDoc } from '@/components/precalc/precalcDraft';
import type { PrecalcEntries } from './types';

/**
 * Precalculation'ı listeye kaydeden istemci tarafı.
 *
 * İki ekran (Advanced Precalculation ve Precalculation) aynı kuralı
 * uygulasın diye tek yerde durur: kaydın id'si varsa o kayıt güncellenir,
 * yoksa yeni kayıt açılır. Güncelleme, okunduğu sürümü gönderir — araya
 * başka biri girmişse sunucu reddeder ve burası "conflict" döndürür.
 */

export interface SavedSummary {
  id: string;
  precalcNo: string;
  version: number;
  updatedAt: string;
}

/** Kaydın revizyon zincirindeki tek bir satır — köktekinden bu kayda kadar. */
export interface RevisionRow {
  id: string;
  precalcNo: string;
  revisionCode: string;
  revisionNote: string;
  createdAt: string;
  createdBy?: { name: string | null } | null;
}

export type SaveResult =
  | { kind: 'ok'; saved: SavedSummary; created: boolean }
  /** Araya başka biri girdi — sunucudaki sürüm ilerlemiş. */
  | { kind: 'conflict'; current: SavedSummary; by: string }
  /** Aynı precalculation numarası başka bir kayıtta kullanılıyor. */
  | { kind: 'duplicate'; existing: { id: string; precalcNo: string } }
  /** Numara değişmedi — revizyon için kullanıcının onu ilerletmesi gerekiyor. */
  | { kind: 'same-number'; existing: { id: string; precalcNo: string } }
  | { kind: 'error'; message: string };

async function body(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function savePrecalculation(
  doc: DraftDoc,
  entries: PrecalcEntries,
  opts: { asRevisionOf?: string; revisionNote?: string } = {},
): Promise<SaveResult> {
  // Revizyon her zaman YENİ kayıttır: eski sürüm listede durmalı.
  const creating = !doc.docId || !!opts.asRevisionOf;
  const url = creating ? '/api/precalc/saved' : `/api/precalc/saved/${doc.docId}`;

  const payloadBody = creating
    ? { entries, parentId: opts.asRevisionOf, revisionNote: opts.revisionNote }
    : { entries, expectedVersion: doc.version };

  let res: Response;
  try {
    res = await fetch(url, {
      method: creating ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBody),
    });
  } catch {
    return { kind: 'error', message: 'Sunucuya ulaşılamadı.' };
  }

  const payload = await body(res);

  if (res.ok) {
    return { kind: 'ok', saved: payload?.data as SavedSummary, created: creating };
  }

  if (res.status === 409) {
    const reason = payload?.reason;
    if (reason === 'duplicate') {
      return {
        kind: 'duplicate',
        existing: payload?.existing as { id: string; precalcNo: string },
      };
    }
    if (reason === 'same-number') {
      return {
        kind: 'same-number',
        existing: payload?.existing as { id: string; precalcNo: string },
      };
    }
    return {
      kind: 'conflict',
      current: payload?.current as SavedSummary,
      by: typeof payload?.by === 'string' ? payload.by : 'başka bir kullanıcı',
    };
  }

  return {
    kind: 'error',
    message: typeof payload?.error === 'string' ? payload.error : `Kaydedilemedi (${res.status})`,
  };
}

/** Kaydın girdilerini sunucudan alır — çakışma sonrası "onlarınkini yükle". */
export async function fetchSaved(id: string): Promise<{
  doc: DraftDoc;
  entries: PrecalcEntries;
  revisions: RevisionRow[];
} | null> {
  const res = await fetch(`/api/precalc/saved/${id}`);
  if (!res.ok) return null;
  const payload = await body(res);
  const row = payload?.data as {
    id: string; precalcNo: string; version: number; entries: PrecalcEntries;
  } | undefined;
  if (!row) return null;
  return {
    doc: { docId: row.id, precalcNo: row.precalcNo, version: row.version },
    entries: row.entries ?? {},
    revisions: (payload?.revisions ?? []) as RevisionRow[],
  };
}
