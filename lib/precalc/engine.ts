/**
 * PRECALCULATION çalışma kitabını bellekte çalıştıran hesap motoru.
 *
 * Kaynak Excel dosyası hiçbir zaman değiştirilmez; buradaki her şey
 * salt-okunur verinin üzerine kullanıcı girdisi bindirilerek hesaplanır.
 */

import {
  ExcelError,
  evaluate,
  indexToCol,
  isError,
  parseFormula,
  splitAddr,
  type CellValue,
  type EvalContext,
} from './formula';
import type { PrecalcAnchors, PrecalcEntries, PrecalcWorkbook, RawValue } from './types';

export interface RecalcStats {
  /** Hesaplanan formül hücresi sayısı. */
  evaluated: number;
  /** Milisaniye. */
  durationMs: number;
}

export interface SettleStats {
  /** Yapılan yineleme sayısı. */
  iterations: number;
  /** Değerler sabitlendi mi (yoksa üst sınıra mı takıldı). */
  converged: boolean;
  /** Döngüye giren hücre sayısı. */
  circularCells: number;
  durationMs: number;
}

/** Excel'in yinelemeli hesap ayarları (kaynak kitapta calcPr iterate="1"). */
const MAX_ITERATIONS = 100;
const ITERATION_DELTA = 0.001;

export class PrecalcEngine implements EvalContext {
  currentSheet = 'PRECALCULATION';
  readonly workbookFileName: string;

  private wb: PrecalcWorkbook;
  /** Kullanıcı girdileri — sabit değerlerin üzerine biner. */
  private entries: PrecalcEntries = {};
  /** Hesaplanmış formül sonuçları. */
  private memo = new Map<string, CellValue>();
  /** Döngü tespiti için hesaplanmakta olan hücreler. */
  private inProgress = new Set<string>();
  /**
   * Kaynak dosyadaki döngüsel referanslar. Kitap yinelemeli hesapla
   * (calcPr iterate="1") kaydedildiği için bunlar hata değil, kasıtlıdır.
   */
  private cycles = new Set<string>();
  /** Döngüdeki hücrelerin bir önceki yinelemedeki değerleri. */
  private iterativeValues = new Map<string, CellValue>();
  /** İlk tam döngü taraması yapıldı mı. */
  private cyclesDiscovered = false;
  /** Sayfa başına dolu satır dizini: sheet -> row -> col harfleri (sıralı). */
  private rowIndex = new Map<string, Map<number, number[]>>();

  private evaluated = 0;

  constructor(workbook: PrecalcWorkbook) {
    this.wb = workbook;
    this.workbookFileName = workbook.meta.sourceFile;
    this.buildRowIndex();
  }

  /* ---------------------------------------------------------------- */
  /* Kurulum                                                           */
  /* ---------------------------------------------------------------- */

