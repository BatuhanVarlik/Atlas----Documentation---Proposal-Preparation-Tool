// CIP (Clean-in-Place) modülünde kullanılan ekipmanları üretir ve PRECALCULATION
// kataloğuyla eşler. Ekipmanlar üç grupta modellenir:
//   A) Tank bazlı   — her var olan tank için (tank sayısı kadar)
//   B) Hat bazlı     — her DL/RL için (hat sayısı kadar)
//   C) Sabit adetli  — hat/tank sayısından bağımsız
//   + Discharge×Return valve çarpımı (tankCount × lineCount)
//   + Bilgi amaçlı   — kimyasal besleme & steam line (fiyata dahil değil)
//
// Bilinen eqNo pinleri otomatik eşleşir (LMT100, TA2512/TA2812, GI701S/G1501S,
// IFM SMF flowmetre, ESV vanalar). Bilinmeyenler (Krohne FM, JUMO conductivity,
// TA812, tubular HE, holding tube, angle seat, steam trap, disco check) Özel
// Katalog'dan çekilir; yoksa "—" olarak eşleşmez işaretlenir.

import { getPricingDataset, findItemByEqNo, type PricingItem } from './loader';
import { findValvePrice, type ControlUnit } from './valveMatcher';
import { findBySizeTokens } from './catalogSizeMatcher';
import { findIfmFlowMeter } from './flowMeter';
import { matchCustomItem } from './customCatalog';
import { getTankDrainValveSize } from '@/lib/calc/selectDN';

// Sabit ürün kodları (katalogda eqNo ile birebir pinlenen kalemler).
const EQ = {
  LOW_LEVEL: 'LMT100',                     // LSL (IFM)
  HIGH_LEVEL: 'NVS-166/200-8/M/H/X/M12',   // LSH (Conductive Level Switch NVS)
  TUBULAR_PRE_TEMP: 'TA2812',              // Tubular öncesi Hot Water sıcaklık sensörü
  LINE_TEMP: 'TA2812',                     // Hat sıcaklık sensörü PT100 (clamp)
  PROXIMITY: 'GI701S',                     // Manhole switch (Inductive Safety Sensor)
  PROXIMITY_RELAY: 'G1501S',               // Proximity ile zorunlu Safety Relay
} as const;

export type CipTankType = 'CAUSTIC' | 'ACID' | 'HOT_WATER' | 'RECOVERY' | 'FRESH_WATER';

export interface CipPricedItem {
  category: string;
  description: string;
  itemType: string;
  size: string | null;
  quantity: number;
  matched: boolean;
  matchedItem: PricingItem | null;
  reason?: string;
  /** true ise bilgi amaçlı — toplam fiyata dahil edilmez */
  informational?: boolean;
  unitPrice: number;
  unitDiscount: number;
  unitNetPrice: number;
  totalNet: number;
}

export interface CipPricingContext {
  standard: 'DIN' | 'SMS';
  controlUnit: ControlUnit;
  systemType: 'FORWARD' | 'CIRCULATED';
  samplingValve: 'NONE' | 'MANUAL' | 'WITH_ACTUATOR';
  hasManholeSwitch: boolean;
  /** Modülün seçilen hat çapı (DIN/SMS string) */
  selectedDN: string | null;
  tanks: Array<{
    tankType: CipTankType;
    capacity: number;             // L
    hasLSH: boolean;
    hasLSL: boolean;
    hasExternalSensor: boolean;
    hasPressureTransmitter: boolean;
  }>;
  lines: Array<{
    name: string;
    lineKind: 'DISCHARGE' | 'RETURN';
    dn: string | null;            // hat çapı
    pumpModel: string | null;
  }>;
  /** Kataloğa elle eklenmiş ürünler (PricingItem'a çevrilmiş) */
  customItems?: PricingItem[];
}

