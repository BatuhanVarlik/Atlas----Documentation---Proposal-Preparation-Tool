'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function AtlasLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="64" height="64" rx="12" fill="#031633" />
      <path d="M32 14L46 50H18L32 14Z" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="38" x2="43" y2="38" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5" fill="#1a2b49" />
      <circle cx="32" cy="32" r="2.5" fill="#8293b6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="w-5 h-5 text-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-5 h-5 text-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('E-posta veya şifre hatalı.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col relative overflow-hidden">

      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.04] z-0 select-none">
        <AtlasLogo className="w-[600px] h-[600px]" />
      </div>

      {/* Header */}
      <header className="w-full flex justify-between items-center px-4 md:px-12 py-4 border-b border-outline-variant bg-surface-container-lowest z-10 relative">
        <div className="flex items-center gap-2">
          <AtlasLogo className="h-8 w-8" />
          <span className="text-2xl font-bold text-primary tracking-tight">Atlas</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center p-4 z-10 relative w-full">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-10 flex flex-col gap-6 relative">

          {/* Card Header */}
          <div className="text-center flex flex-col gap-2">
            <div className="flex justify-center mb-2">
              <AtlasLogo className="h-32 w-32" />
            </div>
            <h1 className="text-2xl font-bold text-primary leading-8">
              Atlas<br />
              <span className="block text-xl font-semibold">Dökümantasyon &amp; Teklif Hazırlama Aracı</span>
            </h1>
            <p className="text-base text-on-surface-variant">
              Hoş geldiniz, lütfen hesabınıza giriş yapın.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">

            {/* Email */}
            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-semibold tracking-wide text-on-surface" htmlFor="email">
                E-posta
              </label>
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <MailIcon />
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="e-posta@ornek.com"
                  className="w-full pl-10 pr-3 py-2 bg-surface text-on-surface border border-outline-variant rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-semibold tracking-wide text-on-surface" htmlFor="password">
                Şifre
              </label>
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <LockIcon />
                </div>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 bg-surface text-on-surface border border-outline-variant rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base transition-colors"
                />
              </div>
            </div>

            {/* Remember me */}
            <div className="flex justify-between items-center w-full mt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface transition-colors"
                />
                <span className="text-base text-on-surface-variant group-hover:text-primary transition-colors">
                  Beni Hatırla
                </span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-error bg-error-container border border-error rounded px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary text-sm font-semibold tracking-wide py-2 px-6 rounded flex items-center justify-center gap-2 mt-2 hover:bg-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              {!loading && <LoginIcon />}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-col md:flex-row justify-between items-center px-12 py-6 w-full bg-surface-container-lowest border-t border-outline-variant z-10 relative gap-4 md:gap-0">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary">
          <AtlasLogo className="h-6 w-6" />
          <span>Atlas</span>
        </div>
        <p className="text-xs font-medium text-on-surface text-center opacity-90">
          © 2024 Atlas Dökümantasyon ve Teklif Hazırlama Sistemi. Tüm hakları saklıdır.
        </p>
        <div className="flex gap-4">
          <a href="#" className="text-xs font-medium text-outline hover:text-primary transition-colors opacity-90 hover:opacity-100">Gizlilik Politikası</a>
          <a href="#" className="text-xs font-medium text-outline hover:text-primary transition-colors opacity-90 hover:opacity-100">Kullanım Şartları</a>
          <a href="#" className="text-xs font-medium text-outline hover:text-primary transition-colors opacity-90 hover:opacity-100">Destek</a>
        </div>
      </footer>
    </div>
  );
}
