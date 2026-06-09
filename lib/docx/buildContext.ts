import { calculateModule } from '@/lib/calc/moduleCalculator';
import { buildValveLineItemsForModule, type ModulePricingContext } from '@/lib/pricing/moduleValves';
import type { CatalogValveType, ControlUnit } from '@/lib/pricing/valveMatcher';
import { buildStorageInstrumentItems } from '@/lib/pricing/storageInstruments';
import type { PricingItem } from '@/lib/pricing/loader';
import { summarizePricingWithOverrides, type CanonicalPricingRow } from '@/lib/pricing/totals';
import { formatNumberTR } from '@/lib/utils';

interface FillingLine {
  id: string;
  name: string;
  capacity: number;
  valveType: string;
  valveControlUnit: string;
  connectedTankCount: number;
}

interface DischargeLine {
  id: string;
  name: string;
  capacity: number;
  pressure: number;
  valveType: string;
  valveControlUnit: string;
  connectedTankCount: number;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
  hasPressureTransmitter: boolean;
  hasFlowMeter: boolean;
  waterInletType: string | null;
}

interface Tank {
  id: string;
  name: string;
  volume: number;
  hasLSH: boolean;
  hasLSM: boolean;
  hasLSL: boolean;
  hasTT: boolean;
  hasPT: boolean;
  samplingValve: string;
  hasProximitySwitch: boolean;
  hasAgitator: boolean;
  agitatorMotorKw: number | null;
  agitatorRpm: number | null;
  agitatorPosition: string | null;
  cipBall: string;
  hasCipInletForAgitator: boolean;
  hasCipInletForManhole: boolean;
  hasTankOutletValve: boolean;
  tankOutletValveType: string | null;
  tankOutletValveSubType: string | null;
  manifoldHasCipReturnPump: boolean;
  cipReturnPumpModel: string | null;
  cipReturnPumpKw: number | null;
  cipReturnPumpImpellerSize: number | null;
}

export interface ModuleForDoc {
  id: string;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: string;
  productType: string;
  valveType: string | null;
  valveControlUnit: string | null;
  cipReturnValveType: string | null;
  waterInletValveType: string | null;
  tankCipInletValveType: string | null;
  tankCipInletDiameter: string | null;
  tankCipReturnManifoldExists: boolean;
  tankCipReturnLineCount: number;
  tankCipReturnPumpModel: string | null;
  priceMultiplier: number;
  priceOverrides: unknown;
  status: string;
  // Teklif (commercial) bilgileri — HEM-PROJECT-NO şablonu için
  quotationNo: string | null;
  customerContactPerson: string | null;
  deliveryWeeks: number | null;
  deliveryPlace: string | null;
  offerValidityDays: number | null;
  createdAt: Date | string;
  creator: { name: string };
  valveCluster: {
    fillingLines: FillingLine[];
    dischargeLines: DischargeLine[];
  } | null;
  tanks: Tank[];
}

const PRODUCT_LABEL: Record<string, string> = {
  HYGIENIC: 'Hijyenik',
  ULTRA_HYGIENIC: 'Ultrahijyenik',
};

const CONTROL_UNIT_LABEL: Record<string, string> = {
  NONE: 'Yok',
  AS_I: 'AS-i',
  DC: 'DC',
};

const WATER_INLET_LABEL: Record<string, string> = {
  SW_CIP42: 'SW-CIP 42',
  SD42: 'SD 42',
};

const CIP_RETURN_VALVE_LABEL: Record<string, string> = {
  SW_CIP41: 'SW CIP41',
  SD41: 'SD41',
};

const FIXED_FILLING_VALVES = 3;

