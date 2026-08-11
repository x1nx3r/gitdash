'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import { useNotifications } from '@/components/notifications/NotificationProvider';

const STEPS = [
  'On GitHub, open the repo (or org) → Settings → Webhooks → Add webhook.',
  'Payload URL: the one shown below (content type application/json).',
  'Secret: the same value as the GITHUB_WEBHOOK_SECRET env var on the server.',
  'Events: select "Let me select individual events", enable pull_request and pull_request_review, disable the rest.',
  'Add webhook. GitHub sends a ping — it should appear as delivered.',
];

export default function WebhookSetupCard() {
  const { configured } = useNotifications();
  const [copied, setCopied] = React.useState(false);
  // Hydration-safe mounted flag: window is only safe to touch post-mount.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const url = mounted ? `${window.location.origin}/api/webhooks/github` : '';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; the URL stays visible for manual copy.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`inline-flex items-center gap-2 self-start rounded-[var(--md-sys-shape-corner-small)] px-2 py-1 md-typescale-label-medium ${
          configured
            ? 'bg-[var(--md-sys-color-success-container)] text-[var(--md-sys-color-on-success-container)]'
            : 'bg-[var(--md-sys-color-warning-container)] text-[var(--md-sys-color-on-warning-container)]'
        }`}
      >
        <md-icon style={{ fontSize: '16px' }} suppressHydrationWarning>
          {configured ? 'check_circle' : 'schedule'}
        </md-icon>
        {configured
          ? 'Webhooks are receiving events'
          : 'Not configured — notifications are off'}
      </div>

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)] px-2 py-1.5 md-typescale-body-small text-[var(--md-sys-color-on-surface)]">
          {url || '/api/webhooks/github'}
        </code>
        <md-icon-button
          aria-label="Copy webhook URL"
          onClick={copy}
          suppressHydrationWarning
        >
          <md-icon>{copied ? 'check' : 'content_copy'}</md-icon>
        </md-icon-button>
      </div>

      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {STEPS.map(step => (
          <li
            key={step}
            className="md-typescale-body-small pl-1 text-[var(--md-sys-color-on-surface-variant)]"
          >
            {step}
          </li>
        ))}
      </ol>

      <p className="md-typescale-label-small text-[var(--md-sys-color-outline)]">
        Without a webhook secret the dashboard stays fully usable — the board
        keeps polling GitHub — but the notification bell and sounds stay
        disabled.
      </p>
    </div>
  );
}
