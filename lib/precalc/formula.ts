/**
 * Excel formül ayrıştırıcı + değerlendirici.
 *
 * PRECALCULATION çalışma kitabındaki formüllerin tamamını (48.000+ hücre)
 * tarayıcıda birebir çalıştırabilmek için yazılmış küçük bir motor.
 * Kapsam bilinçli olarak dardır: yalnızca kaynak dosyada geçen işleçler ve
 * fonksiyonlar desteklenir.
 */

export type CellValue = number | string | boolean | ExcelError | null;

export class ExcelError {
  constructor(public readonly code: string) {}
  toString() { return this.code; }
}

export const ERR_VALUE = new ExcelError('#VALUE!');
export const ERR_DIV0 = new ExcelError('#DIV/0!');
export const ERR_NA = new ExcelError('#N/A');
export const ERR_REF = new ExcelError('#REF!');
export const ERR_NAME = new ExcelError('#NAME?');
export const ERR_CYCLE = new ExcelError('#CYCLE!');

export function isError(v: unknown): v is ExcelError {
  return v instanceof ExcelError;
}

/* ------------------------------------------------------------------ */
/* AST                                                                 */
/* ------------------------------------------------------------------ */

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: string }
  | { k: 'ref'; sheet: string | null; addr: string }
  | { k: 'range'; sheet: string | null; from: string; to: string }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'un'; op: string; e: Node }
  | { k: 'fn'; name: string; args: Node[] };

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'err'; v: string }
  | { t: 'ident'; v: string }
  | { t: 'sheet'; v: string }
  | { t: 'cell'; v: string }
  | { t: 'op'; v: string };

