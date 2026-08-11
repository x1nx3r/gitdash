'use client';

import * as React from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Repo, RepoListResponse } from '@/types/github';

const STORAGE_KEY = 'gitdash.repos.v1';

interface RepoContextValue {
  available: Repo[];
  loading: boolean;
  error: string | null;
  isMock: boolean;
  selected: string[]; // full names of included repos; empty = all
  toggleRepo: (fullName: string) => void;
  setSelected: (fullNames: string[]) => void;
  selectAll: () => void;
  clearAll: () => void;
}

const RepoContext = React.createContext<RepoContextValue | null>(null);

export function useRepos(): RepoContextValue {
  const ctx = React.useContext(RepoContext);
  if (!ctx) throw new Error('useRepos must be used within a RepoProvider');
  return ctx;
}

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = React.useState<Repo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isMock, setIsMock] = React.useState(false);
  const [selected, setSelected] = useLocalStorage<string[]>(STORAGE_KEY, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/github/repos');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: RepoListResponse = await res.json();
        if (!active) return;
        setAvailable(json.repos);
        setIsMock(json.isMockData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (active) setError(msg || 'Failed to load repos');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggleRepo = React.useCallback(
    (fullName: string) => {
      setSelected(prev =>
        prev.includes(fullName)
          ? prev.filter(r => r !== fullName)
          : [...prev, fullName]
      );
    },
    [setSelected]
  );

  const selectAll = React.useCallback(() => {
    setSelected(available.map(r => r.fullName));
  }, [available, setSelected]);

  const clearAll = React.useCallback(() => setSelected([]), [setSelected]);

  const value = React.useMemo<RepoContextValue>(
    () => ({
      available,
      loading,
      error,
      isMock,
      selected,
      toggleRepo,
      setSelected,
      selectAll,
      clearAll,
    }),
    [available, loading, error, isMock, selected, toggleRepo, setSelected, selectAll, clearAll]
  );

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}
