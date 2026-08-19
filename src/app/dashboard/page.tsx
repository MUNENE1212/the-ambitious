'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardContent } from '@/components/pages/dashboard';

export default function DashboardPage() {
  return (
    <ClientLayout>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </ClientLayout>
  );
}
