import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import workbook from '@/lib/precalc/workbook.json';

/**
 * PRECALCULATION çalışma kitabını istemciye verir.
 *
 * Dosya büyük (~3,6 MB, gzip ile ~640 KB) ama derleme anında sabittir;
 * bir kez indirilip tarayıcıda önbelleğe alınır. Hesaplar istemcide
 * çalıştığı için her miktar değişikliğinde sunucuya gidilmez.
 */
export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
  }

  return new NextResponse(JSON.stringify(workbook), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Kaynak Excel değişmedikçe içerik sabit — tarayıcı önbelleğine bırak.
      'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
