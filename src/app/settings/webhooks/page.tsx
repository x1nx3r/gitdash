'use client';

import SettingsSectionShell from '@/components/settings/SettingsSectionShell';
import WebhookSetupCard from '@/components/settings/WebhookSetupCard';

export default function WebhooksPage() {
  return (
    <SettingsSectionShell title="GitHub webhooks" icon="webhook">
      <WebhookSetupCard />
    </SettingsSectionShell>
  );
}