const TANK_LABEL: Record<CipTankType, string> = {
  CAUSTIC: 'Caustic Tank',
  ACID: 'Acid Tank',
  HOT_WATER: 'Hot Water Tank',
  RECOVERY: 'Recovery Tank',
  FRESH_WATER: 'Fresh Water Tank',
};

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
  opts?: { reason?: string; informational?: boolean },
): CipPricedItem {
  const { unitPrice, unitDiscount, unitNetPrice } = priceFromItem(matchedItem);
  return {
    category,
    description,
    itemType,
    size,
    quantity,
    matched,
    matchedItem,
    reason: opts?.reason,
    informational: opts?.informational ?? false,
    unitPrice,
    unitDiscount,
    unitNetPrice,
    totalNet: unitNetPrice * quantity,
  };
}

const NO_MATCH = 'Katalogda karşılığı yok — Özel Katalog\'a ekleyin veya elle fiyat girin';

// Tank Pressure Transmitter: PI1700 Series, tank hacmine göre ölçüm aralığı.
const PI1700_RANGES: { eqNo: string; maxMbar: number }[] = [
  { eqNo: 'PI1789', maxMbar: 100 },
  { eqNo: 'PI1708', maxMbar: 250 },
  { eqNo: 'PI1707', maxMbar: 1000 },
  { eqNo: 'PI1706', maxMbar: 2500 },
];

function findTankPressureTransmitter(volumeL: number | null | undefined): PricingItem | null {
  if (!volumeL || volumeL <= 0) return findItemByEqNo('PI1707');
  const vM3 = volumeL / 1000;
  const d = Math.cbrt(vM3 / 1.178); // V = π/4·D²·H, H=1.5D → V=1.178·D³
  const h = 1.5 * d;
  const pMbar = (1030 * 9.81 * h) / 100;
  const range = PI1700_RANGES.find((r) => pMbar <= r.maxMbar) ?? PI1700_RANGES[PI1700_RANGES.length - 1];
  return findItemByEqNo(range.eqNo);
}

// ============ Asıl builder ============

