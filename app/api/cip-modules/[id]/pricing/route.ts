import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { updatePricingSchema } from '@/lib/validations/pricing';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updatePricingSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Geçersiz veri', 400, parsed.error.flatten());
    }

    const existing = await prisma.cipModule.findUnique({ where: { id } });
    if (!existing) return apiError('Modül bulunamadı', 404);
    if (user.role === 'MEMBER' && existing.creatorId !== user.id) {
      return apiError('Forbidden', 403);
    }

    const updated = await prisma.cipModule.update({
      where: { id },
      data: {
        priceMultiplier: parsed.data.multiplier,
        priceOverrides: parsed.data.overrides,
      },
      select: { id: true, priceMultiplier: true, priceOverrides: true },
    });

    return apiSuccess(updated, 'Fiyatlandırma güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status);
    }
    return apiError('Sunucu hatası', 500);
  }
}
