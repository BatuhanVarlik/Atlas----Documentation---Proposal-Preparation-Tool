import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_DOC,
  adoptLegacyDraft,
  clearDraft,
  readCurrentDocId,
  readDraft,
  setCurrentDocId,
  writeDraft,
} from '../precalcDraft';

/** Taslak saklama localStorage'a dayanır; testte basit bir taklidi kullanılır. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: new MemoryStorage() },
    configurable: true,
    writable: true,
  });
});

describe('precalc taslak saklama', () => {
  it('her kaydın taslağı ayrı tutulur', () => {
    writeDraft({ docId: 'A', precalcNo: 'PRE-A', version: 3, entries: { 'PRECALCULATION!F15': 10 }, savedAt: null });
    writeDraft({ docId: 'B', precalcNo: 'PRE-B', version: 1, entries: { 'PRECALCULATION!F15': 99 }, savedAt: null });

    expect(readDraft('A')?.entries['PRECALCULATION!F15']).toBe(10);
    expect(readDraft('B')?.entries['PRECALCULATION!F15']).toBe(99);
    expect(readDraft('A')?.version).toBe(3);
  });

  it('bir kaydı silmek diğerine dokunmaz', () => {
    writeDraft({ ...EMPTY_DOC, docId: 'A', entries: { x: 1 }, savedAt: null });
    writeDraft({ ...EMPTY_DOC, docId: 'B', entries: { x: 2 }, savedAt: null });

    clearDraft('A');

    expect(readDraft('A')).toBeNull();
    expect(readDraft('B')?.entries.x).toBe(2);
  });

  it('kaydedilmemiş taslak, kayıtlı olanlardan ayrı bir yerde durur', () => {
    writeDraft({ ...EMPTY_DOC, entries: { yeni: 1 }, savedAt: null });
    writeDraft({ ...EMPTY_DOC, docId: 'A', entries: { kayitli: 1 }, savedAt: null });

    expect(readDraft(null)?.entries.yeni).toBe(1);
    expect(readDraft('A')?.entries.kayitli).toBe(1);
    expect(readDraft(null)?.entries.kayitli).toBeUndefined();
  });

  it('açık kayıt işaretçisi okunup yazılabilir', () => {
    expect(readCurrentDocId()).toBeNull();
    setCurrentDocId('A');
    expect(readCurrentDocId()).toBe('A');
    setCurrentDocId(null);
    expect(readCurrentDocId()).toBeNull();
  });

  it('eski tek-taslak biçimi bir kez devralınır', () => {
    window.localStorage.setItem(
      'atlas.precalc.draft.v1',
      JSON.stringify({ entries: { 'PRECALCULATION!F15': 7 }, savedAt: '2026-08-01T00:00:00.000Z' }),
    );

    adoptLegacyDraft();

    expect(readDraft(null)?.entries['PRECALCULATION!F15']).toBe(7);
    expect(window.localStorage.getItem('atlas.precalc.draft.v1')).toBeNull();
  });

  it('devralma, halihazırda duran taslağın üzerine yazmaz', () => {
    writeDraft({ ...EMPTY_DOC, entries: { guncel: 1 }, savedAt: null });
    window.localStorage.setItem(
      'atlas.precalc.draft.v1',
      JSON.stringify({ entries: { eski: 1 } }),
    );

    adoptLegacyDraft();

    expect(readDraft(null)?.entries.guncel).toBe(1);
    expect(readDraft(null)?.entries.eski).toBeUndefined();
  });

  it('bozuk kayıt okunamazsa null döner, patlamaz', () => {
    window.localStorage.setItem('atlas.precalc.draft.v2:A', '{bozuk');
    expect(readDraft('A')).toBeNull();
  });
});
