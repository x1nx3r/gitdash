import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { subscribeStream } from '@/lib/streamHub';

export const dynamic = 'force-dynamic';

/**
 * Nudge stream: carries only {type:'board'} and {type:'events'} messages +
 * heartbeats. Auth is cookie-based, so a same-origin EventSource works.
 */
export async function GET(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;
  return new Response(subscribeStream(request), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}