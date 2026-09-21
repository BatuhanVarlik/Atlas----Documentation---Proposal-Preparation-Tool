import { z } from 'zod';
import { requireAuth, apiError, apiSuccess, AuthError } from '@/lib/auth-middleware';
import { requireCatalogEditor } from '@/lib/precalc/catalogPermission';
import { prisma } from '@/lib/prisma';
import { getCatalogDataset } from '@/lib/precalc/catalog';
import { OVERRIDE_FIELDS, FIELD_COLUMN, computeCatalogKey } from '@/lib/precalc/catalogOverrides';

/**
 * Advanced Precalculation kataloğu üzerindeki admin düzeltmeleri.
 *
 * GET    → tüm düzeltmeleri listeler (herhangi bir oturum yeterli — katalog
 *          görünümü bunları uygulamak için okur).
 * PUT    → tek bir alanı düzeltir/günceller (yalnızca yetkili kullanıcı).
 * DELETE → düzeltmeyi kaldırır, şablon değerine döner (yalnızca yetkili kullanıcı).
 */

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return apiError('Yetkisiz', 401);
  }

  const rows = await prisma.precalcCatalogOverride.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      catalogKey: true,
      field: true,
      value: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  return apiSuccess(rows.map((r) => ({
    catalogKey: r.catalogKey,
    field: r.field,
    value: r.value,
    updatedAt: r.updatedAt,
    updatedByName: r.updatedBy.name,
  })));
}

const putSchema = z.object({
  catalogKey: z.string().min(1),
  field: z.enum(OVERRIDE_FIELDS),
  value: z.string().min(1).max(500),
});

export async function PUT(req: Request) {
  try {
    const user = await requireCatalogEditor();
    const body: unknown = await req.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }
    const { catalogKey, field, value } = parsed.data;

    // Yalnızca kataloğun ŞU AN taşıdığı, formül-üretimli olmayan bir kaleme
    // düzeltme yazılabilir — yazım hatasıyla öksüz kayıt oluşmasın diye.
    const target = getCatalogDataset().items.find((it) => computeCatalogKey(it) === catalogKey);
    if (!target) return apiError('Katalogda bu anahtarla eşleşen kalem yok', 404);

    if (target.fx.includes(FIELD_COLUMN[field])) {
      return apiError('Bu alan Excel\'de formülle üretiliyor, düzeltilemez', 400);
    }
    if ((field === 'listPrice' || field === 'priceFactor' || field === 'extraFactor') && !Number.isFinite(Number(value))) {
      return apiError('Sayısal bir değer girilmeli', 400);
    }

    const saved = await prisma.precalcCatalogOverride.upsert({
      where: { catalogKey_field: { catalogKey, field } },
      update: { value, updatedById: user.id },
      create: { catalogKey, field, value, updatedById: user.id },
      select: { catalogKey: true, field: true, value: true, updatedAt: true, updatedBy: { select: { name: true } } },
    });

    return apiSuccess({
      catalogKey: saved.catalogKey,
      field: saved.field,
      value: saved.value,
      updatedAt: saved.updatedAt,
      updatedByName: saved.updatedBy.name,
    }, 'Düzeltme kaydedildi');
  } catch (e: unknown) {
    if (e instanceof AuthError) return apiError(e.message, e.status);
    return apiError('Sunucu hatası', 500);
  }
}

const deleteSchema = z.object({
  catalogKey: z.string().min(1),
  field: z.enum(OVERRIDE_FIELDS),
});

export async function DELETE(req: Request) {
  try {
    await requireCatalogEditor();
    const body: unknown = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }

    await prisma.precalcCatalogOverride.deleteMany({ where: parsed.data });
    return apiSuccess(null, 'Şablon değerine dönüldü');
  } catch (e: unknown) {
    if (e instanceof AuthError) return apiError(e.message, e.status);
    return apiError('Sunucu hatası', 500);
  }
}
