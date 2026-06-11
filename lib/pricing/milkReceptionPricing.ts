// Süt Alım modülünde kullanılan kesin (katalogda kimliği belli) ürünleri
// PRECALCULATION kataloğuyla eşler ve satır satır fiyat çıkarır.
//
// Kapsam — yalnızca kataloğa karşılığı olanlar:
//   • SV1 Butterfly Valve (ESV) — Air exhaust, Outlet, Filter unit içi, PHE içi (mevcut valveMatcher)
//   • SWCIP41 (Water Inlet) — mevcut valveMatcher
//   • SW44 / SW41 (Clarifier bypass) — mevcut valveMatcher
//   • APV VPN Non-Return Valve (Tanker CIP Check valve)
//   • Krohne Optiflux 6050 (Flow Meter)
//   • IFM Pt100 (hat sıcaklığı + PHE çıkış sıcaklığı + Ice water giriş PT100)
//   • Bimethal Thermometer (PHE Ice water dönüş, Ice water giriş termometre seçeneği)
//   • A300G.100 Manometer (Filter ünite önü/arkası — manuel)
//   • PI1700 Pressure Transmitter (Filter ünite önü/arkası — elektronik)
//   • EUROBINOX Y-TYPE Inline Filter (Filter unit)
//   • EUROBINOX Manual Sampling Valve (Numune — manuel)
//   • APV Manual Sampling Valve PRD20 (Numune — pnömatik/PRD20)
//   • DEGASIFIER Tank (Degazör)
//   • Proximity Switch (Panel için)
//
// Katalogda olmayanlar (eşleşmez, "—" gösterilir):
//   • Milk Clarifier (separatör)
//   • Plate Heat Exchanger (PHE)
//   • Pompalar (W+ serisi modeller katalogda yok)
//   • LSH / LSL level sensor (genel sınıfı: proximity ile yedeklenebilir)

import { getPricingDataset, findItemByEqNo, type PricingItem } from './loader';
import { findValvePrice, type ControlUnit } from './valveMatcher';
import { findBySizeTokens } from './catalogSizeMatcher';
import { getOneSizeSmallerDN } from '@/lib/calc/selectDN';
import { matchCustomItem } from './customCatalog';
import { findIfmFlowMeter } from './flowMeter';

// Sabit ürün kodları (katalogda eqNo ile birebir pinlenen kalemler).
const EQ = {
  LINE_PT100: 'TA2812',     // Hat/PHE sıcaklık sensörü PT100 (clamp bağlantılı)
  THERMOMETER: '90000200',  // Bimethal Termometre
  MANOMETER: '81432193',    // A300G.100 Manometre
  PROXIMITY: 'GI701S',      // Inductive Safety Sensor
  PROXIMITY_RELAY: 'G1501S',// Proximity ile zorunlu Safety Relay
} as const;

