-- Module seviyesinde CIP Dönüş Vanası tipi (her hatta uygulanır)

CREATE TYPE "CipReturnValveType" AS ENUM ('SW_CIP41', 'SD41');

ALTER TABLE "Module"
  ADD COLUMN "cipReturnValveType" "CipReturnValveType";
