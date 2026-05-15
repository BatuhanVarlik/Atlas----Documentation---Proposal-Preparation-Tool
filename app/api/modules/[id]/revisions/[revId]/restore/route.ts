import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { restoreModuleFromSnapshot } from '@/lib/revisions/restore';
import type { ModuleSnapshot } from '@/lib/revisions/snapshot';

type Params = { params: Promise<{ id: string; revId: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId, revId } = await params;

    const mod = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id) return apiError('Forbidden', 403);

    const rev = await prisma.moduleRevision.findUnique({ where: { id: revId } });
    if (!rev || rev.moduleId !== moduleId) return apiError('Revizyon bulunamadı', 404);

    const snap = rev.snapshot as unknown as ModuleSnapshot;
    await restoreModuleFromSnapshot(moduleId, snap);

    return apiSuccess({ restoredFrom: rev.label });
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
