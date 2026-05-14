-- Tank: Manifoldda CIP Dönüş Pompası var mı? (true ise tank için ayrı pompa girilmez)

ALTER TABLE "Tank"
  ADD COLUMN "manifoldHasCipReturnPump" BOOLEAN NOT NULL DEFAULT false;
