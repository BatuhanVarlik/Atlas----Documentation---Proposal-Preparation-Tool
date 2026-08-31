import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { summarizePrecalc } from '@/lib/precalc/savedSummary';

const saveSchema = z.object({
  entries: z.record(
    z.string(),
    z.union([z.number(), z.string(), z.boolean(), z.null()]),
  ),
});

/** Oluşturulan precalculation'ları listeler (en yenisi başta). */
export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  const rows = await prisma.savedPrecalculation.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      precalcNo: true,
      projectNo: true,
      customer: true,
      endUser: true,
      preparedBy: true,
      sourceFile: true,
      currency: true,
      totalCost: true,
      totalSales: true,
      entryCount: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ success: true, data: rows });
}

/**
 * Yeni bir precalculation kaydı açar.
 *
 * Var olan bir kaydı güncellemek bu uçtan YAPILMAZ — onun için
 * PATCH /api/precalc/saved/[id] kullanılır. Ayrım kasıtlı: numaraya göre
 * "üzerine yaz" davranışı, aynı numarayla çalışan iki kişiden birinin
 * işini sessizce siliyordu.
 *
 * Özet tutarlar burada, sunucudaki hesap motoruyla yeniden üretilir;
 * istemciden yalnızca kullanıcı girdileri gelir.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Geçersiz istek gövdesi' }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Geçersiz veri', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const summary = summarizePrecalc(parsed.data.entries);
  if (!summary.precalcNo) {
    return NextResponse.json(
      { success: false, error: 'Precalculation No boş — kaydetmeden önce doldurun.' },
      { status: 400 },
    );
  }

  const existing = await prisma.savedPrecalculation.findUnique({
    where: { precalcNo: summary.precalcNo },
    select: { id: true, precalcNo: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        success: false,
        reason: 'duplicate',
        error: `"${summary.precalcNo}" numarası zaten kayıtlı. Listeden açıp güncelleyin ya da başka bir numara verin.`,
        existing,
      },
      { status: 409 },
    );
  }

  const saved = await prisma.savedPrecalculation.create({
    data: { ...summary, entries: parsed.data.entries, createdById: user.id, updatedById: user.id },
    select: { id: true, precalcNo: true, version: true, updatedAt: true },
  });

  return NextResponse.json({ success: true, data: saved });
}
