'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { ExitRequestsContent } from '@/components/pages/exit-requests';

export default function ExitRequestsPage() {
  return (
    <ClientLayout>
      <AppShell>
        <ExitRequestsContent />
      </AppShell>
    </ClientLayout>
  );
}
