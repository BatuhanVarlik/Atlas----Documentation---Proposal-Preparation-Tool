// Flowmetre seçimi — IFM SMF serisi (DN15–DN125 hijyenik manyetik flowmetre).
// İstenen çapa (DN/SMS) en yakın DN'li SMF kalemi seçilir. Hem Süt Alım hem Depolama kullanır.
import { getPricingDataset, type PricingItem } from './loader';

/** "DN50"→50, "51 SMS (2\")"→51, "63 SMS"→63, "Ø38"→38 */
export function parseSizeMm(size: string | null): number | null {
  if (!size) return null;
  const dn = size.match(/DN\s*(\d+)/i);
  if (dn) return parseInt(dn[1], 10);
  const sms = size.match(/(\d+(?:[.,]\d+)?)\s*SMS/i);
  if (sms) return parseFloat(sms[1].replace(',', '.'));
  const any = size.match(/(\d+(?:[.,]\d+)?)/);
  return any ? parseFloat(any[1].replace(',', '.')) : null;
}

/** IFM SMF flowmetreyi istenen ölçüye en yakın DN'e göre seçer. */
export function findIfmFlowMeter(size: string | null): { item: PricingItem | null; model: string } {
  const smf = getPricingDataset()
    .items.filter((it) => it.productType === 'IFM' && /^SMF\d/.test(it.eqNo))
    .map((it) => {
      const m = it.techSpec.match(/DN\s*(\d+)/i);
      return { it, dn: m ? parseInt(m[1], 10) : NaN };
    })
    .filter((x) => !Number.isNaN(x.dn));
  if (smf.length === 0) return { item: null, model: 'IFM SMF' };

  const target = parseSizeMm(size);
  const pick =
    target == null
      ? [...smf].sort((a, b) => a.it.listPrice - b.it.listPrice)[0]
      : smf.reduce((best, x) => (Math.abs(x.dn - target) < Math.abs(best.dn - target) ? x : best), smf[0]);
  return { item: pick.it, model: `IFM ${pick.it.eqNo}` };
}
