import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().min(1).max(255),
  volume: z.number().positive().max(1_000_000),
  samplingValve: z.enum(['MANUAL', 'WITH_ACTUATOR']),
  cipBall: z.enum(['STATIC', 'ROTARY']),
  hasLSH: z.boolean().default(false),
  hasLSM: z.boolean().default(false),
  hasLSL: z.boolean().default(false),
  hasTT: z.boolean().default(false),
  hasPT: z.boolean().default(false),
  hasProximitySwitch: z.boolean().default(false),
  hasAgitator: z.boolean().default(false),
  agitatorMotorKw: z.number().positive().optional(),
  agitatorRpm: z.number().int().positive().optional(),
  agitatorPosition: z.enum(['SIDE', 'TOP']).optional(),
  hasCipInletForAgitator: z.boolean().default(false),
  hasCipInletForManhole: z.boolean().default(false),
  hasTankOutletValve: z.boolean().default(false),
  tankOutletValveType: z.enum(['MANUAL', 'WITH_ACTUATOR']).optional(),
  tankOutletValveSubType: z.enum(['BUTTERFLY', 'SINGLE_SEAT']).optional(),
  cipReturnPumpModel: z.string().max(255).optional(),
  cipReturnPumpKw: z.number().positive().optional(),
  cipReturnPumpImpellerSize: z.number().positive().optional(),
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

    const count = await prisma.tank.count({ where: { moduleId } });

    const tank = await prisma.tank.create({
      data: { moduleId, order: count + 1, ...parsed.data },
    });

    if (moduleRecord.status === 'DRAFT') {
      await prisma.module.update({ where: { id: moduleId }, data: { status: 'IN_PROGRESS' } });
    }

    return apiSuccess(tank, 'Tank eklendi', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
