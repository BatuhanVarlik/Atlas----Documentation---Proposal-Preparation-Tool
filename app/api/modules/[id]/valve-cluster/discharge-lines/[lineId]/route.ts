import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string; lineId: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  capacity: z.number().positive().max(1_000_000).optional(),
  pressure: z.number().positive().max(100).optional(),
  valveType: z.enum(['SDE44', 'DE44', 'D44SL', 'DA44']).optional(),
  valveControlUnit: z.enum(['NONE', 'AS_I', 'DC']).optional(),
  connectedTankCount: z.number().int().min(0).max(1000).optional(),
  pumpModel: z.string().max(255).nullable().optional(),
  pumpKw: z.number().positive().nullable().optional(),
  pumpImpellerSize: z.number().positive().nullable().optional(),
  hasPressureTransmitter: z.boolean().optional(),
  hasFlowMeter: z.boolean().optional(),
  waterInletType: z.enum(['SW_CIP42', 'SD42']).nullable().optional(),
});

export async function PUT(req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId, lineId } = await params;
    const body: unknown = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const moduleRecord = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!moduleRecord) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && moduleRecord.creatorId !== user.id) return apiError('Forbidden', 403);

    const line = await prisma.dischargeLine.update({
      where: { id: lineId },
      data: parsed.data,
    });

    return apiSuccess(line, 'Güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId, lineId } = await params;

    const moduleRecord = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!moduleRecord) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && moduleRecord.creatorId !== user.id) return apiError('Forbidden', 403);

    await prisma.dischargeLine.delete({ where: { id: lineId } });
    return apiSuccess(null, 'Silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
