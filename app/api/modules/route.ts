import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { createModuleSchema } from '@/lib/validations/module';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const standard = searchParams.get('standard');

    const where: Record<string, unknown> = {};

    if (user.role === 'MEMBER') {
      where.creatorId = user.id;
    } else if ((user.role === 'DEPARTMENT_MANAGER' || user.role === 'FINANCE_MANAGER')) {
      where.creator = { departmentId: user.departmentId };
    }

    if (status) where.status = status;
    if (standard) where.standard = standard;

    const modules = await prisma.module.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { tanks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(modules);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body: unknown = await request.json();
    const parsed = createModuleSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Geçersiz veri', 400, parsed.error.flatten());
    }

    // Teklif No otomatik üret: HEM-YYYY-NNN (yıl bazında sıralı)
    const year = new Date().getFullYear();
    const prefix = `HEM-${year}-`;
    const countThisYear = await prisma.module.count({
      where: { quotationNo: { startsWith: prefix } },
    });
    const quotationNo = `${prefix}${String(countThisYear + 1).padStart(3, '0')}`;

    const moduleRecord = await prisma.module.create({
      data: {
        ...parsed.data,
        quotationNo,
        creatorId: user.id,
        status: 'DRAFT',
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    await prisma.moduleActivity.create({
      data: {
        moduleId: moduleRecord.id,
        userId: user.id,
        action: 'created',
        details: { name: moduleRecord.name },
      },
    });

    return apiSuccess(moduleRecord, 'Modül oluşturuldu', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}
