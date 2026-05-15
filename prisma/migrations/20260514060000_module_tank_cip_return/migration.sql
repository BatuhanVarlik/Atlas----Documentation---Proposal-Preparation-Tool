-- Modül seviyesinde Tank CIP Dönüş Hattı bilgileri.
-- Her tank için ayrı sorulan CIP Return Pump artık modül başlığında bir kez tanımlanır.

ALTER TABLE "Module"
  ADD COLUMN "tankCipReturnManifoldExists" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tankCipReturnLineCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "tankCipReturnPumpModel" TEXT,
  ADD COLUMN "tankCipReturnPumpKw" DOUBLE PRECISION,
  ADD COLUMN "tankCipReturnPumpImpellerSize" DOUBLE PRECISION;
