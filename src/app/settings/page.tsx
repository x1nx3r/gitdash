'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/button/text-button.js';
import '@material/web/labs/card/elevated-card.js';

interface SettingsEntry {
  slug: string;
  title: string;
  description: string;
  icon: string;
}

const ENTRIES: SettingsEntry[] = [
  {
    slug: 'theme',
    title: 'Appearance',
    description: 'Color scheme for the board and slideshow.',
    icon: 'palette',
  },
  {
    slug: 'display',
    title: 'Display',
    description: 'Zoom and the big clock.',
    icon: 'zoom_in',
  },
  {
    slug: 'slideshow',
    title: 'Slideshow',
    description: 'Interval and slide timing.',
    icon: 'slideshow',
  },
  {
    slug: 'fortunes',
    title: 'Fortunes',
    description: 'Quotes on the Overview slide.',
    icon: 'format_quote',
  },
  {
    slug: 'sounds',
    title: 'Notification sounds',
    description: 'Per-user tones and uploaded sounds.',
    icon: 'notifications',
  },
  {
    slug: 'webhooks',
    title: 'GitHub webhooks',
    description: 'Setup and delivery status.',
    icon: 'webhook',
  },
  {
    slug: 'repos',
    title: 'Repositories',
    description: 'Which repos appear on the board.',
    icon: 'folder',
  },
];

export default function SettingsPage() {
  const router = useRouter();

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)]">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] px-4 py-2">
        <md-icon-button
          aria-label="Back to dashboard"
          onClick={() => router.push('/')}
          suppressHydrationWarning
        >
          <md-icon>arrow_back</md-icon>
        </md-icon-button>
        <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
          Settings
        </span>
        <div className="ml-auto">
          <md-text-button onClick={logout} suppressHydrationWarning>
            Logout
          </md-text-button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-8">
        {ENTRIES.map(entry => (
          <Link key={entry.slug} href={`/settings/${entry.slug}`} className="block">
            <md-elevated-card className="!block w-full transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                  <md-icon style={{ fontSize: '24px' }} suppressHydrationWarning>
                    {entry.icon}
                  </md-icon>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
                    {entry.title}
                  </div>
                  <div className="md-typescale-body-small text-[var(--md-sys-color-on-surface-variant)]">
                    {entry.description}
                  </div>
                </div>
                <md-icon
                  className="shrink-0"
                  style={{ color: 'var(--md-sys-color-outline)' }}
                >
                  chevron_right
                </md-icon>
              </div>
            </md-elevated-card>
          </Link>
        ))}
      </main>
    </div>
  );
}