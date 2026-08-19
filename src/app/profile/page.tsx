'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { ProfileContent } from '@/components/pages/profile';

export default function ProfilePage() {
  return (
    <ClientLayout>
      <AppShell>
        <ProfileContent />
      </AppShell>
    </ClientLayout>
  );
}
