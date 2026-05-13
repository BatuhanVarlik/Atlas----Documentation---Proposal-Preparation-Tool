import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(['approve', 'reject']),
});

export async function PUT(req: Request, { params }: Params) {
  try {
    const admin = await requireRole(['ADMIN']);
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri', 400);

    const reqRecord = await prisma.passwordResetRequest.findUnique({ where: { id } });
    if (!reqRecord) return apiError('Talep bulunamadı', 404);
    if (reqRecord.status !== 'PENDING') return apiError('Talep zaten sonuçlandırılmış', 400);

    if (parsed.data.action === 'approve') {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: reqRecord.userId },
          data: { password: reqRecord.hashedNewPassword },
        }),
        prisma.passwordResetRequest.update({
          where: { id },
          data: { status: 'APPROVED', resolvedAt: new Date(), resolvedById: admin.id },
        }),
      ]);
      return apiSuccess(null, 'Şifre onaylandı ve güncellendi');
    }

    await prisma.passwordResetRequest.update({
      where: { id },
      data: { status: 'REJECTED', resolvedAt: new Date(), resolvedById: admin.id },
    });
    return apiSuccess(null, 'Talep reddedildi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
