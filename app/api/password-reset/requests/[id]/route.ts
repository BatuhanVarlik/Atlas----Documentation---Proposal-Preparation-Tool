import { z } from 'zod';
import { requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';
import { resolveResetRequest } from '@/lib/shared-users';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(['approve', 'reject']),
});

// PUT /api/password-reset/requests/[id] — onayla/reddet (ADMIN). ORTAK DB üzerinde işler.
export async function PUT(req: Request, { params }: Params) {
  try {
    const admin = await requireRole(['ADMIN']);
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri', 400);

    const ok = await resolveResetRequest(id, parsed.data.action, admin.id);
    if (!ok) return apiError('Bekleyen talep bulunamadı', 404);

    return parsed.data.action === 'approve'
      ? apiSuccess(null, 'Şifre onaylandı ve güncellendi')
      : apiSuccess(null, 'Talep reddedildi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
