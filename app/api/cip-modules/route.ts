import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { createCipModuleSchema } from '@/lib/validations/cipModule';

export async function GET(_req: Request) {
  try {
    const user = await requireAuth();
    const where: Record<string, unknown> = {};
    if (user.role === 'MEMBER') where.creatorId = user.id;
    else if (user.role === 'DEPARTMENT_MANAGER')
      where.creator = { departmentId: user.departmentId };

    const modules = await prisma.cipModule.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(modules);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body: unknown = await request.json();
    const parsed = createCipModuleSchema.safeParse(body);
    if (!parsed.success)
      return apiError('Geçersiz veri', 400, parsed.error.flatten());

    // Teklif No otomatik üret: HEM-YYYY-NNN (yıl bazında sıralı)
    const year = new Date().getFullYear();
    const prefix = `HEM-${year}-`;
    const countThisYear = await prisma.cipModule.count({
      where: { quotationNo: { startsWith: prefix } },
    });
    const quotationNo = `${prefix}${String(countThisYear + 1).padStart(3, '0')}`;

    const mod = await prisma.cipModule.create({
      data: {
        ...parsed.data,
        quotationNo,
        creatorId: user.id,
        status: 'DRAFT',
      },
      include: { creator: { select: { id: true, name: true } } },
    });
    return apiSuccess(mod, 'Modül oluşturuldu', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e)
      return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
