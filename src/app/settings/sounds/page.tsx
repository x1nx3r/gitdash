'use client';

import SettingsSectionShell from '@/components/settings/SettingsSectionShell';
import UserSoundsPanel from '@/components/settings/UserSoundsPanel';

export default function SoundsPage() {
  return (
    <SettingsSectionShell title="Notification sounds" icon="notifications">
      <UserSoundsPanel />
    </SettingsSectionShell>
  );
}