import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import workbook from '@/lib/precalc/workbook.json';
import { getCatalogDataset } from '@/lib/precalc/catalog';
import { resolveOverridesToWorkbookPatches, type CatalogOverrideRecord } from '@/lib/precalc/catalogOverrides';
import { prisma } from '@/lib/prisma';
import type { PrecalcWorkbook } from '@/lib/precalc/types';

/**
 * PRECALCULATION çalışma kitabını istemciye verir.
 *
 * Dosya büyük (~3,6 MB, gzip ile ~640 KB) ama derleme anında sabittir;
 * bir kez indirilip tarayıcıda önbelleğe alınır. Hesaplar istemcide
 * çalıştığı için her miktar değişikliğinde sunucuya gidilmez.
 *
 * Admin katalog düzeltmeleri (bkz. /api/precalc/catalog-overrides), her
 * isteğe bu noktada bindirilir: yalnızca ilgili hücrenin statik değeri
 * değişir (workbook.json dosyası asla yazılmaz), formül hücreleri hiç
 * dokunulmaz. Motorun kendi önceliği (kullanıcı girdisi > statik değer >
 * formül) korunur — bir kullanıcının kendi teklifine girdiği fiyat, kataloğa
 * yapılan düzeltmeden her zaman üstündür.
 */
export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  const overrideRows = await prisma.precalcCatalogOverride.findMany({
    select: { catalogKey: true, field: true, value: true },
  });
  const overrides = overrideRows as unknown as CatalogOverrideRecord[];

  let body: unknown = workbook;
  if (overrides.length > 0) {
    const { items } = getCatalogDataset();
    const patches = resolveOverridesToWorkbookPatches(items, overrides);
    if (patches.length > 0) {
      // Yalnızca ilgili sayfanın v-haritası kopyalanır; geri kalan (formüller,
      // diğer sayfalar) aynı referansı paylaşır — büyük dosyayı elden
      // geçirmeden ucuz bir kısmi kopya.
      const wb = workbook as unknown as PrecalcWorkbook;
      const patched: PrecalcWorkbook = {
        ...wb,
        sheets: {
          ...wb.sheets,
          PRECALCULATION: {
            ...wb.sheets.PRECALCULATION,
            v: { ...wb.sheets.PRECALCULATION.v },
          },
        },
      };
      for (const p of patches) patched.sheets.PRECALCULATION.v[p.addr] = p.value;
      body = patched;
    }
  }

  return new NextResponse(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Katalog düzeltmeleri her istekte bindirildiği için artık uzun süre
      // önbelleklenemez — düzeltilen fiyat bir sonraki açılışta görünmeli.
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    },
  });
}
