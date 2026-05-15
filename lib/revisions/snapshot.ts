// Modülün tam state'ini snapshot olarak alır ve eski snapshot ile farkı bulur.

import { prisma } from '@/lib/prisma';

export interface ModuleSnapshot {
  module: {
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
    tankCipReturnPumpKw: number | null;
    tankCipReturnPumpImpellerSize: number | null;
  };
  fillingLines: Array<{
    name: string;
    order: number;
    capacity: number;
    valveType: string;
    valveControlUnit: string;
    connectedTankCount: number;
  }>;
  dischargeLines: Array<{
    name: string;
    order: number;
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
    flowMeterDiameter: number | null;
    waterInletType: string | null;
  }>;
  tanks: Array<{
    name: string;
    order: number;
    volume: number;
    hasLSH: boolean; hasLSM: boolean; hasLSL: boolean;
    hasTT: boolean; hasPT: boolean;
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
  }>;
}

export async function captureModuleSnapshot(moduleId: string): Promise<ModuleSnapshot> {
  const m = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      valveCluster: {
        include: {
          fillingLines: { orderBy: { order: 'asc' } },
          dischargeLines: { orderBy: { order: 'asc' } },
        },
      },
      tanks: { orderBy: { order: 'asc' } },
    },
  });
  if (!m) throw new Error('Module not found');

  return {
    module: {
      name: m.name,
      customerName: m.customerName,
      projectCode: m.projectCode,
      standard: m.standard,
      productType: m.productType,
      valveType: m.valveType,
      valveControlUnit: m.valveControlUnit,
      cipReturnValveType: m.cipReturnValveType,
      waterInletValveType: m.waterInletValveType,
      tankCipInletValveType: m.tankCipInletValveType,
      tankCipInletDiameter: m.tankCipInletDiameter,
      tankCipReturnManifoldExists: m.tankCipReturnManifoldExists,
      tankCipReturnLineCount: m.tankCipReturnLineCount,
      tankCipReturnPumpModel: m.tankCipReturnPumpModel,
      tankCipReturnPumpKw: m.tankCipReturnPumpKw,
      tankCipReturnPumpImpellerSize: m.tankCipReturnPumpImpellerSize,
    },
    fillingLines: (m.valveCluster?.fillingLines ?? []).map((l) => ({
      name: l.name, order: l.order, capacity: l.capacity,
      valveType: l.valveType, valveControlUnit: l.valveControlUnit,
      connectedTankCount: l.connectedTankCount,
    })),
    dischargeLines: (m.valveCluster?.dischargeLines ?? []).map((l) => ({
      name: l.name, order: l.order, capacity: l.capacity, pressure: l.pressure,
      valveType: l.valveType, valveControlUnit: l.valveControlUnit,
      connectedTankCount: l.connectedTankCount,
      pumpModel: l.pumpModel, pumpKw: l.pumpKw, pumpImpellerSize: l.pumpImpellerSize,
      hasPressureTransmitter: l.hasPressureTransmitter,
      hasFlowMeter: l.hasFlowMeter,
      flowMeterDiameter: l.flowMeterDiameter,
      waterInletType: l.waterInletType,
    })),
    tanks: m.tanks.map((t) => ({
      name: t.name, order: t.order, volume: t.volume,
      hasLSH: t.hasLSH, hasLSM: t.hasLSM, hasLSL: t.hasLSL,
      hasTT: t.hasTT, hasPT: t.hasPT,
      samplingValve: t.samplingValve,
      hasProximitySwitch: t.hasProximitySwitch,
      hasAgitator: t.hasAgitator,
      agitatorMotorKw: t.agitatorMotorKw,
      agitatorRpm: t.agitatorRpm,
      agitatorPosition: t.agitatorPosition,
      cipBall: t.cipBall,
      hasCipInletForAgitator: t.hasCipInletForAgitator,
      hasCipInletForManhole: t.hasCipInletForManhole,
      hasTankOutletValve: t.hasTankOutletValve,
      tankOutletValveType: t.tankOutletValveType,
      tankOutletValveSubType: t.tankOutletValveSubType,
    })),
  };
}

export interface DetectedChange {
  field: string;
  before: string;
  after: string;
}

const MODULE_FIELD_LABELS: Record<string, string> = {
  name: 'Modül Adı',
  customerName: 'Müşteri',
  projectCode: 'Proje Kodu',
  standard: 'Standart',
  productType: 'Ürün Tipi',
  valveType: 'Vana Tipi',
  valveControlUnit: 'Kontrol Ünitesi',
  cipReturnValveType: 'CIP Dönüş Vana Tipi',
  waterInletValveType: 'Su Giriş Vana Tipi',
  tankCipInletValveType: 'Tank CIP Inlet Vana Tipi',
  tankCipInletDiameter: 'Tank CIP Inlet Çap',
  tankCipReturnManifoldExists: 'Tank CIP Dönüş Manifold',
  tankCipReturnLineCount: 'Tank CIP Dönüş Hat Sayısı',
  tankCipReturnPumpModel: 'Tank CIP Dönüş Pompası',
  tankCipReturnPumpKw: 'Tank CIP Pompa kW',
  tankCipReturnPumpImpellerSize: 'Tank CIP Pompa Çark',
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Var' : 'Yok';
  return String(v);
}

