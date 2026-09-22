import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { summarizePrecalc } from '@/lib/precalc/savedSummary';
import { parseRevisionCode } from '@/lib/precalc/precalcNo';

const updateSchema = z.object({
  entries: z.record(
    z.string(),
    z.union([z.number(), z.string(), z.boolean(), z.null()]),
  ),
  /** İstemcinin okuduğu sürüm — çakışma denetimi bununla yapılır. */
  expectedVersion: z.number().int().nonnegative(),
});

/** Kaydedilmiş bir precalculation'ın girdileriyle birlikte tamamı. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.savedPrecalculation.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ success: false, error: 'Kayıt bulunamadı' }, { status: 404 });
  }

  /**
   * Revizyon geçmişi: bu kayıttan köke kadar ebeveyn zinciri, eskiden yeniye.
   * Döngüye karşı sayaçla korunur — bozuk veri sunucuyu kilitlemesin.
   */
  const chain: unknown[] = [];
  let cursor: string | null = row.parentId;
  for (let guard = 0; cursor && guard < 50; guard++) {
    const parent = await prisma.savedPrecalculation.findUnique({
      where: { id: cursor },
      select: {
        id: true, precalcNo: true, revisionCode: true, revisionNote: true,
        createdAt: true, parentId: true,
        createdBy: { select: { name: true } },
      },
    });
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent.parentId;
  }

  return NextResponse.json({
    success: true,
    data: row,
    revisions: [...chain, {
      id: row.id,
      precalcNo: row.precalcNo,
      revisionCode: row.revisionCode,
      revisionNote: row.revisionNote,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    }],
  });
}

/**
 * Var olan bir kaydı günceller.
 *
 * İyimser kilit: istek, istemcinin okuduğu sürümü taşır ve güncelleme
 * yalnızca sunucudaki sürüm hâlâ oysa geçer. Araya başka biri girdiyse
 * 409 döner ve kullanıcı kimin ne zaman kaydettiğini görüp karar verir —
 * iki kişi aynı teklifi açtığında ikincisi birincinin işini sessizce
 * silmez.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Geçersiz istek gövdesi' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Geçersiz veri', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const current = await prisma.savedPrecalculation.findUnique({
    where: { id },
    select: {
      id: true, precalcNo: true, version: true, updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });
  if (!current) {
    return NextResponse.json({ success: false, error: 'Kayıt bulunamadı' }, { status: 404 });
  }

  if (current.version !== parsed.data.expectedVersion) {
    return NextResponse.json(
      {
        success: false,
        reason: 'conflict',
        error: 'Bu precalculation siz açtıktan sonra başkası tarafından kaydedildi.',
        current: {
          id: current.id,
          precalcNo: current.precalcNo,
          version: current.version,
          updatedAt: current.updatedAt,
        },
        by: current.updatedBy?.name ?? 'başka bir kullanıcı',
      },
      { status: 409 },
    );
  }

  const summary = summarizePrecalc(parsed.data.entries);
  if (!summary.precalcNo) {
    return NextResponse.json(
      { success: false, error: 'Precalculation No boş — kaydetmeden önce doldurun.' },
      { status: 400 },
    );
  }

  /*
   * Üzerine yazma yok: bir kaydı güncellemek numarayı değiştirmeyi gerektirir.
   * Versiyon denetimi kullanıcının elinde — RE-00'ı RE-01 yapan kişi neyin
   * değiştiğini bilerek yapar ve eski sürüm listede durmaya devam eder.
   */
  if (summary.precalcNo === current.precalcNo) {
    return NextResponse.json(
      {
        success: false,
        reason: 'same-number',
        error: `"${current.precalcNo}" numarası zaten kayıtlı. Revizyon için `
          + 'Precalculation No\'yu değiştirin (ör. RE-00 → RE-01).',
        existing: { id: current.id, precalcNo: current.precalcNo },
      },
      { status: 409 },
    );
  }

  const clash = await prisma.savedPrecalculation.findUnique({
    where: { precalcNo: summary.precalcNo },
    select: { id: true, precalcNo: true },
  });
  if (clash && clash.id !== id) {
    return NextResponse.json(
      {
        success: false,
        reason: 'duplicate',
        error: `"${summary.precalcNo}" numarası başka bir kayıtta kullanılıyor.`,
        existing: clash,
      },
      { status: 409 },
    );
  }

  /*
   * Sürüm koşulu güncellemenin kendisinde de var: iki istek aynı anda
   * geldiğinde ikincisi 0 satır günceller ve çakışma olarak döner.
   */
  const result = await prisma.savedPrecalculation.updateMany({
    where: { id, version: parsed.data.expectedVersion },
    data: {
      ...summary,
      entries: parsed.data.entries,
      updatedById: user.id,
      revisionCode: parseRevisionCode(summary.precalcNo)?.full ?? '',
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    const latest = await prisma.savedPrecalculation.findUnique({
      where: { id },
      select: {
        id: true, precalcNo: true, version: true, updatedAt: true,
        updatedBy: { select: { name: true } },
      },
    });
    return NextResponse.json(
      {
        success: false,
        reason: 'conflict',
        error: 'Bu precalculation aynı anda başkası tarafından kaydedildi.',
        current: latest && {
          id: latest.id,
          precalcNo: latest.precalcNo,
          version: latest.version,
          updatedAt: latest.updatedAt,
        },
        by: latest?.updatedBy?.name ?? 'başka bir kullanıcı',
      },
      { status: 409 },
    );
  }

  const saved = await prisma.savedPrecalculation.findUnique({
    where: { id },
    select: { id: true, precalcNo: true, version: true, updatedAt: true },
  });

  return NextResponse.json({ success: true, data: saved });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    await prisma.savedPrecalculation.delete({ where: { id } });
  } catch {
    return NextResponse.json({ success: false, error: 'Kayıt bulunamadı' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
