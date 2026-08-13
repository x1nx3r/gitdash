'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import '@material/web/labs/card/elevated-card.js';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import Slideshow from '@/components/slideshow/Slideshow';
import { useRepos } from '@/components/repos/RepoProvider';
import { subscribeStream } from '@/lib/streamClient';
import { GitHubApiResponse } from '@/types/github';

export default function Home() {
  // Hydration-safe mounted flag: true only after the client has hydrated.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [data, setData] = React.useState<GitHubApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { selected } = useRepos();
  const selectedRef = React.useRef(selected);
  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Latest-wins guard: a webhook nudge can fire a refetch while a poll is
  // still in flight; the older response must never clobber the newer one.
  const fetchSeq = React.useRef(0);

  const fetchKanbanData = React.useCallback(async (force = false) => {
    const seq = ++fetchSeq.current;
    try {
      const reposParam = selectedRef.current.join(',');
      const url = reposParam
        ? `/api/github/prs?repos=${encodeURIComponent(reposParam)}${force ? '&force=1' : ''}`
        : `/api/github/prs${force ? '?force=1' : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GitHubApiResponse = await res.json();
      if (seq !== fetchSeq.current) return;
      setData(json);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to load Kanban data:', err);
      setError(msg || 'Failed to fetch GitHub PR data');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const interval = setInterval(fetchKanbanData, 30000);
    return () => clearInterval(interval);
  }, [fetchKanbanData]);

  React.useEffect(() => {
    if (mounted) fetchKanbanData();
  }, [mounted, selected, fetchKanbanData]);

  // SSE nudge: an events message is the instant proof something changed, so
  // refetch the board (forced — the webhook already warmed the cache, and
  // skipping it guarantees current state). The 'board' message is the
  // pre-chain fallback; the 30s poll covers a dead stream.
  React.useEffect(() => {
    const unsubscribe = subscribeStream(msg => {
      if (msg.type === 'events') void fetchKanbanData(true);
      else if (msg.type === 'board') void fetchKanbanData();
    });
    return unsubscribe;
  }, [fetchKanbanData]);

  if (!mounted || (loading && !data)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--md-sys-color-surface)] p-6 text-center">
        <div className="w-72">
          <svg className="wavy-progress" viewBox="0 0 120 8" preserveAspectRatio="none" role="progressbar" aria-label="Loading">
            <path className="wavy-track" pathLength="1" d="M0,4Q5,1 10,4Q15,7 20,4Q25,1 30,4Q35,7 40,4Q45,1 50,4Q55,7 60,4Q65,1 70,4Q75,7 80,4Q85,1 90,4Q95,7 100,4Q105,1 110,4Q115,7 120,4" />
            <path className="wavy-indicator" pathLength="1" d="M0,4Q5,1 10,4Q15,7 20,4Q25,1 30,4Q35,7 40,4Q45,1 50,4Q55,7 60,4Q65,1 70,4Q75,7 80,4Q85,1 90,4Q95,7 100,4Q105,1 110,4Q115,7 120,4" />
          </svg>
        </div>
        <p className="md-typescale-label-large uppercase tracking-widest text-[var(--md-sys-color-on-surface-variant)]">
          Loading dashboard
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--md-sys-color-surface)] p-6">
        <md-elevated-card className="w-full max-w-md !block">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]">
              <md-icon suppressHydrationWarning>error_outline</md-icon>
            </div>
            <div>
              <h1 className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
                Unable to load data
              </h1>
              <p className="mt-1 md-typescale-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                {error}
              </p>
            </div>
            <md-filled-button onClick={() => void fetchKanbanData()}>Retry</md-filled-button>
          </div>
        </md-elevated-card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--md-sys-color-surface)]">
      {/* Content */}
      {data && (
        <main className="flex-1 overflow-x-auto">
          <KanbanBoard columns={data.columns} />
        </main>
      )}
      <Slideshow data={data} />
    </div>
  );
}
