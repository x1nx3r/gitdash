'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/labs/card/elevated-card.js';
import RepoSettingsSection from '@/components/settings/RepoSettingsSection';
import SoundSettingsForm from '@/components/settings/SoundSettingsForm';
import WebhookSetupCard from '@/components/settings/WebhookSetupCard';
import M3TextField from '@/components/notifications/M3TextField';
import { User, UserListResponse } from '@/types/github';
import { NotificationSettings } from '@/types/notifications';
import { Fortune } from '@/lib/fortunes';
import { THEMES, applyTheme, readTheme, subscribeTheme } from '@/lib/theme';
import { MAX_ZOOM, MIN_ZOOM, readZoom, setZoom, subscribeZoom } from '@/lib/zoom';
import {
  CLOCK_OPACITY_MAX,
  CLOCK_SIZE_MAX,
  CLOCK_SIZE_MIN,
  DEFAULT_CLOCK_SIZE,
  readClockOpacity,
  readClockSize,
  setClockOpacity,
  setClockSize,
  subscribeClockOpacity,
  subscribeClockSize,
} from '@/lib/clock';
import {
  MIN_INTERVAL_SEC,
  MIN_SLIDE_SEC,
  clearSlideTiming,
  defaultSlideTiming,
  readSlideTiming,
  saveSlideTiming,
  subscribeSlideTiming,
} from '@/lib/slideshowTiming';

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
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
  );
}

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
      {/* Top app bar */}
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

      <main className="flex flex-col gap-6 p-4 lg:p-8">
        {/* Board settings left, integrations right on wide screens */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionCard title="Appearance" icon="palette">
              <ThemePanel />
            </SectionCard>

            <SectionCard title="Display" icon="zoom_in">
              <ZoomPanel />
            </SectionCard>

            <SectionCard title="Slideshow" icon="slideshow">
              <SlideshowTimingPanel />
            </SectionCard>

            <SectionCard title="Fortunes" icon="format_quote">
              <FortunesPanel />
            </SectionCard>
          </div>

          <div className="flex flex-col gap-6">
            <SectionCard title="Notification sounds" icon="notifications">
              <UserSoundsPanel />
            </SectionCard>

            <SectionCard title="GitHub webhooks" icon="webhook">
              <WebhookSetupCard />
            </SectionCard>

            <SectionCard title="Repositories" icon="folder">
              <RepoSettingsSection />
            </SectionCard>
          </div>
        </div>
      </main>
    </div>
  );
}

