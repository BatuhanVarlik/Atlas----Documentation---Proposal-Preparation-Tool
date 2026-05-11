-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DEPARTMENT_MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Standard" AS ENUM ('DIN', 'SMS');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('HYGIENIC', 'ULTRA_HYGIENIC');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'DOCUMENT_GENERATED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ValveType" AS ENUM ('SDE44', 'DE44', 'D44SL', 'DA44');

-- CreateEnum
CREATE TYPE "ControlUnitType" AS ENUM ('NONE', 'AS_I', 'DC');

-- CreateEnum
CREATE TYPE "WaterInletType" AS ENUM ('SW_CIP42', 'SD42');

-- CreateEnum
CREATE TYPE "SamplingValveType" AS ENUM ('MANUAL', 'WITH_ACTUATOR');

-- CreateEnum
CREATE TYPE "AgitatorPosition" AS ENUM ('SIDE', 'TOP');

-- CreateEnum
CREATE TYPE "CipBallType" AS ENUM ('STATIC', 'ROTARY');

-- CreateEnum
CREATE TYPE "TankOutletValveType" AS ENUM ('MANUAL', 'WITH_ACTUATOR');

-- CreateEnum
CREATE TYPE "TankOutletValveSubType" AS ENUM ('BUTTERFLY', 'SINGLE_SEAT');

-- CreateEnum
CREATE TYPE "AIReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'PARTIAL');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "departmentId" TEXT NOT NULL,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "standard" "Standard" NOT NULL,
    "productType" "ProductType" NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "selectedDN" TEXT,
    "selectedInnerDiameter" DOUBLE PRECISION,
    "selectedOuterDiameter" DOUBLE PRECISION,
    "creatorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValveCluster" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,

    CONSTRAINT "ValveCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FillingLine" (
    "id" TEXT NOT NULL,
    "valveClusterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "calculatedDiameter" DOUBLE PRECISION,
    "valveType" "ValveType" NOT NULL,
    "valveControlUnit" "ControlUnitType" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FillingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DischargeLine" (
    "id" TEXT NOT NULL,
    "valveClusterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "pressure" DOUBLE PRECISION NOT NULL,
    "calculatedDiameter" DOUBLE PRECISION,
    "valveType" "ValveType" NOT NULL,
    "valveControlUnit" "ControlUnitType" NOT NULL DEFAULT 'NONE',
    "pumpModel" TEXT,
    "pumpKw" DOUBLE PRECISION,
    "pumpImpellerSize" DOUBLE PRECISION,
    "hasPressureTransmitter" BOOLEAN NOT NULL DEFAULT false,
    "hasFlowMeter" BOOLEAN NOT NULL DEFAULT false,
    "flowMeterDiameter" DOUBLE PRECISION,
    "waterInletType" "WaterInletType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tank" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "hasLSH" BOOLEAN NOT NULL DEFAULT false,
    "hasLSM" BOOLEAN NOT NULL DEFAULT false,
    "hasLSL" BOOLEAN NOT NULL DEFAULT false,
    "hasTT" BOOLEAN NOT NULL DEFAULT false,
    "hasPT" BOOLEAN NOT NULL DEFAULT false,
    "samplingValve" "SamplingValveType" NOT NULL,
    "hasProximitySwitch" BOOLEAN NOT NULL DEFAULT false,
    "hasAgitator" BOOLEAN NOT NULL DEFAULT false,
    "agitatorMotorKw" DOUBLE PRECISION,
    "agitatorRpm" INTEGER,
    "agitatorPosition" "AgitatorPosition",
    "cipBall" "CipBallType" NOT NULL,
    "hasCipInletForAgitator" BOOLEAN NOT NULL DEFAULT false,
    "hasCipInletForManhole" BOOLEAN NOT NULL DEFAULT false,
    "hasTankOutletValve" BOOLEAN NOT NULL DEFAULT false,
    "tankOutletValveType" "TankOutletValveType",
    "tankOutletValveSubType" "TankOutletValveSubType",
    "cipReturnPumpModel" TEXT,
    "cipReturnPumpKw" DOUBLE PRECISION,
    "cipReturnPumpImpellerSize" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIReview" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "status" "AIReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "placeholders" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleActivity" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ValveCluster_moduleId_key" ON "ValveCluster"("moduleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValveCluster" ADD CONSTRAINT "ValveCluster_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillingLine" ADD CONSTRAINT "FillingLine_valveClusterId_fkey" FOREIGN KEY ("valveClusterId") REFERENCES "ValveCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeLine" ADD CONSTRAINT "DischargeLine_valveClusterId_fkey" FOREIGN KEY ("valveClusterId") REFERENCES "ValveCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tank" ADD CONSTRAINT "Tank_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReview" ADD CONSTRAINT "AIReview_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleActivity" ADD CONSTRAINT "ModuleActivity_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
