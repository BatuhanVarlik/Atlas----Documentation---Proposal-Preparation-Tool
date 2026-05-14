import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string; tankId: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  volume: z.number().positive().max(1_000_000).optional(),
  samplingValve: z.enum(['MANUAL', 'WITH_ACTUATOR']).optional(),
  cipBall: z.enum(['STATIC', 'ROTARY']).optional(),
  hasLSH: z.boolean().optional(),
  hasLSM: z.boolean().optional(),
  hasLSL: z.boolean().optional(),
  hasTT: z.boolean().optional(),
  hasPT: z.boolean().optional(),
  hasProximitySwitch: z.boolean().optional(),
  hasAgitator: z.boolean().optional(),
  agitatorMotorKw: z.number().positive().nullable().optional(),
  agitatorRpm: z.number().int().positive().nullable().optional(),
  agitatorPosition: z.enum(['SIDE', 'TOP']).nullable().optional(),
  hasCipInletForAgitator: z.boolean().optional(),
  hasCipInletForManhole: z.boolean().optional(),
  hasTankOutletValve: z.boolean().optional(),
  tankOutletValveType: z.enum(['MANUAL', 'WITH_ACTUATOR']).nullable().optional(),
  tankOutletValveSubType: z.enum(['BUTTERFLY', 'SINGLE_SEAT', 'SINGLE_SEAT_TANK', 'SW_CIP_TANK', 'SD_TANK', 'D_TANK']).nullable().optional(),
  manifoldHasCipReturnPump: z.boolean().optional(),
  cipReturnPumpModel: z.string().max(255).nullable().optional(),
  cipReturnPumpKw: z.number().positive().nullable().optional(),
  cipReturnPumpImpellerSize: z.number().positive().nullable().optional(),
});

export async function PUT(req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId, tankId } = await params;
    const body: unknown = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const moduleRecord = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!moduleRecord) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && moduleRecord.creatorId !== user.id) return apiError('Forbidden', 403);

    const tank = await prisma.tank.update({ where: { id: tankId }, data: parsed.data });
    return apiSuccess(tank, 'Tank güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId, tankId } = await params;

    const moduleRecord = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!moduleRecord) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && moduleRecord.creatorId !== user.id) return apiError('Forbidden', 403);

    await prisma.tank.delete({ where: { id: tankId } });
    return apiSuccess(null, 'Tank silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