export function detectChanges(
  prev: ModuleSnapshot | null,
  current: ModuleSnapshot,
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  if (!prev) {
    return [{ field: 'İlk revizyon', before: '—', after: 'Modül oluşturuldu' }];
  }

  // Modül alanları
  for (const key of Object.keys(MODULE_FIELD_LABELS) as Array<keyof ModuleSnapshot['module']>) {
    const a = prev.module[key];
    const b = current.module[key];
    if (a !== b) {
      changes.push({
        field: MODULE_FIELD_LABELS[key as string],
        before: fmt(a),
        after: fmt(b),
      });
    }
  }

  // Dolum hatları
  if (prev.fillingLines.length !== current.fillingLines.length) {
    changes.push({
      field: 'Dolum Hattı Sayısı',
      before: String(prev.fillingLines.length),
      after: String(current.fillingLines.length),
    });
  } else {
    current.fillingLines.forEach((cur, i) => {
      const old = prev.fillingLines[i];
      if (!old) return;
      if (old.name !== cur.name) changes.push({ field: `Dolum #${i + 1} Adı`, before: fmt(old.name), after: fmt(cur.name) });
      if (old.capacity !== cur.capacity) changes.push({ field: `Dolum #${i + 1} Kapasite`, before: `${old.capacity} L/h`, after: `${cur.capacity} L/h` });
      if (old.connectedTankCount !== cur.connectedTankCount) changes.push({ field: `Dolum #${i + 1} Bağlı Tank`, before: fmt(old.connectedTankCount), after: fmt(cur.connectedTankCount) });
    });
  }

  // Boşaltım hatları
  if (prev.dischargeLines.length !== current.dischargeLines.length) {
    changes.push({
      field: 'Boşaltım Hattı Sayısı',
      before: String(prev.dischargeLines.length),
      after: String(current.dischargeLines.length),
    });
  } else {
    current.dischargeLines.forEach((cur, i) => {
      const old = prev.dischargeLines[i];
      if (!old) return;
      if (old.name !== cur.name) changes.push({ field: `Boşaltım #${i + 1} Adı`, before: fmt(old.name), after: fmt(cur.name) });
      if (old.capacity !== cur.capacity) changes.push({ field: `Boşaltım #${i + 1} Kapasite`, before: `${old.capacity} L/h`, after: `${cur.capacity} L/h` });
      if (old.pressure !== cur.pressure) changes.push({ field: `Boşaltım #${i + 1} Basınç`, before: `${old.pressure} Bar`, after: `${cur.pressure} Bar` });
      if (old.pumpModel !== cur.pumpModel) changes.push({ field: `Boşaltım #${i + 1} Pompa`, before: fmt(old.pumpModel), after: fmt(cur.pumpModel) });
      if (old.hasFlowMeter !== cur.hasFlowMeter) changes.push({ field: `Boşaltım #${i + 1} Flow Meter`, before: fmt(old.hasFlowMeter), after: fmt(cur.hasFlowMeter) });
      if (old.connectedTankCount !== cur.connectedTankCount) changes.push({ field: `Boşaltım #${i + 1} Bağlı Tank`, before: fmt(old.connectedTankCount), after: fmt(cur.connectedTankCount) });
    });
  }

  // Tanklar
  if (prev.tanks.length !== current.tanks.length) {
    changes.push({
      field: 'Tank Sayısı',
      before: String(prev.tanks.length),
      after: String(current.tanks.length),
    });
  } else {
    current.tanks.forEach((cur, i) => {
      const old = prev.tanks[i];
      if (!old) return;
      if (old.name !== cur.name) changes.push({ field: `Tank #${i + 1} Adı`, before: fmt(old.name), after: fmt(cur.name) });
      if (old.volume !== cur.volume) changes.push({ field: `Tank #${i + 1} Hacim`, before: `${old.volume} L`, after: `${cur.volume} L` });
      if (old.hasAgitator !== cur.hasAgitator) changes.push({ field: `Tank #${i + 1} Agitator`, before: fmt(old.hasAgitator), after: fmt(cur.hasAgitator) });
      if (old.cipBall !== cur.cipBall) changes.push({ field: `Tank #${i + 1} CIP Ball`, before: fmt(old.cipBall), after: fmt(cur.cipBall) });
    });
  }

  return changes;
}
