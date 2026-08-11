import { createHmac, timingSafeEqual } from 'crypto';
import { getJson, isS3Configured, putJson } from '@/lib/s3';
import { NotificationEvent, PrSnapshot } from '@/types/notifications';

/**
 * Server-side notification hub. GitHub webhooks write events here and the
 * client polls them. Without a webhook secret nothing is written and
 * notifications are disabled entirely.
 */

const EVENTS_KEY = 'notifications/events.json';
const SCOPE_KEY = 'webhook_scope.json';
const MAX_EVENTS = 100;
const HOOK_CACHE_TTL_MS = 60 * 60 * 1000;
const ORG_REPOS_TTL_MS = 10 * 60 * 1000;

export function webhooksConfigured(): boolean {
  return Boolean(process.env.GITHUB_WEBHOOK_SECRET) && isS3Configured();
}

export async function listEvents(): Promise<NotificationEvent[]> {
  const events = await getJson<NotificationEvent[]>(EVENTS_KEY);
  return Array.isArray(events) ? events : [];
}

export async function appendEvent(ev: NotificationEvent): Promise<void> {
  const events = await listEvents();
  const next = [...events, ev];
  while (next.length > MAX_EVENTS) next.shift();
  await putJson(EVENTS_KEY, next);
}

export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const MESSAGES: Record<NotificationEvent['type'], (pr: PrSnapshot) => string> = {
  new_pr: pr => `${pr.repository.name} #${pr.number} needs review`,
  ready_to_merge: pr => `${pr.repository.name} #${pr.number} is ready to merge`,
  merged: pr => `${pr.repository.name} #${pr.number} was merged`,
  changes_requested: pr => `Changes requested on ${pr.repository.name} #${pr.number}`,
};

export function buildEvent(type: NotificationEvent['type'], pr: PrSnapshot): NotificationEvent {
  return { type, pr, message: MESSAGES[type](pr), timestamp: Date.now() };
}

/** Slim PR shape that webhook payloads can be reduced to. */
export function toPrSnapshot(payload: {
  id?: number;
  number?: number;
  title?: string;
  html_url?: string;
  repository?: { full_name?: string };
  user?: { login?: string; avatar_url?: string };
}): PrSnapshot {
  const fullName = payload.repository?.full_name ?? 'org/repo';
  return {
    id: payload.id ?? 0,
    number: payload.number ?? 0,
    title: payload.title ?? '',
    url: payload.html_url ?? '',
    repository: {
      fullName,
      name: fullName.split('/').pop() ?? 'repository',
    },
    author: {
      login: payload.user?.login ?? 'unknown',
      avatarUrl: payload.user?.avatar_url,
    },
  };
}

/**
 * Webhook delivery scope. Each hook that delivers events is classified once
 * (repo-level or org-level) via the GitHub API and persisted in S3, so the
 * dashboard can default its repo scope to exactly what the webhooks cover:
 * a repo hook scopes that one repo, an org hook scopes every repo in the org.
 */

interface HookEntry {
  hookId: string;
  type: 'repo' | 'org';
  repo?: string;
  org?: string;
}

const hookCache = new Map<string, { entry: HookEntry; ts: number }>();
const orgReposCache = new Map<string, { repos: string[]; ts: number }>();
const scopeCache = new Map<string, { repos: string[]; ts: number }>();

export async function observeHookEvent(hookId: string, fullName: string): Promise<void> {
  const cached = hookCache.get(hookId);
  if (cached && Date.now() - cached.ts < HOOK_CACHE_TTL_MS) return;

  const entry = await resolveHookType(hookId, fullName);
  if (!entry) return;
  hookCache.set(hookId, { entry, ts: Date.now() });

  try {
    const hooks = (await getJson<HookEntry[]>(SCOPE_KEY)) ?? [];
    const idx = hooks.findIndex(h => h.hookId === hookId);
    if (idx >= 0) hooks[idx] = entry;
    else hooks.push(entry);
    await putJson(SCOPE_KEY, hooks);
    scopeCache.clear();
  } catch (e) {
    console.error('observeHookEvent persist:', e);
  }
}

async function resolveHookType(
  hookId: string,
  fullName: string
): Promise<HookEntry | null> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return null;
  const owner = fullName.split('/')[0];
  const headers = { Authorization: `Bearer ${pat}` };

  const repoRes = await fetch(
    `https://api.github.com/repos/${fullName}/hooks/${hookId}`,
    { headers }
  );
  if (repoRes.ok) return { hookId, type: 'repo', repo: fullName };

  const orgRes = await fetch(
    `https://api.github.com/orgs/${owner}/hooks/${hookId}`,
    { headers }
  );
  if (orgRes.ok) return { hookId, type: 'org', org: owner };

  return null;
}

async function listOrgRepos(org: string): Promise<string[]> {
  const cached = orgReposCache.get(org);
  if (cached && Date.now() - cached.ts < ORG_REPOS_TTL_MS) return cached.repos;

  const pat = process.env.GITHUB_PAT;
  if (!pat) return [];
  const headers = { Authorization: `Bearer ${pat}` };
  const repos: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://api.github.com/orgs/${org}/repos?per_page=100&page=${page}`,
      { headers }
    );
    if (!res.ok) break;
    const arr = (await res.json()) as { full_name: string }[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    repos.push(...arr.map(r => r.full_name));
    if (arr.length < 100) break;
  }
  orgReposCache.set(org, { repos, ts: Date.now() });
  return repos;
}

/**
 * Full repo list covered by the registered webhooks: each repo hook
 * contributes its repo, each org hook contributes all repos in the org.
 * Empty when webhooks aren't configured or nothing has been observed yet.
 */
export async function getWebhookScopeRepos(): Promise<string[]> {
  if (!webhooksConfigured()) return [];
  const cached = scopeCache.get('scope');
  if (cached && Date.now() - cached.ts < ORG_REPOS_TTL_MS) return cached.repos;

  const hooks = await getJson<HookEntry[]>(SCOPE_KEY);
  if (!Array.isArray(hooks) || hooks.length === 0) return [];

  const set = new Set<string>();
  for (const h of hooks) {
    if (h.type === 'repo' && h.repo) {
      set.add(h.repo);
    } else if (h.type === 'org' && h.org) {
      for (const repo of await listOrgRepos(h.org)) set.add(repo);
    }
  }
  const repos = [...set];
  scopeCache.set('scope', { repos, ts: Date.now() });
  return repos;
}
