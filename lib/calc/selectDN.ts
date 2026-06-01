import type { PipeSize } from './standardTables';
import { DIN_TABLE, SMS_TABLE } from './standardTables';

export function selectDN(
  minDiameterMm: number,
  standard: 'DIN' | 'SMS'
): PipeSize {
  const table = standard === 'DIN' ? DIN_TABLE : SMS_TABLE;
  const selected = table.find((row) => row.inner >= minDiameterMm);
  if (!selected) {
    throw new Error(
      `${minDiameterMm.toFixed(2)} mm için ${standard} tablosunda uygun çap yok. ` +
        `Maksimum: ${table[table.length - 1].inner} mm (${table[table.length - 1].dn})`
    );
  }
  return selected;
}

/**
 * Verilen DN'den standart tablosunda bir basamak küçük olan DN'i döndürür.
 * En küçük değerdeyse (veya tabloda bulunamazsa) en küçük DN'i döndürür.
 */
export function getOneSizeSmallerDN(currentDN: string, standard: 'DIN' | 'SMS'): string {
  const table = standard === 'DIN' ? DIN_TABLE : SMS_TABLE;
  const idx = table.findIndex((r) => r.dn === currentDN);
  if (idx <= 0) return table[0].dn;
  return table[idx - 1].dn;
}

export function getDrainValveSize(currentDN: string, standard: 'DIN' | 'SMS'): string {
  return getOneSizeSmallerDN(currentDN, standard);
}

export function getTankDrainValveSize(standard: 'DIN' | 'SMS'): string {
  return standard === 'SMS' ? '1"' : 'DN25';
}
