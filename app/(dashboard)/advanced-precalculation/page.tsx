import { getCatalogDataset } from '@/lib/precalc/catalog';
import AdvancedPrecalculationClient from './AdvancedPrecalculationClient';

/**
 * @param searchParams `?id=` listeden açılan precalculation kaydıdır.
 *   İstemci tarafında useSearchParams yerine buradan geçirilir: kayıt hangi
 *   teklifin düzenlendiğini belirler ve ilk çizimde belli olmalıdır.
 */
export default async function AdvancedPrecalculationPage(
  { searchParams }: { searchParams: Promise<{ id?: string }> },
) {
  // Kalem listesi sunucudan gelir; hesap motorunu gerektiren çalışma kitabı
  // (diğer Excel sayfaları + genel toplamlar) yalnızca istendiğinde indirilir.
  const dataset = getCatalogDataset();
  const { id } = await searchParams;

  return (
    <AdvancedPrecalculationClient
      items={dataset.items}
      meta={dataset.meta}
      docId={id?.trim() || null}
    />
  );
}
