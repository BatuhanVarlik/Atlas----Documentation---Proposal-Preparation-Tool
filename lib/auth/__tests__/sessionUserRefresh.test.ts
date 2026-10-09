import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('@/lib/shared-users', () => ({ getSharedUserByEmail: vi.fn() }));
vi.mock('@/lib/user-sync', () => ({ syncLocalUser: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { getSharedUserByEmail } from '@/lib/shared-users';
import { syncLocalUser } from '@/lib/user-sync';
import {
  REFRESH_INTERVAL_MS,
  getFreshSessionUser,
  __resetSessionUserRefreshForTests,
} from '@/lib/auth/sessionUserRefresh';

const findUnique = vi.mocked(prisma.user.findUnique);
const getShared = vi.mocked(getSharedUserByEmail);
const sync = vi.mocked(syncLocalUser);

// prisma.user.findUnique iki şekilde çağrılır: e-posta seçimi ve anlık görüntü seçimi
function localUser(over: Partial<{ isActive: boolean; role: string }> = {}) {
  return {
    email: 'a@b.com',
    isActive: over.isActive ?? true,
    role: over.role ?? 'MEMBER',
    departmentId: 'd1',
    financeScopeDepartmentId: null,
    department: { name: 'Otomasyon' },
  } as never;
}

describe('getFreshSessionUser', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSessionUserRefreshForTests();
    findUnique.mockResolvedValue(localUser());
    getShared.mockResolvedValue({ email: 'a@b.com' } as never);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('ortak DB’den senkronlar ve yerel anlık görüntüyü döner', async () => {
    const snap = await getFreshSessionUser('u1', 1_000);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(snap).toEqual({
      isActive: true,
      role: 'MEMBER',
      departmentId: 'd1',
      departmentName: 'Otomasyon',
    });
  });

  it('rol değişikliği aralık dolunca yansır (yeniden giriş gerekmez)', async () => {
    await getFreshSessionUser('u1', 1_000);
    findUnique.mockResolvedValue(localUser({ role: 'DEPARTMENT_MANAGER' }));
    expect((await getFreshSessionUser('u1', 1_000 + REFRESH_INTERVAL_MS - 1))?.role).toBe('MEMBER');
    expect((await getFreshSessionUser('u1', 1_000 + REFRESH_INTERVAL_MS))?.role).toBe('DEPARTMENT_MANAGER');
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('pasife alınan kullanıcı isActive=false döner', async () => {
    findUnique.mockResolvedValue(localUser({ isActive: false }));
    expect((await getFreshSessionUser('u1', 1_000))?.isActive).toBe(false);
  });

  it('eşzamanlı çağrılar tek tazelemeyi paylaşır', async () => {
    await Promise.all([getFreshSessionUser('u1', 1_000), getFreshSessionUser('u1', 1_000)]);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('ortak DB hatasında yerel aynayla devam eder ve aralık boyunca yeniden denemez', async () => {
    getShared.mockRejectedValueOnce(new Error('bağlantı yok'));
    const snap = await getFreshSessionUser('u1', 1_000);
    expect(snap?.isActive).toBe(true);
    await getFreshSessionUser('u1', 2_000);
    expect(getShared).toHaveBeenCalledTimes(1);
    expect(sync).not.toHaveBeenCalled();
  });

  it('yerel DB de okunamazsa önceki görüntüyü korur', async () => {
    await getFreshSessionUser('u1', 1_000);
    findUnique.mockRejectedValue(new Error('yerel DB yok'));
    const snap = await getFreshSessionUser('u1', 1_000 + REFRESH_INTERVAL_MS);
    expect(snap?.role).toBe('MEMBER');
    warn.mockRestore();
  });

  it('ortak DB’de olmayan kullanıcıda yerel kayda dokunmaz', async () => {
    getShared.mockResolvedValueOnce(null);
    await getFreshSessionUser('u1', 1_000);
    expect(sync).not.toHaveBeenCalled();
  });
});
