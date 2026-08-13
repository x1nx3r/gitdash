'use client';

import * as React from 'react';
import '@material/web/labs/card/elevated-card.js';
import SettingsHeader from '@/components/settings/SettingsHeader';

export default function SettingsSectionShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)]">
      <SettingsHeader title={title} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 lg:p-8">
        <md-elevated-card className="!block w-full">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                <md-icon style={{ fontSize: '20px' }} suppressHydrationWarning>
                  {icon}
                </md-icon>
              </div>
              <h1 className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
                {title}
              </h1>
            </div>
            {children}
          </div>
        </md-elevated-card>
      </main>
    </div>
  );
}