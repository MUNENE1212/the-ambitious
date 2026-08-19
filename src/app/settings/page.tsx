'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { SettingsContent } from '@/components/pages/settings';

export default function SettingsPage() {
  return (
    <ClientLayout>
      <AppShell>
        <SettingsContent />
      </AppShell>
    </ClientLayout>
  );
}
