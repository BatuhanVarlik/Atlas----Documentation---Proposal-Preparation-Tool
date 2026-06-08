// Süt Alım modülü için Word şablon context'i.

import { calculatePipeDiameter } from '@/lib/calc/pipeDiameter';
import { selectDN } from '@/lib/calc/selectDN';
import { buildMilkReceptionPricing } from '@/lib/pricing/milkReceptionPricing';
import type { PricingItem } from '@/lib/pricing/loader';
import type { ControlUnit } from '@/lib/pricing/valveMatcher';
import { summarizePricingWithOverrides, type CanonicalPricingRow } from '@/lib/pricing/totals';
import { formatNumberTR } from '@/lib/utils';

interface ReceptionLine {
  id: string;
  name: string;
  order: number;
  capacity: number;
  pressure: number;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
  filterUnitCount: number;
  pressureMeterType: string;
  hasMilkClarifier: boolean;
  clarifierBypassValveType: string | null;
  hasPhe: boolean;
  pheCapacity: number | null;
  pheIceWaterTempSensorType: string | null;
  pheIceWaterPressureMeterType: string | null;
  hasSamplingValve: boolean;
  samplingValveType: string | null;
}

interface ModuleForDoc {
  id: string;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: string;
  valveControlUnit: string;
  hasTankerCip: boolean;
  tankerCipCapacity: number | null;
  tankerCipPressure: number | null;
  tankerCipPumpModel: string | null;
  tankerCipPumpKw: number | null;
  tankerCipPumpImpellerSize: number | null;
  priceMultiplier: number;
  priceOverrides: unknown;
  // Teklif (commercial) bilgileri — yeni teklif şablonu (HEM-PROJECT-NO)
  quotationNo: string | null;
  customerContactPerson: string | null;
  deliveryWeeks: number | null;
  deliveryPlace: string | null;
  offerValidityDays: number | null;
  createdAt: Date | string;
  creator: { name: string };
  receptionLines: ReceptionLine[];
}

const CONTROL_UNIT_LABEL: Record<string, string> = {
  NONE: 'Yok (Pnömatik)',
  AS_I: 'AS-i',
  DC: 'DC',
};

const PM_LABEL: Record<string, string> = {
  MANOMETER: 'Manometer',
  PRESSURE_TRANSMITTER: 'Pressure Transmitter',
};

const SAMPLING_LABEL: Record<string, string> = {
  MANUAL: 'Manuel',
  WITH_ACTUATOR: 'Aktüatörlü',
};

const PHE_TEMP_LABEL: Record<string, string> = {
  PT100: 'PT100',
  THERMOMETER: 'Termometre',
};

