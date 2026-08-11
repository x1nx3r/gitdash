'use client';

import * as React from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { playSound, unlockAudio } from '@/lib/soundEngine';
import {
  NotificationEvent,
  NotificationEventType,
  NotificationItem,
  NotificationSettings,
} from '@/types/notifications';
import NotificationBell from './NotificationBell';

const STORAGE_KEY = 'gitdash.notifications.v1';
const EVENTS_POLL_MS = 30_000;

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
};

function mergeSettings(raw: Partial<NotificationSettings> | null): NotificationSettings {
  if (!raw) return DEFAULT_SETTINGS;
  return {
    enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
    volume: raw.volume ?? DEFAULT_SETTINGS.volume,
    sound: raw.sound ?? DEFAULT_SETTINGS.sound,
    events: { ...DEFAULT_EVENTS, ...raw.events },
    soundByEvent: { ...raw.soundByEvent },
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
  const [configured, setConfigured] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const seenIdsRef = React.useRef<Set<string>>(new Set());
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
          const tone = cfg.soundByEvent[ev.type] ?? cfg.sound;
          playSound(tone, cfg.volume);
        }
      }
    },
    [fetchUserConfig, settings]
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

        if (json.configured !== configured) setConfigured(json.configured);
        if (!json.configured) return;

        const fresh: NotificationEvent[] = [];
        for (const ev of json.events) {
          const id = `${ev.timestamp}-${String(ev.pr.id)}-${ev.type}`;
          if (!seenIdsRef.current.has(id)) {
            seenIdsRef.current.add(id);
            fresh.push(ev);
          }
        }
        if (fresh.length === 0) return;

        const items: NotificationItem[] = fresh
          .map((ev, i) => ({
            ...ev,
            id: `${ev.timestamp}-${String(ev.pr.id)}-${ev.type}-${i}`,
            read: false,
          }))
          .slice(-MAX_HISTORY);
        setNotifications(prevList => [...prevList, ...items].slice(-MAX_HISTORY));
        void playForEvents(fresh);
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
  }, [configured, playForEvents]);

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
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
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
