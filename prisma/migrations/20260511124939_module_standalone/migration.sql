/*
  Warnings:

  - You are about to drop the column `projectId` on the `Module` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Module" DROP CONSTRAINT "Module_projectId_fkey";

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "projectId",
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "projectCode" TEXT;
