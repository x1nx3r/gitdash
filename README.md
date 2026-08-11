# GitDash

A GitHub PR dashboard for a wallboard. Material 3, dark theme, designed to sit
on a TV in the office and be read from across the room. Shows the open pull
requests as a Kanban board, runs a slideshow round on a timer, and plays a
sound when something you care about happens.

That's it. Nothing else.

## What you need

- Node 20+ or Bun (the project uses Bun for lint, anything works for dev)
- A GitHub PAT if you want real data (`GITHUB_PAT`). Without one the app
  serves mock data so you can still see what it looks like.
- S3-compatible storage if you want settings, sounds, and fortunes to
  survive a restart. Without it those fall back to defaults and nothing
  persists.

## Setup

```bash
bun install
cp .env.example .env   # if it exists; otherwise create one
bun dev
```

Open http://localhost:3000. That's the whole setup.

### Environment variables

| Variable | What it does |
|---|---|
| `GITHUB_PAT` | GitHub token for PR data. Optional; mock data without it. |
| `DASHBOARD_PASSWORD` | Set it to enable login. Not set = no login, anyone can look. |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` | Object storage for per-user sound configs, user cache, and fortunes. `S3_REGION` and `S3_FORCE_PATH_STYLE` if your bucket needs them. |
| `NEXT_PUBLIC_SLIDESHOW_INTERVAL_MIN` | How long the board shows before the slideshow takes over. Minutes. |
| `NEXT_PUBLIC_SLIDESHOW_SLIDE_SEC` | Seconds per slide. |

The slideshow timings set in Settings beat the env vars. The env vars are
only the fallback.

`NEXT_PUBLIC_*` vars are inlined at build time. Change them, restart the
server. Not negotiable, that's how Next.js works.

## The slideshow

One round is exactly two slides: the Overview, then Recent activity. No PR
spotlight spam in between. The round ends, the board comes back, the timer
starts again. Clicking, tapping, or pressing a key gets you out of the
slideshow early. A stray mouse crossing the TV screen does nothing.

## Settings

Settings has everything: color scheme (four of them, switch live), slideshow
timing, fortunes (add, edit, delete quotes — they show on the Overview
slide), per-user notification sounds, webhooks, and the repo list.

Fortune quotes are stored on S3 and cached in the browser. The cache exists
so the Overview slide gets its quote instantly instead of waiting on the
network. Don't delete the cache and then complain about a delay.

## Checks

```bash
bun run lint
npx tsc --noEmit
```

Run both. They're fast. Your changes should pass both before you touch the
pull request that reviews them.

## Layout

```
src/app/            pages, API routes
src/components/     board, slideshow, settings, notifications
src/lib/            auth, s3, fortunes, timing, github enrichment
```

That's it. Read the code if you want details — it's not long.

Entire thing is vibecoded, I don't read even a single line of the code, good luck.
