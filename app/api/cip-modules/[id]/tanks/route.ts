import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { upsertCipTankSchema } from '@/lib/validations/cipModule';

type Params = { params: Promise<{ id: string }> };

// Tank tiplerinin sabit sırası (şemadaki görünüm sırası)
const TANK_ORDER: Record<string, number> = {
  CAUSTIC: 0,
  ACID: 1,
  HOT_WATER: 2,
  RECOVERY: 3,
  FRESH_WATER: 4,
};

// Tank tipini aç/kapa + alanlarını upsert et.
// present=false → ilgili tank tipi varsa silinir.
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = upsertCipTankSchema.safeParse(body);
    if (!parsed.success)
      return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const mod = await prisma.cipModule.findUnique({ where: { id } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const { tankType, present } = parsed.data;
    const existing = await prisma.cipTank.findUnique({
      where: { moduleId_tankType: { moduleId: id, tankType } },
    });

    if (!present) {
      if (existing) await prisma.cipTank.delete({ where: { id: existing.id } });
    } else {
      // Fresh Water tankında pressure transmitter kullanılmaz — zorla false.
      const hasPT = tankType === 'FRESH_WATER' ? false : (parsed.data.hasPressureTransmitter ?? existing?.hasPressureTransmitter ?? false);
      const data = {
        capacity: parsed.data.capacity ?? existing?.capacity ?? 0,
        material: parsed.data.material ?? existing?.material ?? 'AISI_304',
        insulation: parsed.data.insulation ?? existing?.insulation ?? 'UNINSULATED',
        hasLSH: parsed.data.hasLSH ?? existing?.hasLSH ?? false,
        hasLSL: parsed.data.hasLSL ?? existing?.hasLSL ?? false,
        hasExternalSensor: parsed.data.hasExternalSensor ?? existing?.hasExternalSensor ?? false,
        hasPressureTransmitter: hasPT,
      };
      if (existing) {
        await prisma.cipTank.update({ where: { id: existing.id }, data });
      } else {
        await prisma.cipTank.create({
          data: { moduleId: id, tankType, order: TANK_ORDER[tankType] ?? 0, ...data },
        });
      }
    }

    const tanks = await prisma.cipTank.findMany({
      where: { moduleId: id },
      orderBy: { order: 'asc' },
    });
    return apiSuccess(tanks, present ? 'Tank kaydedildi' : 'Tank kaldırıldı');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
