import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { updateProjectSchema } from '@/lib/validations/project';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, color: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    if (!project) return apiError('Proje bulunamadı', 404);

    if (
      user.role === 'MEMBER' &&
      project.departmentId !== user.departmentId
    ) {
      return apiError('Forbidden', 403);
    }

    return apiSuccess(project);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Geçersiz veri', 400, parsed.error.flatten());
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return apiError('Proje bulunamadı', 404);

    if (user.role === 'MEMBER' && existing.creatorId !== user.id) {
      return apiError('Forbidden', 403);
    }

    const project = await prisma.project.update({
      where: { id },
      data: parsed.data,
      include: {
        department: { select: { id: true, name: true, color: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(project, 'Proje güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return apiError('Proje bulunamadı', 404);

    if (user.role === 'MEMBER') {
      return apiError('Forbidden', 403);
    }
    if ((user.role === 'DEPARTMENT_MANAGER' || user.role === 'FINANCE_MANAGER') && existing.departmentId !== user.departmentId) {
      return apiError('Forbidden', 403);
    }

    await prisma.project.delete({ where: { id } });
    return apiSuccess(null, 'Proje silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}