const OPS2 = ['<=', '>=', '<>'];
const WORD_START = /[A-Za-zÇĞİÖŞÜçğıöşü_$]/;
const WORD_BODY = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9_$.]+/;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    // dize
    if (c === '"') {
      let s = '';
      i++;
      while (i < n) {
        if (src[i] === '"') {
          if (src[i + 1] === '"') { s += '"'; i += 2; continue; }
          i++; break;
        }
        s += src[i++];
      }
      out.push({ t: 'str', v: s });
      continue;
    }

    // hata sabiti (#N/A, #REF! ...)
    if (c === '#') {
      const m = /^#[A-Z0-9/]+!?/.exec(src.slice(i));
      if (m) { out.push({ t: 'err', v: m[0] }); i += m[0].length; continue; }
    }

    // tırnaklı sayfa adı:  'Ad Soyad'!A1
    if (c === "'") {
      let s = '';
      i++;
      while (i < n) {
        if (src[i] === "'") {
          if (src[i + 1] === "'") { s += "'"; i += 2; continue; }
          i++; break;
        }
        s += src[i++];
      }
      if (src[i] === '!') i++;
      out.push({ t: 'sheet', v: s });
      continue;
    }

    // sayı
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?/.exec(src.slice(i));
      if (m) {
        out.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
    }

    // tanımlayıcı / hücre / tırnaksız sayfa adı
    if (WORD_START.test(c)) {
      const m = WORD_BODY.exec(src.slice(i));
      const word = m ? m[0] : c;
      i += word.length;

      // tırnaksız sayfa niteleyicisi:  KABLO!K82
      if (src[i] === '!') {
        i++;
        out.push({ t: 'sheet', v: word });
        continue;
      }

      const bare = word.replace(/\$/g, '');
      if (/^[A-Za-z]{1,3}[0-9]{1,7}$/.test(bare)) {
        out.push({ t: 'cell', v: bare.toUpperCase() });
      } else {
        out.push({ t: 'ident', v: bare.toUpperCase() });
      }
      continue;
    }

    // iki karakterli işleç
    const two = src.slice(i, i + 2);
    if (OPS2.includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }

    out.push({ t: 'op', v: c });
    i++;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined { return this.toks[this.p]; }
  private next(): Tok | undefined { return this.toks[this.p++]; }
  private isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  }
  private eat(v: string): boolean {
    if (this.isOp(v)) { this.p++; return true; }
    return false;
  }

  parse(): Node {
    return this.comparison();
  }

  private comparison(): Node {
    let l = this.concat();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(t.v)) {
        this.p++;
        l = { k: 'bin', op: t.v, l, r: this.concat() };
      } else return l;
    }
  }

  private concat(): Node {
    let l = this.additive();
    while (this.isOp('&')) { this.p++; l = { k: 'bin', op: '&', l, r: this.additive() }; }
    return l;
  }

  private additive(): Node {
    let l = this.multiplicative();
    for (;;) {
      if (this.isOp('+')) { this.p++; l = { k: 'bin', op: '+', l, r: this.multiplicative() }; }
      else if (this.isOp('-')) { this.p++; l = { k: 'bin', op: '-', l, r: this.multiplicative() }; }
      else return l;
    }
  }

  private multiplicative(): Node {
    let l = this.unary();
    for (;;) {
      if (this.isOp('*')) { this.p++; l = { k: 'bin', op: '*', l, r: this.unary() }; }
      else if (this.isOp('/')) { this.p++; l = { k: 'bin', op: '/', l, r: this.unary() }; }
      else return l;
    }
  }

  private unary(): Node {
    if (this.isOp('-')) { this.p++; return { k: 'un', op: '-', e: this.unary() }; }
    if (this.isOp('+')) { this.p++; return this.unary(); }
    return this.power();
  }

  private power(): Node {
    let l = this.postfix();
    while (this.isOp('^')) { this.p++; l = { k: 'bin', op: '^', l, r: this.postfix() }; }
    return l;
  }

  /** yüzde son eki: 30% */
  private postfix(): Node {
    let e = this.primary();
    while (this.isOp('%')) { this.p++; e = { k: 'bin', op: '/', l: e, r: { k: 'num', v: 100 } }; }
    return e;
  }

  /**
   * Aralığın bitiş hücresini okur. Excel bazen iki ucu da sayfayla niteler:
   * SUM(PRECALCULATION!F3195:'PRECALCULATION'!F3195). Bitişteki sayfa adı
   * başlangıçtakiyle aynı olmak zorunda olduğundan yok sayılır.
   */
  private rangeEnd(): string | null {
    let t = this.next();
    if (t && t.t === 'sheet') t = this.next();
    return t && t.t === 'cell' ? t.v : null;
  }

  private primary(): Node {
    const t = this.next();
    if (!t) return { k: 'err', v: '#VALUE!' };

    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'err') return { k: 'err', v: t.v };

    if (t.t === 'op' && t.v === '(') {
      const e = this.parse();
      this.eat(')');
      return e;
    }

    if (t.t === 'sheet') {
      const c = this.next();
      if (!c || c.t !== 'cell') return { k: 'err', v: '#REF!' };
      if (this.isOp(':')) {
        this.p++;
        const c2 = this.rangeEnd();
        if (!c2) return { k: 'err', v: '#REF!' };
        return { k: 'range', sheet: t.v, from: c.v, to: c2 };
      }
      return { k: 'ref', sheet: t.v, addr: c.v };
    }

    if (t.t === 'cell') {
      if (this.isOp(':')) {
        this.p++;
        const c2 = this.rangeEnd();
        if (!c2) return { k: 'err', v: '#REF!' };
        return { k: 'range', sheet: null, from: t.v, to: c2 };
      }
      return { k: 'ref', sheet: null, addr: t.v };
    }

    if (t.t === 'ident') {
      if (t.v === 'TRUE') return { k: 'bool', v: true };
      if (t.v === 'FALSE') return { k: 'bool', v: false };

      if (this.isOp('(')) {
        this.p++;
        const args: Node[] = [];
        if (!this.isOp(')')) {
          for (;;) {
            args.push(this.parse());
            if (this.eat(',')) continue;
            if (this.eat(';')) continue;
            break;
          }
        }
        this.eat(')');
        return { k: 'fn', name: t.v, args };
      }
      // adlandırılmış aralık — desteklenmiyor
      return { k: 'err', v: '#NAME?' };
    }

    return { k: 'err', v: '#VALUE!' };
  }
}

const astCache = new Map<string, Node>();

export function parseFormula(src: string): Node {
  const hit = astCache.get(src);
  if (hit) return hit;
  const ast = new Parser(tokenize(src)).parse();
  astCache.set(src, ast);
  return ast;
}

