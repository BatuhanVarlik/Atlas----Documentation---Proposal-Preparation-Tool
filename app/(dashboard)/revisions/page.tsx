import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';

export default async function RevisionsListPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const where =
    user.role === 'MEMBER' ? { creatorId: user.id } : {};

  const modules = await prisma.module.findMany({
    where,
    select: {
      id: true,
      name: true,
      customerName: true,
      projectCode: true,
      updatedAt: true,
      creator: { select: { name: true } },
      _count: { select: { revisions: true } },
      revisions: {
        select: { label: true, createdAt: true },
        orderBy: { revisionNumber: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Revizyon Geçmişi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bir modülün geçmiş revizyonlarını görüntülemek için tıklayın.
          </p>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400">
          Henüz modül yok.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Modül</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Müşteri</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Proje Kodu</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Son Revizyon</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Revizyon Sayısı</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Güncellendi</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => {
                const last = m.revisions[0];
                return (
                  <tr key={m.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/revisions/${m.id}`}
                        className="font-medium text-slate-800 hover:text-blue-700"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{m.customerName ?? '—'}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-xs">{m.projectCode ?? '—'}</td>
                    <td className="py-3 px-4 text-slate-700 font-mono text-xs">
                      {last?.label ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{m._count.revisions}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(m.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
