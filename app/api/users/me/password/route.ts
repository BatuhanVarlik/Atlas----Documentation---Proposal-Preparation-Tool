import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';

const schema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre boş olamaz'),
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalı').max(128),
});

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return apiError('Yeni şifre mevcut şifre ile aynı olamaz', 400);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true },
    });
    if (!dbUser) return apiError('Kullanıcı bulunamadı', 404);

    const isValid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isValid) return apiError('Mevcut şifre hatalı', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return apiSuccess(null, 'Şifre güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
