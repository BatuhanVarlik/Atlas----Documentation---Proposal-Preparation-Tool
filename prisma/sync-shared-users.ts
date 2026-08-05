/**
 * Ortak DB → Yerel ayna TOPLU SENKRON scripti (tek seferlik / manuel çalıştırma).
 *
 * Çalıştırma (proje kökünde):
 *   npx tsx prisma/sync-shared-users.ts
 *   # veya
 *   npm run db:sync-users
 *
 * Ne yapar: Ortak Kullanıcılar DB'sindeki (Docker, port 5440) TÜM kullanıcıları
 * bu uygulamanın yerel `User` aynasına yazar. Başka bir uygulamada (Chronos/PYU)
 * oluşturulmuş ama Atlas'a hiç giriş yapmamış kullanıcıları da getirir; böylece
 * Kullanıcılar ekranındaki sayı ortak DB ile eşitlenir.
 *
 * Not: Atlas'ta Kullanıcılar sayfası her açılışta toplu senkron YAPMAZ; yalnızca
 * login/SSO'da tekil senkron olur (lib/user-sync.ts → syncLocalUser). Bu script,
 * sayfayı açmadan sunucuda elle tetiklemek için bir kolaylıktır. Yetki (role)
 * yerelde MEMBER olarak başlar; mevcut kullanıcıların rolü KORUNUR.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { config } from 'dotenv';

// .env.local önce (asıl), .env fallback.
config({ path: '.env.local' });
config({ path: '.env' });

const localPool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(localPool);
const prisma = new PrismaClient({ adapter });

const sharedPool = new Pool({ connectionString: process.env.SHARED_USERS_DATABASE_URL });

interface SharedRow {
  email: string;
  name: string;
  title: string | null;
  departmentName: string | null;
  isActive: boolean;
}

async function main() {
  if (!process.env.SHARED_USERS_DATABASE_URL) {
    throw new Error('SHARED_USERS_DATABASE_URL tanımlı değil (.env.local / .env).');
  }

  const { rows: shared } = await sharedPool.query<SharedRow>(
    `SELECT email, name, title, department_name AS "departmentName", is_active AS "isActive"
     FROM users ORDER BY name ASC`
  );
  console.log(`Ortak DB'de ${shared.length} kullanıcı bulundu.`);

  const [departments, localUsers] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, title: true, isActive: true, departmentId: true },
    }),
  ]);
  if (departments.length === 0) {
    throw new Error('Yerel departman bulunamadı; ayna senkronu yapılamadı.');
  }

  const deptIdByName = new Map(departments.map((d) => [d.name, d.id]));
  const fallbackDeptId = departments[0].id;
  const localByEmail = new Map(localUsers.map((u) => [u.email.toLowerCase(), u]));

  let created = 0;
  let updated = 0;

  for (const s of shared) {
    const matchedDeptId = s.departmentName ? deptIdByName.get(s.departmentName) : undefined;
    const existing = localByEmail.get(s.email.toLowerCase());

    if (!existing) {
      await prisma.user.create({
        data: {
          name: s.name,
          email: s.email,
          password: '', // yerel şifre kullanılmaz — kimlik doğrulama ortak DB'de
          role: 'MEMBER',
          title: s.title,
          departmentId: matchedDeptId ?? fallbackDeptId,
          isActive: s.isActive,
          mustChangePassword: false,
        },
      });
      created++;
      console.log(`  + oluşturuldu: ${s.email}`);
      continue;
    }

    const nextTitle = s.title ?? existing.title;
    const nextDeptId = matchedDeptId ?? existing.departmentId;
    if (
      existing.name !== s.name ||
      existing.title !== nextTitle ||
      existing.isActive !== s.isActive ||
      existing.departmentId !== nextDeptId
    ) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: s.name, title: nextTitle, isActive: s.isActive, departmentId: nextDeptId },
      });
      updated++;
      console.log(`  ~ güncellendi: ${s.email}`);
    }
  }

  console.log(
    `\n✔ Tamamlandı — oluşturulan: ${created}, güncellenen: ${updated}, değişmeyen: ${
      shared.length - created - updated
    }`
  );
}

main()
  .catch((e) => {
    console.error('Senkron hatası:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await sharedPool.end();
    await localPool.end();
  });
