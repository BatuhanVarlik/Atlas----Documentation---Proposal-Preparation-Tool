import { z } from 'zod';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { changeSharedPassword } from '@/lib/shared-users';

const schema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre boş olamaz'),
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalı').max(128),
});

// POST /api/account/change-password — kullanıcı kendi şifresini değiştirir.
// İlk-giriş zorunlu değişikliği ve istemli değişiklik için ortak uç.
// Şifre ORTAK DB'ye yazılır → tüm uygulamalarda geçerli olur.
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    if (!user.email) return apiError('Oturumda e-posta bulunamadı', 400);

    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return apiError('Yeni şifre mevcut şifre ile aynı olamaz', 400);
    }

    const result = await changeSharedPassword(user.email, currentPassword, newPassword);
    if (result === 'not_found') return apiError('Kullanıcı bulunamadı', 404);
    if (result === 'bad_current') return apiError('Mevcut şifre hatalı', 400);

    return apiSuccess(null, 'Şifreniz güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
