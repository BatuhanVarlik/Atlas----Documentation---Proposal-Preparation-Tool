import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/auth-middleware';
import { createSharedResetRequest } from '@/lib/shared-users';

const schema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8).max(128),
});

// POST /api/password-reset/request — şifremi unuttum (PUBLIC).
// Talep ORTAK DB'ye yazılır; admin onayıyla yeni şifre tüm uygulamalarda geçerli olur.
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }

    const { email, newPassword } = parsed.data;
    // E-posta numaralandırmasına karşı her durumda aynı cevap (sessizce yutar).
    await createSharedResetRequest(email, newPassword, 'atlas');

    return apiSuccess(null, 'Talebiniz alındı. Yönetici onayından sonra şifreniz güncellenecektir.');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
