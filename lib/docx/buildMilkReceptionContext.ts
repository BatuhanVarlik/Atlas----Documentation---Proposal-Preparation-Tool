// Süt Alım modülü için Word şablon context'i.

import { calculatePipeDiameter } from '@/lib/calc/pipeDiameter';
import { selectDN } from '@/lib/calc/selectDN';

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

export function buildMilkReceptionContext(module: ModuleForDoc) {
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

  return {
    module: {
      name: module.name,
      customerName: module.customerName ?? '',
      projectCode: module.projectCode ?? '',
      standard: module.standard,
      controlUnit: CONTROL_UNIT_LABEL[module.valveControlUnit] ?? module.valveControlUnit,
      createdDate: new Date(module.createdAt).toLocaleDateString('tr-TR'),
      fixedSmallSize,
      waterInletSize: largestSize,
    },
    creator: { name: module.creator.name },
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
  };
}
