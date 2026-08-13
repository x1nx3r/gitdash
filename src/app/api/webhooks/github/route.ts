import { NextResponse } from 'next/server';
import {
  appendEvent,
  buildEvent,
  listEvents,
  observeHookEvent,
  toPrSnapshot,
  verifySignature,
  webhooksConfigured,
} from '@/lib/notificationHub';
import { invalidateEnrichment } from '@/lib/githubEnrich';
import { refreshBoardsForRepo } from '@/lib/boardCache';
import { broadcastSSE } from '@/lib/streamHub';

const PR_EVENTS: Record<string, boolean> = {
  opened: true,
  reopened: true,
  ready_for_review: true,
};

interface GitHubPullRequestEvent {
  action?: string;
  repository?: { full_name?: string };
  pull_request?: {
    id?: number;
    number?: number;
    title?: string;
    html_url?: string;
    merged?: boolean;
    draft?: boolean;
    user?: { login?: string; avatar_url?: string };
  };
}

interface GitHubReviewEvent {
  action?: string;
  repository?: { full_name?: string };
  review?: {
    state?: string;
  };
  pull_request?: GitHubPullRequestEvent['pull_request'];
}

export async function POST(request: Request) {
  if (!webhooksConfigured()) {
    return NextResponse.json(
      { error: 'Webhooks are not configured (GITHUB_WEBHOOK_SECRET missing)' },
      { status: 503 }
    );
  }

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = request.headers.get('x-github-event');
  if (event === 'ping') {
    return NextResponse.json({ ok: true });
  }

  let payload: GitHubPullRequestEvent | GitHubReviewEvent;
  try {
    payload = JSON.parse(raw) as GitHubPullRequestEvent | GitHubReviewEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // Classify the delivering hook (repo vs org) so the dashboard can scope
    // itself to exactly what the webhook covers.
    const hookId = request.headers.get('x-github-hook-id') ?? '';
    const observe = async (fullName: string) => {
      if (hookId) await observeHookEvent(hookId, fullName);
    };

    // The PR a delivery refers to, when the event type is one we act on.
    let handledPR: { fullName: string; number: number } | null = null;

    if (event === 'pull_request' && payload.pull_request) {
      const pr = payload.pull_request;
      const action = (payload as GitHubPullRequestEvent).action;
      // `repository` lives on the event root; the PR object only carries
      // base.repo/head.repo. Snapshot with the root's repo so board
      // rebuilds and hook scope resolve to the real full name.
      const repository = (payload as GitHubPullRequestEvent).repository;
      const fullName = repository?.full_name ?? '';
      if (PR_EVENTS[action ?? '']) {
        await appendEvent(buildEvent('new_pr', toPrSnapshot({ ...pr, repository })));
        await observe(fullName);
        handledPR = { fullName, number: pr.number ?? 0 };
      } else if (action === 'closed' && pr.merged) {
        await appendEvent(buildEvent('merged', toPrSnapshot({ ...pr, repository })));
        await observe(fullName);
        handledPR = { fullName, number: pr.number ?? 0 };
      }
    } else if (event === 'pull_request_review') {
      const rev = payload as GitHubReviewEvent;
      if (rev.review && rev.pull_request) {
        const state = rev.review.state;
        const fullName = rev.repository?.full_name ?? '';
        if (state === 'approved') {
          await appendEvent(
            buildEvent('ready_to_merge', toPrSnapshot({ ...rev.pull_request, repository: rev.repository }))
          );
          await observe(fullName);
          handledPR = { fullName, number: rev.pull_request.number ?? 0 };
        } else if (state === 'changes_requested') {
          await appendEvent(
            buildEvent('changes_requested', toPrSnapshot({ ...rev.pull_request, repository: rev.repository }))
          );
          await observe(fullName);
          handledPR = { fullName, number: rev.pull_request.number ?? 0 };
        }
      }
    }

    // Board refresh: drop the stale enrichment for the affected PR, rebuild
    // every active scope that includes its repo. Clients refetch on the
    // events message (instant, stored data) with force — no separate nudge
    // timing race. Events broadcast immediately, right after storage.
    if (handledPR) {
      invalidateEnrichment(handledPR.fullName, handledPR.number);
      void refreshBoardsForRepo(handledPR.fullName);
      broadcastSSE({
        type: 'events',
        configured: true,
        events: await listEvents(),
      });
    }
  } catch (e) {
    console.error('webhook handler:', e);
    return NextResponse.json({ error: 'Storage failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
