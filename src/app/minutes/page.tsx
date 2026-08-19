'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { MinutesContent } from '@/components/pages/minutes';

export default function MinutesPage() {
  return (
    <ClientLayout>
      <AppShell>
        <MinutesContent />
      </AppShell>
    </ClientLayout>
  );
}
