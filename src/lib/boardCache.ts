import { GitHubApiResponse } from '@/types/github';
import { fetchBoardState } from './fetchBoardState';

/**
 * Per-scope board snapshot cache. Clients poll /api/github/prs (cache-first);
 * webhook deliveries rebuild the scopes that contain the affected repo, so
 * the next poll returns fresh state without touching the GitHub API.
 */

const CACHE_TTL_MS = 30_000;
const SCOPE_TTL_MS = 30 * 60_000;

interface Entry {
  data: GitHubApiResponse;
  updatedAt: number;
}

const cache = new Map<string, Entry>();
const seenAt = new Map<string, number>();
const inflight = new Map<string, Promise<GitHubApiResponse>>();

export function scopeKey(repos: string[]): string {
  return [...new Set(repos)].sort().join(',');
}

export function rememberScope(key: string): void {
  seenAt.set(key, Date.now());
}

function activeScopes(): string[] {
  const now = Date.now();
  const out: string[] = [];
  for (const [key, ts] of seenAt) {
    if (now - ts < SCOPE_TTL_MS) out.push(key);
    else {
      seenAt.delete(key);
      cache.delete(key);
    }
  }
  return out;
}

/** Active scopes (recently polled by a client) that include the repo. */
export function getScopesIncludingRepo(repo: string): string[] {
  return activeScopes().filter(key => key.split(',').includes(repo));
}

/**
 * Board for a scope: fresh cache hit, else one in-flight fetch shared by
 * everyone (polling clients, webhook rebuilds, SSE nudged refetches).
 */
export async function getBoardForScope(
  repos: string[],
  force = false
): Promise<GitHubApiResponse> {
  const key = scopeKey(repos);
  rememberScope(key);
  if (!force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.updatedAt < CACHE_TTL_MS) return hit.data;
  }
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetchBoardState(repos)
    .then(data => {
      cache.set(key, { data, updatedAt: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

/** Rebuild every active scope that includes the repo (webhook delivery). */
export async function refreshBoardsForRepo(repo: string): Promise<void> {
  for (const key of getScopesIncludingRepo(repo)) {
    try {
      await getBoardForScope(key.split(','), true);
    } catch (e) {
      console.error(`refreshBoardsForRepo ${repo} (scope ${key}):`, e);
    }
  }
}