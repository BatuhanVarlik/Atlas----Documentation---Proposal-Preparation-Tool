import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const [projectCount, moduleCount] = await Promise.all([
    prisma.project.count({ where: { status: 'ACTIVE' } }),
    prisma.module.count({ where: { status: { in: ['DRAFT', 'IN_PROGRESS', 'REVIEW'] } } }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Hoş geldiniz, {session?.user?.name}
        </h1>
        <p className="text-slate-500 mt-1">APV Hemisan Dokümantasyon Aracı</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500 font-medium">Aktif Projeler</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{projectCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500 font-medium">Devam Eden Modüller</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{moduleCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500 font-medium">Bekleyen Onaylar</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">0</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Son Aktiviteler</h2>
        <p className="text-sm text-slate-400">Henüz aktivite yok.</p>
      </div>
    </div>
  );
}
