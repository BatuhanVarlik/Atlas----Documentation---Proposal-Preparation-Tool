import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import {
  buildPrecalcWorkbook,
  CASHFLOW_SHEET,
  cashflowLayoutFor,
  DETAILED_SHEET,
  precalcFileName,
  quoteEquipmentNumbers,
} from '@/lib/precalc/export';
import { PrecalcEngine } from '@/lib/precalc/engine';
import { summarizePrecalc } from '@/lib/precalc/savedSummary';
import { lookupStock, isStockConfigured } from '@/lib/stock/sqlServer';
import { applySheetSetup, injectLineChart } from '@/lib/precalc/xlsxPost';
import type { PrecalcWorkbook } from '@/lib/precalc/types';
import workbookData from '@/lib/precalc/workbook.json';

const workbook = workbookData as unknown as PrecalcWorkbook;

const exportSchema = z.object({
  entries: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  onlyEntered: z.boolean().default(true),
  /** Verilirse revizyon geçmişi ÖZET sayfasına yazılır. */
  docId: z.string().cuid().optional(),
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

    /**
     * Revizyon geçmişi: verilen kayıttan köke kadar ebeveyn zinciri,
     * eskiden yeniye. Döngüye karşı sayaçla korunur — bozuk veri sunucuyu
     * kilitlemesin (bkz. /api/precalc/saved/[id] GET).
     */
    let revisions: { code: string; note: string; author: string; date: string }[] = [];
    if (parsed.data.docId) {
      type RevisionChainRow = {
        precalcNo: string; revisionCode: string; revisionNote: string; createdAt: Date;
        parentId: string | null; createdBy: { name: string | null } | null;
      };
      const chain: RevisionChainRow[] = [];
      let cursor: string | null = parsed.data.docId;
      for (let guard = 0; cursor && guard < 50; guard++) {
        const found: RevisionChainRow | null = await prisma.savedPrecalculation.findUnique({
          where: { id: cursor },
          select: {
            precalcNo: true, revisionCode: true, revisionNote: true, createdAt: true,
            parentId: true, createdBy: { select: { name: true } },
          },
        });
        if (!found) break;
        chain.unshift(found);
        cursor = found.parentId;
      }
      revisions = chain
        .filter((row) => row.revisionCode || row.revisionNote)
        .map((row) => ({
          code: row.revisionCode || row.precalcNo,
          note: row.revisionNote || 'açıklama girilmedi',
          author: row.createdBy?.name ?? '',
          date: row.createdAt.toLocaleDateString('tr-TR'),
        }));
    }

    const book = buildPrecalcWorkbook(workbook, parsed.data.entries, {
      onlyEntered: parsed.data.onlyEntered,
      header: parsed.data.header,
      stock,
      revisions,
    });

    // CASHFLOW grafiğinin hangi satırlara bağlanacağını belirlemek için motor
    // burada ayrıca kurulur — buildPrecalcWorkbook kendi motorunu döndürmüyor,
    // 52 satırlık bir tablo için bunu yeniden hesaplamanın maliyeti önemsiz.
    const cashflowEngine = new PrecalcEngine(workbook);
    cashflowEngine.setEntries(parsed.data.entries);
    cashflowEngine.settle();
    const layout = cashflowLayoutFor(cashflowEngine);

    const raw: Buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    // AYRINTILI FIYATLANDIRMA sayfası A4'e sığdırılır — SheetJS sayfa
    // düzenini yazamadığı için buffer burada son bir kez işlenir.
    const withSetup = applySheetSetup(raw, [{ sheet: DETAILED_SHEET, a4FitToWidth: true }]);
    // CASHFLOW sayfasına native çizgi grafiği enjekte edilir — bu da SheetJS'in
    // yazamadığı bir parça; A4 sığdırma uygulanmış buffer üzerinde çalışır.
    const buffer = injectLineChart(withSetup, {
      sheet: CASHFLOW_SHEET,
      title: 'HAFTA',
      catRef: `${CASHFLOW_SHEET}!$A$${layout.firstWeekRow}:$A$${layout.lastWeekRow}`,
      series: [{
        nameRef: `${CASHFLOW_SHEET}!$D$${layout.netHeaderRow}`,
        valRef: `${CASHFLOW_SHEET}!$D$${layout.firstWeekRow}:$D$${layout.lastWeekRow}`,
        // Kaynak Excel'deki turuncu çizgiyle aynı renk.
        colorRGB: 'ED7D31',
      }],
      anchor: {
        fromCol: 6,
        fromRow: layout.netHeaderRow - 1,
        toCol: 20,
        toRow: layout.netHeaderRow + 24,
      },
    });
    const filename = precalcFileName(summarizePrecalc(parsed.data.entries).precalcNo);

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
