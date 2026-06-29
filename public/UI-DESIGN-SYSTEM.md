# Atlas UI Tasarım Sistemi — Yeniden Kullanılabilir Template

> Bu dosya, Atlas (APV Hemisan) projesinin arayüz mimarisini başka projelerde
> birebir tekrar kurabilmen için hazırlanmış bir **template**'tir. Renk token'ları,
> dark mode stratejisi, layout iskeleti, **watermark**, **ikon** ve **logo** kullanımı,
> bileşen kalıpları ve kopyala-yapıştır snippet'ler içerir.
>
> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui kalıpları
>
> Kopyalarken sadece marka renklerini (`--color-primary`, `--color-secondary`),
> logo dosyalarını ve uygulama adını değiştirmen yeterli.

---

## 0. İçindekiler

1. [Felsefe & Kurallar](#1-felsefe--kurallar)
2. [Tipografi (Fontlar)](#2-tipografi-fontlar)
3. [Renk Token'ları (`@theme`)](#3-renk-tokenları-theme)
4. [Dark Mode Stratejisi](#4-dark-mode-stratejisi)
5. [Layout İskeleti](#5-layout-i̇skeleti)
6. [Watermark (Filigran) Kullanımı](#6-watermark-filigran-kullanımı)
7. [İkon Kullanımı](#7-i̇kon-kullanımı)
8. [Logo & Marka Asset'leri](#8-logo--marka-assetleri)
9. [Bileşen Kalıpları](#9-bileşen-kalıpları)
10. [Form & Girdi Kalıpları](#10-form--girdi-kalıpları)
11. [3 Sütunlu Araç Düzeni (örnek)](#11-3-sütunlu-araç-düzeni-örnek)
12. [Kopyala-Yapıştır Başlangıç Paketi](#12-kopyala-yapıştır-başlangıç-paketi)

---

## 1. Felsefe & Kurallar

- **Tailwind v4** — `tailwind.config.ts` **YOK**. Tüm tema `app/globals.css` içindeki `@theme {}` bloğunda CSS değişkeni olarak tanımlanır. PostCSS plugin'i `@tailwindcss/postcss`.
- **Semantik renk token'ları** kullan (`bg-primary`, `text-on-surface`, `border-outline-variant`) — ham hex değil. Böylece dark mode ve marka değişimi tek yerden yönetilir.
- **`next/font/google` KULLANMA** — LAN/offline sunucuda build sırasında Google'a bağlanmaya çalışır. Fontları sistem fallback'i veya self-host `@font-face` ile ver.
- **İkonlar inline SVG** — ekstra ikon paketi (lucide vb.) bağımlılığı yok; her ikon küçük bir React fonksiyon bileşeni. `viewBox="0 0 24 24"`, `stroke="currentColor"`, `fill="none"`.
- **Kartlar:** `bg-white rounded-xl border border-slate-200 p-4/p-5`.
- **Modal/Portal:** floating her şey `createPortal(content, document.body)` ile render edilir.
- **Component 200 satırı geçerse böl.**

---

## 2. Tipografi (Fontlar)

`@theme` içinde tanımlı:

```css
--font-sans: "Hanken Grotesk", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace;
```

- Sans → genel metin; Mono → sayısal/teknik değerler (`font-mono` ile çap, kW vb.).
- **Önemli:** `next/font/google` yasak. Fontu gerçekten yüklemek istersen `public/fonts/` altına koyup `globals.css`'te `@font-face` tanımla; yüklemezsen sistem fallback'i devreye girer (sorun olmaz).

Yaygın boyut ölçeği (kullanımdaki gerçek değerler):

| Amaç | Sınıf |
|------|-------|
| Sayfa başlığı | `text-xl font-bold` |
| Panel başlığı | `text-sm font-bold` / `text-sm font-semibold` |
| Etiket (label) | `text-xs font-medium text-slate-600` |
| Yardım/ipucu | `text-[10px]` / `text-[11px] text-slate-400` |
| Büyük marka yazısı (login) | `text-[40px] font-bold tracking-tight` |

---

## 3. Renk Token'ları (`@theme`)

> `app/globals.css` başına bunu koy. Marka için sadece `--color-primary` ve
> `--color-secondary` ailelerini değiştirmen yeterli; gerisi nötr/semantiktir.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Hanken Grotesk", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace;

  /* ---- Brand Colors (DEĞİŞTİR) ---- */
  --color-primary: #031633;              /* lacivert — sidebar, başlık */
  --color-on-primary: #ffffff;
  --color-primary-fixed: #d7e2ff;
  --color-primary-fixed-dim: #b6c7ec;
  --color-on-primary-fixed: #081b38;
  --color-on-primary-fixed-variant: #364766;
  --color-primary-container: #1a2b49;
  --color-on-primary-container: #8293b6;

  --color-secondary: #bb0014;            /* kırmızı — aktif nav, vurgulu CTA */
  --color-on-secondary: #ffffff;
  --color-secondary-container: #e41f25;
  --color-on-secondary-container: #fffbff;
  --color-secondary-fixed: #ffdad6;
  --color-secondary-fixed-dim: #ffb4ab;
  --color-on-secondary-fixed: #410002;
  --color-on-secondary-fixed-variant: #93000d;

  --color-tertiary: #06172a;
  --color-on-tertiary: #ffffff;
  --color-tertiary-container: #1c2c40;
  --color-on-tertiary-container: #8393ac;
  --color-tertiary-fixed: #d3e4fe;
  --color-tertiary-fixed-dim: #b7c8e1;
  --color-on-tertiary-fixed: #0b1c30;
  --color-on-tertiary-fixed-variant: #38485d;

  /* ---- Nötr / Yüzeyler ---- */
  --color-background: #f7f9fb;
  --color-on-background: #191c1e;

  --color-surface: #f7f9fb;
  --color-surface-dim: #d8dadc;
  --color-surface-bright: #f7f9fb;
  --color-surface-tint: #4e5e7f;
  --color-on-surface: #191c1e;
  --color-on-surface-variant: #44474e;
  --color-surface-variant: #e0e3e5;
  --color-inverse-surface: #2d3133;
  --color-inverse-on-surface: #eff1f3;
  --color-inverse-primary: #b6c7ec;

  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f2f4f6;
  --color-surface-container: #eceef0;
  --color-surface-container-high: #e6e8ea;
  --color-surface-container-highest: #e0e3e5;

  --color-outline: #75777e;
  --color-outline-variant: #c5c6ce;

  --color-error: #ba1a1a;
  --color-on-error: #ffffff;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;

  /* ---- Semantik kısayollar ---- */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-info: #3b82f6;

  /* ---- Köşe yarıçapı ---- */
  --radius: 0.5rem;
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--color-background);
  color: var(--color-on-background);
  font-family: var(--font-sans);
  line-height: 1.5;
}
```

**Token → utility eşlemesi:** `--color-primary` ⇒ `bg-primary` / `text-primary` / `border-primary`.
"on-" önekli token, o rengin üstündeki metin rengidir (`bg-primary text-on-primary`).

### Aday/sıralama renk paleti (yeşil → sarı → turuncu)

Liste sıralamalı vurgular için (örn. pompa seçim ekranındaki ilk 3 aday):

```ts
const RANK_STYLES = [
  { chip: 'bg-emerald-400', row: 'bg-emerald-400/90 text-emerald-950' }, // 1.
  { chip: 'bg-yellow-300',  row: 'bg-yellow-300/90 text-yellow-950'  }, // 2.
  { chip: 'bg-orange-400',  row: 'bg-orange-400/90 text-orange-950'  }, // 3.
];
```

---

## 4. Dark Mode Stratejisi

Üç parçadan oluşur: **(a)** `.dark` sınıfı token override'ları, **(b)** flash-önleyen
init script, **(c)** `ThemeProvider` + `ThemeToggle`.

### (a) `globals.css` — `.dark` override'ları

```css
/* Dark theme — tüm yüzeyler primary lacivertinde birleşir; borderlar hafif tonla ayrılır. */
.dark {
  --color-background: #031633;
  --color-on-background: #e2e8f0;

  --color-surface: #031633;
  --color-surface-dim: #031633;
  --color-surface-bright: #0a2147;
  --color-on-surface: #e2e8f0;
  --color-on-surface-variant: #94a3b8;
  --color-surface-variant: #0a2147;

  --color-surface-container-lowest: #031633;
  --color-surface-container-low: #031633;
  --color-surface-container: #062041;
  --color-surface-container-high: #0a2147;
  --color-surface-container-highest: #102b58;

  --color-outline: #475569;
  --color-outline-variant: #1a2d50;
  /* Brand renkleri aynı kalır */
}

/* Kodda doğrudan kullanılan Tailwind utility'leri için dark fallback.
   :where() ile specificity DÜŞÜK tutulur ki explicit `dark:` varyantlar ezebilsin. */
.dark :where(.bg-white)      { background-color: #031633; }
.dark :where(.bg-slate-50)   { background-color: #031633; }
.dark :where(.bg-slate-100)  { background-color: #0a2147; }
.dark :where(.bg-slate-800)  { background-color: #062041; }
.dark :where(.bg-slate-900)  { background-color: #031633; }
.dark :where(.bg-slate-950)  { background-color: #031633; }

.dark :where(.text-slate-900) { color: #f1f5f9; }
.dark :where(.text-slate-800) { color: #e2e8f0; }
.dark :where(.text-slate-700) { color: #cbd5e1; }
.dark :where(.text-slate-600) { color: #cbd5e1; }
.dark :where(.text-slate-500) { color: #94a3b8; }
.dark :where(.text-slate-400) { color: #94a3b8; }

.dark :where(.border-slate-100) { border-color: #1e293b; }
.dark :where(.border-slate-200) { border-color: #334155; }
.dark :where(.border-slate-300) { border-color: #475569; }

.dark :where(.hover\:bg-slate-50:hover)  { background-color: #0a2147; }
.dark :where(.hover\:bg-slate-100:hover) { background-color: #0a2147; }
```

> **Neden `:where()` fallback?** Kod tabanında bolca `bg-white`, `text-slate-600` gibi
> ham slate sınıfları var. Hepsine tek tek `dark:` eklemek yerine düşük specificity'li
> global fallback ile otomatik dark karşılığı verilir; özel ihtiyaç olduğunda
> `dark:bg-...` yazınca o ezer.

### (b) Flash-önleyen init script — `app/layout.tsx` `<head>`

```tsx
const themeInitScript = `(function(){try{var t=localStorage.getItem('app-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### (c) `components/ThemeProvider.tsx`

```tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
interface ThemeContextValue { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void; }
const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'app-theme';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as Theme | null;
    const initial: Theme = stored === 'dark' || stored === 'light'
      ? stored
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setThemeState(initial); applyTheme(initial); setMounted(true);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t); applyTheme(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }
  function toggleTheme() { setTheme(theme === 'dark' ? 'light' : 'dark'); }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <div suppressHydrationWarning data-theme={mounted ? theme : undefined}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

---

## 5. Layout İskeleti

Dashboard düzeni: **Sidebar (sol, sabit) + (Header üst + Main içerik)**.

```
┌────────────┬─────────────────────────────────┐
│            │  Header  (h-14)                  │
│  Sidebar   ├─────────────────────────────────┤
│  (w-60)    │  Main (p-6, scroll, watermark)   │
│  bg-primary│                                  │
└────────────┴─────────────────────────────────┘
```

### `app/(dashboard)/layout.tsx`

```tsx
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // ... auth guard (getServerSession → redirect('/login'))
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-primary">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <Header session={session} />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* Watermark (bkz. §6) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.08] dark:opacity-[0.14] z-0 select-none">
            <Image src="/hemisan-logo.png" alt="" width={1000} height={750}
              className="w-3/4 max-w-3xl h-auto object-contain" priority />
          </div>
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

### Sidebar (özet)

- `aside`: `w-60 bg-primary text-white flex flex-col h-screen border-r border-[#1A2B43]`
- Logo bloğu: `h-14` (header ile aynı yükseklik), `px-5`, alt border.
- Nav item: `flex items-center gap-3 px-3 py-2 rounded-lg text-sm`
  - aktif: `bg-secondary text-white`
  - pasif: `text-slate-300 hover:bg-white/5 hover:text-white`
- Aktiflik tespiti: `pathname === href || pathname.startsWith(href + '/')`
- Alt kısımda Ayarlar + `v1.0.0` etiketi.

```tsx
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/projects',  label: 'Projeler',  Icon: ProjectsIcon },
  // ...
];

<Link href={item.href} className={cn(
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
  isActive ? 'bg-secondary text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
)}>
  <item.Icon /><span>{item.label}</span>
</Link>
```

### Header (özet)

- `header`: `h-14 bg-white dark:bg-primary border-b border-slate-200 dark:border-[#1A2B43] flex items-center justify-end px-6`
- İçerik: `ThemeToggle` + avatar (baş harfler) + ad/rol + "Çıkış".
- Avatar: `w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold` + `getInitials(name)`.

---

## 6. Watermark (Filigran) Kullanımı

Sayfa arkasına soluk marka logosu. **Anahtar noktalar:** `absolute inset-0`,
`pointer-events-none`, çok düşük `opacity`, `z-0` (içerik `z-10`), `select-none`.

```tsx
{/* Watermark — main/giriş ekranı gibi relative bir kapsayıcının içinde */}
<div className="absolute inset-0 pointer-events-none flex items-center justify-center
                opacity-[0.07] dark:opacity-[0.12] z-0 select-none">
  <Image
    src="/hemisan-logo.png"   /* marka filigranı — public/ altında */
    alt=""                      /* dekoratif → boş alt */
    width={1000} height={750}
    className="w-3/4 max-w-3xl h-auto object-contain"
    priority
  />
</div>

{/* Gerçek içerik watermark'ın ÜSTÜNDE */}
<div className="relative z-10">{children}</div>
```

| Yer | Opacity (light / dark) |
|-----|------------------------|
| Dashboard `main` | `0.08` / `0.14` |
| Login ekranı | `0.07` / `0.12` |

> Kapsayıcının `relative` olması şart; watermark `absolute inset-0` ile onu kaplar.
> İçeriği mutlaka `relative z-10` ile sar, yoksa watermark tıklanabilirliği etkilemese de
> görsel olarak üstte kalabilir.

---

## 7. İkon Kullanımı

İkonlar **harici paket değil**, küçük inline SVG React bileşenleridir. Tek bir
çizim diliyle (24×24 grid, currentColor stroke) tutarlılık sağlanır.

### Standart ikon kalıbı

```tsx
function DashboardIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
```

**Kurallar**
- `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"` → renk metin renginden gelir (`text-slate-300`, `text-secondary` vb.).
- `strokeWidth="2"` (ince çizgi için `1.5`, login input ikonları gibi).
- `strokeLinecap`/`strokeLinejoin="round"`.
- Boyut className ile: nav `w-4 h-4`, input ikonu `w-5 h-5`, buton ikonu `w-4.5 h-4.5`.
- Stroke kullandığın için `currentColor` ile hover/aktif renklerine otomatik uyum sağlar.

> Geometriler [feathericons.com](https://feathericons.com) / Lucide path'leriyle uyumludur;
> oradan path kopyalayıp bu kalıba gömebilirsin. Paket bağımlılığı eklemene gerek yok.

---

## 8. Logo & Marka Asset'leri

`public/` altına konan PNG'ler, `next/image` (`Image`) ile servis edilir.

| Dosya | Kullanım |
|-------|----------|
| `public/atlas-logo.png` | Sidebar logosu (36px), login kartı (128px), header/footer marka |
| `public/hemisan-logo.png` | Sayfa **watermark**'ı (soluk arka plan) |
| `public/tank.png` | Domaine özel görsel (örnek) |

### Logo "frame" kalıbı (beyaz arkaplı yuvarlak köşe)

```tsx
{/* Sidebar logosu — koyu zeminde beyaz çerçeveli */}
<div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5
                dark:bg-white dark:border dark:border-white
                flex items-center justify-center shrink-0">
  <Image src="/atlas-logo.png" alt="Atlas" width={36} height={36}
         className="w-9 h-9 object-cover" />
</div>
```

```tsx
{/* Login kartı büyük logo */}
<div className="h-32 w-32 rounded-2xl overflow-hidden bg-white flex items-center justify-center">
  <Image src="/atlas-logo.png" alt="Logo" width={128} height={128}
         className="h-32 w-32 object-contain" priority />
</div>
```

> Logoyu hep `bg-white` bir kutu içine al ki koyu/açık temada zemine kaybolmasın.
> `overflow-hidden rounded-*` ile köşeleri yuvarla.

### Favicon / app icon
`app/icon.png` koyarsan Next.js otomatik favicon yapar (`metadata` gerekmez).

---

## 9. Bileşen Kalıpları

### 9.1 Panel / Kart

```tsx
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">{title}</h3>
      {children}
    </div>
  );
}
```

Genel kart: `bg-white rounded-xl border border-slate-200 p-5`.

### 9.2 Butonlar

| Tip | Sınıf |
|-----|-------|
| Primary (lacivert) | `bg-primary text-on-primary ... hover:bg-primary-container rounded` |
| Secondary/CTA (kırmızı) | `bg-secondary hover:bg-secondary-container text-white rounded-lg` |
| Onay/eylem (mavi) | `bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-blue-300` |
| Otomatik/olumlu (yeşil) | `bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:bg-slate-200 disabled:text-slate-400` |
| Tehlike (sil) | `text-red-600 border border-red-300 rounded-lg hover:bg-red-50` |

Tipik dolu buton:
```tsx
<button disabled={loading}
  className="px-4 py-2.5 bg-secondary hover:bg-secondary-container text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
  {loading ? 'İşleniyor…' : 'Kaydet'}
</button>
```

### 9.3 Modal (Portal)

`createPortal` + `Escape` ile kapat + body scroll kilidi + overlay tıklamada kapan.

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const SIZE = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export default function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm'|'md'|'lg';
}) {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) { document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div ref={overlay} className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={(e) => { if (e.target === overlay.current) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
      <div className={cn('relative bg-white dark:bg-primary dark:text-slate-100 rounded-xl shadow-xl w-full', SIZE[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
```

### 9.4 Durum Rozeti (StatusBadge)

Renk haritası ile durum → etiket + arka plan:

```tsx
const STATUS = {
  DRAFT:    { label: 'Taslak',      className: 'bg-slate-100 text-slate-600' },
  ACTIVE:   { label: 'Aktif',       className: 'bg-green-100 text-green-700' },
  REVIEW:   { label: 'İncelemede',  className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Onaylandı',   className: 'bg-green-100 text-green-700' },
  CANCELLED:{ label: 'İptal',       className: 'bg-red-100 text-red-600' },
} as const;

<span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', STATUS[status].className)}>
  {STATUS[status].label}
</span>
```

### 9.5 ThemeToggle

`useTheme()` + Sun/Moon ikon değişimi. Buton: `w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10`.

### 9.6 Uyarı / Bildirim kutuları

```tsx
{/* Hata */}
<div className="rounded-lg px-4 py-2.5 text-xs font-medium bg-red-50 border border-red-200 text-red-700">…</div>
{/* Uyarı */}
<div className="rounded-lg px-4 py-2.5 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">⚠ …</div>
{/* Başarı */}
<div className="rounded-lg px-3 py-2 text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-700">…</div>
```

---

## 10. Form & Girdi Kalıpları

### Etiket + input

```tsx
<div>
  <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L/h) *</label>
  <input className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-blue-500" />
</div>
```

### Salt-bilgi (read-only) alan

```tsx
<div className="px-2.5 py-1.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono">
  {value ?? '—'}  {/* "Sistem hesaplıyor: DN50" gibi */}
</div>
```

### Var/Yok & seçim "pill" toggle

```tsx
function pillCls(active: boolean) {
  return `flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
    active ? 'border-blue-500 bg-blue-50 text-blue-700'
           : 'border-slate-300 text-slate-600 hover:border-slate-400'}`;
}

<div className="flex gap-2">
  <button onClick={() => set(true)}  className={pillCls(value)}>Var</button>
  <button onClick={() => set(false)} className={pillCls(!value)}>Yok</button>
</div>
```

### Bölüm (Section) kutusu

```tsx
<div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
  <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Pompa</p>
  …
</div>
```

### Öneri rozeti + eylem butonu (örnek desen)

```tsx
<div className="flex items-center justify-between gap-2">
  <span className="text-emerald-700 text-[11px]">Önerilen: <strong>{name}</strong> · {kw} kW</span>
  <button disabled={!suggestion}
    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400">
    ⟳ Otomatik Seç
  </button>
</div>
```

---

## 11. 3 Sütunlu Araç Düzeni (örnek)

Klasik "girdi → seçim → sonuç" araçları için (örn. pompa seçimi). Responsive grid:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-5 items-start">
  <Panel title="Conditions"> …girdi alanları… </Panel>
  <Panel title="Seçim">      …listeler/seçim… </Panel>
  <Panel title="Specification"> …hesap çıktısı (SpecRow)… </Panel>
</div>
```

`SpecRow` kalıbı (etiket solda, değer sağda + birim):

```tsx
function SpecRow({ label, value, unit, strong }: { label: string; value: string; unit?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={strong ? 'text-base font-bold text-slate-800' : 'text-sm font-semibold text-slate-700'}>
        {value}{unit && value !== '—' && <span className="text-[10px] text-slate-400 ml-1">{unit}</span>}
      </span>
    </div>
  );
}
```

---

## 12. Kopyala-Yapıştır Başlangıç Paketi

Yeni projeye taşırken sırayla:

1. **`app/globals.css`** → §3 + §4 bloklarını yapıştır. Marka renklerini değiştir.
2. **`app/layout.tsx`** → §4(b) theme init script + `ThemeProvider` sarmalı + `metadata`.
3. **`components/ThemeProvider.tsx`** → §4(c). `STORAGE_KEY`'i uygulamana göre adlandır.
4. **`components/ui/ThemeToggle.tsx`** → §9.5.
5. **`components/layout/Sidebar.tsx` + `Header.tsx`** → §5. `NAV_ITEMS` ve ikonları güncelle.
6. **`app/(dashboard)/layout.tsx`** → §5 + watermark (§6).
7. **`public/`** → `atlas-logo.png` (marka) + `hemisan-logo.png` (watermark) yerine kendi dosyaların.
8. **`components/ui/Modal.tsx`, `StatusBadge.tsx`** → §9.3, §9.4.
9. `lib/utils.ts` içinde `cn` (clsx + tailwind-merge) helper'ı bulunsun:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

### PostCSS (`postcss.config.mjs`)

```js
const config = { plugins: { '@tailwindcss/postcss': {} } };
export default config;
```

### Bağımlılıklar

```
next  react  react-dom  tailwindcss  @tailwindcss/postcss
clsx  tailwind-merge
```

> `tailwind.config.ts` **oluşturma** — v4'te gerek yok, tema `@theme` bloğunda.

---

### Özet kontrol listesi

- [ ] `@theme` token'ları + `.dark` override'ları `globals.css`'te
- [ ] Theme init script `<head>`'de (flash yok)
- [ ] `ThemeProvider` + `ThemeToggle` bağlı
- [ ] Sidebar (w-60, bg-primary) + Header (h-14) iskeleti
- [ ] Watermark `absolute inset-0 opacity-[0.08] z-0`, içerik `relative z-10`
- [ ] İkonlar inline SVG (24×24, currentColor)
- [ ] Logolar `bg-white` çerçeveli, `public/`'te
- [ ] Kartlar `rounded-xl border border-slate-200`
- [ ] Modal'lar `createPortal` ile
- [ ] Semantik renk token'ları kullanılıyor (ham hex değil)
```
