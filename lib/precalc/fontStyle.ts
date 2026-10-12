import type { CSSProperties } from 'react';
import type { FontStyle, PrecalcWorkbook } from './types';

/**
 * Şablondaki hücre yazı biçimini (renk / kalın / italik) okur.
 * Veri build-precalc-styles.js'ten gelir; yalnızca varsayılandan farklı
 * hücreler kayıtlıdır — kayıt yoksa null döner ve UI kendi varsayılanını kullanır.
 */
export function fontStyleOf(
  workbook: Pick<PrecalcWorkbook, 'fontStyles'> | null | undefined,
  sheet: string,
  addr: string,
): FontStyle | null {
  const fs = workbook?.fontStyles;
  if (!fs) return null;
  const idx = fs.cells[sheet]?.[addr];
  return idx === undefined ? null : fs.palette[idx] ?? null;
}

export interface XlFontProps {
  className: string;
  style: CSSProperties | undefined;
}

const NONE: XlFontProps = { className: '', style: undefined };

/**
 * Yazı biçimini hücreye verilecek sınıf + stile çevirir (bkz. globals.css
 * `.xl-c/.xl-b/.xl-i`). Renk CSS değişkeniyle taşınır; böylece hücrenin
 * içindeki giriş kutusu gibi kendi rengi olan öğeler de şablon rengini alır.
 */
export function xlFontProps(style: FontStyle | null | undefined): XlFontProps {
  if (!style) return NONE;
  const classes: string[] = [];
  if (style.c) classes.push('xl-c');
  if (style.b) classes.push('xl-b');
  if (style.i) classes.push('xl-i');
  return {
    className: classes.join(' '),
    style: style.c ? ({ '--xl-c': '#' + style.c } as CSSProperties) : undefined,
  };
}
