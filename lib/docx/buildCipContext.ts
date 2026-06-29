// CIP modülü için Word şablon context'i.

import { calculateCipLine, calculateCipModule } from '@/lib/calc/cipCalculator';
import { buildCipPricing, summarizeCipPricing, type CipTankType } from '@/lib/pricing/cipPricing';
import type { PricingItem } from '@/lib/pricing/loader';
import type { ControlUnit } from '@/lib/pricing/valveMatcher';
import { summarizePricingWithOverrides, type CanonicalPricingRow } from '@/lib/pricing/totals';
import { formatNumberTR } from '@/lib/utils';

interface CipLineForDoc {
  id: string;
  lineKind: 'DISCHARGE' | 'RETURN';
  name: string;
  order: number;
  capacity: number;
  pressure: number;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
}

interface CipTankForDoc {
  tankType: CipTankType;
  capacity: number;
  material: string;
  insulation: string;
  hasLSH: boolean;
  hasLSL: boolean;
  hasExternalSensor: boolean;
  hasPressureTransmitter: boolean;
}

interface ModuleForDoc {
  id: string;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: string;
  valveControlUnit: string;
  systemType: string;
  samplingValve: string;
  hasManholeSwitch: boolean;
  priceMultiplier: number;
  priceOverrides: unknown;
  quotationNo: string | null;
  customerContactPerson: string | null;
  deliveryWeeks: number | null;
  deliveryPlace: string | null;
  offerValidityDays: number | null;
  createdAt: Date | string;
  creator: { name: string };
  tanks: CipTankForDoc[];
  lines: CipLineForDoc[];
}

const CONTROL_UNIT_LABEL: Record<string, string> = { NONE: 'Yok (Pnömatik)', AS_I: 'AS-i', DC: 'DC' };
const SYSTEM_LABEL: Record<string, string> = { FORWARD: 'Forward System', CIRCULATED: 'Circulated System' };
const SAMPLING_LABEL: Record<string, string> = { NONE: 'Yok', MANUAL: 'Manuel', WITH_ACTUATOR: 'Aktüatörlü' };
const MATERIAL_LABEL: Record<string, string> = { AISI_304: 'AISI 304', AISI_316: 'AISI 316' };
const INSULATION_LABEL: Record<string, string> = { INSULATED: 'İzoleli', UNINSULATED: 'İzolesiz' };
const TANK_LABEL: Record<string, string> = {
  CAUSTIC: 'Caustic Tank', ACID: 'Acid Tank', HOT_WATER: 'Hot Water Tank',
  RECOVERY: 'Recovery Tank', FRESH_WATER: 'Fresh Water Tank',
};

