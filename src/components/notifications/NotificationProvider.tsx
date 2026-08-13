'use client';

import * as React from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { playCustomSound, playSound, unlockAudio } from '@/lib/soundEngine';
import { subscribeStream } from '@/lib/streamClient';
import {
  NotificationEvent,
  NotificationEventType,
  NotificationItem,
  NotificationSettings,
} from '@/types/notifications';
import NotificationBell from './NotificationBell';

const STORAGE_KEY = 'gitdash.notifications.v1';
const SEEN_EVENTS_KEY = 'gitdash.seenEvents.v1';
const MAX_SEEN = 500;
const EVENTS_POLL_MS = 30_000;
const FRESH_WINDOW_MS = 90_000;

const DEFAULT_EVENTS: Record<NotificationEventType, boolean> = {
  new_pr: true,
  ready_to_merge: true,
  merged: true,
  changes_requested: true,
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  volume: 0.7,
  sound: 'chime',
  events: DEFAULT_EVENTS,
  soundByEvent: {},
  customSounds: {},
};

function mergeSettings(raw: Partial<NotificationSettings> | null): NotificationSettings {
  if (!raw) return DEFAULT_SETTINGS;
  return {
    enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
    volume: raw.volume ?? DEFAULT_SETTINGS.volume,
    sound: raw.sound ?? DEFAULT_SETTINGS.sound,
    events: { ...DEFAULT_EVENTS, ...raw.events },
    soundByEvent: { ...raw.soundByEvent },
    customSounds: { ...raw.customSounds },
  };
}

interface NotificationContextValue {
  configured: boolean;
  settings: NotificationSettings;
  updateSettings: (patch: Partial<NotificationSettings>) => void;
  notifications: NotificationItem[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = React.createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const ctx = React.useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}

const MAX_HISTORY = 50;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [raw, setRaw] = useLocalStorage<Partial<NotificationSettings> | null>(
    STORAGE_KEY,
    null
  );
  // Seen event ids survive refreshes so a page load never replays the whole
  // history as fresh notifications (badge flood + sound burst).
  const [seenIds, setSeenIds] = useLocalStorage<string[]>(SEEN_EVENTS_KEY, []);
  const [configured, setConfigured] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const seenIdsRef = React.useRef<Set<string>>(new Set(seenIds));
  const configCacheRef = React.useRef<
    Map<string, { settings: NotificationSettings; ts: number }>
  >(new Map());

  const settings = React.useMemo(() => mergeSettings(raw), [raw]);

  const updateSettings = React.useCallback(
    (patch: Partial<NotificationSettings>) => {
      setRaw(prev => ({ ...(prev ?? {}), ...patch }));
    },
    [setRaw]
  );

  /** Resolve the sound configuration for a GitHub user, cached for a few minutes. */
  const fetchUserConfig = React.useCallback(
    async (login: string): Promise<NotificationSettings | null> => {
      const cached = configCacheRef.current.get(login);
      if (cached && Date.now() - cached.ts < CONFIG_CACHE_TTL_MS) {
        return cached.settings;
      }
      try {
        const res = await fetch(`/api/config/${encodeURIComponent(login)}`);
        if (!res.ok) return null;
        const cfg = (await res.json()) as NotificationSettings;
        configCacheRef.current.set(login, { settings: cfg, ts: Date.now() });
        return cfg;
      } catch {
        return null;
      }
    },
    []
  );

  const playForEvents = React.useCallback(
    async (events: NotificationEvent[]) => {
      // Group by PR author: one config lookup per author per poll.
      const byLogin = new Map<string, NotificationEvent[]>();
      for (const ev of events) {
        const login = ev.pr.author.login;
        const list = byLogin.get(login) ?? [];
        list.push(ev);
        byLogin.set(login, list);
      }

      for (const [login, loginEvents] of byLogin) {
        // Fall back to the local (dev) settings when the server config is unreachable.
        const cfg = (await fetchUserConfig(login)) ?? settings;
        if (!cfg.enabled) continue;
        for (const ev of loginEvents) {
          if (!cfg.events[ev.type]) continue;
          const custom = cfg.customSounds?.[ev.type];
          if (custom?.id) {
            const ok = await playCustomSound(
              `/api/sound-library/${encodeURIComponent(custom.id)}`,
              cfg.volume
            );
            if (!ok) playSound(cfg.soundByEvent[ev.type] ?? cfg.sound, cfg.volume);
          } else {
            const tone = cfg.soundByEvent[ev.type] ?? cfg.sound;
            playSound(tone, cfg.volume);
          }
        }
      }
    },
    [fetchUserConfig, settings]
  );

