'use client';

import SettingsSectionShell from '@/components/settings/SettingsSectionShell';
import FortunesPanel from '@/components/settings/FortunesPanel';

export default function FortunesPage() {
  return (
    <SettingsSectionShell title="Fortunes" icon="format_quote">
      <FortunesPanel />
    </SettingsSectionShell>
  );
}