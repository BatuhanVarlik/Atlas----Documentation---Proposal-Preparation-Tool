import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ModulesClient from './ModulesClient';

export default async function ModulesPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const where =
    user.role === 'ADMIN'
      ? {}
      : user.role === 'DEPARTMENT_MANAGER'
        ? { creator: { departmentId: user.departmentId } }
        : { creatorId: user.id };

  const modules = await prisma.module.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { tanks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return <ModulesClient initialModules={modules} userRole={user.role} userId={user.id} />;
}
