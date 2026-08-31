import { prisma } from '@/lib/prisma';
import AdvancedPrecalculationListsClient, { type SavedRow } from './AdvancedPrecalculationListsClient';

/** Oluşturulan precalculation'ların listesi. */
export default async function AdvancedPrecalculationListsPage() {
  const rows = await prisma.savedPrecalculation.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      precalcNo: true,
      projectNo: true,
      customer: true,
      endUser: true,
      preparedBy: true,
      sourceFile: true,
      currency: true,
      totalCost: true,
      totalSales: true,
      entryCount: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });

  const items: SavedRow[] = rows.map((r) => ({
    ...r,
    createdBy: r.createdBy?.name ?? '',
    updatedBy: r.updatedBy?.name ?? '',
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return <AdvancedPrecalculationListsClient items={items} />;
}
