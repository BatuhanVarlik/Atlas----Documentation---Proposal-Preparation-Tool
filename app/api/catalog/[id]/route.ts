import { prisma } from '@/lib/prisma';
import { requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    // Fiyatlandırmayı global etkilediğinden silme yetkili rollere kısıtlı.
    await requireRole(['ADMIN', 'DEPARTMENT_MANAGER']);
    const { id } = await params;
    const existing = await prisma.customCatalogItem.findUnique({ where: { id } });
    if (!existing) return apiError('Ürün bulunamadı', 404);
    await prisma.customCatalogItem.delete({ where: { id } });
    return apiSuccess(null, 'Ürün silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
