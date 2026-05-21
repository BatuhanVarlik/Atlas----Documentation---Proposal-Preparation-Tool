import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import {
  captureMilkReceptionSnapshot,
  detectMilkReceptionChanges,
  type MilkReceptionSnapshot,
} from '@/lib/revisions/milkReceptionSnapshot';

type Params = { params: Promise<{ id: string }> };

const MAX_REVISIONS = 10;

const createSchema = z.object({
  description: z.string().min(1, 'Açıklama girin').max(2000),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId } = await params;

    const mod = await prisma.milkReceptionModule.findUnique({ where: { id: moduleId } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id) return apiError('Forbidden', 403);

    const revisions = await prisma.milkReceptionModuleRevision.findMany({
      where: { moduleId },
      orderBy: { revisionNumber: 'desc' },
      take: MAX_REVISIONS,
      select: {
        id: true,
        revisionNumber: true,
        label: true,
        description: true,
        detectedChanges: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(revisions);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId } = await params;
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

    const mod = await prisma.milkReceptionModule.findUnique({ where: { id: moduleId } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id) return apiError('Forbidden', 403);

    const current = await captureMilkReceptionSnapshot(moduleId);
    const last = await prisma.milkReceptionModuleRevision.findFirst({
      where: { moduleId },
      orderBy: { revisionNumber: 'desc' },
    });
    const prevSnapshot = (last?.snapshot ?? null) as MilkReceptionSnapshot | null;
    const changes = detectMilkReceptionChanges(prevSnapshot, current);
    const nextNumber = (last?.revisionNumber ?? 0) + 1;
    const label = `RV-${String(nextNumber).padStart(2, '0')}`;

    const revision = await prisma.milkReceptionModuleRevision.create({
      data: {
        moduleId,
        revisionNumber: nextNumber,
        label,
        description: parsed.data.description.trim(),
        detectedChanges: changes as unknown as object,
        snapshot: current as unknown as object,
        createdById: user.id,
      },
    });

    const total = await prisma.milkReceptionModuleRevision.count({ where: { moduleId } });
    if (total > MAX_REVISIONS) {
      const stale = await prisma.milkReceptionModuleRevision.findMany({
        where: { moduleId },
        orderBy: { revisionNumber: 'asc' },
        take: total - MAX_REVISIONS,
        select: { id: true },
      });
      await prisma.milkReceptionModuleRevision.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
    }

    return apiSuccess({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      label: revision.label,
      description: revision.description,
      detectedChanges: revision.detectedChanges,
      createdAt: revision.createdAt,
    });
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
