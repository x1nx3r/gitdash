import { NextResponse, NextRequest } from 'next/server';
import { GitHubApiResponse, KanbanColumns, PullRequest, User } from '@/types/github';
import { isS3Configured, putJson } from '@/lib/s3';
import { enrichPRs, deriveColumn, getAccessibleRepos } from '@/lib/githubEnrich';
import { getWebhookScopeRepos } from '@/lib/notificationHub';
import { requireAuth } from '@/lib/auth';

function parseIncludedRepos(request: NextRequest): string[] {
  const raw = request.nextUrl.searchParams.get('repos');
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Scope a search query: explicit repos first, else fall back to the repos
// resolved from webhook scope / accessible-repos (all are owner/repo names).
function buildSearchQuery(base: string, includedRepos: string[], fallbackRepos: string[]): string {
  const repos = includedRepos.length > 0 ? includedRepos : fallbackRepos;
  return base + repos.map(repo => `+repo:${repo}`).join('');
}

interface GitHubIssueSearchItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  draft: boolean;
  labels: { name: string }[];
  pull_request?: { merged_at: string | null };
}

interface GitHubIssueSearchResponse {
  items: GitHubIssueSearchItem[];
}

/** Sort a column's PRs oldest created first. */
function sortOldestFirst(prs: PullRequest[]): void {
  prs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function observeUsers(prs: PullRequest[]): void {
  if (!isS3Configured()) return;
  const authors: User[] = [];
  const reviewers: User[] = [];
  for (const pr of prs) {
    authors.push({ login: pr.author.login, name: pr.author.name, avatarUrl: pr.author.avatarUrl });
    for (const r of pr.reviewers) {
      reviewers.push({ login: r.login, avatarUrl: r.avatarUrl });
    }
  }
  void putJson('prs_users.json', { authors, reviewers });
}

// Dynamic mock generator for dev/offline testing
function getMockPullRequests(): PullRequest[] {
  const now = new Date();
  
  return [
    {
      id: 101,
      number: 482,
      title: 'feat(auth): Add WebAuthn passkey support for SSO login flow',
      url: 'https://github.com/org/core-service/pull/482',
      repository: { name: 'core-service', fullName: 'org/core-service', owner: 'org' },
      author: { login: 'alex_dev', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', name: 'Alex Rivera' },
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
      updatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      isDraft: false,
      isStale: false,
      column: 'needs_review',
      stats: { changedFiles: 24, additions: 1180, deletions: 340 },
      reviewers: [
        { login: 'sarah_m', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', state: 'PENDING' },
      ],
      labels: ['feature', 'security'],
    },
    {
      id: 102,
      number: 319,
      title: 'refactor(api): Migrate legacy REST endpoints to GraphQL query batching',
      url: 'https://github.com/org/api-gateway/pull/319',
      repository: { name: 'api-gateway', fullName: 'org/api-gateway', owner: 'org' },
      author: { login: 'marcus_k', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', name: 'Marcus Chen' },
      createdAt: new Date(now.getTime() - 28 * 3600 * 1000).toISOString(), // > 24h stale
      updatedAt: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
      isDraft: false,
      isStale: true,
      column: 'needs_review',
      stats: { changedFiles: 12, additions: 640, deletions: 210 },
      reviewers: [
        { login: 'dave_tech', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', state: 'PENDING' },
      ],
      labels: ['backend', 'stale'],
    },
    {
      id: 103,
      number: 1204,
      title: 'fix(db): Resolve connection pool starvation under high concurrent read load',
      url: 'https://github.com/org/backend-pipeline/pull/1204',
      repository: { name: 'backend-pipeline', fullName: 'org/backend-pipeline', owner: 'org' },
      author: { login: 'elena_v', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', name: 'Elena Rostova' },
      createdAt: new Date(now.getTime() - 14 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      isDraft: false,
      isStale: false,
      column: 'changes_requested',
      stats: { changedFiles: 3, additions: 45, deletions: 12 },
      reviewers: [
        { login: 'sarah_m', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', state: 'CHANGES_REQUESTED' },
      ],
      labels: ['database', 'high-priority'],
    },
    {
      id: 104,
      number: 88,
      title: 'wip(ui): Experimental dark mode palette variables for dashboard',
      url: 'https://github.com/org/web-frontend/pull/88',
      repository: { name: 'web-frontend', fullName: 'org/web-frontend', owner: 'org' },
      author: { login: 'jordan_b', avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', name: 'Jordan Blake' },
      createdAt: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
      isDraft: true,
      isStale: false,
      column: 'needs_review',
      stats: { changedFiles: 18, additions: 890, deletions: 60 },
      reviewers: [],
      labels: ['draft', 'ui'],
    },
    {
      id: 105,
      number: 512,
      title: 'feat(deploy): Automate blue-green Kubernetes zero-downtime rollouts',
      url: 'https://github.com/org/infra-ops/pull/512',
      repository: { name: 'infra-ops', fullName: 'org/infra-ops', owner: 'org' },
      author: { login: 'dave_tech', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', name: 'Dave Miller' },
      createdAt: new Date(now.getTime() - 8 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      isDraft: false,
      isStale: false,
      column: 'ready_to_merge',
      stats: { changedFiles: 31, additions: 2200, deletions: 950 },
      reviewers: [
        { login: 'alex_dev', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', state: 'APPROVED' },
        { login: 'elena_v', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', state: 'APPROVED' },
      ],
      labels: ['devops', 'approved'],
    },
    {
      id: 106,
      number: 294,
      title: 'perf(cache): Enable Redis cluster read-replicas for session caching',
      url: 'https://github.com/org/core-service/pull/294',
      repository: { name: 'core-service', fullName: 'org/core-service', owner: 'org' },
      author: { login: 'sarah_m', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', name: 'Sarah Miller' },
      createdAt: new Date(now.getTime() - 6 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      mergedAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
      isDraft: false,
      isStale: false,
      column: 'merged_today',
      stats: { changedFiles: 9, additions: 310, deletions: 88 },
      reviewers: [
        { login: 'marcus_k', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', state: 'APPROVED' },
      ],
      labels: ['performance', 'landed'],
    },
    {
      id: 107,
      number: 741,
      title: 'fix(auth): Patch JWT expiration token validation edge case',
      url: 'https://github.com/org/auth-service/pull/741',
      repository: { name: 'auth-service', fullName: 'org/auth-service', owner: 'org' },
      author: { login: 'alex_dev', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', name: 'Alex Rivera' },
      createdAt: new Date(now.getTime() - 12 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
      mergedAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
      isDraft: false,
      isStale: false,
      column: 'merged_today',
      stats: { changedFiles: 2, additions: 14, deletions: 6 },
      reviewers: [
        { login: 'elena_v', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', state: 'APPROVED' },
      ],
      labels: ['hotfix', 'landed'],
    },
  ];
}

export async function GET(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;
  const pat = process.env.GITHUB_PAT;
  const includedRepos = parseIncludedRepos(request);

  if (pat) {
    try {
      // Live GitHub API integration
      // Default scope when no repos are selected: the webhook-covered repos
      // (repo hook = that repo, org hook = all org repos), else all accessible.
      const accessibleRepos =
        includedRepos.length === 0
          ? await (async () => {
              const webhookScope = await getWebhookScopeRepos();
              return webhookScope.length > 0 ? webhookScope : await getAccessibleRepos();
            })()
          : [];
      const searchHeaders = {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github.v3+json',
      };

      const openQuery = buildSearchQuery('is:pr+is:open', includedRepos, accessibleRepos);
      const response = await fetch(
        `https://api.github.com/search/issues?q=${openQuery}&sort=updated`,
        {
          headers: searchHeaders,
          next: { revalidate: 30 },
        }
      );

      if (response.ok) {
        const data: GitHubIssueSearchResponse = await response.json();
        const items = data.items.filter((item: GitHubIssueSearchItem) => {
          if (includedRepos.length === 0) return true;
          const fullName = item.repository_url
            ? item.repository_url.split('/').slice(-2).join('/')
            : '';
          return includedRepos.includes(fullName);
        });

        // Merged today: open-PR search never returns merged PRs, so query
        // the merged ones separately (merged:>= UTC midnight today).
        const mergedItems = await (async (): Promise<GitHubIssueSearchItem[]> => {
          const todayUtc = new Date().toISOString().slice(0, 10);
          const mergedQuery = buildSearchQuery(
            `is:pr+is:merged+merged:>=${todayUtc}`,
            includedRepos,
            accessibleRepos
          );
          const mergedRes = await fetch(
            `https://api.github.com/search/issues?q=${mergedQuery}&sort=updated`,
            {
              headers: searchHeaders,
              next: { revalidate: 30 },
            }
          );
          if (!mergedRes.ok) return [];
          const mergedData: GitHubIssueSearchResponse = await mergedRes.json();
          return mergedData.items.filter((item: GitHubIssueSearchItem) => {
            if (includedRepos.length === 0) return true;
            const fullName = item.repository_url
              ? item.repository_url.split('/').slice(-2).join('/')
              : '';
            return includedRepos.includes(fullName);
          });
        })();

        // First-level enrich: reviewer states + CI status per PR.
        const enrichments = await enrichPRs(
          [...items, ...mergedItems].map(item => ({
            fullName: item.repository_url.split('/').slice(-2).join('/'),
            number: item.number,
          }))
        );
        const mergedEnrichments = enrichments.slice(items.length);

        // Transform live GitHub PR payload
        const livePrs: PullRequest[] = items.map((item, i) => {
          const enrich = enrichments[i];
          const isStale = (new Date().getTime() - new Date(item.created_at).getTime()) > 24 * 3600 * 1000;
          return {
            id: item.id,
            number: item.number,
            title: item.title,
            url: item.html_url,
            repository: {
              name: item.repository_url ? item.repository_url.split('/').pop() ?? 'repository' : 'repository',
              fullName: item.repository_url ? item.repository_url.split('/').slice(-2).join('/') : 'org/repo',
              owner: 'org',
            },
            author: {
              login: item.user.login,
              avatarUrl: item.user.avatar_url,
            },
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            isDraft: item.draft || false,
            isStale,
            column: deriveColumn({
              mergedAt: item.pull_request?.merged_at ?? null,
              isDraft: item.draft || false,
              reviewers: enrich?.reviewers ?? [],
            }),
            stats: enrich?.stats ?? { changedFiles: 0, additions: 0, deletions: 0 },
            reviewers: enrich?.reviewers ?? [],
            labels: item.labels.map((l: { name: string }) => l.name),
          };
        });

        const mergedPrs: PullRequest[] = mergedItems.map((item, i) => {
          const enrich = mergedEnrichments[i];
          return {
            id: item.id,
            number: item.number,
            title: item.title,
            url: item.html_url,
            repository: {
              name: item.repository_url ? item.repository_url.split('/').pop() ?? 'repository' : 'repository',
              fullName: item.repository_url ? item.repository_url.split('/').slice(-2).join('/') : 'org/repo',
              owner: 'org',
            },
            author: {
              login: item.user.login,
              avatarUrl: item.user.avatar_url,
            },
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            mergedAt: item.pull_request?.merged_at ?? null,
            isDraft: item.draft || false,
            isStale: false,
            column: 'merged_today',
            stats: enrich?.stats ?? { changedFiles: 0, additions: 0, deletions: 0 },
            reviewers: enrich?.reviewers ?? [],
            labels: item.labels.map((l: { name: string }) => l.name),
          };
        });

        const allPrs = [...livePrs, ...mergedPrs];
        sortOldestFirst(livePrs);
        sortOldestFirst(mergedPrs);

        const columns: KanbanColumns = {
          needs_review: livePrs.filter(pr => pr.column === 'needs_review'),
          changes_requested: livePrs.filter(pr => pr.column === 'changes_requested'),
          ready_to_merge: livePrs.filter(pr => pr.column === 'ready_to_merge'),
          merged_today: mergedPrs,
        };

        const result: GitHubApiResponse = {
          columns,
          metrics: {
            totalOpen: livePrs.length,
            staleCount: livePrs.filter(pr => pr.isStale).length,
            readyToMergeCount: columns.ready_to_merge.length,
            mergedTodayCount: mergedPrs.length,
            lastUpdated: new Date().toISOString(),
          },
          isMockData: false,
        };
        observeUsers(allPrs);

        return NextResponse.json(result);
      }
    } catch (error) {
      console.error('GitHub API error, falling back to mock data:', error);
    }
  }

  // Return realistic mock data if GITHUB_PAT is absent or fails
  let allPrs = getMockPullRequests();
  if (includedRepos.length > 0) {
    allPrs = allPrs.filter(pr => includedRepos.includes(pr.repository.fullName));
  }
  sortOldestFirst(allPrs);
  const columns: KanbanColumns = {
    needs_review: allPrs.filter(pr => pr.column === 'needs_review'),
    changes_requested: allPrs.filter(pr => pr.column === 'changes_requested'),
    ready_to_merge: allPrs.filter(pr => pr.column === 'ready_to_merge'),
    merged_today: allPrs.filter(pr => pr.column === 'merged_today'),
  };

  const result: GitHubApiResponse = {
    columns,
    metrics: {
      totalOpen: allPrs.filter(pr => pr.column !== 'merged_today').length,
      staleCount: allPrs.filter(pr => pr.isStale).length,
      readyToMergeCount: columns.ready_to_merge.length,
      mergedTodayCount: columns.merged_today.length,
      lastUpdated: new Date().toISOString(),
    },
    isMockData: !pat,
  };
  observeUsers(allPrs);

  return NextResponse.json(result);
}
