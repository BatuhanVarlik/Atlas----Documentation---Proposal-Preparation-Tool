// Ortak DB'deki kullanıcıyı YEREL User aynasına yansıtır (domain FK'leri için).
// Kimlik/şifre/title ortak DB'den gelir; yetki (role) yerelde yönetilir. E-posta ile eşlenir.
import { prisma } from '@/lib/prisma';
import type { SharedUser } from '@/lib/shared-users';
import type { Department, User } from '@prisma/client';

export type LocalUserWithDept = User & { department: Department };

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
      role: 'MEMBER',
      title: shared.title,
      departmentId: fallbackDept.id,
      isActive: shared.isActive,
      mustChangePassword: false,
    },
    include: { department: true },
  });
}
