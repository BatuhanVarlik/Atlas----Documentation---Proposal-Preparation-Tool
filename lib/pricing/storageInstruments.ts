// Raw Milk Storage modülünde tank ve boşaltım hatlarına bağlı kesin enstrümanları
// PRECALCULATION kataloğuyla eşler. Vanalar lib/pricing/moduleValves.ts'te işlenir;
// burada yalnızca enstrüman, sensör, CIP ball ve agitator gibi yardımcılar var.
//
// Kapsam (katalogda kesin karşılığı olanlar):
//   • Tank Level Switch (LSH / LSM / LSL) — Conductive Level Switch NVS
//   • Tank Temperature Sensor (TT) — IFM Pt100
//   • Tank Pressure Transmitter (PT) — PI1700 Series
//   • Proximity Switch — Inductive Sensor
//   • CIP Ball — STATIC CIP BALL (Type 1AX/2AX) veya CAGGIATI ROTARY CIP BALL
//   • Tank Agitator — TPM+ serisi Venturi Mixer (kW'a göre)
//   • Hat üzeri Flow Meter — KROHNE Optiflux 6050
//   • Hat üzeri Pressure Transmitter — PI1700
//
// Katalogda olmayanlar (eşleşmez):
//   • W+ pompalar (CIP return pump, discharge pump)
//   • Tank gövdesi

import { getPricingDataset, type PricingItem } from './loader';
import { findBySizeTokens } from './catalogSizeMatcher';
import { matchCustomItem } from './customCatalog';

export interface StorageInstrumentItem {
  category: string;
  description: string;
  itemType: string;
  size: string | null;
  quantity: number;
  matched: boolean;
  matchedItem: PricingItem | null;
  reason?: string;
  unitPrice: number;
  unitDiscount: number;
  unitNetPrice: number;
  totalNet: number;
}

export interface StorageInstrumentContext {
  standard: 'DIN' | 'SMS';
  /** Modülün seçilen hat çapı — agitatör (Static Mixer TPX) boyutunu belirler */
  selectedDN?: string | null;
  tanks: Array<{
    name: string;
    hasLSH: boolean;
    hasLSM: boolean;
    hasLSL: boolean;
    hasTT: boolean;
    hasPT: boolean;
    hasProximitySwitch: boolean;
    hasAgitator: boolean;
    agitatorMotorKw: number | null;
    cipBall: 'STATIC' | 'ROTARY';
    cipReturnPumpModel: string | null;
  }>;
  dischargeLines: Array<{
    name: string;
    hasFlowMeter: boolean;
    flowMeterSize: string | null;  // örn 'DN50' veya '51 SMS (2")'
    hasPressureTransmitter: boolean;
    pumpModel: string | null;
  }>;
  /** Modül seviyesi Tank CIP Dönüş pompası */
  tankCipReturnPumpModel?: string | null;
  /** Kataloğa elle eklenmiş ürünler (PricingItem'a çevrilmiş) */
  customItems?: PricingItem[];
}

// ============ Yardımcılar ============

function priceFromItem(item: PricingItem | null) {
  if (!item) return { unitPrice: 0, unitDiscount: 0, unitNetPrice: 0 };
  return { unitPrice: item.listPrice, unitDiscount: item.discount, unitNetPrice: item.netPrice };
}

function makeRow(
  category: string,
  description: string,
  itemType: string,
  size: string | null,
  quantity: number,
  matched: boolean,
  matchedItem: PricingItem | null,
  reason?: string,
): StorageInstrumentItem {
  const { unitPrice, unitDiscount, unitNetPrice } = priceFromItem(matchedItem);
  return {
    category,
    description,
    itemType,
    size,
    quantity,
    matched,
    matchedItem,
    reason,
    unitPrice,
    unitDiscount,
    unitNetPrice,
    totalNet: unitNetPrice * quantity,
  };
}

function findFixedItem(filterFn: (it: PricingItem) => boolean): PricingItem | null {
  const items = getPricingDataset().items.filter(filterFn);
  if (items.length === 0) return null;
  return [...items].sort((a, b) => a.listPrice - b.listPrice)[0];
}

