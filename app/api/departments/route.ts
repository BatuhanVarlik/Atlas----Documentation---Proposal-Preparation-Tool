import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';

export async function GET() {
  try {
    await requireAuth();
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
    return apiSuccess(departments);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}
