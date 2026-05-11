import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProjectsClient from './ProjectsClient';

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const where =
    user.role === 'ADMIN'
      ? {}
      : { departmentId: user.departmentId };

  const [projects, departments] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, color: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <ProjectsClient
      initialProjects={projects}
      departments={departments}
      userRole={user.role}
      userDepartmentId={user.departmentId}
    />
  );
}
