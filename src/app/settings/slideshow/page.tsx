'use client';

import SettingsSectionShell from '@/components/settings/SettingsSectionShell';
import SlideshowTimingPanel from '@/components/settings/SlideshowTimingPanel';

export default function SlideshowPage() {
  return (
    <SettingsSectionShell title="Slideshow" icon="slideshow">
      <SlideshowTimingPanel />
    </SettingsSectionShell>
  );
}