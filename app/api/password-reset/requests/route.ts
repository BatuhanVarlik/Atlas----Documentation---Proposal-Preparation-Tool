import { prisma } from '@/lib/prisma';
import { requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';

export async function GET() {
  try {
    await requireRole(['ADMIN']);
    const requests = await prisma.passwordResetRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
    return apiSuccess(requests);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
