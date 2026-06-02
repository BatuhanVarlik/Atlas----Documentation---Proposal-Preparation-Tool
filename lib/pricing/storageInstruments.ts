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

// Agitator: motor kW'a göre en uygun TPM modelini bulur
function findAgitatorForKw(kw: number | null): PricingItem | null {
  if (kw == null || kw <= 0) {
    // Bilinmiyorsa en küçük TPM (TPM+1 7,5kW)
    return findFixedItem((it) => /TPM\+1\s+Mixer/i.test(it.productType));
  }
  let targetModel: RegExp;
  if (kw <= 7.5) targetModel = /TPM\+1\s+Mixer/i;
  else if (kw <= 15) targetModel = /TPM\+2\s+Mixer/i;
  else targetModel = /TPM\+3\s+Mixer/i;
  // Belirli kW'a en yakın eşleşme
  const candidates = getPricingDataset().items.filter((it) => targetModel.test(it.productType));
  if (candidates.length === 0) return null;
  let best: { item: PricingItem; diff: number } | null = null;
  for (const it of candidates) {
    const m = it.techSpec.match(/(\d+(?:[.,]\d+)?)\s*kW/i);
    if (!m) continue;
    const itemKw = parseFloat(m[1].replace(',', '.'));
    const diff = Math.abs(itemKw - kw);
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

  // --- Agitator (Mixer) ---
  for (const tank of tanks) {
    if (!tank.hasAgitator) continue;
    const item = findAgitatorForKw(tank.agitatorMotorKw);
    const kwSpec = tank.agitatorMotorKw != null ? `${tank.agitatorMotorKw} kW` : 'kW belirsiz';
    rows.push(makeRow(
      'Agitator', `Agitator — ${tank.name} (${kwSpec})`, 'TPM+ Venturi Mixer', null, 1, !!item, item,
      item ? undefined : 'TPM serisinde uygun kW eşleşmesi bulunamadı',
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
