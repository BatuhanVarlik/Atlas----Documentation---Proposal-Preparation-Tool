-- Module seviyesinde Tank CIP Inlet Vanası (Var/Yok, tip, çap)

CREATE TYPE "TankCipInletValveType" AS ENUM ('SW43', 'SW44');

ALTER TABLE "Module"
  ADD COLUMN "tankCipInletValveType" "TankCipInletValveType",
  ADD COLUMN "tankCipInletDiameter"  TEXT;
