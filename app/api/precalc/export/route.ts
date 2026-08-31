import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { buildPrecalcWorkbook, precalcFileName, quoteEquipmentNumbers } from '@/lib/precalc/export';
import { lookupStock, isStockConfigured } from '@/lib/stock/sqlServer';
import type { PrecalcWorkbook } from '@/lib/precalc/types';
import workbookData from '@/lib/precalc/workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

const exportSchema = z.object({
  entries: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  onlyEntered: z.boolean().default(true),
  header: z
    .object({
      customer: z.string().max(200).optional(),
      endUser: z.string().max(200).optional(),
      date: z.string().max(40).optional(),
      preparedBy: z.string().max(200).optional(),
      projectNo: z.string().max(80).optional(),
      precalcNo: z.string().max(80).optional(),
    })
    .optional(),
});

/**
 * Girilen miktarlardan Precalculation Excel dosyası üretir.
 *
 * Hesap sunucuda yeniden çalıştırılır — istemciden yalnızca kullanıcı
 * girdileri gelir, hesaplanmış değerlere güvenilmez.
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

  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Geçersiz veri', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    /*
     * Depo bakiyesi ve asgari stok HEMİSAN AS veritabanından gelir; Excel
     * makrosu da bu iki sütunu oradan dolduruyordu. Bağlantı yoksa ya da
     * sorgu düşerse sütunlar boş kalır, teklif yine üretilir — stok bilgisi
     * çıktının kendisini bloke etmemeli.
     */
    let stock = {};
    if (isStockConfigured()) {
      try {
        stock = await lookupStock(quoteEquipmentNumbers(workbook, parsed.data.entries));
      } catch (e) {
        console.error('Stok sorgusu atlandı:', e instanceof Error ? e.message : e);
      }
    }

    const book = buildPrecalcWorkbook(workbook, parsed.data.entries, {
      onlyEntered: parsed.data.onlyEntered,
      header: parsed.data.header,
      stock,
    });

    const buffer: Buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    const filename = precalcFileName();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    console.error('Precalculation dışa aktarma hatası:', e);
    return NextResponse.json({ success: false, error: 'Excel oluşturulamadı' }, { status: 500 });
  }
}
