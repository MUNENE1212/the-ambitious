'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ClientLayout } from '../client-layout';
import { JoinPage } from '@/components/pages/join';
import { PageLoading } from '@/components/ui/loading';

function JoinContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Someone already signed in has no business setting up an account.
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading || user) return <PageLoading />;
  return <JoinPage />;
}

export default function Join() {
  return (
    <ClientLayout>
      <JoinContent />
    </ClientLayout>
  );
}
