import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listPendingResetRequests } from '@/lib/shared-users';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const isAdmin = session.user.role === 'ADMIN';

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
