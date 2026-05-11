import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import TemplatesClient from './TemplatesClient';

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard');

  const templates = await prisma.documentTemplate.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return <TemplatesClient initialTemplates={templates} />;
}