export function buildMilkReceptionContext(module: ModuleForDoc, customItems: PricingItem[] = []) {
  const lines = module.receptionLines;
  const fixedSmallSize = module.standard === 'DIN' ? 'DN25' : '25 SMS (1")';

  // Her hat için çap hesabı
  const lineCalcs = lines.map((l) => {
    if (!l.capacity || l.capacity <= 0) return { lineId: l.id, dn: '—', inner: '—', outer: '—' };
    const d = calculatePipeDiameter({ capacityLh: l.capacity, velocity: 2.0 });
    try {
      const sel = selectDN(d.diameterMm, module.standard as 'DIN' | 'SMS');
      return { lineId: l.id, dn: sel.dn, inner: String(sel.inner), outer: String(sel.outer) };
    } catch {
      return { lineId: l.id, dn: '—', inner: '—', outer: '—' };
    }
  });

  // Tanker CIP çapı
  let tankerCipDN = '—';
  if (module.hasTankerCip && module.tankerCipCapacity && module.tankerCipCapacity > 0) {
    const d = calculatePipeDiameter({ capacityLh: module.tankerCipCapacity, velocity: 2.0 });
    try {
      tankerCipDN = selectDN(d.diameterMm, module.standard as 'DIN' | 'SMS').dn;
    } catch {
      tankerCipDN = '—';
    }
  }

  // En büyük hat çapı (water inlet için)
  const largestSize = lineCalcs
    .filter((c) => c.dn !== '—')
    .sort((a, b) => (parseInt(b.inner, 10) || 0) - (parseInt(a.inner, 10) || 0))[0]?.dn ?? '—';

  // === Fiyatlandırma (önizleme kartıyla aynı satır sırası/anahtarları) ===
  const overrides = (module.priceOverrides as Record<string, number> | null) ?? {};
  const multiplier = module.priceMultiplier ?? 1;
  const pricingRows =
    lines.length > 0 || module.hasTankerCip
      ? buildMilkReceptionPricing({
          standard: module.standard as 'DIN' | 'SMS',
          controlUnit: (module.valveControlUnit ?? 'AS_I') as ControlUnit,
          fixedSmallSize,
          waterInletSize: largestSize,
          lines: lines.map((l) => {
            const dn = lineCalcs.find((c) => c.lineId === l.id)?.dn ?? '—';
            return {
              name: l.name,
              dn: dn === '—' ? null : dn,
              filterUnitCount: (l.filterUnitCount === 2 ? 2 : 1) as 1 | 2,
              pressureMeterType: l.pressureMeterType as 'MANOMETER' | 'PRESSURE_TRANSMITTER',
              hasMilkClarifier: l.hasMilkClarifier,
              clarifierBypassValveType: l.clarifierBypassValveType as 'SW44' | 'SW41' | null,
              hasPhe: l.hasPhe,
              pheIceWaterTempSensorType: l.pheIceWaterTempSensorType as 'PT100' | 'THERMOMETER' | null,
              pheIceWaterPressureMeterType: l.pheIceWaterPressureMeterType as
                | 'MANOMETER'
                | 'PRESSURE_TRANSMITTER'
                | null,
              hasSamplingValve: l.hasSamplingValve,
              samplingValveType: l.samplingValveType as 'MANUAL' | 'WITH_ACTUATOR' | null,
              pumpModel: l.pumpModel,
            };
          }),
          tankerCip: module.hasTankerCip
            ? { hasPump: !!module.tankerCipPumpModel, dn: tankerCipDN === '—' ? null : tankerCipDN, pumpModel: module.tankerCipPumpModel }
            : null,
          customItems,
        })
      : [];
  const canonicalRows: CanonicalPricingRow[] = pricingRows.map((r) => ({
    category: r.category,
    description: r.description,
    size: r.size,
    quantity: r.quantity,
    matched: r.matched,
    unitNetPrice: r.unitNetPrice,
  }));
  const pricingTotals = summarizePricingWithOverrides(canonicalRows, overrides, multiplier);

  // === Ekipman özet tablosu (DESCRIPTION → Equipment/Quantity) ===
  // Adetler sistemin kendi kurallarından türetilir; kullanıcıdan istenmez.
  // Degazör: her hatta 1 + (varsa) Tanker CIP'te 1 — milkReceptionPricing ile aynı.
  const degasserCount = lines.length + (module.hasTankerCip ? 1 : 0);
  // Sensör: PT100 sıcaklık, termometre, manometre/transmitter ve flowmetre kalemleri
  // ("pressure, temperature, and flow rate") — fiyatlandırma satırlarından sayılır.
  const SENSOR_ITEMTYPE = /PT100|Bimethal|A300G|PI1700|Krohne|Optiflux|Optimass/i;
  const sensorCount = pricingRows
    .filter((r) => SENSOR_ITEMTYPE.test(r.itemType))
    .reduce((s, r) => s + r.quantity, 0);
  const equipment = [
    { name: 'Valves', purpose: 'To control and direct the product flow throughout the process line.', quantity: pricingTotals.valveCount },
    { name: 'Degasser', purpose: 'To continuously remove dissolved air from the milk without introducing additional air.', quantity: degasserCount },
    { name: 'Filter Unit', purpose: 'To remove unwanted particles and impurities from the milk.', quantity: lines.reduce((s, l) => s + l.filterUnitCount, 0) },
    { name: 'Plate Heat Exchanger', purpose: 'To cool raw milk from 10°C down to 4°C.', quantity: lines.filter((l) => l.hasPhe).length },
    { name: 'Sensors', purpose: 'To monitor process parameters such as pressure, temperature, and flow rate.', quantity: sensorCount },
  ].filter((e) => e.quantity > 0);

  return {
    module: {
      name: module.name,
      nameUpper: module.name.toUpperCase(),
      customerName: module.customerName ?? '',
      projectCode: module.projectCode ?? '',
      standard: module.standard,
      controlUnit: CONTROL_UNIT_LABEL[module.valveControlUnit] ?? module.valveControlUnit,
      createdDate: new Date(module.createdAt).toLocaleDateString('tr-TR'),
      fixedSmallSize,
      waterInletSize: largestSize,
    },
    creator: { name: module.creator.name },
    // Teklif (commercial) bilgileri — HEM-PROJECT-NO şablonu için
    quotation: {
      no: module.quotationNo ?? '',
      date: new Date(module.createdAt).toLocaleDateString('tr-TR'),
      contactPerson: module.customerContactPerson ?? '',
      deliveryWeeks: module.deliveryWeeks != null ? String(module.deliveryWeeks) : '—',
      deliveryPlace: module.deliveryPlace ?? 'Customer Factory',
      offerValidityDays: module.offerValidityDays != null ? String(module.offerValidityDays) : '30',
    },
    equipment,
    receptionLines: lines.map((line, i) => {
      const calc = lineCalcs.find((c) => c.lineId === line.id);
      return {
        sira: i + 1,
        name: line.name,
        capacity: line.capacity.toLocaleString('tr-TR'),
        pressure: line.pressure.toLocaleString('tr-TR'),
        dn: calc?.dn ?? '—',
        innerDiameter: calc?.inner ?? '—',
        pumpModel: line.pumpModel ?? '—',
        pumpKw: line.pumpKw != null ? String(line.pumpKw) : '—',
        pumpImpellerSize: line.pumpImpellerSize != null ? String(line.pumpImpellerSize) : '—',
        filterUnitCount: line.filterUnitCount,
        filterUnitLabel: line.filterUnitCount === 2 ? 'Çift (500 µ + 200 µ)' : 'Tek (500 µ)',
        pressureMeter: PM_LABEL[line.pressureMeterType] ?? line.pressureMeterType,
        hasMilkClarifier: line.hasMilkClarifier ? 'Var' : 'Yok',
        clarifierBypassValve: line.clarifierBypassValveType ?? '—',
        hasPhe: line.hasPhe ? 'Var' : 'Yok',
        pheCapacity: line.pheCapacity ? line.pheCapacity.toLocaleString('tr-TR') : '—',
        pheIceWaterTempSensor: line.pheIceWaterTempSensorType
          ? (PHE_TEMP_LABEL[line.pheIceWaterTempSensorType] ?? line.pheIceWaterTempSensorType)
          : '—',
        pheIceWaterPressureMeter: line.pheIceWaterPressureMeterType
          ? (PM_LABEL[line.pheIceWaterPressureMeterType] ?? line.pheIceWaterPressureMeterType)
          : '—',
        hasSamplingValve: line.hasSamplingValve ? 'Var' : 'Yok',
        samplingValve: line.samplingValveType
          ? (SAMPLING_LABEL[line.samplingValveType] ?? line.samplingValveType)
          : '—',
      };
    }),
    showTankerCip: module.hasTankerCip,
    tankerCip: {
      enabled: module.hasTankerCip,
      label: module.hasTankerCip ? 'Var' : 'Yok',
      capacity: module.tankerCipCapacity ? module.tankerCipCapacity.toLocaleString('tr-TR') : '—',
      pressure: module.tankerCipPressure ? module.tankerCipPressure.toLocaleString('tr-TR') : '—',
      dn: tankerCipDN,
      pumpModel: module.tankerCipPumpModel ?? '—',
      pumpKw: module.tankerCipPumpKw != null ? String(module.tankerCipPumpKw) : '—',
      pumpImpellerSize: module.tankerCipPumpImpellerSize != null ? String(module.tankerCipPumpImpellerSize) : '—',
    },
    totals: {
      lineCount: lines.length,
      filterUnitTotal: lines.reduce((s, l) => s + l.filterUnitCount, 0),
      clarifierCount: lines.filter((l) => l.hasMilkClarifier).length,
      pheCount: lines.filter((l) => l.hasPhe).length,
      samplingCount: lines.filter((l) => l.hasSamplingValve).length,
    },
    // Özet sayımlar — ekipmanları tek tek listelemeden
    valveCount: pricingTotals.valveCount,
    otherCount: pricingTotals.otherCount,
    itemCount: pricingTotals.itemCount,
    counts: pricingTotals.counts,
    // Fiyatlandırma — yalnızca toplam
    pricing: {
      currency: 'EUR',
      multiplier: formatNumberTR(multiplier, { decimals: 2 }),
      subtotal: formatNumberTR(pricingTotals.subtotal, { decimals: 2 }),
      totalPrice: formatNumberTR(pricingTotals.total, { decimals: 2 }),
    },
  };
}
