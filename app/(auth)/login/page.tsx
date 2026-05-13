'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Modal from '@/components/ui/Modal';

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

function EyeIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Şifremi Unuttum modali
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  function resetForgot() {
    setForgotEmail(''); setForgotNewPass(''); setForgotConfirm('');
    setForgotError(''); setForgotSuccess('');
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(''); setForgotSuccess('');
    if (forgotNewPass.length < 8) { setForgotError('Yeni şifre en az 8 karakter olmalı'); return; }
    if (forgotNewPass !== forgotConfirm) { setForgotError('Yeni şifre ile onay eşleşmiyor'); return; }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), newPassword: forgotNewPass }),
      });
      const json = await res.json();
      if (!json.success) { setForgotError(json.error ?? 'Talep gönderilemedi'); return; }
      setForgotSuccess(json.message ?? 'Talebiniz alındı. Yönetici onayından sonra şifreniz güncellenecektir.');
      setForgotNewPass(''); setForgotConfirm('');
    } finally {
      setForgotLoading(false);
    }
  }

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

      {/* APV Hemisan watermark */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.07] dark:opacity-[0.12] z-0 select-none">
        <Image
          src="/hemisan-logo.png"
          alt=""
          width={1000}
          height={750}
          className="w-3/4 max-w-3xl h-auto object-contain"
          priority
        />
      </div>

      {/* Header — px-4 md:px-12 py-4 (margin-mobile/desktop, py-md) */}
      <header className="w-full flex justify-between items-center px-4 md:px-12 py-4 border-b border-outline-variant bg-surface-container-lowest z-10 relative">
        <div className="flex items-center gap-2">
          {/* gap-sm = 0.5rem = gap-2 */}
          <div className="h-8 w-8 rounded-md overflow-hidden bg-white flex items-center justify-center shrink-0">
            <Image
              src="/atlas-logo.png"
              alt="Atlas Logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </div>
          {/* font-headline-xl: 40px/700 — tasarımda header logosu yanındaki yazı bu boyutta */}
          <span className="text-[40px] font-bold text-primary dark:text-primary-fixed tracking-tight leading-none">Atlas</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main — p-md = p-4 */}
      <main className="flex-grow flex items-center justify-center p-4 z-10 relative w-full">
        {/* Card — max-w-md, p-xl=p-10, gap-lg=gap-6, rounded-xl */}
        <div className="w-full max-w-md bg-surface-container-lowest dark:bg-[#0a2147] border border-outline-variant rounded-xl shadow-sm px-5 py-10 flex flex-col gap-6 relative">

          {/* Card Header — gap-sm=gap-2 */}
          <div className="text-center flex flex-col gap-2 ">
            {/* mb-sm=mb-2 */}
            <div className="flex justify-center mb-2">
              <div className="h-32 w-32 rounded-2xl overflow-hidden bg-white flex items-center justify-center">
                <Image
                  src="/atlas-logo.png"
                  alt="Atlas Logo"
                  width={128}
                  height={128}
                  className="h-32 w-32 object-contain"
                  priority
                />
              </div>
            </div>
            {/* font-headline-md: 24px/600 */}
            <h1 className="text-2xl font-semibold text-primary dark:text-primary-fixed leading-8">
              Atlas<br />
              <span className="block">Dökümantasyon &amp; Teklif Hazırlama Aracı</span>
            </h1>
            {/* font-body-md: 16px/400 */}
            <p className="text-base text-on-surface-variant dark:text-slate-300">
              Hoş geldiniz, lütfen hesabınıza giriş yapın.
            </p>
          </div>

          {/* Form — gap-md=gap-4 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">

            {/* Email — gap-xs=gap-1 */}
            <div className="flex flex-col gap-1 w-full">
              {/* font-label-md: 14px/600/tracking-wide */}
              <label className="text-sm font-semibold tracking-wider text-on-surface dark:text-slate-200" htmlFor="email">
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
                  className="w-full pl-12 pr-4 py-3 bg-surface dark:bg-[#06203f] text-on-surface dark:text-slate-100 text-base border border-outline-variant dark:border-white/15 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
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
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="********"
                  className="w-full pl-12 pr-12 py-3 bg-surface dark:bg-[#06203f] text-on-surface dark:text-slate-100 text-base border border-outline-variant dark:border-white/15 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-primary dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Form Options — mt-xs=mt-1, gap-sm=gap-2 */}
            <div className="flex justify-between items-center w-full mt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface transition-colors"
                />
                <span className="text-base text-on-surface-variant dark:text-slate-300 group-hover:text-primary dark:group-hover:text-primary-fixed transition-colors">
                  Beni Hatırla
                </span>
              </label>
              {/* font-label-md: text-sm font-semibold tracking-wider */}
              <button
                type="button"
                onClick={() => { resetForgot(); setForgotEmail(email); setShowForgot(true); }}
                className="text-sm font-semibold tracking-wider text-secondary hover:text-secondary-container transition-colors"
              >
                Şifremi Unuttum
              </button>
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
              className="w-full bg-primary text-on-primary text-sm font-semibold tracking-wider py-2 px-6 rounded border border-transparent dark:border-white/40 flex items-center justify-center gap-2 mt-2 hover:bg-primary-container dark:hover:border-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
        <div className="text-2xl font-semibold text-primary dark:text-primary-fixed mb-2 md:mb-0 flex items-center">
          <div className="h-6 w-6 rounded overflow-hidden bg-white flex items-center justify-center mr-2 shrink-0">
            <Image
              src="/atlas-logo.png"
              alt="Atlas Logo"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          </div>
          <span className="font-bold">Atlas</span>
        </div>
        {/* font-caption: 12px/500, mb-md=mb-4 md:mb-0 */}
        <p className="text-xs font-medium text-on-surface dark:text-slate-300 text-center md:text-left mb-4 md:mb-0 opacity-90">
          © 2026 Atlas Dökümantasyon ve Teklif Hazırlama Sistemi. Tüm hakları saklıdır.
        </p>
        {/* gap-md=gap-4, font-caption */}
        <div className="flex gap-4">
          <a
            href="mailto:batuhan.varlik@apvhemisan.com"
            className="text-xs font-medium text-outline dark:text-slate-400 hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-90 hover:opacity-100"
          >
            Destek
          </a>
        </div>
      </footer>

      {/* Şifremi Unuttum modali */}
      <Modal
        open={showForgot}
        onClose={() => { if (!forgotLoading) { setShowForgot(false); resetForgot(); } }}
        title="Şifremi Unuttum"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          E-posta adresinizi ve yeni şifrenizi girin. Talep yöneticiye iletilir; onaylandığında yeni şifreniz geçerli olur.
        </p>
        <form onSubmit={handleForgotSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">E-posta</label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#06203f] dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Yeni Şifre</label>
            <input
              type="password"
              value={forgotNewPass}
              onChange={(e) => setForgotNewPass(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#06203f] dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[10px] text-slate-400 mt-1">En az 8 karakter</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              value={forgotConfirm}
              onChange={(e) => setForgotConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#06203f] dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {forgotError && (
            <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {forgotError}
            </p>
          )}
          {forgotSuccess && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              {forgotSuccess}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { if (!forgotLoading) { setShowForgot(false); resetForgot(); } }}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5"
            >
              {forgotSuccess ? 'Kapat' : 'İptal'}
            </button>
            {!forgotSuccess && (
              <button
                type="submit"
                disabled={forgotLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-secondary hover:bg-secondary-container rounded-lg disabled:opacity-60"
              >
                {forgotLoading ? 'Gönderiliyor...' : 'Talep Gönder'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
