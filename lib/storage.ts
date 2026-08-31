/**
 * Kullanıcı verisinin diskteki yeri.
 *
 * Şablonlar ve üretilen belgeler eskiden `public/uploads/` altındaydı; Next.js
 * `public/` içindeki her şeyi kimlik doğrulaması olmadan statik olarak yayınlar,
 * yani dosya adını bilen herkes indirebiliyordu. Bu yüzden hepsi `public/`
 * dışına, yalnızca sunucunun okuduğu bir klasöre alındı. İndirme işlemleri
 * zaten oturum kontrolü yapan API route'ları üzerinden yürüyor.
 */
import path from 'path';
import { mkdir } from 'fs/promises';

/** Veri kökü. Sunucuda başka bir diske almak için ATLAS_DATA_DIR verilebilir. */
export const DATA_ROOT = process.env.ATLAS_DATA_DIR
  ? path.resolve(process.env.ATLAS_DATA_DIR)
  : path.join(process.cwd(), 'data');

/** Yüklenen .docx şablonları. */
export const TEMPLATES_DIR = path.join(DATA_ROOT, 'templates');
/** Modüllerden üretilen belgeler. */
export const GENERATED_DIR = path.join(DATA_ROOT, 'generated');

/**
 * Veritabanındaki `filepath` değerini diskteki mutlak yola çevirir.
 *
 * Eski kayıtlar "/uploads/templates/x.docx" biçiminde; yeni kayıtlar
 * "templates/x.docx". İkisi de aynı köke çözülür, bu yüzden veritabanında
 * göç gerekmez.
 *
 * Yol her zaman veri kökünün içinde kalır: kayıtlı değer ".." içerse bile
 * dışarı çıkamaz.
 */
export function resolveDataPath(filepath: string): string {
  const rel = filepath
    .split(path.win32.sep).join('/')
    .replace(/^\/?uploads\//i, '')
    .replace(/^\/+/, '');
  const abs = path.resolve(DATA_ROOT, rel);
  if (abs !== DATA_ROOT && !abs.startsWith(DATA_ROOT + path.sep)) {
    throw new Error('Geçersiz dosya yolu: ' + filepath);
  }
  return abs;
}

/** Klasörü (yoksa) oluşturur; yazma işlemlerinden önce çağrılır. */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}
