import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { updateCipModuleSchema } from '@/lib/validations/cipModule';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const mod = await prisma.cipModule.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        tanks: { orderBy: { order: 'asc' } },
        lines: { orderBy: [{ lineKind: 'asc' }, { order: 'asc' }] },
      },
    });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);
    return apiSuccess(mod);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updateCipModuleSchema.safeParse(body);
    if (!parsed.success)
      return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const existing = await prisma.cipModule.findUnique({ where: { id } });
    if (!existing) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && existing.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const mod = await prisma.cipModule.update({
      where: { id },
      data: parsed.data,
      include: { creator: { select: { id: true, name: true } } },
    });
    return apiSuccess(mod, 'Modül güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const existing = await prisma.cipModule.findUnique({ where: { id } });
    if (!existing) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && existing.creatorId !== user.id)
      return apiError('Forbidden', 403);
    await prisma.cipModule.delete({ where: { id } });
    return apiSuccess(null, 'Modül silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
