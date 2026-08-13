import type { NotificationEvent } from '@/types/notifications';

/**
 * Client-side singleton EventSource for the nudge stream. One connection
 * shared by every subscriber (board refetch + notification ingest).
 * EventSource reconnects automatically; the 30s polls remain the fallback.
 */

export type StreamMessage =
  | { type: 'board' }
  | { type: 'events'; configured: boolean; events: NotificationEvent[] };

type Listener = (msg: StreamMessage) => void;

const listeners = new Set<Listener>();
let es: EventSource | null = null;

function ensureConnected(): void {
  if (es) return;
  es = new EventSource('/api/stream');
  es.onmessage = (e: MessageEvent) => {
    let msg: StreamMessage;
    try {
      msg = JSON.parse(e.data) as StreamMessage;
    } catch {
      return;
    }
    for (const l of listeners) l(msg);
  };
  // onerror: EventSource reconnects with backoff on its own.
}

export function subscribeStream(listener: Listener): () => void {
  listeners.add(listener);
  ensureConnected();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && es) {
      es.close();
      es = null;
    }
  };
}