function TimingField({
  value,
  min,
  placeholder,
  ariaLabel,
  onValid,
}: {
  value: number;
  min: number;
  placeholder: string;
  ariaLabel: string;
  onValid: (seconds: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  return (
    <M3TextField
      value={draft}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      onValueChange={v => {
        setDraft(v);
        const n = Number(v);
        if (Number.isFinite(n) && n >= min) onValid(n);
      }}
    />
  );
}

function SlideshowTimingPanel() {
  const timing = React.useSyncExternalStore(
    subscribeSlideTiming,
    readSlideTiming,
    defaultSlideTiming
  );
  const intervalSec = Math.round(timing.intervalMs / 1000);
  const slideSec = Math.round(timing.slideMs / 1000);

  return (
    <div className="flex flex-col gap-4">
      <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
        Interval: how long the board shows before the slideshow takes over.
        Slide: how long each slide stays up. Changes apply from the next
        round.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TimingField
          value={intervalSec}
          min={MIN_INTERVAL_SEC}
          placeholder="Interval (seconds)"
          ariaLabel="Slideshow interval in seconds"
          onValid={s => saveSlideTiming(s, slideSec)}
        />
        <TimingField
          value={slideSec}
          min={MIN_SLIDE_SEC}
          placeholder="Slide (seconds)"
          ariaLabel="Seconds per slide"
          onValid={s => saveSlideTiming(intervalSec, s)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Falls back to NEXT_PUBLIC_SLIDESHOW_INTERVAL_MIN / SLIDE_SEC when
          cleared.
        </span>
        <md-text-button onClick={clearSlideTiming} suppressHydrationWarning>
          Reset to defaults
        </md-text-button>
      </div>
    </div>
  );
}

interface DraftFortune {
  id: number;
  text: string;
  author: string;
}

function FortunesPanel() {
  const [items, setItems] = React.useState<DraftFortune[]>([]);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [state, setState] = React.useState<'idle' | 'loading' | 'saving' | 'saved'>('loading');
  const [usingDefaults, setUsingDefaults] = React.useState(false);
  const [savedSnapshot, setSavedSnapshot] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const nextIdRef = React.useRef(0);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/fortunes');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { fortunes: Fortune[]; isDefault: boolean } = await res.json();
        if (!active) return;
        const items: DraftFortune[] = json.fortunes.map((f, i) => ({
          id: i,
          text: f.text,
          author: f.author ?? '',
        }));
        nextIdRef.current = json.fortunes.length;
        setItems(items);
        setSavedSnapshot(JSON.stringify(items));
        setUsingDefaults(json.isDefault);
        setState('idle');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (active) {
          setError(msg || 'Failed to load fortunes');
          setState('idle');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const patch = (id: number, patch: Partial<DraftFortune>) => {
    setItems(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
    setState('idle');
  };

  const add = () => {
    const id = nextIdRef.current++;
    setItems(prev => [...prev, { id, text: '', author: '' }]);
    setEditing(id);
    setState('idle');
  };

  const remove = (id: number) => {
    setItems(prev => prev.filter(f => f.id !== id));
    if (editing === id) setEditing(null);
    setState('idle');
  };

  const cancelEdit = (id: number) => {
    setEditing(null);
    setItems(prev => {
      const target = prev.find(f => f.id === id);
      if (target && !target.text.trim()) return prev.filter(f => f.id !== id);
      return prev;
    });
  };

  const dirty = JSON.stringify(items) !== savedSnapshot;

  const save = async () => {
    const fortunes: Fortune[] = items
      .filter(f => f.text.trim().length > 0)
      .map(f => ({
        text: f.text.trim(),
        ...(f.author.trim() ? { author: f.author.trim() } : {}),
      }));
    setState('saving');
    try {
      const res = await fetch('/api/fortunes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fortunes),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved: DraftFortune[] = fortunes.map((f, i) => ({
        id: i,
        text: f.text,
        author: f.author ?? '',
      }));
      setItems(saved);
      setSavedSnapshot(JSON.stringify(saved));
      setUsingDefaults(false);
      setError(null);
      setState('saved');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Failed to save fortunes');
      setState('idle');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
        Quotes shown on the Overview slide. Add, edit, or remove entries, then
        save — stored on the board (S3).
      </p>

      {items.map(f => (
        <div
          key={f.id}
          className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)] p-3"
        >
          {editing === f.id ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={f.text}
                onChange={e => patch(f.id, { text: e.target.value })}
                rows={2}
                placeholder="Quote"
                spellCheck={false}
                autoFocus
                className="w-full resize-y rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-high)] p-2 text-[14px] leading-relaxed text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)]"
              />
              <input
                value={f.author}
                onChange={e => patch(f.id, { author: e.target.value })}
                placeholder="Author (optional)"
                spellCheck={false}
                className="w-full rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-high)] p-2 text-[14px] text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)]"
              />
              <div className="flex justify-end gap-2">
                <md-text-button
                  onClick={() => cancelEdit(f.id)}
                  suppressHydrationWarning
                >
                  Cancel
                </md-text-button>
                <md-filled-button
                  onClick={() => setEditing(null)}
                  disabled={!f.text.trim()}
                  suppressHydrationWarning
                >
                  Done
                </md-filled-button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[var(--md-sys-color-on-surface)]">
                  {f.text}
                </p>
                {f.author && (
                  <p className="mt-0.5 text-[12px] text-[var(--md-sys-color-on-surface-variant)]">
                    — {f.author}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <md-icon-button
                  aria-label="Edit fortune"
                  onClick={() => setEditing(f.id)}
                  suppressHydrationWarning
                >
                  <md-icon>edit</md-icon>
                </md-icon-button>
                <md-icon-button
                  aria-label="Delete fortune"
                  onClick={() => remove(f.id)}
                  suppressHydrationWarning
                >
                  <md-icon>delete</md-icon>
                </md-icon-button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <md-text-button onClick={add} suppressHydrationWarning>
          <md-icon slot="icon">add</md-icon>
          Add fortune
        </md-text-button>
        <span className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          {usingDefaults
            ? 'Showing built-in defaults — save to override.'
            : state === 'saved'
              ? 'Saved to the board store.'
              : ''}
        </span>
      </div>

      {error && (
        <p className="md-typescale-body-medium text-[var(--md-sys-color-error)]">{error}</p>
      )}

      <div className="flex justify-end border-t border-[var(--md-sys-color-outline-variant)] pt-3">
        <md-filled-button
          onClick={save}
          disabled={!dirty || state === 'saving'}
          suppressHydrationWarning
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </md-filled-button>
      </div>
    </div>
  );
}

function ZoomPanel() {
  const zoom = React.useSyncExternalStore(subscribeZoom, readZoom, () => 1);
  const clockOpacity = React.useSyncExternalStore(
    subscribeClockOpacity,
    readClockOpacity,
    () => CLOCK_OPACITY_MAX
  );
  const clockSize = React.useSyncExternalStore(
    subscribeClockSize,
    readClockSize,
    () => DEFAULT_CLOCK_SIZE
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Browser-zoom-style scaling for the whole app. Handy when the TV
          renders the dashboard too small or too large.
        </p>
        <div className="flex items-center justify-between">
          <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
            Zoom
          </span>
          <span className="md-typescale-label-medium tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
            {zoom.toFixed(1)}x
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="h-2 w-full accent-[var(--md-sys-color-primary)]"
          />
          <md-text-button
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            suppressHydrationWarning
          >
            Reset
          </md-text-button>
        </div>
      </div>

      <div className="h-px bg-[var(--md-sys-color-outline-variant)]" />

      <div className="flex flex-col gap-2">
        <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Size and opacity of the big clock pinned to the bottom-right of the
          screen.
        </p>
        <div className="flex items-center justify-between">
          <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
            Clock size
          </span>
          <span className="md-typescale-label-medium tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
            {clockSize}px
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={CLOCK_SIZE_MIN}
            max={CLOCK_SIZE_MAX}
            step={4}
            value={clockSize}
            onChange={e => setClockSize(Number(e.target.value))}
            className="h-2 w-full accent-[var(--md-sys-color-primary)]"
          />
          <md-text-button
            onClick={() => setClockSize(DEFAULT_CLOCK_SIZE)}
            disabled={clockSize === DEFAULT_CLOCK_SIZE}
            suppressHydrationWarning
          >
            Reset
          </md-text-button>
        </div>

        <div className="flex items-center justify-between">
          <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
            Clock opacity
          </span>
          <span className="md-typescale-label-medium tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
            {clockOpacity}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={CLOCK_OPACITY_MAX}
            step={5}
            value={clockOpacity}
            onChange={e => setClockOpacity(Number(e.target.value))}
            className="h-2 w-full accent-[var(--md-sys-color-primary)]"
          />
          <md-text-button
            onClick={() => setClockOpacity(CLOCK_OPACITY_MAX)}
            disabled={clockOpacity === CLOCK_OPACITY_MAX}
            suppressHydrationWarning
          >
            Reset
          </md-text-button>
        </div>
      </div>
    </div>
  );
}

function ThemePanel() {
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

function UserSoundsPanel() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [usersError, setUsersError] = React.useState<string | null>(null);
  const [isMock, setIsMock] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const [selectedLogin, setSelectedLogin] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<NotificationSettings | null>(null);
  const [configLoading, setConfigLoading] = React.useState(false);
  const [savedSnapshot, setSavedSnapshot] = React.useState('');
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle');

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: UserListResponse = await res.json();
        if (!active) return;
        setUsers(json.users);
        setIsMock(json.isMockData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (active) setUsersError(msg || 'Failed to load users');
      } finally {
        if (active) setUsersLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedLogin) return;
    let active = true;
    (async () => {
      setConfigLoading(true);
      setSaveState('idle');
      try {
        const res = await fetch(`/api/config/${encodeURIComponent(selectedLogin)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: NotificationSettings = await res.json();
        if (!active) return;
        setConfig(json);
        setSavedSnapshot(JSON.stringify(json));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (active) {
          setConfig(null);
          setUsersError(msg || 'Failed to load user settings');
        }
      } finally {
        if (active) setConfigLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedLogin]);

  const dirty = config !== null && JSON.stringify(config) !== savedSnapshot;

  const save = async () => {
    if (!selectedLogin || !config || !dirty) return;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/config/${encodeURIComponent(selectedLogin)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: NotificationSettings = await res.json();
      setConfig(json);
      setSavedSnapshot(JSON.stringify(json));
      setSaveState('saved');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUsersError(msg || 'Failed to save user settings');
      setSaveState('idle');
    }
  };

  const query = filter.trim().toLowerCase();
  const filtered = query
    ? users.filter(u => u.login.toLowerCase().includes(query))
    : users;

  return (
    <div className="flex flex-col gap-4">
      <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
        Pick a GitHub user to customize the notification sound played when their
        pull requests produce events on the dashboard.
        {isMock ? ' Showing sample users (no storage configured).' : ''}
      </p>

      <M3TextField
        value={filter}
        placeholder="Filter users"
        ariaLabel="Filter users"
        onValueChange={setFilter}
      />

      {usersLoading ? (
        <p className="md-typescale-body-medium text-[var(--md-sys-color-outline)]">
          Loading users…
        </p>
      ) : usersError && !selectedLogin ? (
        <p className="md-typescale-body-medium text-[var(--md-sys-color-error)]">{usersError}</p>
      ) : (
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {filtered.map(user => {
            const active = selectedLogin === user.login;
            return (
              <button
                key={user.login}
                type="button"
                onClick={() => setSelectedLogin(user.login)}
                className={`flex w-full items-center gap-3 rounded-[var(--md-sys-shape-corner-small)] px-2 py-2 text-left transition-colors ${
                  active
                    ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]'
                    : 'hover:bg-[var(--md-sys-color-surface-container)]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl ?? ''}
                  alt={user.login}
                  className="h-7 w-7 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
                    {user.login}
                  </div>
                  {user.name && (
                    <div className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
                      {user.name}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center md-typescale-body-medium text-[var(--md-sys-color-outline)]">
              No users match
            </p>
          )}
        </div>
      )}

      {selectedLogin && (
        <div className="flex flex-col gap-4 border-t border-[var(--md-sys-color-outline-variant)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="md-typescale-title-small text-[var(--md-sys-color-on-surface)]">
              @{selectedLogin}
            </span>
            <md-filled-button
              onClick={save}
              disabled={!dirty || saveState === 'saving'}
              suppressHydrationWarning
            >
              {saveState === 'saving' ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </md-filled-button>
          </div>

          {configLoading ? (
            <p className="md-typescale-body-medium text-[var(--md-sys-color-outline)]">
              Loading settings…
            </p>
          ) : config ? (
            <SoundSettingsForm value={config} onChange={setConfig} />
          ) : (
            <p className="md-typescale-body-medium text-[var(--md-sys-color-error)]">
              Failed to load settings
            </p>
          )}
        </div>
      )}
    </div>
  );
}
