import { PRDiffStats, PullRequest, Reviewer } from '@/types/github';

/**
 * First-level enrichment for live PRs: real reviewer states and diff stats.
 * Results are cached in-process for ENRICH_TTL_MS and requests are deduped,
 * so the GitHub core rate limit is only touched once per PR per minute.
 */

const ENRICH_TTL_MS = 60_000;
const CONCURRENCY = 5;

export type PRColumn = PullRequest['column'];

/**
 * Derive the kanban column from GitHub review state:
 * merged > changes requested > fully approved > needs review.
 */
export function deriveColumn(input: {
  mergedAt?: string | null;
  isDraft?: boolean;
  reviewers: Reviewer[];
}): PRColumn {
  if (input.mergedAt) return 'merged_today';
  const states = input.reviewers.map(r => r.state);
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.length > 0 && states.every(s => s === 'APPROVED')) return 'ready_to_merge';
  return 'needs_review';
}

export interface Enrichment {
  reviewers: Reviewer[];
  stats: PRDiffStats;
}

interface GitHubReview {
  user: { login: string; avatar_url: string };
  state: string;
}

interface GitHubPullDetails {
  user?: { login: string };
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

const cache = new Map<string, { data: Enrichment | null; ts: number }>();
const inFlight = new Map<string, Promise<Enrichment | null>>();

/**
 * Drop the cached/in-flight enrichment for one PR so the next read refetches
 * fresh reviewer states and stats (called when a webhook delivery implies
 * the current snapshot is stale).
 */
export function invalidateEnrichment(fullName: string, number: number): void {
  const key = `${fullName}#${number}`;
  cache.delete(key);
  inFlight.delete(key);
}

export async function enrichPR(fullName: string, number: number): Promise<Enrichment | null> {
  const key = `${fullName}#${number}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < ENRICH_TTL_MS) return cached.data;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = doEnrich(fullName, number);
  inFlight.set(key, promise);
  try {
    const data = await promise;
    cache.set(key, { data, ts: Date.now() });
    return data;
  } finally {
    inFlight.delete(key);
  }
}

async function doEnrich(fullName: string, number: number): Promise<Enrichment | null> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return null;
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
  };

  try {
    const pullRes = await fetch(
      `https://api.github.com/repos/${fullName}/pulls/${number}`,
      { headers }
    );
    if (!pullRes.ok) return null;
    const pull: GitHubPullDetails = await pullRes.json();
    const authorLogin = pull.user?.login;

    // Reviewer states: keep the latest review per user, excluding self-reviews.
    const reviewers: Reviewer[] = [];
    const reviewsRes = await fetch(
      `https://api.github.com/repos/${fullName}/pulls/${number}/reviews`,
      { headers }
    );
    if (reviewsRes.ok) {
      const reviews: GitHubReview[] = await reviewsRes.json();
      const latestByUser = new Map<string, GitHubReview>();
      for (const r of reviews) {
        if (r.user.login === authorLogin) continue;
        latestByUser.set(r.user.login, r);
      }
      for (const r of latestByUser.values()) {
        const state =
          r.state === 'APPROVED'
            ? 'APPROVED'
            : r.state === 'CHANGES_REQUESTED'
              ? 'CHANGES_REQUESTED'
              : 'PENDING';
        reviewers.push({ login: r.user.login, avatarUrl: r.user.avatar_url, state });
      }
    }

    // Diff stats come straight off the pulls payload — no extra API call.
    const stats: PRDiffStats = {
      changedFiles: pull.changed_files ?? 0,
      additions: pull.additions ?? 0,
      deletions: pull.deletions ?? 0,
    };

    return { reviewers, stats };
  } catch {
    return null;
  }
}

/** Enrich a list of PRs with bounded concurrency, preserving order. */
export async function enrichPRs(
  items: { fullName: string; number: number }[]
): Promise<(Enrichment | null)[]> {
  const results: (Enrichment | null)[] = new Array(items.length).fill(null);
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(item => enrichPR(item.fullName, item.number))
    );
    chunkResults.forEach((r, j) => {
      results[i + j] = r;
    });
  }
  return results;
}

const repoCache = new Map<string, { fullNames: string[]; ts: number }>();
const REPO_TTL_MS = 10 * 60_000;

/**
 * Repos the PAT can access, most recently updated first. Used to scope
 * search queries when no explicit repos are selected, so the board doesn't
 * show all of GitHub. /user/repos works for classic and fine-grained tokens
 * alike, whereas /user/orgs misses fine-grained repo-level grants.
 */
export async function getAccessibleRepos(): Promise<string[]> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return [];
  const cached = repoCache.get('repos');
  if (cached && Date.now() - cached.ts < REPO_TTL_MS) return cached.fullNames;

  const promise = (async () => {
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!res.ok) return [];
    const repos: { full_name: string }[] = await res.json();
    return repos.map(r => r.full_name);
  })();

  try {
    const fullNames = await promise;
    repoCache.set('repos', { fullNames, ts: Date.now() });
    return fullNames;
  } finally {
    void promise;
  }
}
