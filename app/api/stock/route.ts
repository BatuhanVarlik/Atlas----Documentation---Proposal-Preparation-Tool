import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { lookupStock, isStockConfigured } from '@/lib/stock/sqlServer';

/**
 * Ekipman numaralarının depo bakiyesi ve asgari stok bilgisi.
 *
 * Tarayıcı SQL Server'a ulaşamaz; sorgu sunucuda çalışır. Bağlantı
 * yapılandırılmamışsa ya da sunucuya erişilemiyorsa boş sonuç döner —
 * çağıran taraf teklifi yine üretebilsin diye hata fırlatılmaz.
 */
export async function POST(req: Request) {
  try {
    await requireAuth();

    const body: unknown = await req.json();
    const raw = (body as { equipmentNumbers?: unknown })?.equipmentNumbers;
    if (!Array.isArray(raw)) return apiError('equipmentNumbers dizisi gerekli');

    const codes = raw.filter((v): v is string => typeof v === 'string');
    if (codes.length > 5000) return apiError('En fazla 5000 ekipman numarası sorgulanabilir');

    if (!isStockConfigured()) {
      return apiSuccess({ configured: false, stock: {} }, 'Stok bağlantısı yapılandırılmamış');
    }

    try {
      const stock = await lookupStock(codes);
      return apiSuccess({ configured: true, stock });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'bilinmeyen hata';
      console.error('Stok sorgusu başarısız:', message);
      return apiSuccess({ configured: true, stock: {}, error: message }, 'Stok bilgisi alınamadı');
    }
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