export function buildTemplateContext(module: ModuleForDoc, customItems: PricingItem[] = []) {
  const fl = module.valveCluster?.fillingLines ?? [];
  const dl = module.valveCluster?.dischargeLines ?? [];
  const hasLines = fl.length > 0 || dl.length > 0;
  const FIXED_DISCHARGE_VALVES = module.waterInletValveType ? 3 : 2;

  const calc = hasLines
    ? calculateModule({
        standard: module.standard as 'DIN' | 'SMS',
        fillingLines: fl.map((l) => ({ id: l.id, capacity: l.capacity })),
        dischargeLines: dl.map((l) => ({ id: l.id, capacity: l.capacity, hasFlowMeter: l.hasFlowMeter })),
      })
    : null;

  const cipReturnValveLabel = module.cipReturnValveType
    ? (CIP_RETURN_VALVE_LABEL[module.cipReturnValveType] ?? module.cipReturnValveType)
    : '—';
  const waterInletValveLabel = module.waterInletValveType
    ? (WATER_INLET_LABEL[module.waterInletValveType] ?? module.waterInletValveType)
    : 'Yok';

  // === Fiyatlandırma (önizleme kartıyla aynı satır sırası/anahtarları) ===
  const valveItems =
    module.valveType && hasLines
      ? buildValveLineItemsForModule({
          standard: module.standard as 'DIN' | 'SMS',
          valveType: module.valveType as CatalogValveType,
          controlUnit: (module.valveControlUnit ?? 'AS_I') as ControlUnit,
          cipReturnValveType: (module.cipReturnValveType ?? 'SW_CIP41') as 'SWCIP41' | 'SD41',
          waterInletValveType: module.waterInletValveType as 'SWCIP42' | 'SD42' | null,
          tankCipInlet:
            module.tankCipInletValveType && module.tankCipInletDiameter
              ? { type: module.tankCipInletValveType as 'SW43' | 'SW44', diameter: module.tankCipInletDiameter }
              : null,
          tankCipReturn: {
            manifoldExists: module.tankCipReturnManifoldExists,
            lineCount: module.tankCipReturnLineCount,
            tankCount: module.tanks.length,
          },
          fillingLines: fl.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount })),
          dischargeLines: dl.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, connectedTankCount: l.connectedTankCount })),
        } as ModulePricingContext)
      : [];

  const instrumentRows =
    module.tanks.length > 0 || dl.length > 0
      ? buildStorageInstrumentItems({
          standard: module.standard as 'DIN' | 'SMS',
          tanks: module.tanks.map((t) => ({
            name: t.name,
            hasLSH: t.hasLSH,
            hasLSM: t.hasLSM,
            hasLSL: t.hasLSL,
            hasTT: t.hasTT,
            hasPT: t.hasPT,
            hasProximitySwitch: t.hasProximitySwitch,
            hasAgitator: t.hasAgitator,
            agitatorMotorKw: t.agitatorMotorKw,
            cipBall: t.cipBall as 'STATIC' | 'ROTARY',
            cipReturnPumpModel: t.cipReturnPumpModel,
          })),
          dischargeLines: dl.map((l) => {
            const fmResult = calc?.flowMeterResults.find((r) => r.lineId === l.id);
            return {
              name: l.name,
              hasFlowMeter: l.hasFlowMeter,
              flowMeterSize: l.hasFlowMeter ? (fmResult?.selectedDN.dn ?? calc?.selectedDN.dn ?? null) : null,
              hasPressureTransmitter: l.hasPressureTransmitter,
              pumpModel: l.pumpModel,
            };
          }),
          tankCipReturnPumpModel: module.tankCipReturnPumpModel,
          customItems,
        })
      : [];

  const overrides = (module.priceOverrides as Record<string, number> | null) ?? {};
  const multiplier = module.priceMultiplier ?? 1;
  const canonicalRows: CanonicalPricingRow[] = [
    ...valveItems.map((it) => ({
      category: 'Vanalar',
      description: it.description,
      size: it.size,
      quantity: it.quantity,
      matched: it.matched,
      unitNetPrice: it.unitNetPrice,
    })),
    ...instrumentRows.map((r) => ({
      category: r.category,
      description: r.description,
      size: r.size,
      quantity: r.quantity,
      matched: r.matched,
      unitNetPrice: r.unitNetPrice,
    })),
  ];
  const pricingTotals = summarizePricingWithOverrides(canonicalRows, overrides, multiplier);

  // === Ekipman özet tablosu (DESCRIPTION → Equipment/Quantity) ===
  // Adetler sistemin kendi kurallarından türetilir; 0 olan kalem listeye girmez (koşullu satır).
  const agitatorCount = module.tanks.filter((t) => t.hasAgitator).length;
  const flowMeterCount = dl.filter((l) => l.hasFlowMeter).length;
  const pumpCount =
    dl.filter((l) => l.pumpModel).length +
    module.tanks.filter((t) => t.cipReturnPumpModel).length +
    (module.tankCipReturnPumpModel ? 1 : 0);
  const sensorCount =
    module.tanks.reduce(
      (s, t) => s + [t.hasLSH, t.hasLSM, t.hasLSL, t.hasTT, t.hasPT, t.hasProximitySwitch].filter(Boolean).length,
      0,
    ) + dl.filter((l) => l.hasPressureTransmitter).length;
  // CIP spray ball: her tankta bir adet (statik/döner) — storageInstruments ile aynı.
  const cipBallCount = module.tanks.length;
  const equipment = [
    { name: 'Valves', purpose: 'To control and direct the product flow throughout the process line.', quantity: pricingTotals.valveCount },
    { name: 'Storage Tanks', purpose: 'To store the product under hygienic conditions.', quantity: module.tanks.length },
    { name: 'Agitators', purpose: 'To keep the product homogeneous inside the tanks.', quantity: agitatorCount },
    { name: 'CIP Spray Balls', purpose: 'To clean the tank interior during the CIP cycle.', quantity: cipBallCount },
    { name: 'Pumps', purpose: 'To transfer the product through the process lines.', quantity: pumpCount },
    { name: 'Flow Meters', purpose: 'To measure the product flow rate.', quantity: flowMeterCount },
    { name: 'Sensors', purpose: 'To monitor process parameters such as level, pressure, temperature, and position.', quantity: sensorCount },
  ].filter((e) => e.quantity > 0);

  return {
    module: {
      name: module.name,
      nameUpper: module.name.toUpperCase(),
      customerName: module.customerName ?? '',
      projectCode: module.projectCode ?? '',
      standard: module.standard,
      productTypeLabel: PRODUCT_LABEL[module.productType] ?? module.productType,
      valveType: module.valveType ?? '—',
      controlUnit: module.valveControlUnit
        ? (CONTROL_UNIT_LABEL[module.valveControlUnit] ?? module.valveControlUnit)
        : '—',
      cipReturnValve: cipReturnValveLabel,
      cipInletValve: cipReturnValveLabel,
      waterInletValve: waterInletValveLabel,
      tankCipInletValve: module.tankCipInletValveType ?? 'Yok',
      tankCipInletDiameter: module.tankCipInletDiameter ?? '—',
      drainValveFixed: 'SW41',
      leakageValveFixed: 'ESV',
      createdDate: new Date(module.createdAt).toLocaleDateString('tr-TR'),
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
    calc: {
      selectedDN: calc?.selectedDN.dn ?? '—',
      selectedInner: calc?.selectedDN.inner != null ? String(calc.selectedDN.inner) : '—',
      selectedOuter: calc?.selectedDN.outer != null ? String(calc.selectedDN.outer) : '—',
      drainValveSize: calc?.drainValveSize ?? '—',
      cipReturnSize: calc?.cipReturnSize ?? '—',
      tankDrainValveSize: calc?.tankDrainValveSize ?? '—',
    },
    fillingLines: fl.map((line, i) => ({
      sira: i + 1,
      name: line.name,
      capacity: line.capacity.toLocaleString('tr-TR'),
      valveType: line.valveType,
      controlUnit: CONTROL_UNIT_LABEL[line.valveControlUnit] ?? line.valveControlUnit,
      selectedDN: calc?.selectedDN.dn ?? '—',
      drainValveSize: calc?.drainValveSize ?? '—',
      // Dolum hattı sabit vana grubu (3 adet):
      drainValveFixed: 'SW41',
      leakageValveFixed: 'ESV',
      cipReturnValve: cipReturnValveLabel,
      fixedValveCount: FIXED_FILLING_VALVES,
    })),
    dischargeLines: dl.map((line, i) => {
      const fmResult = calc?.flowMeterResults.find((r) => r.lineId === line.id);
      return {
        sira: i + 1,
        name: line.name,
        capacity: line.capacity.toLocaleString('tr-TR'),
        pressure: String(line.pressure),
        valveType: line.valveType,
        controlUnit: CONTROL_UNIT_LABEL[line.valveControlUnit] ?? line.valveControlUnit,
        pumpModel: line.pumpModel ?? '',
        pumpKw: line.pumpKw != null ? String(line.pumpKw) : '',
        pumpImpellerSize: line.pumpImpellerSize != null ? String(line.pumpImpellerSize) : '',
        hasPT: line.hasPressureTransmitter ? 'Var' : 'Yok',
        hasFlowMeter: line.hasFlowMeter ? 'Var' : 'Yok',
        flowMeterDN: fmResult?.selectedDN.dn ?? '—',
        waterInletType: waterInletValveLabel,
        selectedDN: calc?.selectedDN.dn ?? '—',
        drainValveSize: calc?.drainValveSize ?? '—',
        // Boşaltım hattı sabit vana grubu (3 adet):
        cipInletValve: cipReturnValveLabel,
        leakageValveFixed: 'ESV',
        waterInletValve: waterInletValveLabel,
        fixedValveCount: FIXED_DISCHARGE_VALVES,
      };
    }),
    tanks: module.tanks.map((tank, i) => {
      const sensorFlags: Array<[boolean, string]> = [
        [tank.hasLSH, 'LSH'], [tank.hasLSM, 'LSM'], [tank.hasLSL, 'LSL'],
        [tank.hasTT, 'TT'], [tank.hasPT, 'PT'],
      ];
      const sensors = sensorFlags.filter(([v]) => v).map(([, label]) => label).join(', ') || 'Yok';

      const subTypeLabels: Record<string, string> = {
        BUTTERFLY: 'Kelebek',
        SINGLE_SEAT: 'Single Seat',
        SINGLE_SEAT_TANK: 'Single Seat Tank',
        SW_CIP_TANK: 'SW CIP Tank',
        SD_TANK: 'SD Tank',
        D_TANK: 'D Tank',
      };
      let outletValveLabel = 'Yok';
      if (tank.hasTankOutletValve) {
        if (tank.tankOutletValveType === 'WITH_ACTUATOR') {
          const sub = subTypeLabels[tank.tankOutletValveSubType ?? 'BUTTERFLY'] ?? 'Kelebek';
          outletValveLabel = `Aktüatörlü — ${sub}`;
        } else {
          outletValveLabel = 'Manuel — Kelebek';
        }
      }

      return {
        sira: i + 1,
        name: tank.name,
        volume: tank.volume.toLocaleString('tr-TR'),
        sensors,
        samplingValve: tank.samplingValve === 'MANUAL' ? 'Manuel' : 'Aktüatörlü',
        proximitySwitch: tank.hasProximitySwitch ? 'Var' : 'Yok',
        agitatorLabel: tank.hasAgitator
          ? `Var (${tank.agitatorMotorKw ?? '?'} kW, ${tank.agitatorRpm ?? '?'} rpm, ${tank.agitatorPosition === 'SIDE' ? 'Yan' : 'Üst'})`
          : 'Yok',
        cipBall: tank.cipBall === 'STATIC' ? 'Statik' : 'Döner',
        cipInletAgitator: tank.hasCipInletForAgitator ? 'Var' : 'Yok',
        cipInletManhole: tank.hasCipInletForManhole ? 'Var' : 'Yok',
        tankOutletValve: outletValveLabel,
        cipReturnPump: tank.cipReturnPumpModel
          ? `${tank.cipReturnPumpModel} — ${tank.cipReturnPumpKw ?? '?'} kW`
          : 'Yok',
        drainValveSize: calc?.tankDrainValveSize ?? '—',
        cipValveSize: calc?.selectedDN.dn ?? '—',
        checkValveSize: calc?.selectedDN.dn ?? '—',
      };
    }),
    // Özet sayımlar — ekipmanları tek tek listelemeden
    fillingLineCount: fl.length,
    dischargeLineCount: dl.length,
    tankCount: module.tanks.length,
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
