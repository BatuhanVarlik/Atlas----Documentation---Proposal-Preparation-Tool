-- Module revisions: store last N snapshots of a module
CREATE TABLE "ModuleRevision" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedChanges" JSONB,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleRevision_moduleId_revisionNumber_key"
    ON "ModuleRevision"("moduleId", "revisionNumber");

CREATE INDEX "ModuleRevision_moduleId_createdAt_idx"
    ON "ModuleRevision"("moduleId", "createdAt");

ALTER TABLE "ModuleRevision"
    ADD CONSTRAINT "ModuleRevision_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModuleRevision"
    ADD CONSTRAINT "ModuleRevision_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
