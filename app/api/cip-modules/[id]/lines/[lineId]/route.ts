import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { upsertCipLineSchema } from '@/lib/validations/cipModule';

type Params = { params: Promise<{ id: string; lineId: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id, lineId } = await params;
    const body: unknown = await request.json();
    const parsed = upsertCipLineSchema.safeParse(body);
    if (!parsed.success)
      return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const mod = await prisma.cipModule.findUnique({ where: { id } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const line = await prisma.cipLine.findUnique({ where: { id: lineId } });
    if (!line || line.moduleId !== id) return apiError('Hat bulunamadı', 404);

    const data = parsed.data;
    const updated = await prisma.cipLine.update({
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

    const mod = await prisma.cipModule.findUnique({ where: { id } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const line = await prisma.cipLine.findUnique({ where: { id: lineId } });
    if (!line || line.moduleId !== id) return apiError('Hat bulunamadı', 404);

    const kind = line.lineKind;
    await prisma.cipLine.delete({ where: { id: lineId } });

    // Aynı tipteki hatların order'ını yeniden numarala
    const remaining = await prisma.cipLine.findMany({
      where: { moduleId: id, lineKind: kind },
      orderBy: { order: 'asc' },
    });
    await Promise.all(
      remaining.map((l, i) =>
        l.order !== i
          ? prisma.cipLine.update({ where: { id: l.id }, data: { order: i } })
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
