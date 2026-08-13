// Server-only SSE hub: tracks connected browser streams and broadcasts
// tiny nudge messages (never board payloads — clients refetch from the
// webhook-fed board cache).

interface StreamClient {
  controller: ReadableStreamDefaultController<Uint8Array>;
  heartbeat: ReturnType<typeof setInterval>;
}

const clients = new Set<StreamClient>();
const HEARTBEAT_MS = 25_000;
const encoder = new TextEncoder();

export function subscribeStream(request: Request): ReadableStream<Uint8Array> {
  let client: StreamClient | null = null;

  function cleanup() {
    if (!client) return;
    clients.delete(client);
    clearInterval(client.heartbeat);
    client = null;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);
      client = { controller, heartbeat };
      clients.add(client);
    },
    cancel() {
      cleanup();
    },
  });

  request.signal.addEventListener('abort', cleanup);
  return stream;
}

/** Push a nudge message to every connected client. */
export function broadcastSSE(message: unknown): void {
  const data = encoder.encode(`data: ${JSON.stringify(message)}\n\n`);
  for (const c of clients) {
    try {
      c.controller.enqueue(data);
    } catch {
      // Dead clients are removed by the heartbeat/cancel path.
    }
  }
}