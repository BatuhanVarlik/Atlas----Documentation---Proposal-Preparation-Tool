import { calculatePipeDiameter, type DiameterResult } from './pipeDiameter';
import { selectDN, getDrainValveSize, getTankDrainValveSize } from './selectDN';
import type { PipeSize } from './standardTables';
import { VELOCITY, LEAKAGE_CHAMBER_MM } from './constants';

export interface FillingLineInput {
  id: string;
  capacity: number;
}

export interface DischargeLineInput {
  id: string;
  capacity: number;
  hasFlowMeter: boolean;
}

export interface ModuleInput {
  standard: 'DIN' | 'SMS';
  fillingLines: FillingLineInput[];
  dischargeLines: DischargeLineInput[];
}

export interface FlowMeterResult {
  lineId: string;
  diameterMm: number;
  selectedDN: PipeSize;
}

export interface ModuleCalculation {
  selectedDN: PipeSize;
  maxRawDiameterMm: number;
  fillingDiameters: DiameterResult[];
  dischargeDiameters: DiameterResult[];
  flowMeterResults: FlowMeterResult[];
  drainValveSize: string;
  tankDrainValveSize: string;
  cipReturnSize: string;
  cipInletSize: string;
  checkValveSize: string;
  leakageChamberMm: number;
}

export function calculateModule(module: ModuleInput): ModuleCalculation {
  const fillingDiameters = module.fillingLines.map((line) =>
    calculatePipeDiameter({ capacityLh: line.capacity, velocity: VELOCITY.FILLING })
  );

  const dischargeDiameters = module.dischargeLines.map((line) =>
    calculatePipeDiameter({ capacityLh: line.capacity, velocity: VELOCITY.DISCHARGE })
  );

  const allDiameters = [
    ...fillingDiameters.map((d) => d.diameterMm),
    ...dischargeDiameters.map((d) => d.diameterMm),
  ];

  if (allDiameters.length === 0) {
    throw new Error('Modülde en az bir dolum veya boşaltım hattı olmalıdır.');
  }

  const maxRawDiameterMm = Math.max(...allDiameters);
  const selectedDN = selectDN(maxRawDiameterMm, module.standard);

  const flowMeterResults: FlowMeterResult[] = module.dischargeLines
    .filter((line) => line.hasFlowMeter)
    .map((line) => {
      const result = calculatePipeDiameter({
        capacityLh: line.capacity,
        velocity: VELOCITY.FLOW_METER,
      });
      return {
        lineId: line.id,
        diameterMm: result.diameterMm,
        selectedDN: selectDN(result.diameterMm, module.standard),
      };
    });

  const drainValveSize = getDrainValveSize(selectedDN.dn, module.standard);
  const tankDrainValveSize = getTankDrainValveSize(module.standard);

  return {
    selectedDN,
    maxRawDiameterMm,
    fillingDiameters,
    dischargeDiameters,
    flowMeterResults,
    drainValveSize,
    tankDrainValveSize,
    cipReturnSize: selectedDN.dn,
    cipInletSize: selectedDN.dn,
    checkValveSize: selectedDN.dn,
    leakageChamberMm: LEAKAGE_CHAMBER_MM,
  };
}
