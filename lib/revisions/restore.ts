// Bir snapshot'tan modülü geri yükler.

import { prisma } from '@/lib/prisma';
import type { ModuleSnapshot } from './snapshot';

type Standard = 'DIN' | 'SMS';
type ProductType = 'HYGIENIC' | 'ULTRA_HYGIENIC';
type ValveType = 'SDE44' | 'D44' | 'D44SL' | 'DA44';
type ControlUnit = 'NONE' | 'AS_I' | 'DC';
type CipReturnValveType = 'SW_CIP41' | 'SD41';
type WaterInletType = 'SW_CIP42' | 'SD42';
type TankCipInletValveType = 'SW43' | 'SW44';
type SamplingValveType = 'MANUAL' | 'WITH_ACTUATOR';
type AgitatorPosition = 'SIDE' | 'TOP';
type CipBallType = 'STATIC' | 'ROTARY';
type TankOutletValveType = 'MANUAL' | 'WITH_ACTUATOR';
type TankOutletValveSubType =
  | 'BUTTERFLY' | 'SINGLE_SEAT' | 'SINGLE_SEAT_TANK'
  | 'SW_CIP_TANK' | 'SD_TANK' | 'D_TANK';

export async function restoreModuleFromSnapshot(moduleId: string, snap: ModuleSnapshot): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1) Module alanları
    await tx.module.update({
      where: { id: moduleId },
      data: {
        name: snap.module.name,
        customerName: snap.module.customerName,
        projectCode: snap.module.projectCode,
        standard: snap.module.standard as Standard,
        productType: snap.module.productType as ProductType,
        valveType: snap.module.valveType as ValveType | null,
        valveControlUnit: snap.module.valveControlUnit as ControlUnit | null,
        cipReturnValveType: snap.module.cipReturnValveType as CipReturnValveType | null,
        waterInletValveType: snap.module.waterInletValveType as WaterInletType | null,
        tankCipInletValveType: snap.module.tankCipInletValveType as TankCipInletValveType | null,
        tankCipInletDiameter: snap.module.tankCipInletDiameter,
        tankCipReturnManifoldExists: snap.module.tankCipReturnManifoldExists,
        tankCipReturnLineCount: snap.module.tankCipReturnLineCount,
        tankCipReturnPumpModel: snap.module.tankCipReturnPumpModel,
        tankCipReturnPumpKw: snap.module.tankCipReturnPumpKw,
        tankCipReturnPumpImpellerSize: snap.module.tankCipReturnPumpImpellerSize,
      },
    });

    // 2) ValveCluster + Lines: önce mevcutları sil, sonra ekle
    const cluster = await tx.valveCluster.upsert({
      where: { moduleId },
      create: { moduleId },
      update: {},
    });
    await tx.fillingLine.deleteMany({ where: { valveClusterId: cluster.id } });
    await tx.dischargeLine.deleteMany({ where: { valveClusterId: cluster.id } });

    for (const l of snap.fillingLines) {
      await tx.fillingLine.create({
        data: {
          valveClusterId: cluster.id,
          name: l.name,
          order: l.order,
          capacity: l.capacity,
          valveType: l.valveType as ValveType,
          valveControlUnit: l.valveControlUnit as ControlUnit,
          connectedTankCount: l.connectedTankCount,
        },
      });
    }
    for (const l of snap.dischargeLines) {
      await tx.dischargeLine.create({
        data: {
          valveClusterId: cluster.id,
          name: l.name,
          order: l.order,
          capacity: l.capacity,
          pressure: l.pressure,
          valveType: l.valveType as ValveType,
          valveControlUnit: l.valveControlUnit as ControlUnit,
          connectedTankCount: l.connectedTankCount,
          pumpModel: l.pumpModel,
          pumpKw: l.pumpKw,
          pumpImpellerSize: l.pumpImpellerSize,
          hasPressureTransmitter: l.hasPressureTransmitter,
          hasFlowMeter: l.hasFlowMeter,
          flowMeterDiameter: l.flowMeterDiameter,
          waterInletType: l.waterInletType as WaterInletType | null,
        },
      });
    }

    // 3) Tanks: mevcutları sil, snapshot'tan yeniden oluştur
    await tx.tank.deleteMany({ where: { moduleId } });
    for (const t of snap.tanks) {
      await tx.tank.create({
        data: {
          moduleId,
          name: t.name,
          order: t.order,
          volume: t.volume,
          hasLSH: t.hasLSH, hasLSM: t.hasLSM, hasLSL: t.hasLSL,
          hasTT: t.hasTT, hasPT: t.hasPT,
          samplingValve: t.samplingValve as SamplingValveType,
          hasProximitySwitch: t.hasProximitySwitch,
          hasAgitator: t.hasAgitator,
          agitatorMotorKw: t.agitatorMotorKw,
          agitatorRpm: t.agitatorRpm,
          agitatorPosition: t.agitatorPosition as AgitatorPosition | null,
          cipBall: t.cipBall as CipBallType,
          hasCipInletForAgitator: t.hasCipInletForAgitator,
          hasCipInletForManhole: t.hasCipInletForManhole,
          hasTankOutletValve: t.hasTankOutletValve,
          tankOutletValveType: t.tankOutletValveType as TankOutletValveType | null,
          tankOutletValveSubType: t.tankOutletValveSubType as TankOutletValveSubType | null,
        },
      });
    }
  }, { timeout: 30000 });
}
