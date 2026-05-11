'use client';

import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';

interface HeaderProps {
  session: Session;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Yönetici',
  DEPARTMENT_MANAGER: 'Müdür',
  MEMBER: 'Mühendis',
};

export default function Header({ session }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{session.user?.name}</p>
          <p className="text-xs text-slate-500">
            {ROLE_LABELS[session.user?.role] ?? session.user?.role} ·{' '}
            {session.user?.departmentName}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
