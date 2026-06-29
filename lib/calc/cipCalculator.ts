import { calculatePipeDiameter } from './pipeDiameter';
import { selectDN } from './selectDN';
import type { PipeSize } from './standardTables';
import { CIP_VELOCITY } from './constants';

// CIP modülü hesap motoru — saf TS, deterministik.
// Kapasite diğer modüllerle tutarlı şekilde **L/h** cinsindendir; calculatePipeDiameter
// doğrudan L/h alır. Pompa seçimi tarafında m³/h'a dönüşüm autoSelectPump içinde yapılır.

export type CipLineKind = 'DISCHARGE' | 'RETURN';

export interface CipLineInput {
  id: string;
  lineKind: CipLineKind;
  capacityLh: number;
}

export interface CipModuleInput {
  standard: 'DIN' | 'SMS';
  lines: CipLineInput[];
}

export interface CipLineResult {
  lineId: string;
  lineKind: CipLineKind;
  velocity: number;
  rawDiameterMm: number;
  selectedDN: PipeSize | null;
}

export interface CipModuleCalculation {
  lineResults: CipLineResult[];
  maxRawDiameterMm: number | null;
  selectedDN: PipeSize | null;
}

export function velocityForLineKind(kind: CipLineKind): number {
  return kind === 'DISCHARGE' ? CIP_VELOCITY.DISCHARGE : CIP_VELOCITY.RETURN;
}

/** Tek bir hat için ham çap (mm) + standart DN seçimi. Kapasite L/h. */
export function calculateCipLine(
  capacityLh: number,
  lineKind: CipLineKind,
  standard: 'DIN' | 'SMS',
): { rawDiameterMm: number; selectedDN: PipeSize | null } {
  const velocity = velocityForLineKind(lineKind);
  const { diameterMm } = calculatePipeDiameter({
    capacityLh,
    velocity,
  });
  let dn: PipeSize | null = null;
  try {
    dn = selectDN(diameterMm, standard);
  } catch {
    dn = null; // tabloyu aşan değer — UI/çağıran tarafa null döner
  }
  return { rawDiameterMm: diameterMm, selectedDN: dn };
}

/** Tüm modülün hesabı: her hat + en büyük çaptan modül seçili DN'i. */
export function calculateCipModule(module: CipModuleInput): CipModuleCalculation {
  const lineResults: CipLineResult[] = module.lines
    .filter((l) => l.capacityLh > 0)
    .map((l) => {
      const { rawDiameterMm, selectedDN } = calculateCipLine(
        l.capacityLh,
        l.lineKind,
        module.standard,
      );
      return {
        lineId: l.id,
        lineKind: l.lineKind,
        velocity: velocityForLineKind(l.lineKind),
        rawDiameterMm,
        selectedDN,
      };
    });

  if (lineResults.length === 0) {
    return { lineResults, maxRawDiameterMm: null, selectedDN: null };
  }

  const maxRawDiameterMm = Math.max(...lineResults.map((r) => r.rawDiameterMm));
  let selectedDN: PipeSize | null = null;
  try {
    selectedDN = selectDN(maxRawDiameterMm, module.standard);
  } catch {
    selectedDN = null;
  }

  return { lineResults, maxRawDiameterMm, selectedDN };
}
