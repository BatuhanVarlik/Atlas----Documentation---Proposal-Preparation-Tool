-- AlterTable
ALTER TABLE "User" ADD COLUMN "canEditPrecalcCatalog" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PrecalcCatalogOverride" (
    "id" TEXT NOT NULL,
    "catalogKey" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecalcCatalogOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrecalcCatalogOverride_catalogKey_field_key" ON "PrecalcCatalogOverride"("catalogKey", "field");

-- AddForeignKey
ALTER TABLE "PrecalcCatalogOverride" ADD CONSTRAINT "PrecalcCatalogOverride_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
