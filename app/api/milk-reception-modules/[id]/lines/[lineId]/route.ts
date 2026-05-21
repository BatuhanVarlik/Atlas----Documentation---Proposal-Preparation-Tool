import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { upsertLineSchema } from '@/lib/validations/milkReceptionModule';

type Params = { params: Promise<{ id: string; lineId: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id, lineId } = await params;
    const body: unknown = await request.json();
    const parsed = upsertLineSchema.safeParse(body);
    if (!parsed.success)
      return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const mod = await prisma.milkReceptionModule.findUnique({ where: { id } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const line = await prisma.milkReceptionLine.findUnique({ where: { id: lineId } });
    if (!line || line.moduleId !== id) return apiError('Hat bulunamadı', 404);

    const data = parsed.data;
    // capacity / pressure ham hesap için kullanılır; null kabul edilmez (gerekirse 0 yaz)
    const updated = await prisma.milkReceptionLine.update({
      where: { id: lineId },
      data: {
        ...data,
        capacity: data.capacity ?? line.capacity,
        pressure: data.pressure ?? line.pressure,
      },
    });
    return apiSuccess(updated, 'Hat güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id, lineId } = await params;

    const mod = await prisma.milkReceptionModule.findUnique({ where: { id } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const line = await prisma.milkReceptionLine.findUnique({ where: { id: lineId } });
    if (!line || line.moduleId !== id) return apiError('Hat bulunamadı', 404);

    await prisma.milkReceptionLine.delete({ where: { id: lineId } });

    // Order'ı yeniden numarala
    const remaining = await prisma.milkReceptionLine.findMany({
      where: { moduleId: id },
      orderBy: { order: 'asc' },
    });
    await Promise.all(
      remaining.map((l, i) =>
        l.order !== i
          ? prisma.milkReceptionLine.update({ where: { id: l.id }, data: { order: i } })
          : Promise.resolve(),
      ),
    );

    return apiSuccess(null, 'Hat silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
