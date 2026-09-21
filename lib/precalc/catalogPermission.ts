/** Advanced Precalculation kataloğunu düzenleme yetkisi. */
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthError, type SessionUser } from '@/lib/auth-middleware';

/** ADMIN/CEO her zaman düzenleyebilir; diğerleri yalnızca admin bu yetkiyi açtıysa. */
export async function canEditCatalog(user: SessionUser): Promise<boolean> {
  if (user.role === 'ADMIN' || user.role === 'CEO') return true;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { canEditPrecalcCatalog: true },
  });
  return row?.canEditPrecalcCatalog ?? false;
}

/** Oturum + katalog düzenleme yetkisini birlikte denetler; yetkisizse 401/403 fırlatır. */
export async function requireCatalogEditor(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!(await canEditCatalog(user))) {
    throw new AuthError('Katalog düzenleme yetkiniz yok', 403);
  }
  return user;
}