/* ------------------------------------------------------------------ */
/* Adres yardımcıları                                                  */
/* ------------------------------------------------------------------ */

export function colToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n - 1;
}

export function indexToCol(idx: number): string {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function splitAddr(addr: string): { col: number; row: number } {
  const m = /^([A-Z]+)([0-9]+)$/.exec(addr);
  if (!m) return { col: 0, row: 0 };
  return { col: colToIndex(m[1]), row: parseInt(m[2], 10) };
}

/* ------------------------------------------------------------------ */
/* Tür dönüşümleri                                                     */
/* ------------------------------------------------------------------ */

export function toNumber(v: CellValue): number | ExcelError {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isError(v)) return v;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isNaN(n) ? ERR_VALUE : n;
}

export function toText(v: CellValue): string {
  if (v === null || v === undefined) return '';
  if (isError(v)) return v.code;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

export function toBool(v: CellValue): boolean | ExcelError {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (isError(v)) return v;
  const s = String(v).toUpperCase();
  if (s === 'TRUE') return true;
  if (s === 'FALSE') return false;
  return ERR_VALUE;
}

/** Excel karşılaştırma sırası: sayı < metin < mantıksal */
function compare(a: CellValue, b: CellValue): number {
  const an = a === null || a === '' ? 0 : a;
  const bn = b === null || b === '' ? 0 : b;
  if (typeof an === 'number' && typeof bn === 'number') return an - bn;
  if (typeof an === 'number' && typeof bn === 'string') return -1;
  if (typeof an === 'string' && typeof bn === 'number') return 1;
  const as = toText(an).toUpperCase();
  const bs = toText(bn).toUpperCase();
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Değerlendirme bağlamı                                               */
/* ------------------------------------------------------------------ */

export interface EvalContext {
  /** Tek hücrenin (hesaplanmış) değerini döndürür. */
  getCell(sheet: string, addr: string): CellValue;
  /** Aralıktaki dolu hücreleri satır-sütun sırasıyla döndürür. */
  getRange(sheet: string, from: string, to: string): CellValue[];
  /** Aralığı hücre hücre gezer (SUMIF/COUNTIF/VLOOKUP hizalaması için). */
  eachInRange(
    sheet: string,
    from: string,
    to: string,
    fn: (v: CellValue, rowOffset: number, colOffset: number) => void,
  ): void;
  /** Nitelenmemiş referansların ait olduğu sayfa. */
  currentSheet: string;
  /** CELL("filename") için kaynak dosya adı (ör. "ORNEK PRECALCULATION 36.01.xlsm"). */
  workbookFileName?: string;
}

const LAZY = new Set(['IF', 'AND', 'OR', 'ISERROR', 'IFERROR', 'ISERR']);

export function evaluate(node: Node, ctx: EvalContext): CellValue {
  switch (node.k) {
    case 'num': return node.v;
    case 'str': return node.v;
    case 'bool': return node.v;
    case 'err': return new ExcelError(node.v);

    case 'ref':
      return ctx.getCell(node.sheet ?? ctx.currentSheet, node.addr);

    case 'range': {
      // Tek başına kullanılan aralık — ilk hücre gibi davranır
      const vals = ctx.getRange(node.sheet ?? ctx.currentSheet, node.from, node.to);
      return vals.length ? vals[0] : null;
    }

    case 'un': {
      const v = evaluate(node.e, ctx);
      const n = toNumber(v);
      if (isError(n)) return n;
      return -n;
    }

    case 'bin': return evalBinary(node, ctx);
    case 'fn': return evalFunction(node, ctx);
  }
}

function evalBinary(node: Extract<Node, { k: 'bin' }>, ctx: EvalContext): CellValue {
  const op = node.op;

  if (op === '&') {
    const l = evaluate(node.l, ctx);
    if (isError(l)) return l;
    const r = evaluate(node.r, ctx);
    if (isError(r)) return r;
    return toText(l) + toText(r);
  }

  const lv = evaluate(node.l, ctx);
  if (isError(lv)) return lv;
  const rv = evaluate(node.r, ctx);
  if (isError(rv)) return rv;

  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    const c = compare(lv, rv);
    switch (op) {
      case '=': return c === 0;
      case '<>': return c !== 0;
      case '<': return c < 0;
      case '>': return c > 0;
      case '<=': return c <= 0;
      case '>=': return c >= 0;
    }
  }

  const a = toNumber(lv);
  if (isError(a)) return a;
  const b = toNumber(rv);
  if (isError(b)) return b;

  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? ERR_DIV0 : a / b;
    case '^': return Math.pow(a, b);
  }
  return ERR_VALUE;
}

