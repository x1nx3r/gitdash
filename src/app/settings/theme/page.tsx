'use client';

import SettingsSectionShell from '@/components/settings/SettingsSectionShell';
import ThemePanel from '@/components/settings/ThemePanel';

export default function ThemePage() {
  return (
    <SettingsSectionShell title="Appearance" icon="palette">
      <ThemePanel />
    </SettingsSectionShell>
  );
}