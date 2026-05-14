-- Tank outlet valve subtype'a yeni değerler eklendi (aktüatörlü vana çeşitleri)

ALTER TYPE "TankOutletValveSubType" ADD VALUE IF NOT EXISTS 'SINGLE_SEAT_TANK';
ALTER TYPE "TankOutletValveSubType" ADD VALUE IF NOT EXISTS 'SW_CIP_TANK';
ALTER TYPE "TankOutletValveSubType" ADD VALUE IF NOT EXISTS 'SD_TANK';
ALTER TYPE "TankOutletValveSubType" ADD VALUE IF NOT EXISTS 'D_TANK';