  private buildRowIndex() {
    for (const name of this.wb.sheetNames) {
      const sheet = this.wb.sheets[name];
      if (!sheet) continue;
      const rows = new Map<number, number[]>();
      const add = (addr: string) => {
        const { col, row } = splitAddr(addr);
        let cols = rows.get(row);
        if (!cols) { cols = []; rows.set(row, cols); }
        cols.push(col);
      };
      for (const addr in sheet.v) add(addr);
      for (const addr in sheet.f) add(addr);
      for (const cols of rows.values()) {
        cols.sort((a, b) => a - b);
        // yinelenenleri at (v ve f aynı adreste olmamalı ama garanti olsun)
        let w = 0;
        for (let i = 0; i < cols.length; i++) {
          if (i === 0 || cols[i] !== cols[i - 1]) cols[w++] = cols[i];
        }
        cols.length = w;
      }
      this.rowIndex.set(name, rows);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Girdi yönetimi                                                    */
  /* ---------------------------------------------------------------- */

  /** Tüm kullanıcı girdilerini değiştirir ve önbelleği temizler. */
  setEntries(entries: PrecalcEntries) {
    this.entries = { ...entries };
    this.invalidate();
  }

  /**
   * Tek bir hücreye kullanıcı değeri yazar.
   *
   * null girdiyi SİLER: hücre kaynak dosyadaki değerine — formüllüyse
   * formülüne — döner; "şablona dön" (↺) düğmeleri bunu kullanır. Boş metin
   * ise geçerli bir girdidir ve saklanır: kaynakta dolu gelen bir hücre
   * (ör. pompa şablonundaki teknik açıklama) ancak böyle boşaltılabilir.
   */
  setCell(sheet: string, addr: string, value: RawValue) {
    const key = `${sheet}!${addr}`;
    if (value === null || value === undefined) delete this.entries[key];
    else this.entries[key] = value;
    this.invalidate();
  }

  getEntries(): PrecalcEntries {
    return { ...this.entries };
  }

  /** Tüm kullanıcı girdilerini siler — "Verileri Sıfırla". */
  reset() {
    this.entries = {};
    this.iterativeValues.clear();
    this.invalidate();
  }

  private invalidate() {
    this.memo.clear();
    this.inProgress.clear();
    // cycles ve iterativeValues korunur: döngüler yapısaldır ve son değerler
    // bir sonraki yinelemeye tohum olur — Excel de böyle davranır.
  }

  /** Hesap sırasında karşılaşılan döngüsel referanslar. */
  get circularRefs(): string[] {
    return [...this.cycles];
  }

  /* ---------------------------------------------------------------- */
  /* EvalContext                                                       */
  /* ---------------------------------------------------------------- */

  getCell(sheet: string, addr: string): CellValue {
    const key = `${sheet}!${addr}`;

    // 1) kullanıcı girdisi her şeyin önünde
    const entry = this.entries[key];
    if (entry !== undefined) return entry;

    const data = this.wb.sheets[sheet];
    if (!data) return null;

    // 2) sabit değer
    const raw = data.v[addr];
    if (raw !== undefined) return raw;

    // 3) formül
    const formula = data.f[addr];
    if (formula === undefined) return null;

    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;

    // Dış çalışma kitabına bağlı hücreler hesaplanamaz — Excel'in
    // kaydettiği son değeri kullanırız (kullanıcı elle güncelleyebilir).
    const cached = data.cached[addr];
    if (cached !== undefined) {
      const v = cached as CellValue;
      this.memo.set(key, v);
      return v;
    }

    // Döngüsel referans. Kaynak kitap yinelemeli hesapla kaydedildiği için
    // bu kasıtlıdır (ör. AYRINTILI FIYATLANDIRMA'da genel giderin kategorilere
    // dağıtımı). Excel gibi bir önceki yinelemenin değerini döndürüyoruz;
    // settle() değerler sabitlenene kadar tekrarlar.
    if (this.inProgress.has(key)) {
      this.cycles.add(key);
      return this.iterativeValues.get(key) ?? 0;
    }
    this.inProgress.add(key);

    let result: CellValue;
    try {
      const prevSheet = this.currentSheet;
      this.currentSheet = sheet;
      result = evaluate(parseFormula(formula), this);
      this.currentSheet = prevSheet;
      this.evaluated++;
    } catch {
      result = new ExcelError('#ERROR!');
    } finally {
      this.inProgress.delete(key);
    }

    // Excel'de formül asla "boş" döndürmez: boş hücreye yapılan referans 0'dır.
    if (result === null) result = 0;

    // Döngüdeki hücrenin sonucu bir sonraki yinelemeye tohum olur.
    if (this.cycles.has(key)) this.iterativeValues.set(key, result);

    this.memo.set(key, result);
    return result;
  }

  getRange(sheet: string, from: string, to: string): CellValue[] {
    const out: CellValue[] = [];
    this.eachInRange(sheet, from, to, (v) => out.push(v));
    return out;
  }

  eachInRange(
    sheet: string,
    from: string,
    to: string,
    fn: (v: CellValue, rowOffset: number, colOffset: number) => void,
  ): void {
    const a = splitAddr(from);
    const b = splitAddr(to);
    const r1 = Math.min(a.row, b.row);
    const r2 = Math.max(a.row, b.row);
    const c1 = Math.min(a.col, b.col);
    const c2 = Math.max(a.col, b.col);

    const rows = this.rowIndex.get(sheet);
    if (!rows) return;

    // Seyrek gezinme: yalnızca dolu hücreleri ziyaret et. Girdi ile eklenmiş
    // hücreler dizinde olmayabileceğinden onları da ayrıca kontrol ederiz.
    const seen = new Set<string>();
    for (let r = r1; r <= r2; r++) {
      const cols = rows.get(r);
      if (!cols) continue;
      for (const c of cols) {
        if (c < c1 || c > c2) continue;
        const addr = indexToCol(c) + r;
        seen.add(addr);
        fn(this.getCell(sheet, addr), r - r1, c - c1);
      }
    }

    // Kullanıcının boş bir hücreye girdiği değerler
    const prefix = `${sheet}!`;
    for (const key in this.entries) {
      if (!key.startsWith(prefix)) continue;
      const addr = key.slice(prefix.length);
      if (seen.has(addr)) continue;
      const { col, row } = splitAddr(addr);
      if (row < r1 || row > r2 || col < c1 || col > c2) continue;
      fn(this.getCell(sheet, addr), row - r1, col - c1);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Genel API                                                         */
  /* ---------------------------------------------------------------- */

  /** Hücrenin görüntülenecek değeri. */
  value(addr: string, sheet = 'PRECALCULATION'): CellValue {
    return this.getCell(sheet, addr);
  }

  /** Hücrenin sayısal değeri; hata/boş ise 0. */
  num(addr: string, sheet = 'PRECALCULATION'): number {
    const v = this.getCell(sheet, addr);
    return typeof v === 'number' ? v : 0;
  }

  /** Hücrenin metin değeri. */
  text(addr: string, sheet = 'PRECALCULATION'): string {
    const v = this.getCell(sheet, addr);
    if (v === null || v === undefined) return '';
    if (isError(v)) return v.code;
    return String(v);
  }

  /** Hücrenin kullanıcı tarafından girilip girilmediği. */
  isUserEntry(addr: string, sheet = 'PRECALCULATION'): boolean {
    return this.entries[`${sheet}!${addr}`] !== undefined;
  }

  /** Hücrenin formüllü olup olmadığı (yani salt-okunur hesap sonucu). */
  hasFormula(addr: string, sheet = 'PRECALCULATION'): boolean {
    return this.wb.sheets[sheet]?.f[addr] !== undefined;
  }

  formulaOf(addr: string, sheet = 'PRECALCULATION'): string | null {
    return this.wb.sheets[sheet]?.f[addr] ?? null;
  }

  get workbook(): PrecalcWorkbook {
    return this.wb;
  }

  /** Kitabın yapısal satırları — kod hiçbir satır numarasını sabit yazmaz. */
  get anchors(): PrecalcAnchors {
    return this.wb.meta.anchors;
  }

  /** Parametre hücresinin adresi ("profitMultiplier" -> "M4883"). */
  paramAddr(key: string): string | null {
    return this.wb.params.find((p) => p.key === key)?.addr ?? null;
  }

  /** Girdi sayısı — "kaç kalemde miktar var" göstergesi için. */
  get entryCount(): number {
    return Object.keys(this.entries).length;
  }

  /**
   * Döngüsel referansları Excel'in yinelemeli hesabı gibi sabitler.
   *
   * Kaynak kitapta calcPr iterate="1" ayarlıdır: bazı hücreler kasıtlı olarak
   * birbirine bağlıdır (ör. AYRINTILI FIYATLANDIRMA'da genel gider, dolu
   * kategori sayısına bölünerek dağıtılır — F2 D sütununa, D sütunu F2'ye
   * bakar). Tek geçişli hesapta bu hücreler 0 kalır ve bölme #DIV/0! verir;
   * burada değerler sabitlenene kadar yineleyip Excel'in sonucunu üretiyoruz.
   *
   * Döngü taraması ilk çağrıda bir kez yapılır (tam hesap); sonraki
   * çağrılarda yalnızca döngüdeki hücreler yinelenir.
   */
  settle(maxIterations = MAX_ITERATIONS, delta = ITERATION_DELTA): SettleStats {
    const started = Date.now();

    // Döngüye girip girmemek IF dallarına, yani girilen miktarlara bağlı
    // olabilir; bu yüzden her sabitlemeden önce yeniden taranır. İlk tarama
    // tüm kitabı gezer, sonrakiler yalnızca küçük sayfaları — PRECALCULATION
    // 45 bin formülle tek başına taramanın tamamına yakınıdır ve oradaki
    // döngüler ilk taramada zaten kalıcı olarak kaydedilir.
    if (!this.cyclesDiscovered) {
      this.recalcAll();
      this.cyclesDiscovered = true;
    } else {
      this.recalcAll(this.wb.sheetNames.filter((name) => name !== 'PRECALCULATION'));
    }

    if (this.cycles.size === 0) {
      return { iterations: 0, converged: true, circularCells: 0, durationMs: Date.now() - started };
    }

    /** İki yineleme arasındaki değer aynı mı (hata kodları dahil). */
    const same = (a: CellValue | undefined, b: CellValue | undefined): boolean => {
      if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < delta;
      if (isError(a) && isError(b)) return a.code === b.code;
      return a === b;
    };

    let iterations = 0;
    let converged = false;

    for (let i = 0; i < maxIterations; i++) {
      iterations++;
      // Döngü kümesi yineleme sırasında büyüyebilir (yeni hücreler keşfedilir).
      const keys = [...this.cycles];
      const sizeBefore = this.cycles.size;
      const before = keys.map((k) => this.iterativeValues.get(k));

      // Önbellek temizlenir ki döngüdeki hücreler yeni tohumlarla hesaplansın.
      this.memo.clear();
      this.inProgress.clear();
      for (const key of keys) {
        const cut = key.indexOf('!');
        this.getCell(key.slice(0, cut), key.slice(cut + 1));
      }

      const after = keys.map((k) => this.iterativeValues.get(k));
      // Yeni döngü hücresi çıktıysa henüz sabitlenmiş sayılmaz.
      if (this.cycles.size === sizeBefore && before.every((b, j) => same(b, after[j]))) {
        converged = true;
        break;
      }
    }

    // Önbellek KASITLI olarak temizlenmez: son turda hesaplanan değerler
    // sabitlenmiş sonuçlardır. Temizlenirse döngüdeki bir hücre tek başına
    // yeniden hesaplanırken kendi tohumunu 0 görüp #DIV/0! üretir — Excel de
    // yinelemenin sonucunu saklar, her okumada yeniden hesaplamaz.
    this.inProgress.clear();

    return {
      iterations,
      converged,
      circularCells: this.cycles.size,
      durationMs: Date.now() - started,
    };
  }

  /**
   * Tüm formülleri hesaplar. Genelde gerekmez (getCell tembel çalışır),
   * ama toplu doğrulama ve dışa aktarım öncesi kullanılır.
   */
  recalcAll(sheetNames?: string[]): RecalcStats {
    const started = Date.now();
    this.evaluated = 0;
    for (const name of sheetNames ?? this.wb.sheetNames) {
      const data = this.wb.sheets[name];
      if (!data) continue;
      for (const addr in data.f) this.getCell(name, addr);
    }
    return { evaluated: this.evaluated, durationMs: Date.now() - started };
  }
}

/** Excel seri numarasını JS tarihine çevirir. */
export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  // Excel'in 1900 artık yıl hatası dahil: seri 1 = 1 Ocak 1900
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** JS tarihini Excel seri numarasına çevirir. */
export function dateToExcelSerial(d: Date): number {
  return Math.round(d.getTime() / 86400000 + 25569);
}
