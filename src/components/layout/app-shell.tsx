'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { BottomNav } from './bottom-nav';
import { TopBar } from './top-bar';
import { PageLoading } from '../ui/loading';
import { ForcePinChange } from '../pages/force-pin-change';
import { PWAInstallBanner } from '../ui/pwa-install-banner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) return <PageLoading />;
  if (!user) return <PageLoading />;

  if (user.mustChangePin) return <ForcePinChange />;

  return (
    <div className="min-h-screen bg-amber-50">
      <TopBar />
      <main className="pb-20 max-w-lg mx-auto">
        {children}
      </main>
      <PWAInstallBanner />
      <BottomNav />
    </div>
  );
}
