import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listPendingResetRequests } from '@/lib/shared-users';
import { syncAllLocalUsers } from '@/lib/user-sync';
import UsersClient from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const isAdmin = ['ADMIN', 'CEO'].includes(session.user.role);

  // Ortak DB (tek doğruluk kaynağı) ile yerel aynayı eşitle: başka uygulamalarda
  // (Chronos/PYU) oluşturulan kullanıcılar login'i beklemeden burada da görünsün.
  // Ortak DB erişilemezse sayfayı düşürme — eldeki yerel listeyle devam et.
  try {
    await syncAllLocalUsers();
  } catch (err) {
    console.error('[users] Ortak DB ayna senkronu başarısız:', err);
  }

  const [users, departments, pendingResets] = await Promise.all([
    prisma.user.findMany({
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
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    // Şifre sıfırlama talepleri ORTAK DB'de tutulur.
    isAdmin ? listPendingResetRequests() : Promise.resolve([]),
  ]);

  const resetRequests = pendingResets.map((r) => ({
    id: r.id,
    requestedAt: r.createdAt,
    status: 'PENDING' as const,
    user: { id: r.userId, name: r.name, email: r.email, department: { name: r.departmentName ?? '—' } },
  }));

  return (
    <UsersClient
      currentUserId={session.user.id}
      isAdmin={isAdmin}
      initialUsers={users}
      departments={departments}
      initialResetRequests={resetRequests}
    />
  );
}
