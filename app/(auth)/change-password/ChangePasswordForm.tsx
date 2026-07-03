'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signIn } from 'next-auth/react';

const inputCls =
  'w-full px-3 py-2.5 text-sm bg-surface dark:bg-[#06203f] text-on-surface dark:text-slate-100 border border-outline-variant dark:border-white/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary';

export default function ChangePasswordForm({ email, forced }: { email: string; forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPass.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalı.');
      return;
    }
    if (newPass !== newPass2) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (newPass === currentPassword) {
      setError('Yeni şifre mevcut şifreyle aynı olamaz.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/account/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword: newPass }),
    });
    const json = await res.json();

    if (!json.success) {
      setLoading(false);
      setError(json.error ?? 'Şifre değiştirilemedi.');
      return;
    }

    // Yeni şifreyle taze oturum al (token'daki mustChangePassword=false olur),
    // böylece middleware artık yönlendirmez.
    const signInRes = await signIn('credentials', {
      email,
      password: newPass,
      redirect: false,
    });
    setLoading(false);

    if (signInRes?.error) {
      router.push('/login');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.07] dark:opacity-[0.12] z-0 select-none">
        <Image src="/hemisan-logo.png" alt="" width={1000} height={750} className="w-3/4 max-w-3xl h-auto object-contain" priority />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-24 w-24 rounded-2xl overflow-hidden bg-white flex items-center justify-center mb-4">
            <Image src="/atlas-logo.png" alt="Atlas" width={96} height={96} className="h-24 w-24 object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary dark:text-primary-fixed">Şifre Değiştir</h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-300 text-center mt-1">
            {forced
              ? 'Güvenliğiniz için ilk girişte şifrenizi değiştirmeniz gerekir.'
              : 'Yeni şifrenizi belirleyin.'}
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-lg px-4 py-2.5 text-xs font-medium bg-error-container border border-error text-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest dark:bg-[#0a2147] rounded-xl border border-outline-variant p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant dark:text-slate-300 mb-1">Mevcut Şifre</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" className={inputCls} placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant dark:text-slate-300 mb-1">Yeni Şifre</label>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required autoComplete="new-password" className={inputCls} placeholder="En az 8 karakter" />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant dark:text-slate-300 mb-1">Yeni Şifre (tekrar)</label>
            <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} required autoComplete="new-password" className={inputCls} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full px-4 py-2.5 bg-secondary hover:bg-secondary-container text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Kaydediliyor…' : 'Şifreyi Değiştir'}
          </button>
        </form>
      </div>
    </div>
  );
}
