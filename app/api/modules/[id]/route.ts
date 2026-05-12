import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { updateModuleSchema } from '@/lib/validations/module';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const moduleRecord = await prisma.module.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        valveCluster: {
          include: {
            fillingLines: { orderBy: { order: 'asc' } },
            dischargeLines: { orderBy: { order: 'asc' } },
          },
        },
        tanks: { orderBy: { order: 'asc' } },
        aiReviews: { orderBy: { createdAt: 'desc' }, take: 1 },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!moduleRecord) return apiError('Modül bulunamadı', 404);

    if (user.role === 'MEMBER' && moduleRecord.creatorId !== user.id) {
      return apiError('Forbidden', 403);
    }

    return apiSuccess(moduleRecord);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updateModuleSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Geçersiz veri', 400, parsed.error.flatten());
    }

    const existing = await prisma.module.findUnique({ where: { id } });
    if (!existing) return apiError('Modül bulunamadı', 404);

    if (user.role === 'MEMBER' && existing.creatorId !== user.id) {
      return apiError('Forbidden', 403);
    }

    const moduleRecord = await prisma.module.update({
      where: { id },
      data: parsed.data,
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    await prisma.moduleActivity.create({
      data: {
        moduleId: id,
        userId: user.id,
        action: 'updated',
        details: parsed.data,
      },
    });

    return apiSuccess(moduleRecord, 'Modül güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const existing = await prisma.module.findUnique({ where: { id } });
    if (!existing) return apiError('Modül bulunamadı', 404);

    if (user.role === 'MEMBER' && existing.creatorId !== user.id) {
      return apiError('Forbidden', 403);
    }

    await prisma.module.delete({ where: { id } });
    return apiSuccess(null, 'Modül silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}
