-- CreateTable
CREATE TABLE "SavedPrecalculation" (
    "id" TEXT NOT NULL,
    "precalcNo" TEXT NOT NULL,
    "projectNo" TEXT NOT NULL DEFAULT '',
    "customer" TEXT NOT NULL DEFAULT '',
    "endUser" TEXT NOT NULL DEFAULT '',
    "preparedBy" TEXT NOT NULL DEFAULT '',
    "sourceFile" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "entries" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPrecalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedPrecalculation_precalcNo_key" ON "SavedPrecalculation"("precalcNo");

-- CreateIndex
CREATE INDEX "SavedPrecalculation_createdAt_idx" ON "SavedPrecalculation"("createdAt");

-- AddForeignKey
ALTER TABLE "SavedPrecalculation" ADD CONSTRAINT "SavedPrecalculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
