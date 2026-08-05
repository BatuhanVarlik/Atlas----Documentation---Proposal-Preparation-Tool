// Ortak DB'deki kullanıcıyı YEREL User aynasına yansıtır (domain FK'leri için).
// Kimlik/şifre/title/ROL ortak DB'den gelir (tek doğruluk kaynağı). E-posta ile eşlenir.
// Rol seti tüm uygulamalarda ortaktır (bkz. lib/roles.ts).
import { prisma } from '@/lib/prisma';
import { listAllSharedUsers, type SharedUser } from '@/lib/shared-users';
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

/**
 * Ortak DB'deki TÜM kullanıcıları yerel aynaya toplu yansıtır.
 * Login'i beklemeden Kullanıcılar sayfasının ortak DB ile eşit olmasını sağlar
 * (başka bir uygulamada — Chronos/PYU — oluşturulan kullanıcılar Atlas'ta da görünür).
 * Kimlik + ROL ortak DB'den otoriter yansıtılır; yalnızca değişen alanlar yazılır.
 * (Atlas'ta yönetici ilişkisi yoktur — o geçiş yapılmaz.)
 */
export async function syncAllLocalUsers(): Promise<{ created: number; updated: number }> {
  const shared = await listAllSharedUsers();
  if (shared.length === 0) return { created: 0, updated: 0 };

  const [departments, localUsers] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, title: true, role: true, isActive: true, departmentId: true },
    }),
  ]);
  if (departments.length === 0) {
    throw new Error('Yerel departman bulunamadı; ayna senkronu yapılamadı.');
  }

  const deptIdByName = new Map(departments.map((d) => [d.name, d.id]));
  const fallbackDeptId = departments[0].id;
  const localByEmail = new Map(localUsers.map((u) => [u.email.toLowerCase(), u]));

  let created = 0;
  let updated = 0;

  for (const s of shared) {
    const matchedDeptId = s.departmentName ? deptIdByName.get(s.departmentName) : undefined;
    const existing = localByEmail.get(s.email.toLowerCase());

    if (!existing) {
      await prisma.user.create({
        data: {
          name: s.name,
          email: s.email,
          password: '', // yerel şifre kullanılmaz — kimlik doğrulama ortak DB'de
          role: resolveRole(s.role),
          title: s.title,
          departmentId: matchedDeptId ?? fallbackDeptId,
          isActive: s.isActive,
          mustChangePassword: false,
        },
      });
      created++;
      continue;
    }

    // Departman eşleşmezse mevcut değeri koru (syncLocalUser ile aynı davranış).
    const nextTitle = s.title ?? existing.title;
    const nextDeptId = matchedDeptId ?? existing.departmentId;
    const nextRole = resolveRole(s.role, existing.role);
    if (
      existing.name !== s.name ||
      existing.title !== nextTitle ||
      existing.role !== nextRole ||
      existing.isActive !== s.isActive ||
      existing.departmentId !== nextDeptId
    ) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: s.name, title: nextTitle, role: nextRole, isActive: s.isActive, departmentId: nextDeptId },
      });
      updated++;
    }
  }

  return { created, updated };
}
