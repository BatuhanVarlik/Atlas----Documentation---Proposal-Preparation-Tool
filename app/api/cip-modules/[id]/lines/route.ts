import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { addCipLinesSchema } from '@/lib/validations/cipModule';

type Params = { params: Promise<{ id: string }> };

const PREFIX: Record<'DISCHARGE' | 'RETURN', string> = {
  DISCHARGE: 'DL',
  RETURN: 'RL',
};

// Belirli bir hat tipine (DISCHARGE/RETURN) `addCount` kadar YENİ hat ekler.
// Verilen ortak detay (capacity/pressure/pump) yalnızca yeni eklenen hatlara uygulanır;
// mevcut hatlar değiştirilmez. Hatlar sona eklenir (DL3, DL4 ... şeklinde devam eder).
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = addCipLinesSchema.safeParse(body);
    if (!parsed.success)
      return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const mod = await prisma.cipModule.findUnique({ where: { id } });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const { lineKind, addCount } = parsed.data;
    const startOrder = await prisma.cipLine.count({ where: { moduleId: id, lineKind } });

    const toCreate = Array.from({ length: addCount }, (_, i) => ({
      moduleId: id,
      lineKind,
      name: `${PREFIX[lineKind]}${startOrder + i + 1}`,
      order: startOrder + i,
      capacity: parsed.data.capacity ?? 0,
      pressure: parsed.data.pressure ?? 0,
      pumpModel: parsed.data.pumpModel ?? null,
      pumpKw: parsed.data.pumpKw ?? null,
      pumpImpellerSize: parsed.data.pumpImpellerSize ?? null,
    }));
    await prisma.cipLine.createMany({ data: toCreate });

    const updated = await prisma.cipLine.findMany({
      where: { moduleId: id },
      orderBy: [{ lineKind: 'asc' }, { order: 'asc' }],
    });
    return apiSuccess(updated, `${addCount} hat eklendi`);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
