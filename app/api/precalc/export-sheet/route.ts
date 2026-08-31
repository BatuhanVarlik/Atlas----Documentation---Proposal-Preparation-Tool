import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { buildSheetSnapshot, precalcFileName } from '@/lib/precalc/export';
import { PrecalcEngine } from '@/lib/precalc/engine';
import type { PrecalcWorkbook } from '@/lib/precalc/types';
import workbookData from '@/lib/precalc/workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

const schema = z.object({
  entries: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  sheet: z.string().min(1).max(120),
});

/**
 * Kitabın tek bir sayfasını (AYRINTILI FIYATLANDIRMA, KABLO, panel
 * listeleri…) hesaplanmış hâliyle Excel dosyasına verir.
 *
 * Bütün precalculation'ı üretmeden yalnızca bir kırılımı almak isteyen
 * kullanıcı için. Hesap sunucuda yeniden çalıştırılır — istemciden yalnızca
 * kullanıcı girdileri gelir, hesaplanmış değerlere güvenilmez.
 */
export async function POST(req: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Geçersiz istek gövdesi' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Geçersiz veri', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sheet, entries } = parsed.data;
  // Sayfa adı kitaptan doğrulanır: istemciden gelen serbest metinle
  // çalışma kitabında dolaşılmasın.
  if (!workbook.sheetNames.includes(sheet)) {
    return NextResponse.json({ success: false, error: 'Bilinmeyen sayfa' }, { status: 400 });
  }

  try {
    const engine = new PrecalcEngine(workbook);
    engine.setEntries(entries);
    engine.settle();

    const snapshot = buildSheetSnapshot(engine, sheet);
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Sayfa boş' }, { status: 400 });
    }

    const book = XLSX.utils.book_new();
    // Excel sayfa adı 31 karakterle sınırlı ve bazı işaretleri kabul etmez.
    XLSX.utils.book_append_sheet(book, snapshot, sheet.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));

    const buffer: Buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    const filename = precalcFileName(sheet.replace(/[\\/?*[\]:]/g, ' '));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    console.error('Sayfa dışa aktarma hatası:', e);
    return NextResponse.json({ success: false, error: 'Excel oluşturulamadı' }, { status: 500 });
  }
}
