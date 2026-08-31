'use client';

import type { PrecalcEntries } from './types';

/**
 * Kitabın tek bir sayfasını Excel olarak indirir.
 *
 * Dosya sunucuda üretilir: hesap orada yeniden koşar ve biçimlendirme
 * (dolgu, sayı biçimi, kenarlık) tek yerden gelir. İstemciye yalnızca
 * indirme işi kalır.
 */
export async function downloadSheetExcel(sheet: string, entries: PrecalcEntries): Promise<void> {
  const res = await fetch('/api/precalc/export-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet, entries }),
  });

  if (!res.ok) {
    // Sunucu hatayı JSON olarak açıklıyorsa kullanıcıya onu göster.
    let detail = `Sunucu hatası (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) detail = String(body.error);
    } catch {
      // gövde JSON değilse varsayılan metin kalsın
    }
    throw new Error(detail);
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : `${sheet}.xlsx`;

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
