import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole, requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { upsertSharedUser } from '@/lib/shared-users';
import { ROLES } from '@/lib/roles';

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  departmentId: z.string().cuid(),
  role: z.enum(ROLES).default('MEMBER'),
});

export async function GET() {
  try {
    await requireAuth();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        department: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(users);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(['ADMIN', 'CEO']);
    const body: unknown = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400, parsed.error.flatten());
    }

    const { name, email, password, departmentId, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return apiError('Bu e-posta ile kayıtlı kullanıcı zaten var', 409);

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) return apiError('Departman bulunamadı', 404);

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, departmentId, role },
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

    // ORTAK DB'ye de yaz → kullanıcı tüm uygulamalarda bu giriş bilgisiyle erişir.
    await upsertSharedUser({
      email,
      name,
      departmentName: dept.name,
      role,
      defaultPassword: password,
    });

    return apiSuccess(user, 'Kullanıcı oluşturuldu', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
