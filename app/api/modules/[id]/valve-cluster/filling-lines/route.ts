import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().min(1).max(255),
  capacity: z.number().positive().max(1_000_000),
  valveType: z.enum(['SDE44', 'DE44', 'D44SL', 'DA44']),
  valveControlUnit: z.enum(['NONE', 'AS_I', 'DC']).default('AS_I'),
  connectedTankCount: z.number().int().min(0).max(1000).default(1),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId } = await params;
    const body: unknown = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const moduleRecord = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!moduleRecord) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && moduleRecord.creatorId !== user.id) return apiError('Forbidden', 403);

    // Valve cluster'ı bul veya oluştur
    let cluster = await prisma.valveCluster.findUnique({ where: { moduleId } });
    if (!cluster) {
      cluster = await prisma.valveCluster.create({ data: { moduleId } });
    }

    const count = await prisma.fillingLine.count({ where: { valveClusterId: cluster.id } });

    const line = await prisma.fillingLine.create({
      data: {
        valveClusterId: cluster.id,
        order: count + 1,
        ...parsed.data,
      },
    });

    // Status → IN_PROGRESS
    if (moduleRecord.status === 'DRAFT') {
      await prisma.module.update({ where: { id: moduleId }, data: { status: 'IN_PROGRESS' } });
    }

    return apiSuccess(line, 'Dolum hattı eklendi', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
