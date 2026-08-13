'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import { THEMES, applyTheme, readTheme, subscribeTheme } from '@/lib/theme';

export default function ThemePanel() {
  const theme = React.useSyncExternalStore(
    subscribeTheme,
    readTheme,
    () => 'default'
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
        Color scheme for the whole app and slideshow. Applies instantly and is
        remembered on this device.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {THEMES.map(t => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTheme(t.id)}
              className={`flex items-center gap-3 rounded-[var(--md-sys-shape-corner-small)] p-3 text-left transition-colors ${
                active
                  ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]'
                  : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)]'
              }`}
            >
              <span className="flex shrink-0 gap-1">
                {t.swatch.map(c => (
                  <span
                    key={c}
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span
                  className={`block truncate md-typescale-body-medium ${
                    active
                      ? 'text-[var(--md-sys-color-on-primary-container)]'
                      : 'text-[var(--md-sys-color-on-surface)]'
                  }`}
                >
                  {t.label}
                </span>
                <span className="block truncate md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
                  {t.description}
                </span>
              </span>
              {active && (
                <md-icon className="ml-auto shrink-0">check_circle</md-icon>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}