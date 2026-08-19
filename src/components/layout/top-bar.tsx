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
    <header className="sticky top-0 z-30 bg-amber-700 text-white safe-area-top">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌱</span>
          <h1 className="text-lg font-bold tracking-tight">{displayTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <Link href="/profile" className="text-sm text-amber-200 hidden sm:block hover:text-white transition-colors">
                {user.name}
              </Link>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-amber-800 transition-colors"
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
