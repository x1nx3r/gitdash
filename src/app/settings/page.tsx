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
import M3TextField from '@/components/notifications/M3TextField';
import { User, UserListResponse } from '@/types/github';
import { NotificationSettings } from '@/types/notifications';

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

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 lg:p-8">
        <SectionCard title="Notification sounds" icon="notifications">
          <UserSoundsPanel />
        </SectionCard>

        <SectionCard title="Repositories" icon="folder">
          <RepoSettingsSection />
        </SectionCard>
      </main>
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
