'use client';

import SettingsSectionShell from '@/components/settings/SettingsSectionShell';
import RepoSettingsSection from '@/components/settings/RepoSettingsSection';

export default function ReposPage() {
  return (
    <SettingsSectionShell title="Repositories" icon="folder">
      <RepoSettingsSection />
    </SettingsSectionShell>
  );
}