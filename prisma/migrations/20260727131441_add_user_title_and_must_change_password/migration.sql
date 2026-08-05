-- CreateEnum
CREATE TYPE "PasswordResetRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PressureMeterType" AS ENUM ('MANOMETER', 'PRESSURE_TRANSMITTER');

-- CreateEnum
CREATE TYPE "ClarifierBypassValveType" AS ENUM ('SW44', 'SW41');

-- CreateEnum
CREATE TYPE "PheTempSensorType" AS ENUM ('PT100', 'THERMOMETER');

-- CreateEnum
CREATE TYPE "CipSystemType" AS ENUM ('FORWARD', 'CIRCULATED');

-- CreateEnum
CREATE TYPE "CipTankType" AS ENUM ('CAUSTIC', 'ACID', 'HOT_WATER', 'RECOVERY', 'FRESH_WATER');

-- CreateEnum
CREATE TYPE "TankMaterial" AS ENUM ('AISI_304', 'AISI_316');

-- CreateEnum
CREATE TYPE "TankInsulation" AS ENUM ('INSULATED', 'UNINSULATED');

-- CreateEnum
CREATE TYPE "CipSamplingValve" AS ENUM ('NONE', 'MANUAL', 'WITH_ACTUATOR');

-- CreateEnum
CREATE TYPE "CipLineKind" AS ENUM ('DISCHARGE', 'RETURN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'CEO';
ALTER TYPE "Role" ADD VALUE 'FINANCE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'QUALITY_OBSERVER';

-- AlterTable
ALTER TABLE "DischargeLine" ADD COLUMN     "connectedTankCount" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "valveControlUnit" SET DEFAULT 'AS_I';

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "moduleType" TEXT NOT NULL DEFAULT 'STORAGE';

-- AlterTable
ALTER TABLE "FillingLine" ADD COLUMN     "connectedTankCount" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "valveControlUnit" SET DEFAULT 'AS_I';

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "customerContactPerson" TEXT,
ADD COLUMN     "deliveryPlace" TEXT DEFAULT 'Customer Factory',
ADD COLUMN     "deliveryWeeks" INTEGER,
ADD COLUMN     "offerValidityDays" INTEGER DEFAULT 30,
ADD COLUMN     "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "priceOverrides" JSONB,
ADD COLUMN     "quotationNo" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "CustomCatalogItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standard" TEXT NOT NULL DEFAULT '',
    "size" TEXT,
    "listPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedNewPassword" TEXT NOT NULL,
    "status" "PasswordResetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkReceptionModule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT,
    "projectCode" TEXT,
    "standard" "Standard" NOT NULL,
    "valveControlUnit" "ControlUnitType" NOT NULL DEFAULT 'AS_I',
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "selectedDN" TEXT,
    "selectedInnerDiameter" DOUBLE PRECISION,
    "selectedOuterDiameter" DOUBLE PRECISION,
    "hasTankerCip" BOOLEAN NOT NULL DEFAULT false,
    "tankerCipCapacity" DOUBLE PRECISION,
    "tankerCipPressure" DOUBLE PRECISION,
    "tankerCipPumpModel" TEXT,
    "tankerCipPumpKw" DOUBLE PRECISION,
    "tankerCipPumpImpellerSize" DOUBLE PRECISION,
    "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "priceOverrides" JSONB,
    "quotationNo" TEXT,
    "customerContactPerson" TEXT,
    "deliveryWeeks" INTEGER,
    "deliveryPlace" TEXT DEFAULT 'Customer Factory',
    "offerValidityDays" INTEGER DEFAULT 30,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "MilkReceptionModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkReceptionGeneratedDocument" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkReceptionGeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkReceptionLine" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "pressure" DOUBLE PRECISION NOT NULL,
    "calculatedDiameter" DOUBLE PRECISION,
    "pumpModel" TEXT,
    "pumpKw" DOUBLE PRECISION,
    "pumpImpellerSize" DOUBLE PRECISION,
    "filterUnitCount" INTEGER NOT NULL DEFAULT 1,
    "pressureMeterType" "PressureMeterType" NOT NULL DEFAULT 'MANOMETER',
    "hasMilkClarifier" BOOLEAN NOT NULL DEFAULT false,
    "clarifierBypassValveType" "ClarifierBypassValveType",
    "hasPhe" BOOLEAN NOT NULL DEFAULT false,
    "pheCapacity" DOUBLE PRECISION,
    "pheIceWaterTempSensorType" "PheTempSensorType",
    "pheIceWaterPressureMeterType" "PressureMeterType",
    "hasSamplingValve" BOOLEAN NOT NULL DEFAULT false,
    "samplingValveType" "SamplingValveType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkReceptionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkReceptionModuleRevision" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedChanges" JSONB,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkReceptionModuleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipModule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT,
    "projectCode" TEXT,
    "standard" "Standard" NOT NULL,
    "valveControlUnit" "ControlUnitType" NOT NULL DEFAULT 'NONE',
    "systemType" "CipSystemType" NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "samplingValve" "CipSamplingValve" NOT NULL DEFAULT 'NONE',
    "hasManholeSwitch" BOOLEAN NOT NULL DEFAULT false,
    "selectedDN" TEXT,
    "selectedInnerDiameter" DOUBLE PRECISION,
    "selectedOuterDiameter" DOUBLE PRECISION,
    "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "priceOverrides" JSONB,
    "quotationNo" TEXT,
    "customerContactPerson" TEXT,
    "deliveryWeeks" INTEGER,
    "deliveryPlace" TEXT DEFAULT 'Customer Factory',
    "offerValidityDays" INTEGER DEFAULT 30,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "CipModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipTank" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "tankType" "CipTankType" NOT NULL,
    "order" INTEGER NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "material" "TankMaterial" NOT NULL,
    "insulation" "TankInsulation" NOT NULL,
    "hasLSH" BOOLEAN NOT NULL DEFAULT false,
    "hasLSL" BOOLEAN NOT NULL DEFAULT false,
    "hasExternalSensor" BOOLEAN NOT NULL DEFAULT false,
    "hasPressureTransmitter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CipTank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipLine" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "lineKind" "CipLineKind" NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "pressure" DOUBLE PRECISION NOT NULL,
    "calculatedDiameter" DOUBLE PRECISION,
    "pumpModel" TEXT,
    "pumpKw" DOUBLE PRECISION,
    "pumpImpellerSize" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CipLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipGeneratedDocument" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CipGeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipModuleRevision" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedChanges" JSONB,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CipModuleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomCatalogItem_kind_idx" ON "CustomCatalogItem"("kind");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_status_requestedAt_idx" ON "PasswordResetRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "MilkReceptionModuleRevision_moduleId_createdAt_idx" ON "MilkReceptionModuleRevision"("moduleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MilkReceptionModuleRevision_moduleId_revisionNumber_key" ON "MilkReceptionModuleRevision"("moduleId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CipTank_moduleId_tankType_key" ON "CipTank"("moduleId", "tankType");

-- CreateIndex
CREATE INDEX "CipModuleRevision_moduleId_createdAt_idx" ON "CipModuleRevision"("moduleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CipModuleRevision_moduleId_revisionNumber_key" ON "CipModuleRevision"("moduleId", "revisionNumber");

-- AddForeignKey
ALTER TABLE "CustomCatalogItem" ADD CONSTRAINT "CustomCatalogItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkReceptionModule" ADD CONSTRAINT "MilkReceptionModule_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkReceptionGeneratedDocument" ADD CONSTRAINT "MilkReceptionGeneratedDocument_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "MilkReceptionModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkReceptionGeneratedDocument" ADD CONSTRAINT "MilkReceptionGeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkReceptionLine" ADD CONSTRAINT "MilkReceptionLine_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "MilkReceptionModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkReceptionModuleRevision" ADD CONSTRAINT "MilkReceptionModuleRevision_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "MilkReceptionModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkReceptionModuleRevision" ADD CONSTRAINT "MilkReceptionModuleRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipModule" ADD CONSTRAINT "CipModule_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipTank" ADD CONSTRAINT "CipTank_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CipModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipLine" ADD CONSTRAINT "CipLine_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CipModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipGeneratedDocument" ADD CONSTRAINT "CipGeneratedDocument_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CipModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipGeneratedDocument" ADD CONSTRAINT "CipGeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipModuleRevision" ADD CONSTRAINT "CipModuleRevision_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CipModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipModuleRevision" ADD CONSTRAINT "CipModuleRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
