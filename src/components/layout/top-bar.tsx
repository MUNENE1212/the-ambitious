'use client';

import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import Link from 'next/link';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();

  const displayTitle = title || settings.groupShortName;

  return (
    <header className="sticky top-0 z-30 bg-brand-gradient text-white safe-area-top shadow-hero">
      <div className="flex items-center justify-between px-4 py-3.5 max-w-lg mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-white/10 ring-1 ring-white/15 text-base">
            🌱
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight">{displayTitle}</h1>
            <p className="text-[11px] text-gold-200/70">Self Help Group</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 pl-1 pr-3 py-1
                  hover:bg-white/15 transition-colors"
              >
                <span className="grid place-items-center w-6 h-6 rounded-full bg-gold-300 text-amber-900 text-[11px] font-bold">
                  {user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </span>
                <span className="text-xs font-medium hidden sm:block">{user.name.split(' ')[0]}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
