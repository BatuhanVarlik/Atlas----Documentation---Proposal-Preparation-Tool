import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import {
  captureMilkReceptionSnapshot,
  detectMilkReceptionChanges,
  type MilkReceptionSnapshot,
} from '@/lib/revisions/milkReceptionSnapshot';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId } = await params;

    const mod = await prisma.milkReceptionModule.findUnique({ where: { id: moduleId } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id) return apiError('Forbidden', 403);

    const current = await captureMilkReceptionSnapshot(moduleId);
    const last = await prisma.milkReceptionModuleRevision.findFirst({
      where: { moduleId },
      orderBy: { revisionNumber: 'desc' },
    });
    const prev = (last?.snapshot ?? null) as MilkReceptionSnapshot | null;
    const changes = detectMilkReceptionChanges(prev, current);
    const nextNumber = (last?.revisionNumber ?? 0) + 1;
    const nextLabel = `RV-${String(nextNumber).padStart(2, '0')}`;

    return apiSuccess({
      hasPreviousRevision: !!last,
      previousLabel: last?.label ?? null,
      nextLabel,
      changes,
    });
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
