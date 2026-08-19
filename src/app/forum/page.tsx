'use client';

import { ClientLayout } from '../client-layout';
import { AppShell } from '@/components/layout/app-shell';
import { ForumContent } from '@/components/pages/forum';

export default function ForumPage() {
  return (
    <ClientLayout>
      <AppShell>
        <ForumContent />
      </AppShell>
    </ClientLayout>
  );
}
