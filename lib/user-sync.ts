// Ortak DB'deki kullanıcıyı YEREL User aynasına yansıtır (domain FK'leri için).
// Kimlik/şifre/title/ROL ortak DB'den gelir (tek doğruluk kaynağı). E-posta ile eşlenir.
// Rol seti tüm uygulamalarda ortaktır (bkz. lib/roles.ts).
import { prisma } from '@/lib/prisma';
import type { SharedUser } from '@/lib/shared-users';
import { ROLES } from '@/lib/roles';
import type { Department, User, Role } from '@prisma/client';

export type LocalUserWithDept = User & { department: Department };

const VALID_ROLES = new Set<string>(ROLES);

/** Ortak roldan geçerli yerel rolü seçer; geçersiz/boşsa mevcut rolü, o da yoksa MEMBER. */
function resolveRole(sharedRole: string | null, existingRole?: string): Role {
  if (sharedRole && VALID_ROLES.has(sharedRole)) return sharedRole as Role;
  return (existingRole ?? 'MEMBER') as Role;
}

export async function syncLocalUser(shared: SharedUser): Promise<LocalUserWithDept> {
  const dept = shared.departmentName
    ? await prisma.department.findUnique({ where: { name: shared.departmentName } })
    : null;

  const existing = await prisma.user.findUnique({
    where: { email: shared.email },
    include: { department: true },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: shared.name,
        title: shared.title ?? existing.title,
        role: resolveRole(shared.role, existing.role),
        isActive: shared.isActive,
        ...(dept ? { departmentId: dept.id } : {}),
      },
      include: { department: true },
    });
  }

  const fallbackDept = dept ?? (await prisma.department.findFirst());
  if (!fallbackDept) throw new Error('Yerel departman bulunamadı; ayna kaydı oluşturulamadı.');

  return prisma.user.create({
    data: {
      name: shared.name,
      email: shared.email,
      password: '', // yerel şifre kullanılmaz — kimlik doğrulama ortak DB'de
      role: resolveRole(shared.role),
      title: shared.title,
      departmentId: fallbackDept.id,
      isActive: shared.isActive,
      mustChangePassword: false,
    },
    include: { department: true },
  });
}
