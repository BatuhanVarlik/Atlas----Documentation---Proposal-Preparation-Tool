// ─── ORTAK ROL MODELİ ─────────────────────────────────────────────────────────
// Tüm APV Hemisan uygulamaları AYNI rol setini paylaşır (Chronos rol modeli).
// Rol ortak DB'de tutulur (tek doğruluk kaynağı) ve login/sync ile buraya yansır.
//
// Atlas yetki eşlemesi:
//   ADMIN, CEO                          → tam yetki (admin düzeyi)
//   DEPARTMENT_MANAGER, FINANCE_MANAGER → yönetsel (departman kapsamı)
//   QUALITY_OBSERVER                    → salt-oku (görür, yazamaz)
//   MEMBER                              → temel üye

export const ROLES = [
  'ADMIN',
  'CEO',
  'FINANCE_MANAGER',
  'DEPARTMENT_MANAGER',
  'QUALITY_OBSERVER',
  'MEMBER',
] as const;

export type Role = (typeof ROLES)[number];

// Record<string, string> — çağrı yerleri rolü düz `string` ile indeksleyebilsin diye.
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Sistem Yöneticisi',
  CEO: 'Genel Müdür',
  FINANCE_MANAGER: 'Finans Genel Müdürü',
  DEPARTMENT_MANAGER: 'Departman Müdürü',
  QUALITY_OBSERVER: 'Kalite Gözlemcisi',
  MEMBER: 'Üye',
};

/** Admin düzeyi (tam yetki): ADMIN, CEO. */
export const ADMIN_ROLES: readonly Role[] = ['ADMIN', 'CEO'];

/** Yönetsel düzey (departman kapsamı dahil): admin düzeyi + departman & finans müdürü. */
export const MANAGER_ROLES: readonly Role[] = ['ADMIN', 'CEO', 'DEPARTMENT_MANAGER', 'FINANCE_MANAGER'];

/** Admin düzeyinde mi? */
export function isAdmin(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'CEO';
}

/** Yönetsel işlem yapabilir mi? */
export function canManage(role?: string | null): boolean {
  return MANAGER_ROLES.includes(role as Role);
}

/** Departman kapsamlı yönetici mi (departman bazlı görünürlük/işlem)? */
export function isDepartmentManager(role?: string | null): boolean {
  return role === 'DEPARTMENT_MANAGER' || role === 'FINANCE_MANAGER';
}

/** Salt-okur rol mü? */
export function isReadOnly(role?: string | null): boolean {
  return role === 'QUALITY_OBSERVER';
}
