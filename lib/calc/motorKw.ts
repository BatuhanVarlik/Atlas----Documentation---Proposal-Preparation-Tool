// Standart motor güçleri (kW) — IEC normalize değerleri.
// Pompa seçiminde, hesaplanan Power Consumption (çekilen güç) değerinin
// BİR ÜSTÜNDEKİ standart motor kW seçilir (kullanıcı isteği).
//
// Bu listeyi sonradan serbestçe düzenleyebilirsiniz; seçim mantığı listeyi
// küçükten büyüğe tarayıp ilk "yeterli" değeri döndürür.
export const STANDARD_MOTOR_KW: readonly number[] = [
  0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75,
];

/**
 * Hesaplanan power consumption (kW) için bir üst standart motor kW'ı döndürür.
 * Örn. 3.8 → 4 ; 4.2 → 5.5 ; 12 → 15.
 * Liste aşılırsa en büyük standart değer döner; geçersiz girişte null.
 */
export function selectMotorKw(powerConsumptionKw: number | null | undefined): number | null {
  if (powerConsumptionKw == null || Number.isNaN(powerConsumptionKw) || powerConsumptionKw <= 0) {
    return null;
  }
  const found = STANDARD_MOTOR_KW.find((kw) => kw >= powerConsumptionKw);
  return found ?? STANDARD_MOTOR_KW[STANDARD_MOTOR_KW.length - 1];
}
