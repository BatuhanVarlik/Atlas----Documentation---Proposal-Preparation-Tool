import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';
import { upsertSharedUser, adminSetSharedPassword, setSharedUserActive } from '@/lib/shared-users';
import { ROLES } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  departmentId: z.string().cuid().optional(),
  role: z.enum(ROLES).optional(),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: Params) {
  try {
    const admin = await requireRole(['ADMIN', 'CEO']);
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return apiError('Kullanıcı bulunamadı', 404);

    const { password, email, departmentId, ...rest } = parsed.data;

    if (email && email !== target.email) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup) return apiError('Bu e-posta başka bir kullanıcıda var', 409);
    }

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) return apiError('Departman bulunamadı', 404);
    }

    // Adminin kendi rolünü düşürmesi
    if (id === admin.id && parsed.data.role && parsed.data.role !== 'ADMIN') {
      return apiError('Kendi yönetici rolünüzü düşüremezsiniz', 400);
    }
    // Kendini pasifleştirme
    if (id === admin.id && parsed.data.isActive === false) {
      return apiError('Kendinizi pasifleştiremezsiniz', 400);
    }

    const data: Record<string, unknown> = { ...rest };
    if (email) data.email = email;
    if (departmentId) data.departmentId = departmentId;
    if (password) data.password = await bcrypt.hash(password, 12);

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        department: { select: { id: true, name: true, color: true } },
      },
    });

    // ORTAK DB senkronu — ad/departman/rol bilgisi (aktiflik ve şifre korunur).
    await upsertSharedUser({
      email: updated.email,
      name: updated.name,
      departmentName: updated.department.name,
      role: updated.role,
    });
    // Admin yeni şifre atadıysa ortak DB'de de güncelle (ilk girişte değiştirilir).
    if (password) {
      await adminSetSharedPassword(updated.email, password);
    }
    // Aktiflik ORTAK'tır → değiştiyse ortak DB'ye yaz (yoksa sync eski aktifliği yerele geri basar).
    if (parsed.data.isActive !== undefined) {
      await setSharedUserActive(updated.email, parsed.data.isActive);
    }

    return apiSuccess(updated, 'Kullanıcı güncellendi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const admin = await requireRole(['ADMIN', 'CEO']);
    const { id } = await params;
    if (id === admin.id) return apiError('Kendi hesabınızı silemezsiniz', 400);

    const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!target) return apiError('Kullanıcı bulunamadı', 404);

    // Hard-delete YOK: "silme" = ORTAK DB'de pasifleştirme → tüm uygulamalara yayılır.
    // (Hard-delete edilse ayna bir sonraki senkronda geri gelirdi.)
    await setSharedUserActive(target.email, false);
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return apiSuccess(null, 'Kullanıcı pasifleştirildi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
