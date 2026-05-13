'use client';

import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface HeaderProps {
  session: Session;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Yönetici',
  DEPARTMENT_MANAGER: 'Müdür',
  MEMBER: 'Mühendis',
};

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function Header({ session }: HeaderProps) {
  const name = session.user?.name;
  const initials = getInitials(name);

  return (
    <header className="h-14 bg-white dark:bg-primary border-b border-slate-200 dark:border-[#1A2B43] flex items-center justify-end px-6 z-10 relative">
      <div className="flex items-center gap-3">
        <ThemeToggle />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center border border-transparent dark:border-white">
            {initials}
          </div>
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {ROLE_LABELS[session.user?.role] ?? session.user?.role}
              {session.user?.departmentName ? ` · ${session.user.departmentName}` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-slate-500 dark:text-slate-300 hover:text-secondary dark:hover:text-secondary-fixed-dim px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
