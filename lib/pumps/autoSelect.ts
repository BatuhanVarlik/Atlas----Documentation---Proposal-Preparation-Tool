// Hatlarda kapasite (L/h) + basınç (bar) ile otomatik pompa seçimi.
// Pompa seçimi sayfasıyla AYNI sonucu döndürür: /api/pump-selection'daki "best"
// (yeşil/ilk aday) pompa ve hedef basıncı karşılayan impeller.
// Client tarafında çağrılır; pumpData.json sunucuda kalır (bundle'a girmez).

import { selectMotorKw } from '@/lib/calc/motorKw';

export interface AutoPumpResult {
  pumpModel: string;
  pumpKw: number | null;            // MOTOR kW — power consumption'ın bir üstündeki standart değer
  pumpImpellerSize: number | null;
  powerConsumptionKw: number | null; // hesaplanan çekilen güç (bilgi amaçlı)
}

export async function autoSelectPump(
  capacityLh: number,
  pressureBar: number,
): Promise<AutoPumpResult | null> {
  if (!(capacityLh > 0) || !(pressureBar > 0)) return null;
  const q = capacityLh / 1000; // L/h → m³/h
  const res = await fetch('/api/pump-selection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, bar: pressureBar }),
  });
  const json = await res.json();
  if (!json.success || !json.data?.best) return null;

  const best = json.data.best as {
    name: string;
    kw: number | null;
    safeD: number | null;
    recommendedD: number | null;
  };
  const power = best.kw != null ? Math.round(best.kw * 100) / 100 : null;
  return {
    pumpModel: best.name,
    // Modüllerde gösterilen kW = motor kW (power consumption'ın bir üstü standart değer).
    pumpKw: selectMotorKw(best.kw),
    // Hedef basıncı karşılayan impeller (yoksa en yakın).
    pumpImpellerSize: best.safeD ?? best.recommendedD ?? null,
    powerConsumptionKw: power,
  };
}
