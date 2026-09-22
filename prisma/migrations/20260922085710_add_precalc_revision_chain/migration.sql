-- AlterTable
ALTER TABLE "SavedPrecalculation" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "revisionChanges" JSONB,
ADD COLUMN     "revisionCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "revisionNote" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "SavedPrecalculation_parentId_idx" ON "SavedPrecalculation"("parentId");

-- AddForeignKey
ALTER TABLE "SavedPrecalculation" ADD CONSTRAINT "SavedPrecalculation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SavedPrecalculation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
