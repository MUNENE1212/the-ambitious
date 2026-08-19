'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { AdminContent } from '@/components/pages/admin';

export default function AdminPage() {
  return (
    <ClientLayout>
      <AppShell>
        <AdminContent />
      </AppShell>
    </ClientLayout>
  );
}