/** Bir düğümü "sayı listesi" olarak toplar (SUM/MAX gibi toplayıcılar için). */
function collectNumbers(node: Node, ctx: EvalContext, out: number[]): ExcelError | null {
  if (node.k === 'range') {
    const vals = ctx.getRange(node.sheet ?? ctx.currentSheet, node.from, node.to);
    for (const v of vals) {
      if (isError(v)) return v;
      // aralıktaki metin ve boş hücreler yok sayılır (Excel davranışı)
      if (typeof v === 'number') out.push(v);
    }
    return null;
  }
  const v = evaluate(node, ctx);
  if (isError(v)) return v;
  const n = toNumber(v);
  if (isError(n)) return n;
  out.push(n);
  return null;
}

/** SUMIF/COUNTIF ölçütü: "1", ">5", "YES" ... */
function makeCriteria(crit: CellValue): (v: CellValue) => boolean {
  if (isError(crit)) return () => false;
  const s = toText(crit).trim();
  const m = /^(<=|>=|<>|<|>|=)(.*)$/.exec(s);
  if (m) {
    const op = m[1];
    const raw = m[2].trim();
    const rhs: CellValue = raw === '' ? null : Number.isNaN(Number(raw)) ? raw : Number(raw);
    return (v) => {
      const c = compare(v, rhs);
      switch (op) {
        case '=': return c === 0;
        case '<>': return c !== 0;
        case '<': return c < 0;
        case '>': return c > 0;
        case '<=': return c <= 0;
        case '>=': return c >= 0;
      }
      return false;
    };
  }
  const asNum = s === '' || Number.isNaN(Number(s)) ? null : Number(s);
  if (asNum !== null) return (v) => compare(v, asNum) === 0;
  const up = s.toUpperCase();
  return (v) => toText(v).trim().toUpperCase() === up;
}

