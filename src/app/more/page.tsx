'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/auth-context';
import { usePWAInstall } from '@/lib/use-pwa-install';
import Link from 'next/link';

const menuItems = [
  { href: '/profile', label: 'Profile', icon: '👤', description: 'Edit name, change PIN, or request to exit' },
  { href: '/minutes', label: 'Meeting Minutes', icon: '📋', description: 'View and create meeting records' },
  { href: '/forum', label: 'Forum', icon: '💬', description: 'Discussions, proposals & announcements' },
  { href: '/exit-requests', label: 'Exit Requests', icon: '🚪', description: 'Refund breakdowns and committee votes' },
  { href: '/settings', label: 'Settings', icon: '⚙️', description: 'App configuration', adminOnly: true },
  { href: '/admin', label: 'Admin', icon: '🔧', description: 'Manage members', adminOnly: true },
];

function MoreContent() {
  const { user } = useAuth();
  const { canInstall, isInstalled, install } = usePWAInstall();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-lg font-bold text-stone-800 mb-4">More</h2>

      {canInstall && !isInstalled && (
        <button
          onClick={install}
          className="flex items-center gap-4 w-full bg-amber-50 rounded-xl border border-amber-200 p-4 hover:bg-amber-100 transition-colors text-left"
        >
          <span className="text-2xl">📲</span>
          <div>
            <p className="font-medium text-amber-800">Install App</p>
            <p className="text-sm text-amber-600">Add to home screen for quick access</p>
          </div>
          <svg className="w-5 h-5 text-amber-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
      )}

      {menuItems
        .filter(item => !item.adminOnly || isAdmin)
        .map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 bg-white rounded-xl border border-stone-200 p-4 hover:bg-stone-50 transition-colors"
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-medium text-stone-800">{item.label}</p>
              <p className="text-sm text-stone-500">{item.description}</p>
            </div>
            <svg className="w-5 h-5 text-stone-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
    </div>
  );
}

export default function MorePage() {
  return (
    <ClientLayout>
      <AppShell>
        <MoreContent />
      </AppShell>
    </ClientLayout>
  );
}
