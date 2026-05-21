import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import MilkReceptionDetailClient from './MilkReceptionDetailClient';

type Props = { params: Promise<{ id: string }> };

export default async function MilkReceptionDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const mod = await prisma.milkReceptionModule.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      receptionLines: { orderBy: { order: 'asc' } },
    },
  });
  if (!mod) notFound();
  if (user.role === 'MEMBER' && mod.creatorId !== user.id) notFound();

  return <MilkReceptionDetailClient module={mod} userRole={user.role} userId={user.id} />;
}
