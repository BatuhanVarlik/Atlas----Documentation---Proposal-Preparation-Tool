import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
    isAdmin
      ? prisma.passwordResetRequest.findMany({
          where: { status: 'PENDING' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { requestedAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  return (
    <UsersClient
      currentUserId={session.user.id}
      isAdmin={isAdmin}
      initialUsers={users}
      departments={departments}
      initialResetRequests={pendingResets}
    />
  );
}
