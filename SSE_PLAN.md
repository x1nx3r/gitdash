# Plan: 5s Polling + ETags → SSE

Two phases. Phase 1 is a surgical change to existing files. Phase 2 adds the SSE machinery.

---

## Phase 1: 5s polling + conditional requests

Three files touched. No new files.

### 1. [`src/app/page.tsx`](file:///home/x1nx3r/mgodonf/gitdash/src/app/page.tsx#L50) — drop interval to 5s

```diff
-const interval = setInterval(fetchKanbanData, 30000);
+const interval = setInterval(fetchKanbanData, 5000);
```

### 2. [`src/lib/githubEnrich.ts`](file:///home/x1nx3r/mgodonf/gitdash/src/lib/githubEnrich.ts) — ETag-aware enrichment

The enrichment cache currently stores `{ data, ts }` and uses a 60s TTL. After TTL expiry it makes unconditional requests that burn rate limit even if nothing changed.

**Change:** Store the ETag from each GitHub response alongside the cached data. On cache expiry, send `If-None-Match` with the stored ETag. On `304 Not Modified`:
- Return the cached data as-is
- Refresh the TTL (so we don't re-check for another cycle)
- GitHub doesn't count 304s against the core rate limit

This applies to both calls in `doEnrich()`:
- `GET /repos/{owner}/{repo}/pulls/{number}` (diff stats)
- `GET /repos/{owner}/{repo}/pulls/{number}/reviews` (reviewer states)

Since 304s are free, we can also **lower the enrichment TTL from 60s to 15s** — stale data refreshes faster without extra rate limit cost.

```diff
 // Cache entry shape
-const cache = new Map<string, { data: Enrichment | null; ts: number }>();
+const cache = new Map<string, {
+  data: Enrichment | null;
+  ts: number;
+  etags: { pull?: string; reviews?: string };
+}>();
```

```diff
 // In doEnrich(), each fetch gains conditional headers
-const pullRes = await fetch(url, { headers });
+const pullRes = await fetch(url, {
+  headers: {
+    ...headers,
+    ...(cached?.etags.pull ? { 'If-None-Match': cached.etags.pull } : {}),
+  },
+});
+if (pullRes.status === 304) {
+  // Data unchanged — reuse cached, refresh TTL
+}
```

### 3. [`src/lib/githubEnrich.ts`](file:///home/x1nx3r/mgodonf/gitdash/src/lib/githubEnrich.ts#L9) — lower TTL

```diff
-const ENRICH_TTL_MS = 60_000;
+const ENRICH_TTL_MS = 15_000;
```

---

## Phase 2: Server-side poller + SSE

### Architecture

```
┌─────────────────────────────────────┐
│         PRPoller (singleton)        │
│                                     │
│  setInterval(5s)                    │
│    ├─ fetch GitHub Search (open)    │
│    ├─ fetch GitHub Search (merged)  │
│    ├─ enrichPRs (with ETags)       │
│    ├─ diff against previous state   │
│    └─ if changed → notify listeners │
│                                     │
│  state: GitHubApiResponse | null    │
│  listeners: Set<(data) => void>     │
└─────────────────────────────────────┘
         │
         │ state changed
         ▼
┌─────────────────────────────────────┐
│    /api/github/prs/stream (SSE)     │
│                                     │
│  on connect:                        │
│    → push current cached state      │
│    → register listener              │
│  on state change:                   │
│    → push new state to client       │
│  on disconnect:                     │
│    → unregister listener            │
└─────────────────────────────────────┘
         │
         │ EventSource
         ▼
┌─────────────────────────────────────┐
│    Client (usePRStream hook)        │
│                                     │
│  EventSource → /api/github/prs/stream│
│  on message → setData(parsed)       │
│  on error → fallback to fetch poll  │
└─────────────────────────────────────┘
```

### New files

| File | Purpose |
|---|---|
| `src/lib/prPoller.ts` | Singleton poller. Holds the polling loop, current state, listener set, and the diff logic. Exposes `subscribe(cb)` / `unsubscribe(cb)` / `getSnapshot()`. Starts on first subscriber, keeps running (wallboard is always-on). |
| `src/app/api/github/prs/stream/route.ts` | SSE endpoint. Returns a `ReadableStream` with `Content-Type: text/event-stream`. On connect: auth check, push snapshot, register listener. On disconnect: cleanup. |
| `src/hooks/usePRStream.ts` | Client hook. Opens `EventSource`, parses incoming `GitHubApiResponse`, manages reconnection. Exposes `{ data, loading, error }` — same shape as the current `useState` pattern in `page.tsx`. |

### Modified files

| File | Change |
|---|---|
| `src/app/page.tsx` | Replace the `fetchKanbanData` + `setInterval` block with `usePRStream()`. The component becomes a pure consumer — no fetching logic. |
| `src/app/api/github/prs/route.ts` | Keep as-is for backward compatibility (direct fetch still works). The poller reuses the same enrichment/search logic but calls it internally instead of going through HTTP. |

### Lifecycle

- **Poller start:** Lazily on first SSE connection. Since this is a wallboard that's always on, it effectively runs forever.
- **Poller state:** Module-scope singleton. Works on self-hosted Node/Bun (long-lived process). Would NOT work on serverless (Vercel edge functions) — but you self-host, so this is fine.
- **Reconnection:** `EventSource` auto-reconnects natively. The SSE endpoint pushes the full current state on each new connection, so the client is immediately caught up after a reconnect.
- **Repo selection:** The poller needs to know which repos to query. Two options:
  - **(A)** Client sends selected repos as a query param on the SSE URL → poller uses them. Simple but means the poller re-queries when selection changes.
  - **(B)** Poller always fetches all accessible repos, client filters locally. Simpler poller, slightly more data over the wire — but with 1-2 clients and a handful of repos, this is negligible.

> [!NOTE]
> Option B is simpler and avoids the complexity of per-client poller state. The client already has the repo selection logic in `RepoProvider` — it can just filter the full dataset client-side.

### Diff detection

The poller compares the new `GitHubApiResponse` against the previous one. A naive `JSON.stringify` comparison works for this data volume. If it's identical, no push. This means clients only get traffic when something actually changed on GitHub — could be minutes of silence between pushes, which is fine.

---

## Execution order

1. **Phase 1 first** — the 5s + ETag change is self-contained, immediately useful, and doesn't depend on Phase 2. Ship it, verify rate limit behavior.
2. **Phase 2 after** — build the SSE layer on top. Once SSE works, `page.tsx` switches from polling to streaming. The old `/api/github/prs` GET route stays as a fallback.

---

Green light on Phase 1?
