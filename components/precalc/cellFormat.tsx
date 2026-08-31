'use client';

import { excelSerialToDate } from '@/lib/precalc/engine';
import { isError, type CellValue } from '@/lib/precalc/formula';
import { formatNumberTR } from '@/lib/utils';
import { FACTOR_DECIMALS, type CellFormat } from './columns';

/**
 * Değeri en fazla `max` haneyle, gereksiz sondaki sıfırları atarak yazar.
 * 0,7 → "0,70" · 0,7025 → "0,7025" — çarpanlar hem sade hem tam görünsün.
 */
export function formatTrimmed(value: number, max: number, min = 2): string {
  const rounded = Number(value.toFixed(max));
  const used = (String(rounded).split('.')[1] ?? '').length;
  return formatNumberTR(rounded, { decimals: Math.min(Math.max(used, min), max) });
}

/** Motor değerini ekranda gösterilecek metne çevirir. */
export function formatCell(value: CellValue, format: CellFormat): string {
  if (value === null || value === undefined || value === '') return '';
  if (isError(value)) return value.code;
  if (typeof value === 'boolean') return value ? 'EVET' : 'HAYIR';

  if (typeof value === 'number') {
    switch (format) {
      case 'money':
        return value === 0 ? '' : formatNumberTR(value, { decimals: 2 });
      case 'percent':
        return formatNumberTR(value * 100, { decimals: 0 }) + '%';
      case 'factor':
        return value === 0 ? '' : formatTrimmed(value, FACTOR_DECIMALS);
      case 'int':
        return value === 0 ? '' : formatNumberTR(Math.round(value), { decimals: 0 });
      case 'date': {
        const d = excelSerialToDate(value);
        return d ? d.toLocaleDateString('tr-TR') : '';
      }
      case 'number':
      default: {
        if (value === 0) return '';
        const rounded = Math.round(value * 1000) / 1000;
        return Number.isInteger(rounded)
          ? formatNumberTR(rounded, { decimals: 0 })
          : formatNumberTR(rounded, { decimals: 2 });
      }
    }
  }

  return String(value);
}

/** Düzenleme kutusuna konacak ham metin. */
export function toEditText(value: CellValue, format: CellFormat): string {
  if (value === null || value === undefined || value === '') return '';
  if (isError(value)) return '';
  if (typeof value === 'number') {
    if (format === 'date') {
      const d = excelSerialToDate(value);
      return d ? d.toISOString().slice(0, 10) : '';
    }
    if (value === 0) return '';
    return String(value).replace('.', ',');
  }
  return String(value);
}

/**
 * Kullanıcının yazdığı metni hücre değerine çevirir.
 *
 * Boş bırakılan metin hücresi boş DEĞER döndürür (null değil): kaynakta dolu
 * gelen bir hücre ancak böyle boşaltılabilir — null motorda girdiyi silmek,
 * yani kaynak değere geri dönmek demektir. Sayısal hücrelerde boş bırakmak
 * "şablona dön" anlamını korur.
 */
export function parseEditText(text: string, format: CellFormat): number | string | null {
  const trimmed = text.trim();
  if (trimmed === '') return format === 'text' ? '' : null;

  if (format === 'date') {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    return Math.round(d.getTime() / 86400000 + 25569);
  }

  if (format === 'text') return trimmed;

  /*
   * Çarpanlar binlik ayraç almaz (0 ile 1 arası dolaşırlar), buna karşılık
   * sayısal tuş takımı çoğu düzende nokta basar. Bu yüzden yalnızca burada
   * "0.7025" de "0,7025" gibi okunur — genel kuralda nokta binlik ayracıdır
   * ve orada değiştirilmesi 30.000 gibi girdileri bozardı.
   */
  const normalized = format === 'factor' && !trimmed.includes(',')
    ? trimmed
    : trimmed.replace(/\./g, '').replace(',', '.');

  const n = Number(normalized.replace(',', '.'));
  if (Number.isNaN(n)) {
    // Sayı beklenen alana metin yazıldıysa (ör. "YES") olduğu gibi sakla
    return trimmed;
  }
  // Kayan nokta artığı taşımasın: 4 haneden fazlası zaten gösterilmiyor.
  return format === 'factor' ? Number(n.toFixed(FACTOR_DECIMALS)) : n;
}