export function buildCipContext(module: ModuleForDoc, customItems: PricingItem[] = []) {
  const standard = module.standard as 'DIN' | 'SMS';
  const lines = module.lines;

  // Modül seçili DN
  const moduleCalc = calculateCipModule({
    standard,
    lines: lines.map((l) => ({ id: l.id, lineKind: l.lineKind, capacityLh: l.capacity })),
  });
  const selectedDN = moduleCalc.selectedDN?.dn ?? null;

  // Hat bazlı DN
  const lineCalcs = lines.map((l) => {
    if (!l.capacity || l.capacity <= 0) return { lineId: l.id, dn: null as string | null };
    const c = calculateCipLine(l.capacity, l.lineKind, standard);
    return { lineId: l.id, dn: c.selectedDN?.dn ?? null };
  });

  // === Fiyatlandırma ===
  const overrides = (module.priceOverrides as Record<string, number> | null) ?? {};
  const multiplier = module.priceMultiplier ?? 1;
  const allRows = buildCipPricing({
    standard,
    controlUnit: (module.valveControlUnit ?? 'NONE') as ControlUnit,
    systemType: module.systemType as 'FORWARD' | 'CIRCULATED',
    samplingValve: module.samplingValve as 'NONE' | 'MANUAL' | 'WITH_ACTUATOR',
    hasManholeSwitch: module.hasManholeSwitch,
    selectedDN,
    tanks: module.tanks.map((t) => ({
      tankType: t.tankType,
      capacity: t.capacity,
      hasLSH: t.hasLSH,
      hasLSL: t.hasLSL,
      hasExternalSensor: t.hasExternalSensor,
      hasPressureTransmitter: t.hasPressureTransmitter,
    })),
    lines: lines.map((l) => ({
      name: l.name,
      lineKind: l.lineKind,
      dn: lineCalcs.find((c) => c.lineId === l.id)?.dn ?? null,
      pumpModel: l.pumpModel,
    })),
    customItems,
  });
  // Fiyata dahil edilenler (bilgi amaçlı satırlar hariç) — önizleme kartıyla aynı set
  const pricingRows = allRows.filter((r) => !r.informational);
  const canonicalRows: CanonicalPricingRow[] = pricingRows.map((r) => ({
    category: r.category,
    description: r.description,
    size: r.size,
    quantity: r.quantity,
    matched: r.matched,
    unitNetPrice: r.unitNetPrice,
  }));
  const pricingTotals = summarizePricingWithOverrides(canonicalRows, overrides, multiplier);
  const summary = summarizeCipPricing(allRows);

  const tankCount = module.tanks.length;
  const dischargeCount = lines.filter((l) => l.lineKind === 'DISCHARGE').length;
  const returnCount = lines.filter((l) => l.lineKind === 'RETURN').length;

  return {
    isCip: true,
    module: {
      name: module.name,
      nameUpper: module.name.toUpperCase(),
      customerName: module.customerName ?? '',
      projectCode: module.projectCode ?? '',
      standard: module.standard,
      controlUnit: CONTROL_UNIT_LABEL[module.valveControlUnit] ?? module.valveControlUnit,
      systemType: SYSTEM_LABEL[module.systemType] ?? module.systemType,
      samplingValve: SAMPLING_LABEL[module.samplingValve] ?? module.samplingValve,
      manholeSwitch: module.hasManholeSwitch ? 'Var' : 'Yok',
      selectedDN: selectedDN ?? '—',
      createdDate: new Date(module.createdAt).toLocaleDateString('tr-TR'),
    },
    creator: { name: module.creator.name },
    quotation: {
      no: module.quotationNo ?? '',
      date: new Date(module.createdAt).toLocaleDateString('tr-TR'),
      contactPerson: module.customerContactPerson ?? '',
      deliveryWeeks: module.deliveryWeeks != null ? String(module.deliveryWeeks) : '—',
      deliveryPlace: module.deliveryPlace ?? 'Customer Factory',
      offerValidityDays: module.offerValidityDays != null ? String(module.offerValidityDays) : '30',
    },
    tanks: module.tanks.map((t) => ({
      type: TANK_LABEL[t.tankType] ?? t.tankType,
      capacity: t.capacity.toLocaleString('tr-TR'),
      material: MATERIAL_LABEL[t.material] ?? t.material,
      insulation: INSULATION_LABEL[t.insulation] ?? t.insulation,
      hasLSH: t.hasLSH ? 'Var' : 'Yok',
      hasLSL: t.hasLSL ? 'Var' : 'Yok',
      hasExternalSensor: t.hasExternalSensor ? 'Var' : 'Yok',
      hasPressureTransmitter: t.tankType === 'FRESH_WATER' ? '—' : (t.hasPressureTransmitter ? 'Var' : 'Yok'),
    })),
    dischargeLines: lines.filter((l) => l.lineKind === 'DISCHARGE').map((line, i) => ({
      sira: i + 1,
      name: line.name,
      capacity: line.capacity.toLocaleString('tr-TR'),
      pressure: line.pressure.toLocaleString('tr-TR'),
      dn: lineCalcs.find((c) => c.lineId === line.id)?.dn ?? '—',
      pumpModel: line.pumpModel ?? '—',
      pumpKw: line.pumpKw != null ? String(line.pumpKw) : '—',
      pumpImpellerSize: line.pumpImpellerSize != null ? String(line.pumpImpellerSize) : '—',
    })),
    returnLines: lines.filter((l) => l.lineKind === 'RETURN').map((line, i) => ({
      sira: i + 1,
      name: line.name,
      capacity: line.capacity.toLocaleString('tr-TR'),
      pressure: line.pressure.toLocaleString('tr-TR'),
      dn: lineCalcs.find((c) => c.lineId === line.id)?.dn ?? '—',
      pumpModel: line.pumpModel ?? '—',
      pumpKw: line.pumpKw != null ? String(line.pumpKw) : '—',
      pumpImpellerSize: line.pumpImpellerSize != null ? String(line.pumpImpellerSize) : '—',
    })),
    totals: {
      tankCount,
      dischargeCount,
      returnCount,
      dischargeValveCount: tankCount * dischargeCount,
      returnValveCount: tankCount * returnCount,
    },
    itemCount: pricingTotals.itemCount,
    counts: pricingTotals.counts,
    matchedCount: summary.matched,
    pricing: {
      currency: 'EUR',
      multiplier: formatNumberTR(multiplier, { decimals: 2 }),
      subtotal: formatNumberTR(pricingTotals.subtotal, { decimals: 2 }),
      totalPrice: formatNumberTR(pricingTotals.total, { decimals: 2 }),
    },
  };
}
