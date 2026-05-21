import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { setLineCountSchema } from '@/lib/validations/milkReceptionModule';

type Params = { params: Promise<{ id: string }> };

// Hat sayısı belirleme — mevcut sayıyı `count`'a getirir.
// Eksik varsa ekler, fazla varsa son N hattı siler.
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = setLineCountSchema.safeParse(body);
    if (!parsed.success)
      return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const mod = await prisma.milkReceptionModule.findUnique({
      where: { id },
      include: { receptionLines: { orderBy: { order: 'asc' } } },
    });
    if (!mod) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && mod.creatorId !== user.id)
      return apiError('Forbidden', 403);

    const current = mod.receptionLines.length;
    const target = parsed.data.count;
    const providedNames = parsed.data.names ?? [];

    if (target > current) {
      const toCreate = Array.from({ length: target - current }, (_, i) => ({
        moduleId: id,
        name: providedNames[current + i] ?? `Raw Milk Reception ${current + i + 1}`,
        order: current + i,
        capacity: 0,
        pressure: 0,
      }));
      await prisma.milkReceptionLine.createMany({ data: toCreate });
    } else if (target < current) {
      const toRemove = mod.receptionLines.slice(target).map((l) => l.id);
      await prisma.milkReceptionLine.deleteMany({ where: { id: { in: toRemove } } });
    }

    // İsim güncellemeleri (sağlandıysa)
    if (providedNames.length > 0) {
      const lines = await prisma.milkReceptionLine.findMany({
        where: { moduleId: id },
        orderBy: { order: 'asc' },
      });
      await Promise.all(
        lines.map((l, i) =>
          providedNames[i] && providedNames[i] !== l.name
            ? prisma.milkReceptionLine.update({ where: { id: l.id }, data: { name: providedNames[i] } })
            : Promise.resolve(),
        ),
      );
    }

    const updated = await prisma.milkReceptionLine.findMany({
      where: { moduleId: id },
      orderBy: { order: 'asc' },
    });
    return apiSuccess(updated, 'Hat sayısı güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
