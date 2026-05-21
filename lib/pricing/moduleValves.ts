// Bir modüldeki vanaları çıkarıp her birine fiyat eşler.

import { calculateModule } from '@/lib/calc/moduleCalculator';
import type { ModuleInput } from '@/lib/calc/moduleCalculator';
import { findValvePrice, type CatalogValveType, type ControlUnit } from './valveMatcher';
import type { PricingItem } from './loader';

export interface ValveLineItem {
  /** Bu vana grubunun açıklaması (örn: "Dolum Hattı 1 — Ana Vana SDE44") */
  description: string;
  /** Bağlam: dolum hattı, boşaltım hattı, modül seviyesi */
  context: string;
  valveType: CatalogValveType;
  standard: 'DIN' | 'SMS';
  size: string;
  controlUnit?: ControlUnit;
  quantity: number;
  matched: boolean;
  matchedItem: PricingItem | null;
  reason?: string;
  unitPrice: number; // listPrice
  unitDiscount: number; // 0..1
  unitNetPrice: number;
  totalNet: number;
}

export interface ModulePricingContext {
  standard: 'DIN' | 'SMS';
  valveType: CatalogValveType;            // module.valveType
  controlUnit: ControlUnit;               // module.valveControlUnit
  cipReturnValveType: 'SWCIP41' | 'SD41'; // module.cipReturnValveType normalized
  waterInletValveType: 'SWCIP42' | 'SD42' | null;
  tankCipInlet: {
    type: 'SW43' | 'SW44';
    diameter: string;                     // örn: "DN50" or '2"' (zaten bu formatta)
  } | null;
  /** Tank CIP Dönüş — manifoldda yoksa her hatta tank başına SW41 + Drain + Check valve */
  tankCipReturn?: {
    manifoldExists: boolean;
    lineCount: number;
    tankCount: number;
  } | null;
  fillingLines: Array<{ id: string; name: string; capacity: number; connectedTankCount: number }>;
  dischargeLines: Array<{ id: string; name: string; capacity: number; connectedTankCount: number }>;
}

// `SW_CIP41` → `SWCIP41` gibi normalize
function normalizeValveType(v: string): string {
  return v.replace(/_/g, '');
}

