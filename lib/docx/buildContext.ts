import { calculateModule } from '@/lib/calc/moduleCalculator';

interface FillingLine {
  id: string;
  name: string;
  capacity: number;
  valveType: string;
  valveControlUnit: string;
}

interface DischargeLine {
  id: string;
  name: string;
  capacity: number;
  pressure: number;
  valveType: string;
  valveControlUnit: string;
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
  status: string;
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

export function buildTemplateContext(module: ModuleForDoc) {
  const fl = module.valveCluster?.fillingLines ?? [];
  const dl = module.valveCluster?.dischargeLines ?? [];
  const hasLines = fl.length > 0 || dl.length > 0;

  const calc = hasLines
    ? calculateModule({
        standard: module.standard as 'DIN' | 'SMS',
        fillingLines: fl.map((l) => ({ id: l.id, capacity: l.capacity })),
        dischargeLines: dl.map((l) => ({ id: l.id, capacity: l.capacity, hasFlowMeter: l.hasFlowMeter })),
      })
    : null;

  return {
    module: {
      name: module.name,
      customerName: module.customerName ?? '',
      projectCode: module.projectCode ?? '',
      standard: module.standard,
      productTypeLabel: PRODUCT_LABEL[module.productType] ?? module.productType,
      createdDate: new Date(module.createdAt).toLocaleDateString('tr-TR'),
    },
    creator: { name: module.creator.name },
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
        waterInletType: line.waterInletType ? (WATER_INLET_LABEL[line.waterInletType] ?? line.waterInletType) : '',
        selectedDN: calc?.selectedDN.dn ?? '—',
        drainValveSize: calc?.drainValveSize ?? '—',
      };
    }),
    tanks: module.tanks.map((tank, i) => {
      const sensorFlags: Array<[boolean, string]> = [
        [tank.hasLSH, 'LSH'], [tank.hasLSM, 'LSM'], [tank.hasLSL, 'LSL'],
        [tank.hasTT, 'TT'], [tank.hasPT, 'PT'],
      ];
      const sensors = sensorFlags.filter(([v]) => v).map(([, label]) => label).join(', ') || 'Yok';

      let outletValveLabel = 'Yok';
      if (tank.hasTankOutletValve) {
        if (tank.tankOutletValveType === 'WITH_ACTUATOR') {
          const sub = tank.tankOutletValveSubType === 'BUTTERFLY' ? 'Kelebek' : 'Tek Koltuklu';
          outletValveLabel = `Aktüatörlü — ${sub}`;
        } else {
          outletValveLabel = 'Manuel';
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
  };
}
