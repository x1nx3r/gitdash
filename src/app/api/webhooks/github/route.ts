import { NextResponse } from 'next/server';
import {
  appendEvent,
  buildEvent,
  toPrSnapshot,
  verifySignature,
  webhooksConfigured,
} from '@/lib/notificationHub';

const PR_EVENTS: Record<string, boolean> = {
  opened: true,
  reopened: true,
  ready_for_review: true,
};

interface GitHubPullRequestEvent {
  action?: string;
  pull_request?: {
    id?: number;
    number?: number;
    title?: string;
    html_url?: string;
    merged?: boolean;
    draft?: boolean;
    repository?: { full_name?: string };
    user?: { login?: string; avatar_url?: string };
  };
}

interface GitHubReviewEvent {
  action?: string;
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
    if (event === 'pull_request' && payload.pull_request) {
      const pr = payload.pull_request;
      const action = (payload as GitHubPullRequestEvent).action;
      if (PR_EVENTS[action ?? '']) {
        await appendEvent(buildEvent('new_pr', toPrSnapshot(pr)));
      } else if (action === 'closed' && pr.merged) {
        await appendEvent(buildEvent('merged', toPrSnapshot(pr)));
      }
    } else if (event === 'pull_request_review') {
      const rev = payload as GitHubReviewEvent;
      if (rev.review && rev.pull_request) {
        const state = rev.review.state;
        if (state === 'approved') {
          await appendEvent(buildEvent('ready_to_merge', toPrSnapshot(rev.pull_request)));
        } else if (state === 'changes_requested') {
          await appendEvent(buildEvent('changes_requested', toPrSnapshot(rev.pull_request)));
        }
      }
    }
  } catch (e) {
    console.error('webhook handler:', e);
    return NextResponse.json({ error: 'Storage failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
