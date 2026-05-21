// Süt Alım modülünün tam state'ini snapshot olarak alır ve eski snapshot ile farkı bulur.

import { prisma } from '@/lib/prisma';

export interface MilkReceptionSnapshot {
  module: {
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
  };
  receptionLines: Array<{
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
  }>;
}

export async function captureMilkReceptionSnapshot(moduleId: string): Promise<MilkReceptionSnapshot> {
  const m = await prisma.milkReceptionModule.findUnique({
    where: { id: moduleId },
    include: { receptionLines: { orderBy: { order: 'asc' } } },
  });
  if (!m) throw new Error('Modül bulunamadı');

  return {
    module: {
      name: m.name,
      customerName: m.customerName,
      projectCode: m.projectCode,
      standard: m.standard,
      valveControlUnit: m.valveControlUnit,
      hasTankerCip: m.hasTankerCip,
      tankerCipCapacity: m.tankerCipCapacity,
      tankerCipPressure: m.tankerCipPressure,
      tankerCipPumpModel: m.tankerCipPumpModel,
      tankerCipPumpKw: m.tankerCipPumpKw,
      tankerCipPumpImpellerSize: m.tankerCipPumpImpellerSize,
    },
    receptionLines: m.receptionLines.map((l) => ({
      name: l.name,
      order: l.order,
      capacity: l.capacity,
      pressure: l.pressure,
      pumpModel: l.pumpModel,
      pumpKw: l.pumpKw,
      pumpImpellerSize: l.pumpImpellerSize,
      filterUnitCount: l.filterUnitCount,
      pressureMeterType: l.pressureMeterType,
      hasMilkClarifier: l.hasMilkClarifier,
      clarifierBypassValveType: l.clarifierBypassValveType,
      hasPhe: l.hasPhe,
      pheCapacity: l.pheCapacity,
      pheIceWaterTempSensorType: l.pheIceWaterTempSensorType,
      pheIceWaterPressureMeterType: l.pheIceWaterPressureMeterType,
      hasSamplingValve: l.hasSamplingValve,
      samplingValveType: l.samplingValveType,
    })),
  };
}

export interface MRDetectedChange {
  field: string;
  before: string;
  after: string;
}

const MODULE_FIELD_LABELS: Record<string, string> = {
  name: 'Modül Adı',
  customerName: 'Müşteri',
  projectCode: 'Proje Kodu',
  standard: 'Standart',
  valveControlUnit: 'Vana Kontrol Ünitesi',
  hasTankerCip: 'Tanker CIP',
  tankerCipCapacity: 'Tanker CIP Kapasite',
  tankerCipPressure: 'Tanker CIP Basınç',
  tankerCipPumpModel: 'Tanker CIP Pompa Model',
  tankerCipPumpKw: 'Tanker CIP Pompa kW',
  tankerCipPumpImpellerSize: 'Tanker CIP Pompa Çark',
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Var' : 'Yok';
  return String(v);
}

export function detectMilkReceptionChanges(
  prev: MilkReceptionSnapshot | null,
  current: MilkReceptionSnapshot,
): MRDetectedChange[] {
  const changes: MRDetectedChange[] = [];
  if (!prev) {
    return [{ field: 'İlk revizyon', before: '—', after: 'Modül oluşturuldu' }];
  }

  for (const key of Object.keys(MODULE_FIELD_LABELS) as Array<keyof MilkReceptionSnapshot['module']>) {
    const a = prev.module[key];
    const b = current.module[key];
    if (a !== b) {
      changes.push({ field: MODULE_FIELD_LABELS[key as string], before: fmt(a), after: fmt(b) });
    }
  }

  if (prev.receptionLines.length !== current.receptionLines.length) {
    changes.push({
      field: 'Süt Alım Hat Sayısı',
      before: String(prev.receptionLines.length),
      after: String(current.receptionLines.length),
    });
  } else {
    current.receptionLines.forEach((cur, i) => {
      const old = prev.receptionLines[i];
      if (!old) return;
      if (old.name !== cur.name) changes.push({ field: `Hat #${i + 1} Adı`, before: fmt(old.name), after: fmt(cur.name) });
      if (old.capacity !== cur.capacity) changes.push({ field: `Hat #${i + 1} Kapasite`, before: `${old.capacity} L/h`, after: `${cur.capacity} L/h` });
      if (old.pressure !== cur.pressure) changes.push({ field: `Hat #${i + 1} Basınç`, before: `${old.pressure} Bar`, after: `${cur.pressure} Bar` });
      if (old.pumpModel !== cur.pumpModel) changes.push({ field: `Hat #${i + 1} Pompa`, before: fmt(old.pumpModel), after: fmt(cur.pumpModel) });
      if (old.filterUnitCount !== cur.filterUnitCount) changes.push({ field: `Hat #${i + 1} Filter Unit`, before: fmt(old.filterUnitCount), after: fmt(cur.filterUnitCount) });
      if (old.hasMilkClarifier !== cur.hasMilkClarifier) changes.push({ field: `Hat #${i + 1} Clarifier`, before: fmt(old.hasMilkClarifier), after: fmt(cur.hasMilkClarifier) });
      if (old.hasPhe !== cur.hasPhe) changes.push({ field: `Hat #${i + 1} PHE`, before: fmt(old.hasPhe), after: fmt(cur.hasPhe) });
      if (old.hasSamplingValve !== cur.hasSamplingValve) changes.push({ field: `Hat #${i + 1} Sampling`, before: fmt(old.hasSamplingValve), after: fmt(cur.hasSamplingValve) });
    });
  }

  return changes;
}
