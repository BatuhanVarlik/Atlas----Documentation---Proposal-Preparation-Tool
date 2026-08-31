'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Daraltılmış kenar çubuğu tercihi tarayıcıda saklanır. */
const COLLAPSE_KEY = 'atlas.sidebar.collapsed';

function DashboardIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ModulesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RevisionsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function PumpIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="13" r="6" />
      <path d="M11 13V7a3 3 0 0 1 3-3h1M11 9h5" />
      <path d="M17 19l3 3M19 17l3 3" />
    </svg>
  );
}

function PricingIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ListsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/projects', label: 'Projeler', Icon: ProjectsIcon },
  { href: '/modules', label: 'Modüller', Icon: ModulesIcon },
  { href: '/revisions', label: 'Revizyon Geçmişi', Icon: RevisionsIcon },
  { href: '/advanced-precalculation', label: 'Advanced Precalculation', Icon: PricingIcon },
  { href: '/advanced-precalculation-lists', label: 'Advanced Precalculation Lists', Icon: ListsIcon },
  { href: '/pump-selection', label: 'Pompa Seçimi', Icon: PumpIcon },
  { href: '/templates', label: 'Şablonlar', Icon: TemplatesIcon },
  { href: '/users', label: 'Kullanıcılar', Icon: UsersIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/');
  const [collapsed, setCollapsed] = useState(false);

  // Tercih yalnızca istemcide okunur; sunucu çıktısı her zaman geniş haldedir.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // localStorage kapalıysa varsayılan geniş hal
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* yok say */ }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        'relative bg-primary text-white flex flex-col h-screen border-r border-[#1A2B43]',
        'transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Daralt / genişlet — kenarın üstünde, ana alanın üzerine taşar */}
      <button
        onClick={toggle}
        title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        aria-expanded={!collapsed}
        className={cn(
          'absolute top-16 -right-3 z-30 w-6 h-6 rounded-full flex items-center justify-center',
          'bg-white border border-slate-300 text-slate-600 shadow-sm',
          'hover:bg-slate-50 hover:text-slate-900 transition-colors',
        )}
      >
        <span className="text-[11px] leading-none">{collapsed ? '›' : '‹'}</span>
      </button>

      {/* Logo + Brand — header ile aynı yükseklik (h-14) */}
      <div className={cn(
        'h-14 border-b border-[#1A2B43] flex items-center gap-3',
        collapsed ? 'px-0 justify-center' : 'px-5',
      )}>
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 dark:bg-white dark:border dark:border-white flex items-center justify-center shrink-0">
          <Image
            src="/atlas-logo.png"
            alt="Atlas"
            width={36}
            height={36}
            className="w-9 h-9 object-cover"
          />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <h1 className="text-base font-bold text-white">Atlas</h1>
            <p className="text-[11px] text-slate-300 mt-0.5">Dökümantasyon &amp; Teklif Oluşturma Aracı</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 py-2 rounded-lg text-sm transition-colors',
                collapsed ? 'px-0 justify-center' : 'px-3',
                isActive
                  ? 'bg-secondary text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.Icon />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Settings — bottom */}
      <div className="p-3 border-t border-white/10">
        <Link
          href="/settings"
          title={collapsed ? 'Ayarlar' : undefined}
          className={cn(
            'flex items-center gap-3 py-2 rounded-lg text-sm transition-colors',
            collapsed ? 'px-0 justify-center' : 'px-3',
            settingsActive
              ? 'bg-secondary text-white'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <SettingsIcon />
          {!collapsed && <span>Ayarlar</span>}
        </Link>
        {!collapsed && <p className="text-[10px] text-slate-500 text-center mt-2">v1.0.0</p>}
      </div>
    </aside>
  );
}
