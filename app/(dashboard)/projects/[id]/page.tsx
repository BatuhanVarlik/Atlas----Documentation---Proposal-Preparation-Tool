import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProjectDetailClient from './ProjectDetailClient';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true, color: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  if (!project) notFound();

  if (user.role === 'MEMBER' && project.departmentId !== user.departmentId) {
    notFound();
  }

  return (
    <ProjectDetailClient
      project={project}
      userRole={user.role}
      userId={user.id}
    />
  );
}
