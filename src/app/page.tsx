'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ClientLayout } from './client-layout';
import { LoginPage } from '@/components/pages/login';
import { PageLoading } from '@/components/ui/loading';

function RootContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) return <PageLoading />;
  if (user) return <PageLoading />;
  return <LoginPage />;
}

export default function Home() {
  return (
    <ClientLayout>
      <RootContent />
    </ClientLayout>
  );
}
