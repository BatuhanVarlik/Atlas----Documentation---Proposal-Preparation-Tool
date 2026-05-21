// Hat çapı (DIN/SMS) için PRECALCULATION kataloğunda eşleşen ürünleri bulmak için
// token-bazlı eşleştirme. SMS hatlar için outer-Ø, inch ve sade SMS varyantlarını
// hepsini üretir; DIN için DN ve NW varyantları.

import type { PricingItem } from './loader';

export type Standard = 'DIN' | 'SMS';

// SMS hat numarası → outer Ø (mm), inch tam isim
const SMS_LOOKUP: Record<number, { outer: string; inch: string }> = {
  25: { outer: '25.4', inch: '1"' },
  38: { outer: '38.1', inch: '1 1/2"' },
  51: { outer: '50.8', inch: '2"' },
  63: { outer: '63.5', inch: '2 1/2"' },
  76: { outer: '76.1', inch: '3"' },
  101: { outer: '101.6', inch: '4"' },
};

// DIN nominal → inch eşdeğeri (yaygın inç-uyumlu boyutlar)
const DIN_INCH_LOOKUP: Record<number, string> = {
  25: '1"',
  32: '1 1/4"',
  40: '1 1/2"',
  50: '2"',
  65: '2 1/2"',
  80: '3"',
  100: '4"',
  125: '5"',
};

/** Encoding sorunlu (\\uFFFD) veya farklı Ø varyantlarını tek karaktere indirger. */
function normalize(s: string): string {
  return s.replace(/[�Øø?]/g, '#');
}

/** Hat boyut stringinden katalog techSpec'inde aranacak alfanümerik token listesi üret. */
export function generateSizeTokens(size: string, standard: Standard): string[] {
  const tokens: string[] = [];

  if (standard === 'DIN') {
    const m = size.match(/DN(\d+)/i);
    if (!m) return tokens;
    const dn = parseInt(m[1], 10);
    tokens.push(`DN${dn}`, `DN ${dn}`, `DN-${dn}`);
    tokens.push(`NW${dn}`, `NW ${dn}`, `NW-${dn}`);
    const inch = DIN_INCH_LOOKUP[dn];
    if (inch) tokens.push(inch);
  } else {
    // SMS: "25 SMS (1\")" / "38 SMS (1\"1/2)" / "51 SMS (2\")" / "101,6 SMS (4\")" / vb.
    const m = size.match(/^(\d+(?:[.,]\d+)?)\s*SMS/);
    if (!m) return tokens;
    const head = parseFloat(m[1].replace(',', '.'));
    // SMS_LOOKUP key'lerine en yakın olanı seç (101,6 → 101 vb.)
    const smsKeys = Object.keys(SMS_LOOKUP).map(Number);
    const intHead = smsKeys.reduce(
      (closest, k) => (Math.abs(k - head) < Math.abs(closest - head) ? k : closest),
      smsKeys[0] ?? Math.round(head),
    );

    // Tamsayı SMS varyantları
    tokens.push(
      `SMS${intHead}`,
      `SMS ${intHead}`,
      `SMSØ${intHead}`,
      `SMS Ø${intHead}`,
      `SMS�${intHead}`,            // bozulmuş Ø karakteri
      `SMS-${intHead}`,
    );

    // Outer Ø (Krohne Optimass: "SMSØ38.1" gibi)
    const meta = SMS_LOOKUP[intHead];
    if (meta) {
      tokens.push(
        `SMSØ${meta.outer}`,
        `SMS Ø${meta.outer}`,
        `SMS�${meta.outer}`,
        `SMS${meta.outer}`,
        `SMS ${meta.outer}`,
        meta.inch,                  // örn. `1 1/2"`, `2"`
        // ISO 2037 outer Ø (APV VPN: "ISO-50.8", "ISO-38" gibi)
        `ISO-${meta.outer}`,
        `ISO ${meta.outer}`,
        `ISO-${intHead}`,
        `ISO ${intHead}`,
      );
    }
  }

  return tokens;
}

/** Items içinde, herhangi bir token techSpec'te geçenleri bul. Birden fazla varsa en düşük fiyatlı. */
export function findBySizeTokens(
  items: PricingItem[],
  size: string,
  standard: Standard,
): { item: PricingItem | null; matchedToken: string | null } {
  const tokens = generateSizeTokens(size, standard);
  if (tokens.length === 0) return { item: null, matchedToken: null };

  const normalizedTokens = tokens.map((t) => ({ raw: t, norm: normalize(t) }));

  const matches: { item: PricingItem; token: string }[] = [];
  for (const it of items) {
    const spec = normalize(it.techSpec);
    for (const tok of normalizedTokens) {
      if (spec.includes(tok.norm)) {
        matches.push({ item: it, token: tok.raw });
        break;
      }
    }
  }
  if (matches.length === 0) return { item: null, matchedToken: null };
  matches.sort((a, b) => a.item.listPrice - b.item.listPrice);
  return { item: matches[0].item, matchedToken: matches[0].token };
}
