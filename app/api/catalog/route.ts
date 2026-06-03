import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';
import { createCustomCatalogSchema } from '@/lib/validations/customCatalog';

// Özel katalog tüm modüllerin fiyatlandırmasını etkilediğinden yazma işlemleri yetkili rollere kısıtlı.
const CATALOG_WRITE_ROLES = ['ADMIN', 'DEPARTMENT_MANAGER'];

export async function GET() {
  try {
    await requireAuth();
    const items = await prisma.customCatalogItem.findMany({ orderBy: { createdAt: 'desc' } });
    return apiSuccess(items);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(CATALOG_WRITE_ROLES);
    const body: unknown = await req.json();
    const parsed = createCustomCatalogSchema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const item = await prisma.customCatalogItem.create({
      data: {
        kind: parsed.data.kind,
        name: parsed.data.name,
        standard: parsed.data.standard,
        size: parsed.data.size?.trim() || null,
        listPrice: parsed.data.listPrice,
        discount: parsed.data.discount,
        createdById: user.id,
      },
    });
    return apiSuccess(item, 'Ürün kataloğa eklendi', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
