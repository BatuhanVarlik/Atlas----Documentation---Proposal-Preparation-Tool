// Şu anki modül state'ini en son revizyonla karşılaştırıp değişiklik özetini döner.

import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { captureModuleSnapshot, detectChanges, type ModuleSnapshot } from '@/lib/revisions/snapshot';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId } = await params;

    const mod = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id) return apiError('Forbidden', 403);

    const current = await captureModuleSnapshot(moduleId);
    const last = await prisma.moduleRevision.findFirst({
      where: { moduleId },
      orderBy: { revisionNumber: 'desc' },
    });
    const prev = (last?.snapshot ?? null) as ModuleSnapshot | null;
    const changes = detectChanges(prev, current);
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
