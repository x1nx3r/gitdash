'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import '@material/web/divider/divider.js';
import '@material/web/button/filled-button.js';
import M3TextField from '@/components/notifications/M3TextField';
import SoundSettingsForm from '@/components/settings/SoundSettingsForm';
import { useRepos } from '@/components/repos/RepoProvider';
import { playCustomSound } from '@/lib/soundEngine';
import { User, UserListResponse } from '@/types/github';
import { NotificationSettings, SoundLibraryEntry } from '@/types/notifications';

const MAX_SOUND_BYTES = 2 * 1024 * 1024;

export default function UserSoundsPanel() {
  const { selected, available, loading: reposLoading } = useRepos();
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

  const [sounds, setSounds] = React.useState<SoundLibraryEntry[]>([]);
  const [libraryError, setLibraryError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/sound-library');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { sounds: SoundLibraryEntry[] };
        if (!active) return;
        setSounds(json.sounds);
        setLibraryError(null);
      } catch (e) {
        if (active) {
          setLibraryError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const uploadSound = React.useCallback(
    async (file: File): Promise<SoundLibraryEntry | null> => {
      if (!file.type.startsWith('audio/')) {
        setLibraryError('Only audio files are accepted');
        return null;
      }
      if (file.size > MAX_SOUND_BYTES) {
        setLibraryError('File is too large (max 2 MB)');
        return null;
      }
      const res = await fetch('/api/sound-library', {
        method: 'POST',
        headers: { 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const entry = (await res.json()) as SoundLibraryEntry;
      setSounds(prev => [...prev, entry]);
      return entry;
    },
    []
  );

  const deleteSound = React.useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/sound-library/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSounds(prev => prev.filter(s => s.id !== id));
      } catch (e) {
        setLibraryError(e instanceof Error ? e.message : String(e));
      }
    },
    []
  );

  const selectedCount = selected.length;
  const scoped = selectedCount > 0;
  const repoLabel = scoped
    ? `${selectedCount} selected repo${selectedCount === 1 ? '' : 's'}`
    : 'all your repos';

  React.useEffect(() => {
    let active = true;
    (async () => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const qs = scoped
          ? `?repos=${encodeURIComponent(selected.join(','))}`
          : '';
        const res = await fetch(`/api/users${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: UserListResponse = await res.json();
        if (!active) return;
        setUsers(json.users);
        setIsMock(json.isMockData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (active) setUsersError(msg || 'Failed to load contributors');
      } finally {
        if (active) setUsersLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [scoped, selected]);

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
      window.dispatchEvent(new Event('gitdash:sound-config-updated'));
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

  const selectedUser = users.find(u => u.login === selectedLogin) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="md-typescale-title-small text-[var(--md-sys-color-on-surface)]">
            Sound library
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--md-sys-color-primary-container)] px-3 py-1.5 text-[var(--md-sys-color-on-primary-container)] md-typescale-label-large hover:brightness-95">
            <md-icon style={{ fontSize: '18px' }}>upload_file</md-icon>
            Upload
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) {
                  try {
                    await uploadSound(file);
                  } catch (err) {
                    setLibraryError(err instanceof Error ? err.message : String(err));
                  }
                }
              }}
            />
          </label>
        </div>

        {libraryError && (
          <p className="md-typescale-body-small text-[var(--md-sys-color-error)]">
            {libraryError}
          </p>
        )}

        {sounds.length === 0 && !libraryError ? (
          <p className="md-typescale-label-small text-[var(--md-sys-color-outline)]">
            No sounds yet — upload audio clips here, then assign them to
            contributors below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sounds.map(s => (
              <span
                key={s.id}
                className="flex items-center gap-1.5 rounded-full bg-[var(--md-sys-color-surface-container)] py-1 pl-3 pr-1"
              >
                <span className="max-w-40 truncate md-typescale-label-medium text-[var(--md-sys-color-on-surface)]">
                  {s.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void playCustomSound(
                      `/api/sound-library/${encodeURIComponent(s.id)}`,
                      0.7
                    )
                  }
                  aria-label={`Preview ${s.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                >
                  <md-icon style={{ fontSize: '16px' }}>play_circle</md-icon>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSound(s.id)}
                  aria-label={`Delete ${s.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                >
                  <md-icon style={{ fontSize: '16px' }}>delete</md-icon>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <md-divider></md-divider>

      <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
        Pick a GitHub contributor to customize the notification sound played
        when their pull requests produce events on the dashboard.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="md-typescale-body-small text-[var(--md-sys-color-on-surface-variant)]">
            Contributors of
          </span>
          <span className="rounded-full bg-[var(--md-sys-color-surface-container-high)] px-2 py-0.5 md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
            {reposLoading ? '…' : repoLabel}
          </span>
        </div>
        {isMock && (
          <p className="md-typescale-label-small text-[var(--md-sys-color-outline)]">
            Sample users — no GitHub token configured. Sounds still apply once
            real events arrive.
          </p>
        )}
        {!scoped && !reposLoading && available.length > 0 && (
          <p className="md-typescale-label-small text-[var(--md-sys-color-outline)]">
            No repos selected — showing contributors of all accessible repos.
          </p>
        )}
      </div>

      <M3TextField
        value={filter}
        placeholder="Filter contributors"
        ariaLabel="Filter contributors"
        onValueChange={setFilter}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-1 overflow-y-auto rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)] p-1 lg:max-h-[60vh]">
          {usersLoading ? (
            <p className="px-3 py-6 text-center md-typescale-body-medium text-[var(--md-sys-color-outline)]">
              Loading contributors…
            </p>
          ) : usersError ? (
            <p className="px-3 py-6 text-center md-typescale-body-medium text-[var(--md-sys-color-error)]">
              {usersError}
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-6 text-center md-typescale-body-medium text-[var(--md-sys-color-outline)]">
              {users.length === 0 ? 'No contributors found' : 'No users match'}
            </p>
          ) : (
            filtered.map(user => {
              const active = selectedLogin === user.login;
              return (
                <button
                  key={user.login}
                  type="button"
                  onClick={() => setSelectedLogin(user.login)}
                  className={`flex w-full items-center gap-3 rounded-[var(--md-sys-shape-corner-small)] px-2 py-2 text-left transition-colors ${
                    active
                      ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]'
                      : 'hover:bg-[var(--md-sys-color-surface-container-high)]'
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
            })
          )}
          {!usersLoading && !usersError && (
            <div className="border-t border-[var(--md-sys-color-outline-variant)] px-2 py-1.5 text-center md-typescale-label-small text-[var(--md-sys-color-outline)]">
              {filtered.length} of {users.length} contributors
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {selectedLogin ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="md-typescale-title-small text-[var(--md-sys-color-on-surface)]">
                  {selectedUser?.name ? `${selectedUser.name} ` : ''}@{selectedLogin}
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
                <SoundSettingsForm
                  value={config}
                  onChange={setConfig}
                  sounds={sounds}
                  onUpload={uploadSound}
                />
              ) : (
                <p className="md-typescale-body-medium text-[var(--md-sys-color-error)]">
                  Failed to load settings
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)] p-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <md-icon
                  style={{ fontSize: '32px' }}
                  className="text-[var(--md-sys-color-outline)]"
                >
                  music_note
                </md-icon>
                <p className="md-typescale-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                  Select a contributor to customize their sounds
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}