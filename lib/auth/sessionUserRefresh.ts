import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSharedUserByEmail } from '@/lib/shared-users';
import { syncLocalUser } from '@/lib/user-sync';

/**
 * Oturumdaki kullanıcının GÜNCEL durumu — en fazla REFRESH_INTERVAL_MS'de bir tazelenir.
 * (Chronos'taki lib/auth/sessionUserRefresh.ts ile aynı sistem — tüm uygulamalarda ortak.)
 *
 * Neden: Portal'dan yapılan değişiklikler (pasifleştirme, rol, departman…) yalnızca ortak DB'ye
 * yazılır; bu uygulama ise yetkiyi yerel aynadan ve JWT'ye gömülü alanlardan okur. Eskiden ikisi
 * de yalnızca girişte güncellendiğinden, 30 günlük oturumu olan biri değişikliği günlerce görmüyordu.
 *
 * lib/auth.ts'teki jwt callback'i bunu HER oturum okumasında (sayfa + API) çağırır:
 *   · isActive=false → oturum geçersiz sayılır (session callback boş döner → 401 / giriş).
 *   · rol / departman → token'a yazılır; yeniden giriş gerekmez.
 *
 * Ortak DB erişilemezse yerel ayna okunur (sayfa düşmez); yerel DB de okunamazsa önceki görüntü,
 * o da yoksa null döner (çağıran token'ı olduğu gibi bırakır).
 * Bellek içi önbellek süreç başınadır (PM2'de birden çok süreç varsa her biri ayrı sayar) — zararsız.
 */
export const REFRESH_INTERVAL_MS = 60_000;

export interface SessionUserSnapshot {
  isActive: boolean;
  role: Role;
  departmentId: string;
  departmentName: string;
}

const cache = new Map<string, { at: number; snap: SessionUserSnapshot | null }>();
const inFlight = new Map<string, Promise<SessionUserSnapshot | null>>();

async function readLocalSnapshot(userId: string): Promise<SessionUserSnapshot | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, departmentId: true, department: { select: { name: true } } },
  });
  if (!u) return null;
  return { isActive: u.isActive, role: u.role, departmentId: u.departmentId, departmentName: u.department.name };
}

export async function getFreshSessionUser(
  userId: string,
  now: number = Date.now()
): Promise<SessionUserSnapshot | null> {
  const cached = cache.get(userId);
  if (cached && now - cached.at < REFRESH_INTERVAL_MS) return cached.snap;

  // Aynı kullanıcının eşzamanlı istekleri (sayfa + API'ler, birkaç sekme) tek tazelemeyi paylaşır
  const running = inFlight.get(userId);
  if (running) return running;

  const task = (async () => {
    try {
      // 1) Ortak DB → yerel ayna. Hata, yerel aynayla devam etmeyi engellemez.
      try {
        const local = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        const shared = local?.email ? await getSharedUserByEmail(local.email) : null;
        if (shared) await syncLocalUser(shared); // ortak DB'de yoksa yerel kayda dokunma
      } catch (err) {
        console.warn('[sessionUserRefresh] ortak DB senkronu başarısız:', err instanceof Error ? err.message : err);
      }

      // 2) Yerel aynadan anlık görüntü
      let snap: SessionUserSnapshot | null;
      try {
        snap = await readLocalSnapshot(userId);
      } catch (err) {
        console.warn('[sessionUserRefresh] yerel kullanıcı okunamadı:', err instanceof Error ? err.message : err);
        snap = cached?.snap ?? null;
      }
      // Başarısız denemede de damga basılır → DB kapalıyken her istek bağlantı zaman aşımı beklemesin
      cache.set(userId, { at: now, snap });
      return snap;
    } finally {
      inFlight.delete(userId);
    }
  })();
  inFlight.set(userId, task);
  return task;
}

/** Yalnızca testler için: bellek içi durumu sıfırlar. */
export function __resetSessionUserRefreshForTests(): void {
  cache.clear();
  inFlight.clear();
}