function evalFunction(node: Extract<Node, { k: 'fn' }>, ctx: EvalContext): CellValue {
  const name = node.name;
  const args = node.args;

  // ---- kısa devre yapan fonksiyonlar ----
  if (LAZY.has(name)) {
    switch (name) {
      case 'IF': {
        const cond = evaluate(args[0], ctx);
        if (isError(cond)) return cond;
        const b = toBool(cond);
        if (isError(b)) return b;
        if (b) return args[1] ? evaluate(args[1], ctx) : true;
        return args[2] ? evaluate(args[2], ctx) : false;
      }
      case 'AND':
      case 'OR': {
        const wantAll = name === 'AND';
        for (const a of args) {
          const vals: CellValue[] = [];
          if (a.k === 'range') {
            ctx.eachInRange(a.sheet ?? ctx.currentSheet, a.from, a.to, (v) => vals.push(v));
          } else vals.push(evaluate(a, ctx));
          for (const v of vals) {
            if (isError(v)) return v;
            if (v === null || v === '') continue;
            const b = toBool(v);
            if (isError(b)) return b;
            if (wantAll && !b) return false;
            if (!wantAll && b) return true;
          }
        }
        return wantAll;
      }
      case 'ISERROR':
      case 'ISERR':
        return isError(evaluate(args[0], ctx));
      case 'IFERROR': {
        const v = evaluate(args[0], ctx);
        return isError(v) ? evaluate(args[1], ctx) : v;
      }
    }
  }

  switch (name) {
    case 'SUM': {
      const nums: number[] = [];
      for (const a of args) {
        const e = collectNumbers(a, ctx, nums);
        if (e) return e;
      }
      let total = 0;
      for (const x of nums) total += x;
      return total;
    }

    case 'MAX':
    case 'MIN': {
      const nums: number[] = [];
      for (const a of args) {
        const e = collectNumbers(a, ctx, nums);
        if (e) return e;
      }
      if (!nums.length) return 0;
      let best = nums[0];
      for (const x of nums) {
        if (name === 'MAX' ? x > best : x < best) best = x;
      }
      return best;
    }

    case 'ROUND':
    case 'ROUNDUP':
    case 'ROUNDDOWN': {
      const v = toNumber(evaluate(args[0], ctx));
      if (isError(v)) return v;
      const d = args[1] ? toNumber(evaluate(args[1], ctx)) : 0;
      if (isError(d)) return d;
      const f = Math.pow(10, d);
      const x = v * f;
      const sign = x < 0 ? -1 : 1;
      let r: number;
      if (name === 'ROUND') r = sign * Math.round(Math.abs(x));
      else if (name === 'ROUNDUP') r = sign * Math.ceil(Math.abs(x) - 1e-9);
      else r = sign * Math.floor(Math.abs(x) + 1e-9);
      // Math.ceil(-1e-9) = -0; eksi sıfır ekranda ve dışa aktarımda şaşırtır.
      return r === 0 ? 0 : r / f;
    }

    case 'MROUND': {
      const v = toNumber(evaluate(args[0], ctx));
      if (isError(v)) return v;
      const m = toNumber(evaluate(args[1], ctx));
      if (isError(m)) return m;
      if (m === 0) return 0;
      if (v !== 0 && Math.sign(v) !== Math.sign(m)) return ERR_NA;
      return Math.round(v / m) * m;
    }

    case 'ABS': {
      const v = toNumber(evaluate(args[0], ctx));
      return isError(v) ? v : Math.abs(v);
    }

    case 'VALUE': {
      const v = evaluate(args[0], ctx);
      if (isError(v)) return v;
      if (typeof v === 'number') return v;
      const s = toText(v).trim().replace(/\s/g, '').replace(',', '.');
      if (s === '') return ERR_VALUE;
      const n = Number(s);
      return Number.isNaN(n) ? ERR_VALUE : n;
    }

    // UPPER/LOWER Excel'de sistemin yerel ayarına göre çalışır. Kaynak dosya
    // Türkçe Windows'ta hazırlandığı için "Acid" -> "ACİD" olur; B sütunundaki
    // ekipman kodları bu davranışa bağlı olduğundan aynısını uyguluyoruz.
    case 'UPPER': {
      const v = evaluate(args[0], ctx);
      if (isError(v)) return v;
      return toText(v).toLocaleUpperCase('tr-TR');
    }

    case 'LOWER': {
      const v = evaluate(args[0], ctx);
      if (isError(v)) return v;
      return toText(v).toLocaleLowerCase('tr-TR');
    }

    case 'TRIM': {
      const v = evaluate(args[0], ctx);
      if (isError(v)) return v;
      return toText(v).replace(/\s+/g, ' ').trim();
    }

    case 'LEN': {
      const v = evaluate(args[0], ctx);
      if (isError(v)) return v;
      return toText(v).length;
    }

    case 'MID': {
      const t = evaluate(args[0], ctx);
      if (isError(t)) return t;
      const start = toNumber(evaluate(args[1], ctx));
      if (isError(start)) return start;
      const len = toNumber(evaluate(args[2], ctx));
      if (isError(len)) return len;
      if (start < 1 || len < 0) return ERR_VALUE;
      return toText(t).slice(start - 1, start - 1 + len);
    }

    case 'LEFT': {
      const t = evaluate(args[0], ctx);
      if (isError(t)) return t;
      const len = args[1] ? toNumber(evaluate(args[1], ctx)) : 1;
      if (isError(len)) return len;
      return toText(t).slice(0, len);
    }

    case 'RIGHT': {
      const t = evaluate(args[0], ctx);
      if (isError(t)) return t;
      const len = args[1] ? toNumber(evaluate(args[1], ctx)) : 1;
      if (isError(len)) return len;
      return len <= 0 ? '' : toText(t).slice(-len);
    }

    case 'SEARCH':
    case 'FIND': {
      const needle = evaluate(args[0], ctx);
      if (isError(needle)) return needle;
      const hay = evaluate(args[1], ctx);
      if (isError(hay)) return hay;
      const start = args[2] ? toNumber(evaluate(args[2], ctx)) : 1;
      if (isError(start)) return start;
      let hs = toText(hay);
      let ns = toText(needle);
      if (name === 'SEARCH') { hs = hs.toUpperCase(); ns = ns.toUpperCase(); }
      const idx = hs.indexOf(ns, Math.max(0, start - 1));
      return idx < 0 ? ERR_VALUE : idx + 1;
    }

    case 'SUMIF': {
      if (args[0].k !== 'range') return ERR_VALUE;
      const crit = makeCriteria(evaluate(args[1], ctx));
      const rangeNode = args[0];
      const sumNode = args[2] ?? args[0];
      const sheet = rangeNode.sheet ?? ctx.currentSheet;

      if (sumNode.k !== 'range') {
        let total = 0;
        ctx.eachInRange(sheet, rangeNode.from, rangeNode.to, (v) => {
          if (crit(v) && typeof v === 'number') total += v;
        });
        return total;
      }

      const sumSheet = sumNode.sheet ?? ctx.currentSheet;
      const sumOrigin = splitAddr(sumNode.from);
      let total = 0;
      ctx.eachInRange(sheet, rangeNode.from, rangeNode.to, (v, dr, dc) => {
        if (!crit(v)) return;
        const addr = indexToCol(sumOrigin.col + dc) + (sumOrigin.row + dr);
        const sv = ctx.getCell(sumSheet, addr);
        if (typeof sv === 'number') total += sv;
      });
      return total;
    }

    case 'COUNTIF': {
      if (args[0].k !== 'range') return ERR_VALUE;
      const crit = makeCriteria(evaluate(args[1], ctx));
      const r = args[0];
      let count = 0;
      ctx.eachInRange(r.sheet ?? ctx.currentSheet, r.from, r.to, (v) => {
        if (v === null || v === '') return;
        if (crit(v)) count++;
      });
      return count;
    }

    case 'COUNT': {
      const nums: number[] = [];
      for (const a of args) {
        const e = collectNumbers(a, ctx, nums);
        if (e) return e;
      }
      return nums.length;
    }

    case 'VLOOKUP': {
      const key = evaluate(args[0], ctx);
      if (isError(key)) return key;
      if (args[1].k !== 'range') return ERR_NA;
      const tbl = args[1];
      const colIdx = toNumber(evaluate(args[2], ctx));
      if (isError(colIdx)) return colIdx;
      const sheet = tbl.sheet ?? ctx.currentSheet;
      const origin = splitAddr(tbl.from);
      let found: CellValue | undefined;
      ctx.eachInRange(sheet, tbl.from, tbl.to, (v, dr, dc) => {
        if (dc !== 0 || found !== undefined) return;
        if (compare(v, key) === 0) {
          found = ctx.getCell(sheet, indexToCol(origin.col + colIdx - 1) + (origin.row + dr));
        }
      });
      return found === undefined ? ERR_NA : found;
    }

    case 'WEEKNUM': {
      const serial = toNumber(evaluate(args[0], ctx));
      if (isError(serial)) return serial;
      // Excel seri numarası -> hafta numarası (tip 1: hafta Pazar başlar)
      const d = new Date(Date.UTC(1899, 11, 30));
      d.setUTCDate(d.getUTCDate() + Math.floor(serial));
      const year = d.getUTCFullYear();
      const firstOfYear = new Date(Date.UTC(year, 0, 1));
      const dayOfYear = Math.floor((d.getTime() - firstOfYear.getTime()) / 86400000) + 1;
      return Math.floor((dayOfYear + firstOfYear.getUTCDay() - 1) / 7) + 1;
    }

    case 'CELL': {
      const kind = toText(evaluate(args[0], ctx)).toLowerCase();
      // Excel CELL("filename") -> "C:\yol\[dosya.xlsm]Sayfa Adı"
      if (kind === 'filename' || kind === 'dosyaadi' || kind === 'dosyaadı') {
        const file = ctx.workbookFileName ?? '';
        return `[${file}]${ctx.currentSheet}`;
      }
      return '';
    }

    case 'NA': return ERR_NA;

    default:
      return ERR_NAME;
  }
}
