import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ModuleRevisionsClient from './ModuleRevisionsClient';

type Props = { params: Promise<{ moduleId: string }> };

export default async function ModuleRevisionsPage({ params }: Props) {
  const { moduleId } = await params;
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      name: true,
      customerName: true,
      projectCode: true,
      creatorId: true,
    },
  });
  if (!mod) notFound();
  if (user.role === 'MEMBER' && mod.creatorId !== user.id) notFound();

  const revisions = await prisma.moduleRevision.findMany({
    where: { moduleId },
    orderBy: { revisionNumber: 'desc' },
    select: {
      id: true,
      revisionNumber: true,
      label: true,
      description: true,
      detectedChanges: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Link href="/revisions" className="hover:text-slate-900">Revizyon Geçmişi</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{mod.name}</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{mod.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mod.customerName ?? 'Müşteri belirsiz'}
            {mod.projectCode && <> · <span className="font-mono">{mod.projectCode}</span></>}
          </p>
        </div>
        <Link
          href={`/modules/${mod.id}`}
          className="px-4 py-2 text-sm text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg"
        >
          Modüle Dön
        </Link>
      </div>

      <ModuleRevisionsClient
        moduleId={mod.id}
        revisions={revisions.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
