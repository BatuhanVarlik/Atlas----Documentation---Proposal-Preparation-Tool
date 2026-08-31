-- AlterTable
ALTER TABLE "SavedPrecalculation" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SavedPrecalculation" ADD COLUMN "updatedById" TEXT;

-- AddForeignKey
ALTER TABLE "SavedPrecalculation" ADD CONSTRAINT "SavedPrecalculation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
