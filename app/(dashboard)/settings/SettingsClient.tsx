'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Yönetici',
  DEPARTMENT_MANAGER: 'Müdür',
  MEMBER: 'Mühendis',
};

interface SettingsUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date | string;
  department: { name: string; color: string | null } | null;
}

interface Props {
  user: SettingsUser;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function SettingsClient({ user }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalı');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifre ile onay eşleşmiyor');
      return;
    }
    if (currentPassword === newPassword) {
      setError('Yeni şifre mevcut şifre ile aynı olamaz');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Şifre güncellenemedi');
        return;
      }
      setSuccess('Şifre başarıyla güncellendi.');
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ayarlar</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Hesap bilgileriniz ve güvenlik</p>
      </div>

      {/* Kullanıcı Bilgileri */}
      <section className="bg-white dark:bg-[#0a2147] border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-5">
          Kullanıcı Bilgileri
        </h2>

        <div className="flex items-start gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary text-white text-lg font-semibold flex items-center justify-center border border-transparent dark:border-white shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/30">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {user.department && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full border"
                  style={{
                    color: user.department.color ?? '#475569',
                    borderColor: user.department.color ?? '#cbd5e1',
                    backgroundColor: (user.department.color ?? '#475569') + '15',
                  }}
                >
                  {user.department.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-slate-100 dark:border-white/10 pt-4">
          <Info label="Ad Soyad" value={user.name} />
          <Info label="E-posta" value={user.email} mono />
          <Info label="Rol" value={ROLE_LABELS[user.role] ?? user.role} />
          <Info label="Departman" value={user.department?.name ?? '—'} />
          <Info label="Kayıt Tarihi" value={formatDate(user.createdAt)} />
          <Info label="Kullanıcı ID" value={user.id} mono />
        </dl>
      </section>

      {/* Şifre Değiştirme */}
      <section className="bg-white dark:bg-[#0a2147] border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-1">
          Şifre Değiştir
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-400 mb-4">
          Güvenliğiniz için en az 8 karakterli yeni bir şifre belirleyin.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Mevcut Şifre
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#06203f] dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Yeni Şifre
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#06203f] dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Yeni Şifre (Tekrar)
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#06203f] dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-secondary hover:bg-secondary-container rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-white/15 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Temizle
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`text-sm text-slate-800 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
