'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

function MailIcon() {
  return (
    <svg className="w-5 h-5 text-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-5 h-5 text-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      {/* Background Watermark — opacity-5, w-2/3 (HTML ile birebir) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 z-0">
        <Image
          src="/hemisan-logo.png"
          alt="Background Watermark"
          width={800}
          height={600}
          className="w-2/3 h-auto object-contain"
          priority
        />
      </div>

      {/* Header — px-4 md:px-12 py-4 (margin-mobile/desktop, py-md) */}
      <header className="w-full flex justify-between items-center px-4 md:px-12 py-4 border-b border-outline-variant bg-surface-container-lowest z-10 relative">
        <div className="flex items-center gap-2">
          {/* gap-sm = 0.5rem = gap-2 */}
          <Image
            src="/atlas-logo.png"
            alt="Atlas Logo"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          {/* font-headline-xl: 40px/700 — tasarımda header logosu yanındaki yazı bu boyutta */}
          <span className="text-[40px] font-bold text-primary tracking-tight leading-none">Atlas</span>
        </div>
      </header>

      {/* Main — p-md = p-4 */}
      <main className="flex-grow flex items-center justify-center p-4 z-10 relative w-full">
        {/* Card — max-w-md, p-xl=p-10, gap-lg=gap-6, rounded-xl */}
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm px-5 py-10 flex flex-col gap-6 relative">

          {/* Card Header — gap-sm=gap-2 */}
          <div className="text-center flex flex-col gap-2 ">
            {/* mb-sm=mb-2 */}
            <div className="flex justify-center mb-2">
              <Image
                src="/atlas-logo.png"
                alt="Atlas Logo"
                width={128}
                height={128}
                className="h-32 w-32 object-contain"
                priority
              />
            </div>
            {/* font-headline-md: 24px/600 */}
            <h1 className="text-2xl font-semibold text-primary leading-8">
              Atlas<br />
              <span className="block">Dökümantasyon &amp; Teklif Hazırlama Aracı</span>
            </h1>
            {/* font-body-md: 16px/400 */}
            <p className="text-base text-on-surface-variant">
              Hoş geldiniz, lütfen hesabınıza giriş yapın.
            </p>
          </div>

          {/* Form — gap-md=gap-4 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">

            {/* Email — gap-xs=gap-1 */}
            <div className="flex flex-col gap-1 w-full">
              {/* font-label-md: 14px/600/tracking-wide */}
              <label className="text-sm font-semibold tracking-wider text-on-surface" htmlFor="email">
                Email
              </label>
              {/* Absolute positioning — HTML ile birebir */}
              <div className="relative w-full">
                {/* pl-sm = pl-2 = 8px */}
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MailIcon />
                </div>
                {/* pl-xl=pl-10=40px, pr-sm=pr-2=8px, py-sm=py-2=8px */}
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="e-posta@ornek.com"
                  className="w-full pl-12 pr-4 py-3 bg-surface text-on-surface text-base border border-outline-variant rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Password — gap-xs=gap-1 */}
            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-semibold tracking-wider text-on-surface" htmlFor="password">
                Password
              </label>
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
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
                  placeholder="********"
                  className="w-full pl-12 pr-4 py-3 bg-surface text-on-surface text-base border border-outline-variant rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Form Options — mt-xs=mt-1, gap-sm=gap-2 */}
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
              {/* font-label-md: text-sm font-semibold tracking-wider */}
              <a href="#" className="text-sm font-semibold tracking-wider text-secondary hover:text-secondary-container transition-colors">
                Şifremi Unuttum
              </a>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-error bg-error-container border border-error rounded px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit — py-sm=py-2, px-lg=px-6, gap-sm=gap-2, mt-sm=mt-2 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary text-sm font-semibold tracking-wider py-2 px-6 rounded flex items-center justify-center gap-2 mt-2 hover:bg-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              {!loading && <LoginIcon />}
            </button>
          </form>
        </div>
      </main>

      {/* Footer — px-margin-desktop=px-12, py-lg=py-6 */}
      <footer className="flex flex-col md:flex-row justify-between items-center px-12 py-6 w-full bg-surface-container-lowest border-t border-outline-variant z-10 relative gap-4 md:gap-0">
        {/* font-headline-md: 24px/600, mb-sm=mb-2 */}
        <div className="text-2xl font-semibold text-primary mb-2 md:mb-0 flex items-center">
          <Image
            src="/atlas-logo.png"
            alt="Atlas Logo"
            width={24}
            height={24}
            className="h-6 w-6 object-contain inline-block mr-2"
          />
          <span className="font-bold">Atlas</span>
        </div>
        {/* font-caption: 12px/500, mb-md=mb-4 md:mb-0 */}
        <p className="text-xs font-medium text-on-surface text-center md:text-left mb-4 md:mb-0 opacity-90">
          © 2026 Atlas Dökümantasyon ve Teklif Hazırlama Sistemi. Tüm hakları saklıdır.
        </p>
        {/* gap-md=gap-4, font-caption */}
        <div className="flex gap-4">
          <a href="#" className="text-xs font-medium text-outline hover:text-primary transition-colors opacity-90 hover:opacity-100">Gizlilik Politikası</a>
          <a href="#" className="text-xs font-medium text-outline hover:text-primary transition-colors opacity-90 hover:opacity-100">Kullanım Şartları</a>
          <a href="#" className="text-xs font-medium text-outline hover:text-primary transition-colors opacity-90 hover:opacity-100">Destek</a>
        </div>
      </footer>
    </div>
  );
}
