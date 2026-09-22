import type { PrecalcEngine } from './engine';

/**
 * Projenin haftalık nakit akışı.
 *
 * Kaynak kitapta ödeme planının sağında duran tabloyu (36.07'de P4883:X4934)
 * okur. Hesabı burada yeniden kurmuyoruz — kitabın kendi formülleri
 * çalıştırılıyor, biz yalnızca sonucu topluyoruz:
 *
 *   W (GELİR) = SUMIF(tahsilat haftası; ödeme planı tutarları)
 *   X (GİDER) = SUMIF(ödeme haftası; kalem maliyetleri)
 *   V (NET)   = bir önceki NET + (GELİR − GİDER)      ← kümülatif
 *
 * Böylece ekranda gördüğü rakam ile Excel'den çıkan rakam ayrışmaz.
 *
 * Satır numaraları sürümden sürüme kaydığı için sabit yazılmaz; hepsi
 * `engine.anchors.subtotalRow` üzerinden ofsettir.
 */

/** Tablodaki tek bir hafta. */
export interface CashflowWeek {
  week: number;
  gelir: number;
  gider: number;
  /** Kümülatif net — o haftanın sonundaki kasa durumu. */
  net: number;
}

/** Ödeme planındaki bir aşama. */
export interface PaymentStage {
  /** Excel satır numarası — düzenlenebilir hücrelerin adresi buradan kurulur. */
  row: number;
  label: string;
  /** Toplam satıştan bu aşamaya düşen oran (0–1). */
  ratio: number;
  /** Aşamanın tamamlandığı proje haftası. */
  week: number;
  amount: number;
  /** Tahsilatın kasaya girdiği hafta (kitapta hafta + 2). */
  collectWeek: number;
}

export interface CashflowData {
  weeks: CashflowWeek[];
  stages: PaymentStage[];
  stageTotal: number;
  totalGelir: number;
  totalGider: number;
  /** 52. haftadaki kümülatif net. */
  closingNet: number;
  /** Kasanın en dibe indiği hafta — finansmanın karşılaması gereken tutar. */
  lowest: { week: number; net: number };
}

/** Haftalık tablonun ilk satırı: ara toplamdan 20 satır aşağıda. */
const WEEK_OFFSET = 20;
/** Ödeme planının ilk aşaması: ara toplamdan 21 satır aşağıda. */
const STAGE_OFFSET = 21;

export const WEEK_COUNT = 52;
export const STAGE_COUNT = 8;

/** Hata hücresi (#DIV/0! gibi) ya da boş değer sıfır sayılır. */
const n = (engine: PrecalcEngine, addr: string): number => {
  const v = engine.num(addr);
  return Number.isFinite(v) ? v : 0;
};

export function readCashflow(engine: PrecalcEngine): CashflowData {
  const { subtotalRow } = engine.anchors;
  const firstWeekRow = subtotalRow + WEEK_OFFSET;
  const firstStageRow = subtotalRow + STAGE_OFFSET;

  const weeks: CashflowWeek[] = [];
  for (let i = 0; i < WEEK_COUNT; i++) {
    const r = firstWeekRow + i;
    weeks.push({
      week: i + 1,
      gelir: n(engine, 'W' + r),
      gider: n(engine, 'X' + r),
      net: n(engine, 'V' + r),
    });
  }

  const stages: PaymentStage[] = [];
  for (let i = 0; i < STAGE_COUNT; i++) {
    const r = firstStageRow + i;
    stages.push({
      row: r,
      label: engine.text('A' + r),
      ratio: n(engine, 'B' + r),
      week: n(engine, 'C' + r),
      amount: n(engine, 'D' + r),
      collectWeek: n(engine, 'E' + r),
    });
  }

  let lowest = { week: weeks[0].week, net: weeks[0].net };
  for (const w of weeks) if (w.net < lowest.net) lowest = { week: w.week, net: w.net };

  return {
    weeks,
    stages,
    // Kitabın kendi toplamı (D<ilk aşama + 8>) — aşamalarla aynı olmalı.
    stageTotal: n(engine, 'D' + (firstStageRow + STAGE_COUNT)),
    totalGelir: weeks.reduce((s, w) => s + w.gelir, 0),
    totalGider: weeks.reduce((s, w) => s + w.gider, 0),
    closingNet: weeks[WEEK_COUNT - 1].net,
    lowest,
  };
}
