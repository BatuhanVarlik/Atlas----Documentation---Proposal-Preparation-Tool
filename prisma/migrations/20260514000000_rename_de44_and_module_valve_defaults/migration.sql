-- Rename ValveType enum value DE44 -> D44 and add Module-level valve defaults

ALTER TYPE "ValveType" RENAME VALUE 'DE44' TO 'D44';

ALTER TABLE "Module"
  ADD COLUMN "valveType" "ValveType",
  ADD COLUMN "valveControlUnit" "ControlUnitType";
