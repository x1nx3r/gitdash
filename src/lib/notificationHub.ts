import { createHmac, timingSafeEqual } from 'crypto';
import { getJson, isS3Configured, putJson } from '@/lib/s3';
import { NotificationEvent, PrSnapshot } from '@/types/notifications';

/**
 * Server-side notification hub. GitHub webhooks write events here and the
 * client polls them. Without a webhook secret nothing is written and
 * notifications are disabled entirely.
 */

const EVENTS_KEY = 'notifications/events.json';
const MAX_EVENTS = 100;

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
