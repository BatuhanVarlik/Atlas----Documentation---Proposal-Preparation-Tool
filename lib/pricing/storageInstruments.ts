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

import { getPricingDataset, findItemByEqNo, type PricingItem } from './loader';
import { findBySizeTokens } from './catalogSizeMatcher';
import { matchCustomItem } from './customCatalog';

// Sabit ürün kodları (katalogda eqNo ile birebir pinlenen kalemler).
const EQ = {
  HIGH_LEVEL: 'NVS-166/200-8/M/H/X/M12', // High Level Sensor (LSH/LSM)
  LOW_LEVEL: 'LMT100',                    // IFM Low Level Sensor (LSL)
  TANK_PT100: 'TA2512',                   // Tank sıcaklık sensörü PT100 (TT)
  PROXIMITY: 'GI701S',                    // Inductive Safety Sensor
  PROXIMITY_RELAY: 'G1501S',              // Proximity ile zorunlu Safety Relay
} as const;

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

// ============ Asıl builder ============

export function buildStorageInstrumentItems(ctx: StorageInstrumentContext): StorageInstrumentItem[] {
  const rows: StorageInstrumentItem[] = [];
  const { standard, tanks, dischargeLines } = ctx;
  const customItems = ctx.customItems ?? [];
  const noMatchReason = 'Katalogda karşılığı yok — Özel Katalog\'a ekleyin veya elle fiyat girin';

  // --- Tank sensörleri (katalogda eqNo ile pinlenmiş kesin ürünler) ---
  const highLevelSwitch = findItemByEqNo(EQ.HIGH_LEVEL);   // LSH / LSM
  const lowLevelSwitch = findItemByEqNo(EQ.LOW_LEVEL);     // LSL (IFM LMT100)
  const tankTempSensor = findItemByEqNo(EQ.TANK_PT100);    // TT (PT100 TA2512)
  const pressTransmitter = findFixedItem(
    (it) => it.subCategory === 'PRESSURE TRANSMITTER' && /PI1700/i.test(it.productType),
  );
  const proxSwitch = findItemByEqNo(EQ.PROXIMITY);         // GI701S
  const proxRelay = findItemByEqNo(EQ.PROXIMITY_RELAY);    // G1501S (zorunlu)

  for (const tank of tanks) {
    if (tank.hasLSH) {
      rows.push(makeRow('Tank Sensörleri', `LSH (High Level) — ${tank.name}`, 'NVS-166 High Level Sensor', null, 1, !!highLevelSwitch, highLevelSwitch));
    }
    if (tank.hasLSM) {
      rows.push(makeRow('Tank Sensörleri', `LSM (Mid Level) — ${tank.name}`, 'NVS-166 High Level Sensor', null, 1, !!highLevelSwitch, highLevelSwitch));
    }
    if (tank.hasLSL) {
      rows.push(makeRow('Tank Sensörleri', `LSL (Low Level) — ${tank.name}`, 'IFM LMT100 Low Level Sensor', null, 1, !!lowLevelSwitch, lowLevelSwitch));
    }
    if (tank.hasTT) {
      rows.push(makeRow('Tank Sensörleri', `TT (Sıcaklık PT100) — ${tank.name}`, 'IFM PT100 TA2512', null, 1, !!tankTempSensor, tankTempSensor));
    }
    if (tank.hasPT) {
      rows.push(makeRow('Tank Sensörleri', `PT (Basınç) — ${tank.name}`, 'PI1700 Pressure Transmitter', null, 1, !!pressTransmitter, pressTransmitter));
    }
    if (tank.hasProximitySwitch) {
      rows.push(makeRow('Tank Sensörleri', `Proximity Switch GI701S — ${tank.name}`, 'GI701S', null, 1, !!proxSwitch, proxSwitch));
      // Proximity switch varsa Safety Relay G1501S zorunlu.
      rows.push(makeRow('Tank Sensörleri', `Safety Relay G1501S (proximity zorunlu) — ${tank.name}`, 'G1501S', null, 1, !!proxRelay, proxRelay));
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

  // --- Agitator (Karıştırıcı) — katalogda yok; Özel Katalog'dan (AGITATOR) çekilir ---
  for (const tank of tanks) {
    if (!tank.hasAgitator) continue;
    const item = matchCustomItem(customItems, 'AGITATOR', { standard });
    rows.push(makeRow(
      'Agitator', `Karıştırıcı (Agitator) — ${tank.name}`, 'Agitator', null, 1, !!item, item,
      item ? undefined : noMatchReason,
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
