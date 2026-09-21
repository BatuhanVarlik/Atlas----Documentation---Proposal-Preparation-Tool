import type { PrecalcEngine } from './engine';

/**
 * Teklifin kâr oranı.
 *
 * Kitabın kendi hücresi (M<ara toplam+19>) `1-(M<toplam>/M<SALES PRICE>)`
 * biçimindedir ve SALES PRICE elle girilen, varsayılanı 0 olan bir hücredir —
 * girilmediği sürece oran anlamsız çıkar. Bu yüzden gösterilen değer genel
 * toplam satırından türetilir: satışın ne kadarı kâr.
 *
 * Kaynak kitabın hücresi değiştirilmez; yalnızca ekranda ve özet sayfasında
 * gösterdiğimiz rakam buradan gelir.
 *
 * @returns 0–1 arası oran; satış yoksa null (çağıran "—" gösterir).
 */
export function profitRate(engine: PrecalcEngine): number | null {
  const { grandTotalRow } = engine.anchors;
  const sales = engine.num('N' + grandTotalRow);
  if (!(sales > 0)) return null;
  return 1 - engine.num('M' + grandTotalRow) / sales;
}
