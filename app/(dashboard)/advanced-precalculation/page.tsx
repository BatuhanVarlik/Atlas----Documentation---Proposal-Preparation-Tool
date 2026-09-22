import { getCatalogDataset } from '@/lib/precalc/catalog';
import { applyCatalogOverridesToItems, type CatalogOverrideRecord } from '@/lib/precalc/catalogOverrides';
import { getSession } from '@/lib/auth-middleware';
import { canEditCatalog } from '@/lib/precalc/catalogPermission';
import { prisma } from '@/lib/prisma';
import AdvancedPrecalculationClient from './AdvancedPrecalculationClient';
import StartGate from './StartGate';

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

  const [user, overrideRows] = await Promise.all([
    getSession(),
    prisma.precalcCatalogOverride.findMany({ select: { catalogKey: true, field: true, value: true } }),
  ]);
  const overrides = overrideRows as unknown as CatalogOverrideRecord[];
  // Katalog düzeltmeleri burada, okuma anında bindirilir — üretilen catalog.json
  // hiçbir zaman değişmez (bkz. lib/precalc/catalogOverrides.ts).
  const items = applyCatalogOverridesToItems(dataset.items, overrides).items;
  const docId = id?.trim() || null;
  const canEdit = user ? await canEditCatalog(user) : false;
  // Yalnızca revizyon diyaloğunun önizleme metninde kullanılır — kaydedilen
  // asıl revizyon notunu sunucu kendi bildiği kullanıcı adıyla yazar.
  const userName = user?.name ?? 'bilinmiyor';

  // "Katalog Düzelt" paneli kendi düzeltme birleştirmesini ŞABLON (henüz
  // düzeltme uygulanmamış) kalemlerden yapmalı — üstteki `items` (zaten
  // bindirilmiş) üzerinden tekrar birleştirmek, techSpec gibi bileşik-anahtar
  // alanları düzeltilmişken anahtarı kaydırır.
  const rawCatalogItems = dataset.items;

  // `?id=` ile belirli bir kayıt açılıyorsa direkt o kayıt açılır — 2 butonlu
  // karşılama ekranı yalnızca çıplak URL'de (StartGate) gösterilir.
  if (docId) {
    return (
      <AdvancedPrecalculationClient
        items={items}
        rawCatalogItems={rawCatalogItems}
        meta={dataset.meta}
        docId={docId}
        canEditCatalog={canEdit}
        userName={userName}
      />
    );
  }

  return (
    <StartGate
      items={items}
      rawCatalogItems={rawCatalogItems}
      meta={dataset.meta}
      canEditCatalog={canEdit}
      userName={userName}
    />
  );
}
