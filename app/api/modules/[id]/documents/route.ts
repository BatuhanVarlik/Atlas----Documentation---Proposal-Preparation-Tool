import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId } = await params;

    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && module.creatorId !== user.id) return apiError('Forbidden', 403);

    const docs = await prisma.generatedDocument.findMany({
      where: { moduleId },
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { name: true } } },
    });

    return apiSuccess(docs);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
