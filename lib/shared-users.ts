// Ortak Kullanıcılar DB erişimi (tek doğruluk kaynağı — Docker, port 5440).
// Saf `pg` ile yazıldı; 3 uygulamada da AYNI dosya kullanılır.
// Kimlik doğrulama, şifre değişimi ve şifre sıfırlama talepleri buradan yürür.
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const globalForShared = globalThis as unknown as { sharedUsersPool?: Pool };

function getPool(): Pool {
  if (!globalForShared.sharedUsersPool) {
    const connectionString = process.env.SHARED_USERS_DATABASE_URL;
    if (!connectionString) {
      throw new Error('SHARED_USERS_DATABASE_URL tanımlı değil (ortak kullanıcı DB bağlantısı).');
    }
    globalForShared.sharedUsersPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });
  }
  return globalForShared.sharedUsersPool;
}

export interface SharedUser {
  id: string;
  email: string;
  name: string;
  password: string;
  title: string | null;
  departmentName: string | null;
  role: string | null;
  managerEmail: string | null;
  avatar: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

const SELECT_COLS = `
  id, email, name, password, title,
  department_name AS "departmentName", role, manager_email AS "managerEmail", avatar,
  is_active AS "isActive", must_change_password AS "mustChangePassword"`;

export async function getSharedUserByEmail(email: string): Promise<SharedUser | null> {
  const { rows } = await getPool().query<SharedUser>(
    `SELECT ${SELECT_COLS} FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

/** Ortak DB'deki TÜM kullanıcıları döner (yerel ayna toplu senkronu için). */
export async function listAllSharedUsers(): Promise<SharedUser[]> {
  const { rows } = await getPool().query<SharedUser>(
    `SELECT ${SELECT_COLS} FROM users ORDER BY name ASC`
  );
  return rows;
}

/** Kimlik doğrulama: e-posta + şifre doğruysa kullanıcıyı döner, değilse null. */
export async function verifySharedCredentials(
  email: string,
  password: string
): Promise<SharedUser | null> {
  const user = await getSharedUserByEmail(email);
  if (!user || !user.isActive) return null;
  const ok = await bcrypt.compare(password, user.password);
  return ok ? user : null;
}

export type ChangePasswordResult = 'ok' | 'not_found' | 'bad_current';

/** Kullanıcı kendi şifresini değiştirir (mevcut şifre doğrulanır). İlk-giriş zorunluluğu kalkar. */
export async function changeSharedPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const user = await getSharedUserByEmail(email);
  if (!user || !user.isActive) return 'not_found';
  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) return 'bad_current';
  const hashed = await bcrypt.hash(newPassword, 12);
  await getPool().query(
    `UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2`,
    [hashed, user.id]
  );
  return 'ok';
}

/** Admin tarafından doğrudan şifre atama (ör. kullanıcı yönetimi). İlk-girişte tekrar değiştirmesi istenir. */
export async function adminSetSharedPassword(email: string, newPassword: string): Promise<boolean> {
  const user = await getSharedUserByEmail(email);
  if (!user) return false;
  const hashed = await bcrypt.hash(newPassword, 12);
  await getPool().query(
    `UPDATE users SET password = $1, must_change_password = true, updated_at = now() WHERE id = $2`,
    [hashed, user.id]
  );
  return true;
}

/** "Şifremi unuttum" — admin onaylı talep. E-posta numaralandırmasına karşı sessizce yutar. */
export async function createSharedResetRequest(
  email: string,
  newPassword: string,
  sourceApp: string
): Promise<void> {
  const user = await getSharedUserByEmail(email);
  if (!user || !user.isActive) return;
  const hashed = await bcrypt.hash(newPassword, 12);
  const pool = getPool();
  await pool.query(`DELETE FROM password_reset_requests WHERE user_id = $1 AND status = 'PENDING'`, [
    user.id,
  ]);
  await pool.query(
    `INSERT INTO password_reset_requests (id, user_id, email, new_password, status, source_app)
     VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
    [randomUUID(), user.id, user.email, hashed, sourceApp]
  );
}

export interface PendingResetRequest {
  id: string;
  userId: string;
  email: string;
  name: string;
  departmentName: string | null;
  sourceApp: string | null;
  createdAt: Date;
}

export async function listPendingResetRequests(): Promise<PendingResetRequest[]> {
  const { rows } = await getPool().query<PendingResetRequest>(
    `SELECT r.id, r.user_id AS "userId", r.email, r.source_app AS "sourceApp",
            r.created_at AS "createdAt", u.name, u.department_name AS "departmentName"
     FROM password_reset_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.status = 'PENDING'
     ORDER BY r.created_at DESC`
  );
  return rows;
}

/** Talebi onayla (yeni şifreyi uygula) veya reddet. */
export async function resolveResetRequest(
  id: string,
  action: 'approve' | 'reject',
  resolvedBy: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query<{ user_id: string; new_password: string; status: string }>(
    `SELECT user_id, new_password, status FROM password_reset_requests WHERE id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r || r.status !== 'PENDING') return false;

  if (action === 'approve') {
    await pool.query(
      `UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2`,
      [r.new_password, r.user_id]
    );
    await pool.query(
      `UPDATE password_reset_requests SET status = 'APPROVED', resolved_at = now(), resolved_by = $1 WHERE id = $2`,
      [resolvedBy, id]
    );
  } else {
    await pool.query(
      `UPDATE password_reset_requests SET status = 'REJECTED', resolved_at = now(), resolved_by = $1 WHERE id = $2`,
      [resolvedBy, id]
    );
  }
  return true;
}

/** Ortak DB'de yeni kullanıcı oluştur / güncelle (kullanıcı yönetimi senkronu için). */
export async function upsertSharedUser(params: {
  email: string;
  name: string;
  title?: string | null;
  departmentName?: string | null;
  role?: string | null;
  managerEmail?: string | null;
  isActive?: boolean;
  defaultPassword?: string; // yalnızca yeni kayıtta kullanılır
}): Promise<void> {
  const { email, name, title, departmentName, role, managerEmail, isActive = true, defaultPassword = 'Hemisan1234' } = params;
  const hashed = await bcrypt.hash(defaultPassword, 12);
  await getPool().query(
    // NOT: çakışmada is_active ve password KORUNUR — bir uygulamadaki düzenleme,
    // kullanıcıyı diğer uygulamalarda kilitlemez. Aktiflik için setSharedUserActive kullanılır.
    // title/department/role/manager COALESCE ile korunur: null gönderen uygulama mevcut değeri silmez.
    // Yöneticiyi TEMİZLEMEK için setSharedUserManager(email, null) kullanılır.
    `INSERT INTO users (id, email, name, password, title, department_name, role, manager_email, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           title = COALESCE(EXCLUDED.title, users.title),
           department_name = COALESCE(EXCLUDED.department_name, users.department_name),
           role = COALESCE(EXCLUDED.role, users.role),
           manager_email = COALESCE(EXCLUDED.manager_email, users.manager_email),
           updated_at = now()`,
    [randomUUID(), email, name, hashed, title ?? null, departmentName ?? null, role ?? null, managerEmail ?? null, isActive]
  );
}

/** Ortak DB'de kullanıcıyı pasifleştir/aktifleştir. */
export async function setSharedUserActive(email: string, isActive: boolean): Promise<void> {
  await getPool().query(
    `UPDATE users SET is_active = $1, updated_at = now() WHERE lower(email) = lower($2)`,
    [isActive, email]
  );
}

/** Ortak DB'de bağlı yöneticiyi ayarla/temizle (null = yönetici yok). Org hiyerarşisi ORTAKTIR. */
export async function setSharedUserManager(email: string, managerEmail: string | null): Promise<void> {
  await getPool().query(
    `UPDATE users SET manager_email = $1, updated_at = now() WHERE lower(email) = lower($2)`,
    [managerEmail, email]
  );
}
