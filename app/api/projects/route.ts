import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { createProjectSchema } from '@/lib/validations/project';

export async function GET() {
  try {
    const user = await requireAuth();

    const where =
      user.role === 'MEMBER'
        ? { departmentId: user.departmentId }
        : (user.role === 'DEPARTMENT_MANAGER' || user.role === 'FINANCE_MANAGER')
          ? { departmentId: user.departmentId }
          : {};

    const projects = await prisma.project.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, color: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(projects);
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
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Geçersiz veri', 400, parsed.error.flatten());
    }

    const { departmentId, ...rest } = parsed.data;

    // MEMBER kendi departmanı dışında proje oluşturamaz
    if (user.role === 'MEMBER' && departmentId !== user.departmentId) {
      return apiError('Forbidden', 403);
    }

    const project = await prisma.project.create({
      data: {
        ...rest,
        departmentId,
        creatorId: user.id,
      },
      include: {
        department: { select: { id: true, name: true, color: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(project, 'Proje oluşturuldu', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      return apiError('Bu proje kodu zaten kullanımda', 409);
    }
    return apiError('Sunucu hatası', 500);
  }
}