  /** Dedupe, list and sound new events. Shared by the poll and the SSE stream. */
  const ingestEvents = React.useCallback(
    (json: { configured: boolean; events: NotificationEvent[] }) => {
      setConfigured(prev => (json.configured !== prev ? json.configured : prev));
      if (!json.configured) return;

      const fresh: NotificationEvent[] = [];
      const newlySeen: string[] = [];
      // Only events that just happened (within the freshness window) are
      // genuine new events. Older unseen ones (first load in a browser,
      // reconnect after downtime) reconcile into the list silently instead of
      // replaying the whole backlog as sound.
      const now = Date.now();
      const soundworthy: NotificationEvent[] = [];
      for (const ev of json.events) {
        const id = `${ev.timestamp}-${String(ev.pr.id)}-${ev.type}`;
        if (!seenIdsRef.current.has(id)) {
          seenIdsRef.current.add(id);
          newlySeen.push(id);
          fresh.push(ev);
          if (now - ev.timestamp <= FRESH_WINDOW_MS) soundworthy.push(ev);
        }
      }
      if (fresh.length === 0) return;
      if (newlySeen.length > 0) {
        setSeenIds(prev => [...prev, ...newlySeen].slice(-MAX_SEEN));
      }

      const items: NotificationItem[] = fresh
        .map((ev, i) => ({
          ...ev,
          id: `${ev.timestamp}-${String(ev.pr.id)}-${ev.type}-${i}`,
          read: false,
        }))
        .slice(-MAX_HISTORY);
      setNotifications(prevList => [...prevList, ...items].slice(-MAX_HISTORY));
      unlockAudio();
      void playForEvents(soundworthy);
    },
    [playForEvents, setSeenIds]
  );

  React.useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/notifications/events');
        if (!res.ok) return;
        const json = (await res.json()) as {
          configured: boolean;
          events: NotificationEvent[];
        };
        if (cancelled) return;
        ingestEvents(json);
      } catch {
        // Transient failure; the next poll will retry.
      }
    };

    void poll();
    const interval = setInterval(poll, EVENTS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ingestEvents]);

  // SSE: events arrive instantly on webhook delivery; dedupe makes
  // double-delivery (stream + poll) harmless. Poll remains the fallback.
  React.useEffect(() => {
    const unsubscribe = subscribeStream(msg => {
      if (msg.type === 'events') ingestEvents(msg);
    });
    return unsubscribe;
  }, [ingestEvents]);

  const markAllRead = React.useCallback(() => {
    setNotifications(prevList => prevList.map(n => ({ ...n, read: true })));
  }, []);

  const markRead = React.useCallback((id: string) => {
    setNotifications(prevList =>
      prevList.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = React.useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  React.useEffect(() => {
    const onConfigUpdate = () => configCacheRef.current.clear();
    window.addEventListener('gitdash:sound-config-updated', onConfigUpdate);
    return () => window.removeEventListener('gitdash:sound-config-updated', onConfigUpdate);
  }, []);

  React.useEffect(() => {
    // If the user already interacted with this page, start audio now.
    unlockAudio();
    const unlock = () => unlockAudio();
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'mousedown', 'click'] as const) {
      window.addEventListener(ev, unlock);
    }
    return () => {
      for (const ev of ['pointerdown', 'keydown', 'touchstart', 'mousedown', 'click'] as const) {
        window.removeEventListener(ev, unlock);
      }
    };
  }, []);

  const value = React.useMemo<NotificationContextValue>(
    () => ({
      configured,
      settings,
      updateSettings,
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      clearAll,
    }),
    [configured, settings, updateSettings, notifications, unreadCount, markRead, markAllRead, clearAll]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationBell />
    </NotificationContext.Provider>
  );
}
