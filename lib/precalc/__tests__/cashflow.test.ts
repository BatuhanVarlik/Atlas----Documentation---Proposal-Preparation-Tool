import { describe, expect, it } from 'vitest';
import { PrecalcEngine } from '../engine';
import { readCashflow } from '../cashflow';
import type { PrecalcWorkbook } from '../types';
import workbookData from '../workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

/** Adet, fiyat ve ödeme haftası girilmiş; satış fiyatı da verilmiş bir teklif. */
function quoted() {
  const engine = new PrecalcEngine(workbook);
  const item = workbook.outline.find((r) => r.kind === 'item' && r.r > workbook.meta.headerRow)!;
  engine.setCell('PRECALCULATION', 'F' + item.r, 10);
  engine.setCell('PRECALCULATION', 'I' + item.r, 1000);
  // Ödeme planı tutarları SALES PRICE'a (M4881) bağlıdır.
  engine.setCell('PRECALCULATION', engine.paramAddr('salesPrice')!, 200000);
  engine.settle();
  return engine;
}

describe('cashflow okuması', () => {
  it('52 hafta döner ve haftalar 1den 52ye siralandir', () => {
    const cf = readCashflow(quoted());
    expect(cf.weeks).toHaveLength(52);
    expect(cf.weeks[0].week).toBe(1);
    expect(cf.weeks[51].week).toBe(52);
  });

  it('NET kumülatiftir -- her hafta bir öncekine (gelir - gider) ekler', () => {
    const cf = readCashflow(quoted());
    let running = 0;
    for (const w of cf.weeks) {
      running += w.gelir - w.gider;
      expect(w.net).toBeCloseTo(running, 6);
    }
  });

  it('sekiz ödeme asamas ve toplami okunur', () => {
    const cf = readCashflow(quoted());
    expect(cf.stages).toHaveLength(8);
    expect(cf.stages[0].label).toBe('PRE-PAYMENT');
    expect(cf.stageTotal).toBeCloseTo(
      cf.stages.reduce((s, x) => s + x.amount, 0), 6,
    );
  });

  it('ödeme oranlari toplami 1dir (kitabin kendi plani)', () => {
    const cf = readCashflow(quoted());
    expect(cf.stages.reduce((s, x) => s + x.ratio, 0)).toBeCloseTo(1, 6);
  });

  it('toplamlar ve kapanis neti hafta tablosuyla tutar', () => {
    const cf = readCashflow(quoted());
    expect(cf.totalGelir).toBeCloseTo(cf.weeks.reduce((s, w) => s + w.gelir, 0), 6);
    expect(cf.totalGider).toBeCloseTo(cf.weeks.reduce((s, w) => s + w.gider, 0), 6);
    expect(cf.closingNet).toBeCloseTo(cf.weeks[51].net, 6);
  });

  it('en düsük net, tablodaki gerçek en küçük degerdir', () => {
    const cf = readCashflow(quoted());
    const min = Math.min(...cf.weeks.map((w) => w.net));
    expect(cf.lowest.net).toBeCloseTo(min, 6);
    expect(cf.weeks.find((w) => w.week === cf.lowest.week)!.net).toBeCloseTo(min, 6);
  });

  it('settle() cagrilmamis motorda bile sayisal döner - hata hücresi 0 sayilir', () => {
    // Kitap yinelemeli hesapla kaydedilmis; sabitlenmeden bazi hücreler
    // #DIV/0! kalir. Okuma bunu 0a düsürmeli, NaN sizdirmamali.
    const engine = new PrecalcEngine(workbook);
    const cf = readCashflow(engine);
    for (const w of cf.weeks) {
      expect(Number.isFinite(w.gelir)).toBe(true);
      expect(Number.isFinite(w.gider)).toBe(true);
      expect(Number.isFinite(w.net)).toBe(true);
    }
  });
});
