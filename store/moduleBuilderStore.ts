import { create } from 'zustand';
import { calculateModule, type ModuleCalculation } from '@/lib/calc/moduleCalculator';

export interface FillingLineDraft {
  id: string;
  name: string;
  capacity: number;
  valveType: string;
  valveControlUnit: string;
  order: number;
  calculatedDiameter: number | null;
}

export interface DischargeLineDraft {
  id: string;
  name: string;
  capacity: number;
  pressure: number;
  valveType: string;
  valveControlUnit: string;
  pumpModel: string;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
  hasPressureTransmitter: boolean;
  hasFlowMeter: boolean;
  waterInletType: string | null;
  order: number;
  calculatedDiameter: number | null;
}

interface ModuleBuilderState {
  moduleId: string | null;
  standard: 'DIN' | 'SMS' | null;
  fillingLines: FillingLineDraft[];
  dischargeLines: DischargeLineDraft[];
  liveCalc: ModuleCalculation | null;
  calcError: string | null;

  init: (
    moduleId: string,
    standard: 'DIN' | 'SMS',
    filling: FillingLineDraft[],
    discharge: DischargeLineDraft[]
  ) => void;
  setFillingLines: (lines: FillingLineDraft[]) => void;
  setDischargeLines: (lines: DischargeLineDraft[]) => void;
  updateFillingLine: (id: string, patch: Partial<FillingLineDraft>) => void;
  updateDischargeLine: (id: string, patch: Partial<DischargeLineDraft>) => void;
  recalculate: () => void;
}

export const useModuleBuilder = create<ModuleBuilderState>((set, get) => ({
  moduleId: null,
  standard: null,
  fillingLines: [],
  dischargeLines: [],
  liveCalc: null,
  calcError: null,

  init(moduleId, standard, filling, discharge) {
    set({ moduleId, standard, fillingLines: filling, dischargeLines: discharge });
    get().recalculate();
  },

  setFillingLines(lines) {
    set({ fillingLines: lines });
    get().recalculate();
  },

  setDischargeLines(lines) {
    set({ dischargeLines: lines });
    get().recalculate();
  },

  updateFillingLine(id, patch) {
    set((s) => ({
      fillingLines: s.fillingLines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
    get().recalculate();
  },

  updateDischargeLine(id, patch) {
    set((s) => ({
      dischargeLines: s.dischargeLines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
    get().recalculate();
  },

  recalculate() {
    const { standard, fillingLines, dischargeLines } = get();
    if (!standard || (fillingLines.length === 0 && dischargeLines.length === 0)) {
      set({ liveCalc: null, calcError: null });
      return;
    }
    try {
      const calc = calculateModule({
        standard,
        fillingLines: fillingLines.map((l) => ({ id: l.id, capacity: l.capacity })),
        dischargeLines: dischargeLines.map((l) => ({
          id: l.id,
          capacity: l.capacity,
          hasFlowMeter: l.hasFlowMeter,
        })),
      });
      set({ liveCalc: calc, calcError: null });
    } catch (e) {
      set({ liveCalc: null, calcError: e instanceof Error ? e.message : 'Hesap hatası' });
    }
  },
}));
