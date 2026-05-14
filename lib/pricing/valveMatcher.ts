// Modülde seçilen vanaları PRECALCULATION fiyat kataloğuyla eşler.
// Vana tipi + standart + çap + kontrol ünitesi ile catalog item bulur.

import { getPricingDataset, type PricingItem } from './loader';

export type CatalogValveType =
  | 'SDE44' | 'D44' | 'D44SL' | 'DA44'
  | 'SW41' | 'SW43' | 'SW44'
  | 'SWCIP41' | 'SD41'
  | 'SWCIP42' | 'SD42'
  | 'SV1';

export type ControlUnit = 'NONE' | 'AS_I' | 'DC';

export interface ValveMatchInput {
  valveType: CatalogValveType;
  standard: 'DIN' | 'SMS';
  size: string;        // örn: "DN50" veya "51 SMS (2\")"
  controlUnit?: ControlUnit;
}

export interface ValveMatchResult {
  found: boolean;
  item: PricingItem | null;
  matchedSizeToken: string | null;
  reason?: string;
}

// Modül vana tipini katalog subCategory pattern'ine çevirir
const VALVE_TYPE_PATTERNS: Record<CatalogValveType, RegExp> = {
  SDE44:   /SDE44/i,
  D44:     /^D44\s+NSL/i,           // D44 NSL Double Seat Valve
  D44SL:   /^D44\s+SL\s+Double|^DT4\s+SL\s+Double|^D4\s+SL/i,
  DA44:    /^DA44/i,
  SW41:    /SW41/i,
  SW43:    /SW43/i,
  SW44:    /SW44/i,
  SWCIP41: /SWCIP41|SWCip41/i,
  SD41:    /^SD41/i,
  SWCIP42: /SWCIP42|SWCip42/i,
  SD42:    /^SD42/i,
  SV1:     /^SV1\s+BUTTERFLY/i,
};

// DIN/SMS çap stringi → catalog techSpec'te aranacak token
// Örn: "DN50" → "-50 " ; "51 SMS (2\")" → '-2"'
function sizeToToken(size: string, standard: 'DIN' | 'SMS'): string {
  if (standard === 'DIN') {
    const m = size.match(/DN(\d+)/i);
    if (m) return `-${m[1]} `;     // "-50 " (boşluk önemli: 50 ile 500 karışmasın)
  } else {
    // SMS: "51 SMS (2\")" → '-2"'  veya "38 SMS (1\"1/2)" → '-1.5"'
    if (size.includes('(1"1/2)')) return '-1.5"';
    if (size.includes('(2"1/2)')) return '-2.5"';
    const m = size.match(/\((\d+)"\)/);
    if (m) return `-${m[1]}"`;
  }
  return '';
}

// Kontrol ünitesine göre item filtrele.
// NONE → "PNEUMATIC ACTUATED PROCESS VALVES" sub-category (Excel'deki ayrı grup).
// AS_I → techSpec içinde ASI / AS-I
// DC   → techSpec içinde -DC / DC
function matchesControlUnit(
  item: { techSpec: string; subCategory: string },
  cu: ControlUnit,
): boolean {
  const t = item.techSpec.toUpperCase();
  const s = item.subCategory.toUpperCase();
  if (cu === 'AS_I') {
    if (s === 'PNEUMATIC ACTUATED PROCESS VALVES') return false;
    return /\bASI\b|\bAS-I\b/.test(t);
  }
  if (cu === 'DC') {
    if (s === 'PNEUMATIC ACTUATED PROCESS VALVES') return false;
    return /-DC\b|\bDC\b/.test(t);
  }
  if (cu === 'NONE') {
    return s === 'PNEUMATIC ACTUATED PROCESS VALVES';
  }
  return true;
}

export function findValvePrice(input: ValveMatchInput): ValveMatchResult {
  const dataset = getPricingDataset();
  const pattern = VALVE_TYPE_PATTERNS[input.valveType];
  if (!pattern) {
    return { found: false, item: null, matchedSizeToken: null, reason: `Tanımsız vana tipi: ${input.valveType}` };
  }

  const sizeToken = sizeToToken(input.size, input.standard);
  if (!sizeToken) {
    return { found: false, item: null, matchedSizeToken: null, reason: `Çap çözümlenemedi: ${input.size}` };
  }

  // 1) Standard + valveType + size eşleşmesi
  //    Vana tipi artık productType seviyesinde (örn: "SDE44 Double Seat Valve").
  //    Eski subCategory'de de bulunabileceği için her ikisine de bakıyoruz.
  let candidates = dataset.items.filter((it) => {
    if (it.standard !== input.standard) return false;
    if (!pattern.test(it.productType) && !pattern.test(it.subCategory)) return false;
    return it.techSpec.includes(sizeToken);
  });

  // 2) Kontrol ünitesine göre dar — uygun yoksa kontrol ünitesini görmezden gel
  if (input.controlUnit && candidates.length > 1) {
    const cuFiltered = candidates.filter((it) => matchesControlUnit(it, input.controlUnit!));
    if (cuFiltered.length > 0) candidates = cuFiltered;
  }

  if (candidates.length === 0) {
    return { found: false, item: null, matchedSizeToken: sizeToken, reason: `Eşleşme bulunamadı (${input.valveType} ${input.standard} ${input.size})` };
  }

  // En düşük fiyatlı olanı al — yine de tek değilse stable
  candidates.sort((a, b) => a.listPrice - b.listPrice);
  return { found: true, item: candidates[0], matchedSizeToken: sizeToken };
}