export interface MRPricedItem {
  /** Tablodaki gruplama etiketi (örn: "Vanalar", "Filter Ünite", "Sensörler") */
  category: string;
  /** Insanca açıklama (örn: "ESV Outlet Vanası — Raw Milk Reception 1") */
  description: string;
  /** Tipi (örn: SV1, SWCIP41, VPN, Manometer, Krohne FM, ...) */
  itemType: string;
  /** Talep edilen çap (varsa) */
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

export interface MilkReceptionPricingContext {
  standard: 'DIN' | 'SMS';
  controlUnit: ControlUnit;
  fixedSmallSize: string;        // 'DN25' veya '25 SMS (1")'
  waterInletSize: string;        // SW-CIP41 hattındaki en büyük DN
  lines: Array<{
    name: string;
    dn: string | null;            // hat çapı (DIN/SMS string)
    filterUnitCount: 1 | 2;
    pressureMeterType: 'MANOMETER' | 'PRESSURE_TRANSMITTER';
    hasMilkClarifier: boolean;
    clarifierBypassValveType: 'SW44' | 'SW41' | null;
    hasPhe: boolean;
    pheIceWaterTempSensorType: 'PT100' | 'THERMOMETER' | null;
    pheIceWaterPressureMeterType: 'MANOMETER' | 'PRESSURE_TRANSMITTER' | null;
    hasSamplingValve: boolean;
    samplingValveType: 'MANUAL' | 'WITH_ACTUATOR' | null;
    pumpModel: string | null;
  }>;
  tankerCip: { hasPump: boolean; dn: string | null; pumpModel: string | null } | null;
  /** Kataloğa elle eklenmiş ürünler (PricingItem'a çevrilmiş) */
  customItems?: PricingItem[];
}

// ============ Eşleyici yardımcılar ============

function priceFromItem(item: PricingItem | null) {
  if (!item) return { unitPrice: 0, unitDiscount: 0, unitNetPrice: 0 };
  return {
    unitPrice: item.listPrice,
    unitDiscount: item.discount,
    unitNetPrice: item.netPrice,
  };
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
): MRPricedItem {
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

/** Sabit (çapsız) tek-satır eşleştirme — en düşük fiyatlıyı seçer */
function findFixedItem(filterFn: (it: PricingItem) => boolean): PricingItem | null {
  const items = getPricingDataset().items.filter(filterFn);
  if (items.length === 0) return null;
  return [...items].sort((a, b) => a.listPrice - b.listPrice)[0];
}

// ============ Asıl fiyatlandırma fonksiyonu ============

export function buildMilkReceptionPricing(ctx: MilkReceptionPricingContext): MRPricedItem[] {
  const rows: MRPricedItem[] = [];
  const { standard, controlUnit, fixedSmallSize, waterInletSize, lines, tankerCip } = ctx;
  const customItems = ctx.customItems ?? [];

  // --- ESV (SV1 Butterfly Valve) ---
  // 1) Her hat: 1 air exhaust (DN25/25SMS) + 1 outlet (hat çapı) + 4×filterUnitCount filter ESV + 2×PHE (varsa)
  for (const line of lines) {
    const lineSize = line.dn ?? '—';

    // Air exhaust ESV (sabit küçük çap)
    {
      const r = findValvePrice({ valveType: 'SV1', standard, size: fixedSmallSize, controlUnit });
      rows.push(makeRow(
        'Vanalar', `Air Exhaust ESV — ${line.name}`, 'SV1', fixedSmallSize, 1, r.found, r.item, r.reason,
      ));
    }
    // Outlet ESV (hat çapı)
    if (line.dn) {
      const r = findValvePrice({ valveType: 'SV1', standard, size: line.dn, controlUnit });
      rows.push(makeRow(
        'Vanalar', `Outlet ESV — ${line.name}`, 'SV1', line.dn, 1, r.found, r.item, r.reason,
      ));
    }
    // Filter unit ESV (her unitte 4 manuel ESV)
    if (line.dn && line.filterUnitCount > 0) {
      // Filter unit içindeki vanalar manuel (kullanıcı PDF: "manuel sabit")
      const r = findValvePrice({ valveType: 'SV1', standard, size: line.dn, controlUnit: 'NONE' });
      const qty = 4 * line.filterUnitCount;
      rows.push(makeRow(
        'Vanalar', `Filter Unit ESV (manuel) — ${line.name} × ${line.filterUnitCount} unit`, 'SV1', line.dn, qty, r.found, r.item, r.reason,
      ));
    }
    // PHE içi ESV (varsa 2 adet — bir size büyük, ama katalogda mevcut çapla eşleştirelim)
    if (line.hasPhe && line.dn) {
      const r = findValvePrice({ valveType: 'SV1', standard, size: line.dn, controlUnit });
      rows.push(makeRow(
        'Vanalar', `PHE içi ESV (kontrol+manuel) — ${line.name}`, 'SV1', line.dn, 2, r.found, r.item, r.reason,
      ));
    }
  }

  // --- SW-CIP41 Water Inlet (modül düzeyinde 1 adet) ---
  if (waterInletSize !== '—') {
    const r = findValvePrice({ valveType: 'SWCIP41', standard, size: waterInletSize, controlUnit });
    rows.push(makeRow(
      'Vanalar', 'Water Inlet Vanası (modül)', 'SW-CIP41', waterInletSize, 1, r.found, r.item, r.reason,
    ));
  }

  // --- Clarifier Bypass SW44/SW41 ---
  for (const line of lines) {
    if (!line.hasMilkClarifier || !line.clarifierBypassValveType || !line.dn) continue;
    const r = findValvePrice({ valveType: line.clarifierBypassValveType, standard, size: line.dn, controlUnit });
    rows.push(makeRow(
      'Vanalar', `Clarifier Bypass ${line.clarifierBypassValveType} — ${line.name}`, line.clarifierBypassValveType, line.dn, 1, r.found, r.item, r.reason,
    ));
  }

  // --- Tanker CIP vanaları (varsa) ---
  if (tankerCip && tankerCip.dn) {
    // Air exhaust ESV
    {
      const r = findValvePrice({ valveType: 'SV1', standard, size: fixedSmallSize, controlUnit });
      rows.push(makeRow(
        'Vanalar', 'Tanker CIP — Air Exhaust ESV', 'SV1', fixedSmallSize, 1, r.found, r.item, r.reason,
      ));
    }
    // Outlet ESV
    {
      const r = findValvePrice({ valveType: 'SV1', standard, size: tankerCip.dn, controlUnit });
      rows.push(makeRow(
        'Vanalar', 'Tanker CIP — Outlet ESV', 'SV1', tankerCip.dn, 1, r.found, r.item, r.reason,
      ));
    }
    // VPN check valve
    {
      const candidates = getPricingDataset().items.filter(
        (it) => it.productType.toUpperCase() === 'APV VPN' && (it.standard === standard || it.standard === ''),
      );
      const { item } = findBySizeTokens(candidates, tankerCip.dn, standard);
      rows.push(makeRow(
        'Vanalar', 'Tanker CIP — Check Valve VPN', 'VPN', tankerCip.dn, 1, !!item, item,
        item ? undefined : `VPN ${standard} ${tankerCip.dn} katalogda yok`,
      ));
    }
  }

  // --- Sensörler: hat başına PT100 (TA2812 — clamp bağlantılı, hat tipi) ---
  for (const line of lines) {
    const pt100 = findItemByEqNo(EQ.LINE_PT100);
    rows.push(makeRow(
      'Sensörler', `Sıcaklık Sensörü PT100 (hat) — ${line.name}`, 'IFM PT100 TA2812', null, 1, !!pt100, pt100,
    ));
  }

  // --- PHE içi sıcaklık + ice water sensörleri ---
  for (const line of lines) {
    if (!line.hasPhe) continue;
    // PHE çıkış PT100 (TA2812 — hat tipi)
    const phePt = findItemByEqNo(EQ.LINE_PT100);
    rows.push(makeRow(
      'PHE', `PHE çıkış PT100 — ${line.name}`, 'IFM PT100 TA2812', null, 1, !!phePt, phePt,
    ));

    // Ice water giriş — kullanıcı seçimi
    if (line.pheIceWaterTempSensorType === 'PT100') {
      rows.push(makeRow(
        'PHE', `Ice Water giriş PT100 — ${line.name}`, 'IFM PT100 TA2812', null, 1, !!phePt, phePt,
      ));
    } else if (line.pheIceWaterTempSensorType === 'THERMOMETER') {
      const therm = findItemByEqNo(EQ.THERMOMETER);
      rows.push(makeRow(
        'PHE', `Ice Water giriş Termometre — ${line.name}`, 'Bimethal 90000200', null, 1, !!therm, therm,
      ));
    }

    // Ice water dönüş termometresi (sabit)
    const thermReturn = findItemByEqNo(EQ.THERMOMETER);
    rows.push(makeRow(
      'PHE', `Ice Water dönüş Termometre — ${line.name}`, 'Bimethal 90000200', null, 1, !!thermReturn, thermReturn,
    ));

    // Ice water giriş basınç ölçer
    if (line.pheIceWaterPressureMeterType === 'MANOMETER') {
      const m = findItemByEqNo(EQ.MANOMETER);
      rows.push(makeRow(
        'PHE', `Ice Water giriş Manometer — ${line.name}`, 'A300G.100 81432193', null, 1, !!m, m,
      ));
    } else if (line.pheIceWaterPressureMeterType === 'PRESSURE_TRANSMITTER') {
      const pt = findFixedItem((it) => it.subCategory === 'PRESSURE TRANSMITTER' && /PI1700/i.test(it.productType));
      rows.push(makeRow(
        'PHE', `Ice Water giriş Pressure Transmitter — ${line.name}`, 'PI1700', null, 1, !!pt, pt,
      ));
    }
  }

  // --- Filter unit ekipmanları ---
  for (const line of lines) {
    if (!line.dn) continue;
    // EUROBINOX Y-Type filter — her unit için 1
    const filterCandidates = getPricingDataset().items.filter(
      (it) => it.productType.toUpperCase().includes('EUROBINOX Y-TYPE') && (it.standard === standard || it.standard === ''),
    );
    const { item: filterItem } = findBySizeTokens(filterCandidates, line.dn, standard);
    rows.push(makeRow(
      'Filter Ünite',
      `Y-Type Filter — ${line.name} (${line.filterUnitCount === 2 ? '500 µ + 200 µ' : '500 µ'})`,
      'EUROBINOX Y-Type',
      line.dn,
      line.filterUnitCount,
      !!filterItem,
      filterItem,
      filterItem ? undefined : `Y-Type Filter ${standard} ${line.dn} katalogda yok`,
    ));

    // Filter ünite önü/arkası basınç ölçer (1 unit→2 adet, 2 unit→3 adet)
    const pmCount = line.filterUnitCount === 1 ? 2 : 3;
    if (line.pressureMeterType === 'MANOMETER') {
      const m = findItemByEqNo(EQ.MANOMETER);
      rows.push(makeRow(
        'Filter Ünite', `Filter Basınç Ölçer Manometer — ${line.name}`, 'A300G.100 81432193', null, pmCount, !!m, m,
      ));
    } else {
      const pt = findFixedItem((it) => it.subCategory === 'PRESSURE TRANSMITTER' && /PI1700/i.test(it.productType));
      rows.push(makeRow(
        'Filter Ünite', `Filter Pressure Transmitter — ${line.name}`, 'PI1700', null, pmCount, !!pt, pt,
      ));
    }
  }

  // --- Flow meter (IFM SMF) her hatta 1 ---
  for (const line of lines) {
    if (!line.dn) continue;
    // Flow meter hat çapından bir size küçük seçilir (akış hızını ölçüm için yükseltmek üzere).
    const fmSize = getOneSizeSmallerDN(line.dn, standard);
    const { item, model } = findIfmFlowMeter(fmSize);
    rows.push(makeRow(
      'Ölçüm', `Flow Meter ${model} — ${line.name}`, model, fmSize, 1, !!item, item,
      item ? undefined : 'IFM SMF flowmetre katalogda bulunamadı',
    ));
  }

  // --- Sampling vanaları ---
  for (const line of lines) {
    if (!line.hasSamplingValve) continue;
    if (line.samplingValveType === 'MANUAL') {
      const item = findFixedItem(
        (it) => it.subCategory === 'MANUEL SAMPLING VALVE' && /EUROBINOX/i.test(it.productType),
      );
      rows.push(makeRow(
        'Vanalar', `Numune Vanası Manuel — ${line.name}`, 'EUROBINOX VMM/VMMC', null, 1, !!item, item,
      ));
    } else if (line.samplingValveType === 'WITH_ACTUATOR') {
      const item = findFixedItem(
        (it) => it.subCategory === 'MANUEL SAMPLING VALVE' && /APV/i.test(it.productType),
      );
      rows.push(makeRow(
        'Vanalar', `Numune Vanası Aktüatörlü — ${line.name}`, 'APV PRD20', null, 1, !!item, item,
      ));
    }
  }

  // --- Degazör Tank (her hatta + Tanker CIP'te de 1 adet) ---
  const degazorTank = findFixedItem((it) => it.productType === 'DEGASIFIER' && it.subCategory === 'TANK');
  if (degazorTank) {
    rows.push(makeRow(
      'Ekipman', `Degazör Tank × ${lines.length}${tankerCip ? ' + 1 (Tanker CIP)' : ''}`,
      'DEGASIFIER Tank',
      null,
      lines.length + (tankerCip ? 1 : 0),
      true,
      degazorTank,
    ));
  }

  // --- Panel (proximity switch içerir) — hat sayısı kadar + zorunlu Safety Relay ---
  if (lines.length > 0) {
    const prox = findItemByEqNo(EQ.PROXIMITY);     // GI701S
    const proxRelay = findItemByEqNo(EQ.PROXIMITY_RELAY); // G1501S (zorunlu)
    rows.push(makeRow(
      'Ekipman', `CIP Paneli Proximity Switch GI701S × ${lines.length}`, 'GI701S', null, lines.length, !!prox, prox,
    ));
    rows.push(makeRow(
      'Ekipman', `Safety Relay G1501S (proximity zorunlu) × ${lines.length}`, 'G1501S', null, lines.length, !!proxRelay, proxRelay,
    ));
  }

  // --- Katalogda karşılığı olmayan ürünler (Özel Katalog'dan çekilir, yoksa elle) ---
  const noMatchReason = 'Katalogda karşılığı yok — Özel Katalog\'a ekleyin veya elle fiyat girin';
  for (const line of lines) {
    // Milk Clarifier (separatör)
    if (line.hasMilkClarifier) {
      const item = matchCustomItem(customItems, 'MILK_CLARIFIER', { standard, size: line.dn });
      rows.push(makeRow('Opsiyonel', `Milk Clarifier — ${line.name}`, 'Milk Clarifier', line.dn, 1, !!item, item, item ? undefined : noMatchReason));
    }
    // Plate Heat Exchanger (PHE)
    if (line.hasPhe) {
      const item = matchCustomItem(customItems, 'PHE', { standard, size: line.dn });
      rows.push(makeRow('PHE', `Plate Heat Exchanger — ${line.name}`, 'PHE', line.dn, 1, !!item, item, item ? undefined : noMatchReason));
    }
    // Süt alım pompası (W+ vb.)
    if (line.pumpModel) {
      const item = matchCustomItem(customItems, 'PUMP', { standard, nameContains: line.pumpModel });
      rows.push(makeRow('Pompalar', `Süt Alım Pompası ${line.pumpModel} — ${line.name}`, 'Pompa', null, 1, !!item, item, item ? undefined : noMatchReason));
    }
  }
  // Tanker CIP pompası
  if (tankerCip?.pumpModel) {
    const item = matchCustomItem(customItems, 'PUMP', { standard, nameContains: tankerCip.pumpModel });
    rows.push(makeRow('Pompalar', `Tanker CIP Pompası ${tankerCip.pumpModel}`, 'Pompa', null, 1, !!item, item, item ? undefined : noMatchReason));
  }

  return rows;
}

export function summarizeMilkReceptionPricing(rows: MRPricedItem[]) {
  const total = rows.reduce((s, r) => s + (r.matched ? r.totalNet : 0), 0);
  const matched = rows.filter((r) => r.matched).length;
  return { total, matched, totalRows: rows.length };
}