// Hat çapı stringinden sayısal boyutu çıkar ("DN50" → 50, "63 SMS (2\"1/2)" → 63).
function parseDnNumber(size: string | null, standard: 'DIN' | 'SMS'): number | null {
  if (!size) return null;
  if (standard === 'DIN') {
    const m = size.match(/DN\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }
  const m = size.match(/^(\d+(?:[.,]\d+)?)\s*SMS/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

// Agitatör/Mixer: standart (SMS-DS / DIN TPX Mixer) + modül hat çapına en yakın Static Mixer TPX.
// SMS büyük boyutlar techSpec'te "DS" der; bu yüzden boyut techSpec'teki "…mm" sayısından alınır.
function findStaticMixer(standard: 'DIN' | 'SMS', selectedDN: string | null): PricingItem | null {
  const productType = standard === 'DIN' ? 'DIN TPX Mixer' : 'SMS-DS TPX Mixer';
  const candidates = getPricingDataset().items.filter(
    (it) => it.productType === productType && /Static Mixer/i.test(it.machineType),
  );
  if (candidates.length === 0) return null;
  const target = parseDnNumber(selectedDN, standard);
  if (target == null) return [...candidates].sort((a, b) => a.listPrice - b.listPrice)[0];
  let best: { item: PricingItem; diff: number } | null = null;
  for (const it of candidates) {
    const m = it.techSpec.match(/(\d+(?:\.\d+)?)\s*mm/i);
    if (!m) continue;
    const diff = Math.abs(parseFloat(m[1]) - target);
    if (!best || diff < best.diff) best = { item: it, diff };
  }
  return best?.item ?? candidates[0];
}

// ============ Asıl builder ============

export function buildStorageInstrumentItems(ctx: StorageInstrumentContext): StorageInstrumentItem[] {
  const rows: StorageInstrumentItem[] = [];
  const { standard, tanks, dischargeLines } = ctx;

  // --- Tank sensörleri ---
  // Conductive Level Switch NVS (en ucuz HIGH LEVEL SENSOR satırı)
  const levelSwitch = findFixedItem(
    (it) => it.subCategory === 'HIGH LEVEL SENSOR' && /Conductive Level Switch/i.test(it.techSpec),
  );
  const pt100Sensor = findFixedItem(
    (it) => it.subCategory === 'Pt100' && /Temperature Sensor/i.test(it.techSpec) && !/Infrared/i.test(it.techSpec),
  );
  const pressTransmitter = findFixedItem(
    (it) => it.subCategory === 'PRESSURE TRANSMITTER' && /PI1700/i.test(it.productType),
  );
  const proxSwitch = findFixedItem(
    (it) => it.subCategory === 'PROXIMITY SWITCH' && /Inductive Sensor/i.test(it.techSpec) && it.listPrice > 30,
  );

  for (const tank of tanks) {
    if (tank.hasLSH) {
      rows.push(makeRow('Tank Sensörleri', `LSH — ${tank.name}`, 'Conductive Level Switch NVS', null, 1, !!levelSwitch, levelSwitch));
    }
    if (tank.hasLSM) {
      rows.push(makeRow('Tank Sensörleri', `LSM — ${tank.name}`, 'Conductive Level Switch NVS', null, 1, !!levelSwitch, levelSwitch));
    }
    if (tank.hasLSL) {
      rows.push(makeRow('Tank Sensörleri', `LSL — ${tank.name}`, 'Conductive Level Switch NVS', null, 1, !!levelSwitch, levelSwitch));
    }
    if (tank.hasTT) {
      rows.push(makeRow('Tank Sensörleri', `TT (Sıcaklık) — ${tank.name}`, 'IFM PT100', null, 1, !!pt100Sensor, pt100Sensor));
    }
    if (tank.hasPT) {
      rows.push(makeRow('Tank Sensörleri', `PT (Basınç) — ${tank.name}`, 'PI1700 Pressure Transmitter', null, 1, !!pressTransmitter, pressTransmitter));
    }
    if (tank.hasProximitySwitch) {
      rows.push(makeRow('Tank Sensörleri', `Proximity Switch — ${tank.name}`, 'Inductive Proximity', null, 1, !!proxSwitch, proxSwitch));
    }
  }

  // --- CIP Ball ---
  const staticBall = findFixedItem((it) => it.productType === 'STATIC CIP BALL' && it.subCategory === 'CIP BALL');
  const rotaryBall = findFixedItem((it) => /ROTARY CIP BALL/i.test(it.productType) && it.subCategory === 'CIP BALL');

  for (const tank of tanks) {
    if (tank.cipBall === 'STATIC') {
      rows.push(makeRow('CIP Ball', `CIP Ball (Statik) — ${tank.name}`, 'STATIC CIP BALL', null, 1, !!staticBall, staticBall));
    } else {
      rows.push(makeRow('CIP Ball', `CIP Ball (Döner) — ${tank.name}`, 'CAGGIATI ROTARY CIP BALL', null, 1, !!rotaryBall, rotaryBall));
    }
  }

  // --- Agitator (Static Mixer TPX) — standart + hat çapına göre; tüm tanklarda aynı ---
  const mixer = findStaticMixer(standard, ctx.selectedDN ?? null);
  for (const tank of tanks) {
    if (!tank.hasAgitator) continue;
    rows.push(makeRow(
      'Agitator', `Static Mixer TPX — ${tank.name}`, 'Static Mixer TPX', ctx.selectedDN ?? null, 1, !!mixer, mixer,
      mixer ? undefined : 'Static Mixer TPX katalogda bulunamadı',
    ));
  }

  // --- Boşaltım hatları: Flow meter + PT ---
  // KROHNE: Optiflux 6050 (electromagnetic, DN50/65) + Optimass 6400 (Coriolis, SMS Ø25/38/51)
  const krohneItems = getPricingDataset().items.filter(
    (it) =>
      it.subCategory === 'FLOW METER' &&
      (it.productType.toUpperCase() === 'KROHNE' || /Optiflux|Optimass/i.test(it.techSpec)),
  );
  for (const line of dischargeLines) {
    if (line.hasFlowMeter && line.flowMeterSize) {
      const { item } = findBySizeTokens(krohneItems, line.flowMeterSize, standard);
      const model = item && /Optimass/i.test(item.techSpec)
        ? 'Krohne Optimass 6400'
        : 'Krohne Optiflux 6050';
      rows.push(makeRow(
        'Ölçüm', `Flow Meter ${model} — ${line.name}`, model, line.flowMeterSize, 1, !!item, item,
        item ? undefined : `Krohne ${standard} ${line.flowMeterSize} katalogda yok (Optiflux DN50/DN65, Optimass SMS Ø25/38/51 mevcut)`,
      ));
    }
    if (line.hasPressureTransmitter) {
      rows.push(makeRow(
        'Ölçüm', `Pressure Transmitter — ${line.name}`, 'PI1700', null, 1, !!pressTransmitter, pressTransmitter,
      ));
    }
  }

  // --- Katalogda karşılığı olmayan pompalar (Özel Katalog'dan çekilir, yoksa elle) ---
  const customItems = ctx.customItems ?? [];
  const noMatchReason = 'Katalogda karşılığı yok — Özel Katalog\'a ekleyin veya elle fiyat girin';
  for (const line of dischargeLines) {
    if (line.pumpModel) {
      const item = matchCustomItem(customItems, 'PUMP', { standard, nameContains: line.pumpModel });
      rows.push(makeRow('Pompalar', `Boşaltım Pompası ${line.pumpModel} — ${line.name}`, 'Pompa', null, 1, !!item, item, item ? undefined : noMatchReason));
    }
  }
  for (const tank of tanks) {
    if (tank.cipReturnPumpModel) {
      const item = matchCustomItem(customItems, 'PUMP', { standard, nameContains: tank.cipReturnPumpModel });
      rows.push(makeRow('Pompalar', `CIP Dönüş Pompası ${tank.cipReturnPumpModel} — ${tank.name}`, 'Pompa', null, 1, !!item, item, item ? undefined : noMatchReason));
    }
  }
  if (ctx.tankCipReturnPumpModel) {
    const item = matchCustomItem(customItems, 'PUMP', { standard, nameContains: ctx.tankCipReturnPumpModel });
    rows.push(makeRow('Pompalar', `Tank CIP Dönüş Pompası ${ctx.tankCipReturnPumpModel}`, 'Pompa', null, 1, !!item, item, item ? undefined : noMatchReason));
  }

  return rows;
}

export function summarizeStorageInstruments(rows: StorageInstrumentItem[]) {
  const total = rows.reduce((s, r) => s + (r.matched ? r.totalNet : 0), 0);
  const matched = rows.filter((r) => r.matched).length;
  return { total, matched, totalRows: rows.length };
}
