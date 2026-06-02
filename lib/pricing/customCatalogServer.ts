import { prisma } from '@/lib/prisma';
import { customToPricingItem } from './customCatalog';
import type { PricingItem } from './loader';

/** Özel kataloğu DB'den okuyup fiyatlandırma motorunun kullanacağı PricingItem listesine çevirir. */
export async function getCustomPricingItems(): Promise<PricingItem[]> {
  const items = await prisma.customCatalogItem.findMany();
  return items.map(customToPricingItem);
}
