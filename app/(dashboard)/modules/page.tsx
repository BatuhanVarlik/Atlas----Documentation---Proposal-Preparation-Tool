import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ModulesClient, { type UnifiedModule } from './ModulesClient';

export default async function ModulesPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const where = user.role === 'MEMBER' ? { creatorId: user.id } : {};

  const [storageModules, milkReceptionModules, cipModules] = await Promise.all([
    prisma.module.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { tanks: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.milkReceptionModule.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { receptionLines: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cipModule.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const unified: UnifiedModule[] = [
    ...storageModules.map((m) => ({
      id: m.id,
      type: 'STORAGE' as const,
      name: m.name,
      customerName: m.customerName,
      projectCode: m.projectCode,
      standard: m.standard,
      productType: m.productType as string | null,
      status: m.status,
      childCount: m._count.tanks,
      childLabel: 'Tank',
      creator: m.creator,
      createdAt: m.createdAt,
    })),
    ...milkReceptionModules.map((m) => ({
      id: m.id,
      type: 'MILK_RECEPTION' as const,
      name: m.name,
      customerName: m.customerName,
      projectCode: m.projectCode,
      standard: m.standard,
      productType: null,
      status: m.status,
      childCount: m._count.receptionLines,
      childLabel: 'Hat',
      creator: m.creator,
      createdAt: m.createdAt,
    })),
    ...cipModules.map((m) => ({
      id: m.id,
      type: 'CIP' as const,
      name: m.name,
      customerName: m.customerName,
      projectCode: m.projectCode,
      standard: m.standard,
      productType: null,
      status: m.status,
      childCount: m._count.lines,
      childLabel: 'Hat',
      creator: m.creator,
      createdAt: m.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return <ModulesClient initialModules={unified} userRole={user.role} userId={user.id} />;
}