// Tank CIP Inlet diameter ham string ("DN50" veya '2,5"') → ValveMatchInput.size formatına çevir
function tankCipInletSizeAsCatalog(diameter: string, standard: 'DIN' | 'SMS'): string {
  // DIN: zaten "DN50" formunda — direkt geçer
  if (standard === 'DIN') return diameter;
  // SMS: '2"' veya '2,5"' formundan '51 SMS (2")' / '63 SMS (2"1/2)' formuna çevir
  // Yarım inç değerleri (1,5" → 1"1/2, 2,5" → 2"1/2) sizeToToken'ın anladığı format.
  const m = diameter.match(/^(\d+)(?:,5)?"$/);
  if (m) {
    const whole = m[1];
    const isHalf = diameter.includes(',5');
    if (isHalf) return `xxx SMS (${whole}"1/2)`;
    return `xxx SMS (${whole}")`;
  }
  return diameter;
}

export function buildValveLineItemsForModule(ctx: ModulePricingContext): ValveLineItem[] {
  const items: ValveLineItem[] = [];

  // Hesaplama: selectedDN, drainValveSize
  const calcInput: ModuleInput = {
    standard: ctx.standard,
    fillingLines: ctx.fillingLines.map((l) => ({ id: l.id, capacity: l.capacity })),
    dischargeLines: ctx.dischargeLines.map((l) => ({ id: l.id, capacity: l.capacity, hasFlowMeter: false })),
  };
  const calc = (ctx.fillingLines.length + ctx.dischargeLines.length) > 0
    ? calculateModule(calcInput)
    : null;
  const selectedSize = calc?.selectedDN.dn ?? '';
  const drainSize = calc?.drainValveSize ?? '';
  // Leakage her zaman 25 mm sabit → DIN: DN25, SMS: 25 SMS (1")
  const leakageSize = ctx.standard === 'DIN' ? 'DN25' : '25 SMS (1")';
  const cipReturnType = normalizeValveType(ctx.cipReturnValveType) as 'SWCIP41' | 'SD41';
  const waterInletType = ctx.waterInletValveType
    ? (normalizeValveType(ctx.waterInletValveType) as 'SWCIP42' | 'SD42')
    : null;

  function push(input: {
    description: string; context: string;
    valveType: CatalogValveType; size: string; quantity: number;
    controlUnit?: ControlUnit;
  }) {
    const match = findValvePrice({
      valveType: input.valveType,
      standard: ctx.standard,
      size: input.size,
      controlUnit: input.controlUnit,
    });
    const it = match.item;
    const unitNet = it ? it.netPrice : 0;
    items.push({
      description: input.description,
      context: input.context,
      valveType: input.valveType,
      standard: ctx.standard,
      size: input.size,
      controlUnit: input.controlUnit,
      quantity: input.quantity,
      matched: match.found,
      matchedItem: it,
      reason: match.reason,
      unitPrice: it?.listPrice ?? 0,
      unitDiscount: it?.discount ?? 0,
      unitNetPrice: unitNet,
      totalNet: Math.round(unitNet * input.quantity * 100) / 100,
    });
  }

  // === DOLUM HATLARI ===
  ctx.fillingLines.forEach((line, idx) => {
    const lineLabel = `Dolum Hattı ${idx + 1}${line.name ? ` — ${line.name}` : ''}`;
    // Hatta bağlı tankların ana vanaları (connectedTankCount adet)
    if (line.connectedTankCount > 0 && selectedSize) {
      push({
        description: `Ana Vana — ${ctx.valveType}`,
        context: lineLabel,
        valveType: ctx.valveType,
        size: selectedSize,
        quantity: line.connectedTankCount,
        controlUnit: ctx.controlUnit,
      });
    }
    // Drain Vanası — SW41, drain boyutunda
    if (drainSize) {
      push({
        description: 'Drain Vanası — SW41',
        context: lineLabel,
        valveType: 'SW41',
        size: drainSize,
        quantity: 1,
        controlUnit: ctx.controlUnit,
      });
    }
    // Leakage Vanası — ESV (SV1 Butterfly), 25mm sabit → DIN: DN25, SMS: 25 SMS (1")
    push({
      description: 'Leakage Vanası — ESV (25 mm sabit)',
      context: lineLabel,
      valveType: 'SV1',
      size: leakageSize,
      quantity: 1,
      controlUnit: ctx.controlUnit,
    });
    // CIP Dönüş — cipReturnValveType, ana çapta
    if (selectedSize) {
      push({
        description: `CIP Dönüş Vanası — ${cipReturnType}`,
        context: lineLabel,
        valveType: cipReturnType,
        size: selectedSize,
        quantity: 1,
        controlUnit: ctx.controlUnit,
      });
    }
  });

  // === BOŞALTIM HATLARI ===
  ctx.dischargeLines.forEach((line, idx) => {
    const lineLabel = `Boşaltım Hattı ${idx + 1}${line.name ? ` — ${line.name}` : ''}`;
    if (line.connectedTankCount > 0 && selectedSize) {
      push({
        description: `Ana Vana — ${ctx.valveType}`,
        context: lineLabel,
        valveType: ctx.valveType,
        size: selectedSize,
        quantity: line.connectedTankCount,
        controlUnit: ctx.controlUnit,
      });
    }
    // CIP Giriş
    if (selectedSize) {
      push({
        description: `CIP Giriş Vanası — ${cipReturnType}`,
        context: lineLabel,
        valveType: cipReturnType,
        size: selectedSize,
        quantity: 1,
        controlUnit: ctx.controlUnit,
      });
    }
    // Leakage Vanası — ESV (SV1 Butterfly), 25mm sabit
    push({
      description: 'Leakage Vanası — ESV (25 mm sabit)',
      context: lineLabel,
      valveType: 'SV1',
      size: leakageSize,
      quantity: 1,
      controlUnit: ctx.controlUnit,
    });
    // Su Giriş (varsa)
    if (waterInletType && selectedSize) {
      push({
        description: `Su Giriş Vanası — ${waterInletType}`,
        context: lineLabel,
        valveType: waterInletType,
        size: selectedSize,
        quantity: 1,
        controlUnit: ctx.controlUnit,
      });
    }
  });

  // === MODÜL — TANK CIP INLET ===
  if (ctx.tankCipInlet) {
    push({
      description: `Tank CIP Inlet Vanası — ${ctx.tankCipInlet.type}`,
      context: 'Modül',
      valveType: ctx.tankCipInlet.type,
      size: tankCipInletSizeAsCatalog(ctx.tankCipInlet.diameter, ctx.standard),
      quantity: 1,
      controlUnit: ctx.controlUnit,
    });
  }

  // === MODÜL — TANK CIP DÖNÜŞ HATLARI ===
  // Manifoldda CIP dönüş yoksa: her hatta tank başına SW41 + Drain + Check Valve
  if (
    ctx.tankCipReturn &&
    !ctx.tankCipReturn.manifoldExists &&
    ctx.tankCipReturn.tankCount > 0 &&
    ctx.tankCipReturn.lineCount > 0 &&
    selectedSize
  ) {
    // CIP Vanası: her hatta her tank için bir tane → lineCount × tankCount
    // Drain Vanası: her hatta bir tane (manifold seviyesinde) → lineCount
    const cipQty = ctx.tankCipReturn.lineCount * ctx.tankCipReturn.tankCount;
    const drainQty = ctx.tankCipReturn.lineCount;
    const label = `Tank CIP Dönüş (${ctx.tankCipReturn.lineCount} hat × ${ctx.tankCipReturn.tankCount} tank)`;
    push({
      description: 'CIP Dönüş Vanası — SW41',
      context: label,
      valveType: 'SW41',
      size: selectedSize,
      quantity: cipQty,
      controlUnit: ctx.controlUnit,
    });
    if (drainSize) {
      push({
        description: 'Drain Vanası — SW41',
        context: label,
        valveType: 'SW41',
        size: drainSize,
        quantity: drainQty,
        controlUnit: ctx.controlUnit,
      });
    }
  }

  return items;
}
