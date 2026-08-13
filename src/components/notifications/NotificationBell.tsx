'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/button/text-button.js';
import '@material/web/labs/badge/badge.js';
import '@material/web/labs/card/elevated-card.js';
import '@material/web/divider/divider.js';
import { useNotifications } from './NotificationProvider';
import {
  isAudioUnsupported,
  isMuted,
  isSoundBlocked,
  playSound,
  setMuted,
  subscribeMuted,
  subscribeSoundBlocked,
  unlockAudio,
} from '@/lib/soundEngine';
import {
  NotificationEventType,
  NotificationItem,
} from '@/types/notifications';

const TYPE_META: Record<
  NotificationEventType,
  { icon: string; color: string; label: string }
> = {
  new_pr: { icon: 'add_circle', color: 'var(--md-sys-color-primary)', label: 'New PR' },
  ready_to_merge: {
    icon: 'rocket_launch',
    color: 'var(--md-sys-color-secondary)',
    label: 'Ready to merge',
  },
  merged: { icon: 'merge', color: 'var(--md-sys-color-success)', label: 'Merged' },
  changes_requested: {
    icon: 'chat',
    color: 'var(--md-sys-color-error)',
    label: 'Changes requested',
  },
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const {
    configured,
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
  } = useNotifications();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const soundBlocked = React.useSyncExternalStore(
    subscribeSoundBlocked,
    isSoundBlocked,
    () => false
  );
  const muted = React.useSyncExternalStore(subscribeMuted, isMuted, () => false);
  const audioUnsupported = React.useState(() => isAudioUnsupported())[0];

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Notifications only exist when GitHub webhooks deliver them; the
  // settings gear stays visible either way.
  const goToSettings = () => {
    setOpen(false);
    router.push('/settings');
  };

  return (
    <div
      ref={panelRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
    >
      {configured && (
        <>
          <div className="relative inline-flex">
            <md-icon-button
              aria-label="Notifications"
              onClick={() => setOpen(o => !o)}
              suppressHydrationWarning
            >
              <md-icon>{unreadCount > 0 ? 'notifications' : 'notifications_none'}</md-icon>
            </md-icon-button>
            {unreadCount > 0 && (
              <md-badge
                value={unreadCount}
                className="absolute -right-1 -top-1"
                suppressHydrationWarning
              ></md-badge>
            )}
          </div>

          {open && (
            <md-elevated-card className="mb-1 !block w-[340px] max-w-[90vw] overflow-hidden">
              <div className="flex flex-col">
                {/* Panel header */}
                <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
                  <span className="md-typescale-title-small text-[var(--md-sys-color-on-surface)]">
                    Notifications
                  </span>
                  <div className="flex items-center gap-0.5">
                    {notifications.length > 0 && (
                      <md-text-button onClick={markAllRead} suppressHydrationWarning>
                        Mark all read
                      </md-text-button>
                    )}
                    {notifications.length > 0 && (
                      <md-icon-button
                        aria-label="Clear notifications"
                        onClick={clearAll}
                        suppressHydrationWarning
                      >
                        <md-icon>clear_all</md-icon>
                      </md-icon-button>
                    )}
                  </div>
                </div>

                <md-divider></md-divider>

                <NotificationList notifications={notifications} onOpen={markRead} />
              </div>
            </md-elevated-card>
          )}
        </>
      )}

      {configured && audioUnsupported && (
        <div
          className="flex items-center gap-1.5 rounded-full bg-[var(--md-sys-color-error-container)] px-3 py-1.5 text-[var(--md-sys-color-on-error-container)] md-typescale-label-small shadow"
          suppressHydrationWarning
        >
          <md-icon style={{ fontSize: '16px' }}>volume_off</md-icon>
          Sound not supported on this browser
        </div>
      )}

      {configured && !audioUnsupported && (
        <md-icon-button
          aria-label={
            muted || soundBlocked ? 'Enable sound' : 'Mute sounds'
          }
          onClick={() => {
            if (muted) {
              setMuted(false);
              unlockAudio();
              playSound('chime', 0.7);
            } else if (soundBlocked) {
              unlockAudio();
              playSound('chime', 0.7);
            } else {
              setMuted(true);
            }
          }}
          suppressHydrationWarning
        >
          <md-icon>{muted || soundBlocked ? 'volume_off' : 'volume_up'}</md-icon>
        </md-icon-button>
      )}

      <div className="flex flex-row items-center gap-2">
        <md-icon-button
          aria-label="Start slideshow"
          onClick={() => window.dispatchEvent(new Event('gitdash:start-slideshow'))}
          suppressHydrationWarning
        >
          <md-icon>slideshow</md-icon>
        </md-icon-button>

        <md-icon-button
          aria-label="Open settings"
          onClick={goToSettings}
          suppressHydrationWarning
        >
          <md-icon>settings</md-icon>
        </md-icon-button>
      </div>
    </div>
  );
}

function NotificationList({
  notifications,
  onOpen,
}: {
  notifications: NotificationItem[];
  onOpen: (id: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="px-4 py-10 text-center md-typescale-body-medium text-[var(--md-sys-color-outline)]">
        No notifications yet
      </div>
    );
  }

  return (
    <div className="flex max-h-[50vh] flex-col overflow-y-auto">
      {notifications.map(n => {
        const meta = TYPE_META[n.type];
        return (
          <a
            key={n.id}
            href={n.pr.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen(n.id)}
            className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--md-sys-color-surface-container)] ${
              n.read ? 'opacity-60' : ''
            }`}
          >
            <md-icon
              style={{ fontSize: '20px', color: meta.color, marginTop: '2px' }}
              suppressHydrationWarning
            >
              {meta.icon}
            </md-icon>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="md-typescale-label-small uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">
                  {meta.label}
                </span>
                <span className="shrink-0 md-typescale-label-small text-[var(--md-sys-color-outline)]">
                  {timeAgo(n.timestamp)}
                </span>
              </div>
              <p className="mt-0.5 md-typescale-body-small text-[var(--md-sys-color-on-surface)]">
                {n.message}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
