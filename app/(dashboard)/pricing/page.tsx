import { getPricingDataset } from '@/lib/pricing/loader';
import { prisma } from '@/lib/prisma';
import PricingClient from './PricingClient';
import CustomCatalogManager, { type CustomItem } from './CustomCatalogManager';

export default async function PricingPage() {
  const dataset = getPricingDataset();
  const custom = await prisma.customCatalogItem.findMany({ orderBy: { createdAt: 'desc' } });
  const customItems: CustomItem[] = custom.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    standard: c.standard,
    size: c.size,
    listPrice: c.listPrice,
    discount: c.discount,
  }));

  return (
    <div className="max-w-7xl">
      <CustomCatalogManager initialItems={customItems} />
      <PricingClient items={dataset.items} meta={dataset.meta} />
    </div>
  );
}
