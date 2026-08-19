'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { FundsContent } from '@/components/pages/funds';

export default function FundsPage() {
  return (
    <ClientLayout>
      <AppShell>
        <FundsContent />
      </AppShell>
    </ClientLayout>
  );
}
