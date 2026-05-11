'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◻' },
  { href: '/modules', label: 'Modüller', icon: '⚙' },
  { href: '/templates', label: 'Şablonlar', icon: '📄' },
  { href: '/users', label: 'Kullanıcılar', icon: '👥' },
  { href: '/settings', label: 'Ayarlar', icon: '🔧' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col h-screen">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-base font-bold text-white leading-tight">APV Hemisan</h1>
        <p className="text-xs text-slate-400 mt-0.5">Dokümantasyon Aracı</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">v1.0.0</p>
      </div>
    </aside>
  );
}
