'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import '@material/web/button/text-button.js';
import { useRepos } from '@/components/repos/RepoProvider';
import M3TextField from '@/components/notifications/M3TextField';

export default function RepoSettingsSection() {
  const {
    available,
    loading,
    error,
    isMock,
    selected,
    toggleRepo,
    selectAll,
    clearAll,
  } = useRepos();
  const [filter, setFilter] = React.useState('');

  const query = filter.trim().toLowerCase();
  const filtered = query
    ? available.filter(
        r =>
          r.name.toLowerCase().includes(query) ||
          r.fullName.toLowerCase().includes(query)
      )
    : available;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="md-typescale-title-small text-[var(--md-sys-color-on-surface)]">
          Included repositories
        </span>
        <div className="flex items-center gap-1">
          <md-text-button onClick={selectAll} suppressHydrationWarning>
            Select all
          </md-text-button>
          <md-text-button onClick={clearAll} suppressHydrationWarning>
            Clear
          </md-text-button>
        </div>
      </div>

      {isMock && (
        <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Sample repositories (no GitHub token configured).
        </p>
      )}

      <M3TextField
        value={filter}
        placeholder="Filter repositories"
        ariaLabel="Filter repositories"
        onValueChange={setFilter}
      />

      {loading ? (
        <p className="md-typescale-body-medium text-[var(--md-sys-color-outline)]">
          Loading repositories…
        </p>
      ) : error ? (
        <p className="md-typescale-body-medium text-[var(--md-sys-color-error)]">{error}</p>
      ) : (
        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {filtered.map(repo => {
            const included = selected.includes(repo.fullName);
            return (
              <button
                key={repo.fullName}
                type="button"
                onClick={() => toggleRepo(repo.fullName)}
                className="flex w-full items-center gap-3 rounded-[var(--md-sys-shape-corner-small)] px-2 py-2 text-left transition-colors hover:bg-[var(--md-sys-color-surface-container)]"
              >
                <md-icon
                  style={{
                    fontSize: '20px',
                    color: included
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-outline)',
                  }}
                  suppressHydrationWarning
                >
                  {included ? 'check_circle' : 'radio_button_unchecked'}
                </md-icon>
                <div className="min-w-0">
                  <div className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
                    {repo.name}
                  </div>
                  <div className="md-typescale-label-small text-[var(--md-sys-color-outline)]">
                    {repo.fullName}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center md-typescale-body-medium text-[var(--md-sys-color-outline)]">
              No repositories match
            </p>
          )}
        </div>
      )}
    </div>
  );
}
