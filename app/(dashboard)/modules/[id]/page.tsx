import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ModuleDetailClient from './ModuleDetailClient';

type Props = { params: Promise<{ id: string }> };

export default async function ModuleDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const moduleData = await prisma.module.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      valveCluster: {
        include: {
          fillingLines: { orderBy: { order: 'asc' } },
          dischargeLines: { orderBy: { order: 'asc' } },
        },
      },
      tanks: { orderBy: { order: 'asc' } },
    },
  });

  if (!moduleData) notFound();

  if (user.role === 'MEMBER' && moduleData.creatorId !== user.id) {
    notFound();
  }

  return (
    <ModuleDetailClient
      module={moduleData}
      userRole={user.role}
      userId={user.id}
    />
  );
}
