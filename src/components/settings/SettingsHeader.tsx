'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/button/text-button.js';

export default function SettingsHeader({ title }: { title: string }) {
  const router = useRouter();

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] px-4 py-2">
      <md-icon-button
        aria-label="Back to settings"
        onClick={() => router.push('/settings')}
        suppressHydrationWarning
      >
        <md-icon>arrow_back</md-icon>
      </md-icon-button>
      <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
        {title}
      </span>
      <div className="ml-auto">
        <md-text-button onClick={logout} suppressHydrationWarning>
          Logout
        </md-text-button>
      </div>
    </header>
  );
}