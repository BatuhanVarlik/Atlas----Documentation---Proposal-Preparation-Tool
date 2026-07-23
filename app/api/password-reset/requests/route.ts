import { requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';
import { listPendingResetRequests } from '@/lib/shared-users';

// GET /api/password-reset/requests — bekleyen talepler (ADMIN). ORTAK DB'den.
export async function GET() {
  try {
    await requireRole(['ADMIN', 'CEO']);
    const pending = await listPendingResetRequests();
    const requests = pending.map((r) => ({
      id: r.id,
      requestedAt: r.createdAt,
      status: 'PENDING' as const,
      user: { id: r.userId, name: r.name, email: r.email, department: { name: r.departmentName ?? '—' } },
    }));
    return apiSuccess(requests);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
