'use client';

import SettingsSectionShell from '@/components/settings/SettingsSectionShell';
import DisplayPanel from '@/components/settings/DisplayPanel';

export default function DisplayPage() {
  return (
    <SettingsSectionShell title="Display" icon="zoom_in">
      <DisplayPanel />
    </SettingsSectionShell>
  );
}