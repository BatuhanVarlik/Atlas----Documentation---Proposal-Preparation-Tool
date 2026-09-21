import type * as XLSX from 'xlsx-js-style';
import type { PrecalcEngine } from '../engine';
import { buildSheetSnapshot } from './snapshot';

/** Kaynak kitaptaki maliyet kırılımı sayfasının adı. */
export const DETAILED_SHEET = 'AYRINTILI FIYATLANDIRMA';

/**
 * AYRINTILI FIYATLANDIRMA sayfasını hesaplanmış hâliyle üretir.
 *
 * Şimdilik yalnızca `buildSheetSnapshot`'ı sarmalar (parite kuralı Task 7'de
 * eklenecek).
 */
export function buildDetailedSheet(engine: PrecalcEngine): XLSX.WorkSheet | null {
  return buildSheetSnapshot(engine, DETAILED_SHEET);
}
