/**
 * Depo bakiyesi ve asgari stok sorgusu (HEMİSAN AS SQL Server).
 *
 * Excel'deki makro her satır için üç ayrı sorgu açıyordu; yüzlerce kalemde bu
 * yüzlerce gidiş-geliş demek. Burada aynı üç sorgu küme hâlinde bir kez
 * çalışır, sonuç ekipman numarasına göre eşlenir.
 *
 * Bağlantı bilgileri ortam değişkenlerinden gelir; hiçbiri kodda durmaz:
 *   HEMISAN_SQL_SERVER    192.168.35.10
 *   HEMISAN_SQL_DATABASE  HEMISANAS2026
 *   HEMISAN_SQL_USER
 *   HEMISAN_SQL_PASSWORD
 *   HEMISAN_SQL_PORT      (varsayılan 1433)
 *   HEMISAN_SQL_ENCRYPT   'true' ise şifreli bağlanır (varsayılan false — yerel ağ)
 *
 * Yapılandırma eksikse ya da sunucuya ulaşılamazsa sorgu boş döner: stok
 * sütunları boş kalır ama teklif çıktısı yine üretilir.
 */

import sql from 'mssql';

export interface StockInfo {
  /** Depo 1'deki net bakiye (giriş - çıkış). */
  depoBakiye: number;
  /** Kart üzerindeki asgari stok. */
  asgariStok: number;
}

/** Ekipman numarası -> stok bilgisi. */
export type StockMap = Record<string, StockInfo>;

export function isStockConfigured(): boolean {
  return !!(process.env.HEMISAN_SQL_SERVER && process.env.HEMISAN_SQL_DATABASE
    && process.env.HEMISAN_SQL_USER && process.env.HEMISAN_SQL_PASSWORD);
}

function config(): sql.config {
  return {
    server: process.env.HEMISAN_SQL_SERVER as string,
    database: process.env.HEMISAN_SQL_DATABASE as string,
    user: process.env.HEMISAN_SQL_USER as string,
    password: process.env.HEMISAN_SQL_PASSWORD as string,
    port: Number(process.env.HEMISAN_SQL_PORT ?? 1433),
    options: {
      // Yerel ağdaki eski sunucu genelde şifresiz; sertifika da kendinden imzalı.
      encrypt: process.env.HEMISAN_SQL_ENCRYPT === 'true',
      trustServerCertificate: true,
    },
    requestTimeout: 60_000,
    connectionTimeout: 15_000,
    pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
  };
}

/** Havuz süreç boyunca paylaşılır; her istekte yeniden bağlanmak pahalı. */
let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config()).connect().catch((e) => {
      poolPromise = null;   // başarısız havuzu önbellekte tutma
      throw e;
    });
  }
  return poolPromise;
}

/**
 * Parametreli IN listesi kurar: değerler sorgu metnine gömülmez.
 * (Makro değerleri doğrudan metne yazıyordu — tırnak içeren bir ekipman
 * numarası sorguyu bozar ya da enjeksiyona açar.)
 */
function bindList(req: sql.Request, values: string[], prefix: string): string {
  return values.map((v, i) => {
    const name = `${prefix}${i}`;
    req.input(name, sql.NVarChar, v);
    return `@${name}`;
  }).join(',');
}

/** SQL Server'ın parametre sınırı 2100; güvenli bir paket boyu seçilir. */
const CHUNK = 500;

export async function lookupStock(equipmentNumbers: string[]): Promise<StockMap> {
  const codes = [...new Set(equipmentNumbers.map((s) => s.trim()).filter(Boolean))];
  if (codes.length === 0 || !isStockConfigured()) return {};

  const pool = await getPool();
  const out: StockMap = {};

  for (let i = 0; i < codes.length; i += CHUNK) {
    const batch = codes.slice(i, i + CHUNK);

    // 1) Üretici kodu -> stok kodu
    const r1 = pool.request();
    const list1 = bindList(r1, batch, 'u');
    const map = await r1.query<{ URETICI_KODU: string; STOK_KODU: string }>(
      `SELECT URETICI_KODU, STOK_KODU FROM TBLSTSABIT WHERE URETICI_KODU IN (${list1})`,
    );
    const byStok = new Map<string, string[]>();   // stok kodu -> ekipman numaraları
    for (const row of map.recordset) {
      const code = String(row.STOK_KODU).trim();
      const list = byStok.get(code);
      if (list) list.push(row.URETICI_KODU);
      else byStok.set(code, [row.URETICI_KODU]);
    }
    const stokCodes = [...byStok.keys()];
    if (stokCodes.length === 0) continue;

    // 2) Asgari stok (genel kart: CARI_KOD boş)
    const r2 = pool.request();
    const list2 = bindList(r2, stokCodes, 's');
    const asgari = await r2.query<{ STOK_KODU: string; ASGARI_STOK: number }>(
      `SELECT STOK_KODU, ASGARI_STOK FROM TBLCARISTOK
       WHERE STOK_KODU IN (${list2}) AND CARI_KOD IS NULL`,
    );
    const asgariBy = new Map<string, number>();
    for (const row of asgari.recordset) asgariBy.set(String(row.STOK_KODU).trim(), Number(row.ASGARI_STOK) || 0);

    // 3) Depo  bakiyesi: giriş (G) eksi çıkış
    const r3 = pool.request();
    const list3 = bindList(r3, stokCodes, 'd');
    const bakiye = await r3.query<{ STOK_KODU: string; DEPO_BAKIYE: number }>(
      `SELECT STOK_KODU,
              ISNULL(SUM(CASE WHEN STHAR_GCKOD = 'G' THEN STHAR_GCMIK ELSE -STHAR_GCMIK END), 0) AS DEPO_BAKIYE
       FROM TBLSTHAR
       WHERE STOK_KODU IN (${list3}) AND DEPO_KODU = 3
       GROUP BY STOK_KODU`,
    );
    const bakiyeBy = new Map<string, number>();
    for (const row of bakiye.recordset) bakiyeBy.set(String(row.STOK_KODU).trim(), Number(row.DEPO_BAKIYE) || 0);

    for (const [stok, eqNos] of byStok) {
      for (const eq of eqNos) {
        out[eq] = {
          depoBakiye: bakiyeBy.get(stok) ?? 0,
          asgariStok: asgariBy.get(stok) ?? 0,
        };
      }
    }
  }

  return out;
}
