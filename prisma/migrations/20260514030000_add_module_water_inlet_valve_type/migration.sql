-- Module seviyesinde Su Giriş Vanası Tipi (her boşaltım hattına sabit eklenir)

ALTER TABLE "Module"
  ADD COLUMN "waterInletValveType" "WaterInletType";
