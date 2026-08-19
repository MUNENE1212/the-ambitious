'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { ContributionsContent } from '@/components/pages/contributions';

export default function ContributionsPage() {
  return (
    <ClientLayout>
      <AppShell>
        <ContributionsContent />
      </AppShell>
    </ClientLayout>
  );
}
