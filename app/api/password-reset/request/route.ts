import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/auth-middleware';

const schema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }

    const { email, newPassword } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // E-posta bulunmasa bile aynı cevabı dönüyoruz — enumeration saldırısını engelle
    if (!user) {
      return apiSuccess(null, 'Talebiniz alındı. Yönetici onayından sonra şifreniz güncellenecektir.');
    }

    const existing = await prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, status: 'PENDING' },
    });
    if (existing) {
      return apiError('Bu hesap için bekleyen bir talep zaten var', 409);
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.passwordResetRequest.create({
      data: { userId: user.id, hashedNewPassword: hashed },
    });

    return apiSuccess(null, 'Talebiniz alındı. Yönetici onayından sonra şifreniz güncellenecektir.');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