export function buildCipPricing(ctx: CipPricingContext): CipPricedItem[] {
  const rows: CipPricedItem[] = [];
  const { standard, controlUnit, systemType, selectedDN, tanks, lines } = ctx;
  const customItems = ctx.customItems ?? [];

  const dischargeLines = lines.filter((l) => l.lineKind === 'DISCHARGE');
  const returnLines = lines.filter((l) => l.lineKind === 'RETURN');
  const tankCount = tanks.length;
  const tankDrainSize = getTankDrainValveSize(standard);

  // Özel katalog / katalog-dışı kalem için satır üretici (kind='OTHER', isimle eşleşir)
  const customRow = (
    category: string,
    description: string,
    itemType: string,
    size: string | null,
    quantity: number,
    nameContains: string,
  ): CipPricedItem => {
    const item = matchCustomItem(customItems, 'OTHER', { standard, size, nameContains });
    return makeRow(category, description, itemType, size, quantity, !!item, item, {
      reason: item ? undefined : NO_MATCH,
    });
  };

  // ESV butterfly (SV1) satırı — verilen çapta
  const esvRow = (category: string, description: string, size: string | null, quantity: number, cu: ControlUnit = controlUnit) => {
    if (!size) {
      rows.push(makeRow(category, description, 'SV1 Butterfly ESV', null, quantity, false, null, { reason: 'Çap belirsiz' }));
      return;
    }
    const r = findValvePrice({ valveType: 'SV1', standard, size, controlUnit: cu });
    rows.push(makeRow(category, description, 'SV1 Butterfly ESV', size, quantity, r.found, r.item, { reason: r.reason }));
  };

  // ---------- A) TANK BAZLI ----------
  for (const tank of tanks) {
    const label = TANK_LABEL[tank.tankType];

    // Tank çıkışı + CIP + suction + process water butterfly ESV (modül DN'inde)
    esvRow('Tank Ekipmanı', `Tank Çıkışı Butterfly ESV — ${label}`, selectedDN, 1);
    esvRow('Tank Ekipmanı', `CIP Butterfly ESV — ${label}`, selectedDN, 1);
    esvRow('Tank Ekipmanı', `Suction Valve — ${label}`, selectedDN, 1);
    esvRow('Tank Ekipmanı', `Process Water Butterfly Valve — ${label}`, selectedDN, 1);

    // Drain valve (tank drain — SMS 1" / DIN DN25)
    esvRow('Tank Ekipmanı', `Drain Valve — ${label}`, tankDrainSize, 1);

    // LSL = LMT100 (pinli)
    if (tank.hasLSL) {
      const lsl = findItemByEqNo(EQ.LOW_LEVEL);
      rows.push(makeRow('Tank Sensörleri', `LSL (Low Level) LMT100 — ${label}`, 'IFM LMT100', null, 1, !!lsl, lsl));
    }
    // LSH = NVS-166 (pinli)
    if (tank.hasLSH) {
      const lsh = findItemByEqNo(EQ.HIGH_LEVEL);
      rows.push(makeRow('Tank Sensörleri', `LSH (High Level) — ${label}`, 'NVS-166 High Level', null, 1, !!lsh, lsh));
    }
    // Tank dışı sensör (genel — katalog dışı)
    if (tank.hasExternalSensor) {
      rows.push(customRow('Tank Sensörleri', `Tank Dışı Sensör — ${label}`, 'External Sensor', null, 1, 'sensor'));
    }
    // Pressure transmitter (Fresh Water hariç) — hacme göre PI1700
    if (tank.hasPressureTransmitter && tank.tankType !== 'FRESH_WATER') {
      const pt = findTankPressureTransmitter(tank.capacity);
      rows.push(makeRow('Tank Sensörleri', `Pressure Transmitter PI1700 — ${label}`, 'PI1700', null, 1, !!pt, pt));
    }

    // Tubular ile ilişkili tank-tipi sensörleri
    if (tank.tankType === 'HOT_WATER') {
      const pre = findItemByEqNo(EQ.TUBULAR_PRE_TEMP); // TA2812
      rows.push(makeRow('Tubular Sensörleri', `Tubular Öncesi Sıcaklık TA2812 — ${label}`, 'IFM TA2812', null, 1, !!pre, pre));
      rows.push(customRow('Tubular Sensörleri', `Tubular Sonrası Sıcaklık TA812 — ${label}`, 'TA812', null, 1, 'TA812'));
    } else if (tank.tankType === 'ACID' || tank.tankType === 'CAUSTIC') {
      rows.push(customRow('Tubular Sensörleri', `Tubular Öncesi Conductivity (JUMO) — ${label}`, 'JUMO Conductivity', null, 1, 'conductivity'));
      rows.push(customRow('Tubular Sensörleri', `Tubular Sonrası Sıcaklık TA812 — ${label}`, 'TA812', null, 1, 'TA812'));
    }
    // FRESH_WATER ve RECOVERY → tubular sonrası sensör yok
  }

  // ---------- B) DISCHARGE × RETURN VALVE ÇARPIMI ----------
  // Her tank-hat kombinasyonu için discharge ve return valve (butterfly ESV).
  if (tankCount > 0 && dischargeLines.length > 0) {
    esvRow('Tank-Hat Vanaları', `Discharge Valve ESV (${tankCount} tank × ${dischargeLines.length} DL)`, selectedDN, tankCount * dischargeLines.length);
  }
  if (tankCount > 0 && returnLines.length > 0) {
    esvRow('Tank-Hat Vanaları', `Return Valve ESV (${tankCount} tank × ${returnLines.length} RL)`, selectedDN, tankCount * returnLines.length);
  }

  // ---------- C) HAT BAZLI ----------
  for (const line of lines) {
    const lineSize = line.dn;
    const tag = `${line.name}`;

    esvRow('Hat Ekipmanı', `Butterfly ESV — ${tag}`, lineSize, 1);

    // Filter unit 500 micron (EUROBINOX Y-Type)
    if (lineSize) {
      const filterCandidates = getPricingDataset().items.filter(
        (it) => it.productType.toUpperCase().includes('EUROBINOX Y-TYPE') && (it.standard === standard || it.standard === ''),
      );
      const { item } = findBySizeTokens(filterCandidates, lineSize, standard);
      rows.push(makeRow('Hat Ekipmanı', `Filter Unit 500 µ — ${tag}`, 'EUROBINOX Y-Type', lineSize, 1, !!item, item, { reason: item ? undefined : NO_MATCH }));
    }

    // Flow meter — Krohne (katalog dışı; IFM SMF varsa onunla yedekle)
    if (lineSize) {
      const { item, model } = findIfmFlowMeter(lineSize);
      if (item) {
        rows.push(makeRow('Hat Ölçüm', `Flow Meter ${model} — ${tag}`, model, lineSize, 1, true, item));
      } else {
        rows.push(customRow('Hat Ölçüm', `Flow Meter Krohne — ${tag}`, 'Krohne FM', lineSize, 1, 'krohne'));
      }
    }

    // Conductivity sensor JUMO (katalog dışı)
    rows.push(customRow('Hat Ölçüm', `Conductivity Sensor JUMO — ${tag}`, 'JUMO Conductivity', null, 1, 'conductivity'));

    // Drain valve
    esvRow('Hat Ekipmanı', `Drain Valve — ${tag}`, tankDrainSize, 1);

    // Tubular heat exchanger (katalog dışı)
    rows.push(customRow('Hat Ekipmanı', `Tubular Heat Exchanger — ${tag}`, 'Tubular HE', null, 1, 'tubular'));

    // Temperature sensor (TA2812 pinli)
    {
      const temp = findItemByEqNo(EQ.LINE_TEMP);
      rows.push(makeRow('Hat Ölçüm', `Temperature Sensor TA2812 — ${tag}`, 'IFM TA2812', null, 1, !!temp, temp));
    }

    // Forward System'e özel hat ekipmanları
    if (systemType === 'FORWARD') {
      rows.push(customRow('Forward Ekipmanı', `Holding Tube / Balance Tank — ${tag}`, 'Holding Tube', null, 1, 'holding'));
      rows.push(customRow('Forward Ekipmanı', `Angle Seat Valve — ${tag}`, 'Angle Seat Valve', lineSize, 1, 'angle seat'));
      rows.push(customRow('Forward Ekipmanı', `Steam Trap DN25 — ${tag}`, 'Steam Trap DN25', 'DN25', 1, 'steam trap'));
      rows.push(customRow('Forward Ekipmanı', `Disco Check Valve DN25 — ${tag}`, 'Disco Check DN25', 'DN25', 1, 'disco'));
      rows.push(customRow('Forward Ekipmanı', `Ball Valve — ${tag}`, 'Ball Valve', lineSize, 1, 'ball valve'));
    }
  }

  // ---------- C) SABİT ADETLİ (hat/tank sayısından bağımsız) ----------
  // Nonreturn / SW single seat / bypass / stop — her biri 2 adet.
  {
    // SW single seat valve (SW44 — modül DN'inde, pinlenebilir)
    if (selectedDN) {
      const sw = findValvePrice({ valveType: 'SW44', standard, size: selectedDN, controlUnit });
      rows.push(makeRow('Sabit Ekipman', 'SW Single Seat Valve', 'SW44', selectedDN, 2, sw.found, sw.item, { reason: sw.reason }));
    } else {
      rows.push(makeRow('Sabit Ekipman', 'SW Single Seat Valve', 'SW44', null, 2, false, null, { reason: 'Çap belirsiz' }));
    }
    rows.push(customRow('Sabit Ekipman', 'Nonreturn Valve', 'Nonreturn Valve', selectedDN, 2, 'nonreturn'));
    rows.push(customRow('Sabit Ekipman', 'Bypass Valve', 'Bypass Valve', selectedDN, 2, 'bypass'));
    rows.push(customRow('Sabit Ekipman', 'Stop Valve', 'Stop Valve', selectedDN, 2, 'stop'));
  }

  // ---------- Sampling valve (modül seviyesi) ----------
  if (ctx.samplingValve === 'MANUAL') {
    const item = getPricingDataset().items
      .filter((it) => it.subCategory === 'MANUEL SAMPLING VALVE' && /EUROBINOX/i.test(it.productType))
      .sort((a, b) => a.listPrice - b.listPrice)[0] ?? null;
    rows.push(makeRow('Vanalar', 'Numune Vanası (Manuel)', 'EUROBINOX VMM', null, 1, !!item, item, { reason: item ? undefined : NO_MATCH }));
  } else if (ctx.samplingValve === 'WITH_ACTUATOR') {
    const item = getPricingDataset().items
      .filter((it) => it.subCategory === 'MANUEL SAMPLING VALVE' && /APV/i.test(it.productType))
      .sort((a, b) => a.listPrice - b.listPrice)[0] ?? null;
    rows.push(makeRow('Vanalar', 'Numune Vanası (Aktüatörlü)', 'APV PRD20', null, 1, !!item, item, { reason: item ? undefined : NO_MATCH }));
  }

  // ---------- Manhole switch ----------
  if (ctx.hasManholeSwitch) {
    const prox = findItemByEqNo(EQ.PROXIMITY);
    const relay = findItemByEqNo(EQ.PROXIMITY_RELAY);
    rows.push(makeRow('Sensörler', 'Manhole Switch GI701S', 'GI701S', null, 1, !!prox, prox));
    rows.push(makeRow('Sensörler', 'Safety Relay G1501S (zorunlu)', 'G1501S', null, 1, !!relay, relay));
  }

  // ---------- Pompalar (hat bazlı — katalog dışı, Özel Katalog) ----------
  for (const line of lines) {
    if (!line.pumpModel) continue;
    const item = matchCustomItem(customItems, 'PUMP', { standard, nameContains: line.pumpModel });
    rows.push(makeRow('Pompalar', `Pompa ${line.pumpModel} — ${line.name}`, 'Pompa', null, 1, !!item, item, { reason: item ? undefined : NO_MATCH }));
  }

  // ---------- E) BİLGİ AMAÇLI (fiyata dahil değil) ----------
  // Kimyasal besleme
  for (const eq of ['Liquid Level Gauge Rod', 'Pneumatic Diaphragm Pump', 'Selenoid', 'Regulator']) {
    rows.push(makeRow('Kimyasal Besleme (Bilgi)', eq, eq, null, 1, false, null, { informational: true, reason: 'Bilgi amaçlı — fiyata dahil değil' }));
  }
  // Steam line
  rows.push(makeRow('Steam Line (Bilgi)', 'Manometer (3 parça)', 'Manometer', null, 1, false, null, { informational: true, reason: 'Bilgi amaçlı — fiyata dahil değil' }));
  for (const eq of ['Steam Trap', 'Disco Check Valve', 'Ball Valve']) {
    rows.push(makeRow('Steam Line (Bilgi)', eq, eq, null, 1, false, null, { informational: true, reason: 'Bilgi amaçlı — fiyata dahil değil' }));
  }

  return rows;
}

export function summarizeCipPricing(rows: CipPricedItem[]) {
  const priced = rows.filter((r) => !r.informational);
  const total = priced.reduce((s, r) => s + (r.matched ? r.totalNet : 0), 0);
  const matched = priced.filter((r) => r.matched).length;
  return { total, matched, totalRows: priced.length, informationalRows: rows.length - priced.length };
}
