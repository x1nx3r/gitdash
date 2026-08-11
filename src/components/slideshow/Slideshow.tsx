'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import { GitHubApiResponse, PullRequest } from '@/types/github';
import { NotificationEvent, NotificationEventType } from '@/types/notifications';
import { NotificationEventsResponse } from '@/types/notifications';
import {
  SlideTiming,
  defaultSlideTiming,
  readSlideTiming,
  subscribeSlideTiming,
} from '@/lib/slideshowTiming';
import { Fortune } from '@/lib/fortunes';

/**
 * Timed wallboard slideshow. The board shows normally; every interval the
 * slideshow takes over for one full round (every slide, slideSec each),
 * then the board comes back — repeating forever regardless of activity.
 * Timing comes from the Settings page first, falling back to the
 * NEXT_PUBLIC env vars (interval: NEXT_PUBLIC_SLIDESHOW_INTERVAL_MIN,
 * slide: NEXT_PUBLIC_SLIDESHOW_SLIDE_SEC). A timing change applies from
 * the next round. Clicking, tapping, or pressing a key dismisses the
 * active slideshow early; the cycle still comes back.
 */

// Debug: NEXT_PUBLIC_ vars are inlined when the module compiles. Compare the
// values here against the ones in the browser console if the timers are off.
const envTiming: SlideTiming = defaultSlideTiming();
console.log('[slideshow] env →', {
  intervalMs: envTiming.intervalMs,
  slideMs: envTiming.slideMs,
});

// Deliberate input only: a stray mouse crossing the TV must not exit it.
const DISMISS_EVENTS = ['mousedown', 'keydown', 'touchstart', 'wheel'] as const;

// Fade the overlay out before handing back to the board at round's end.
const EXIT_FADE_MS = 450;

type Slide =
  | { kind: 'metrics'; data: GitHubApiResponse }
  | { kind: 'merged'; prs: PullRequest[] }
  | { kind: 'events'; events: NotificationEvent[] };

const EVENT_META: Record<NotificationEventType, { icon: string; accent: string }> = {
  new_pr: { icon: 'notifications', accent: 'var(--md-sys-color-primary)' },
  ready_to_merge: { icon: 'task_alt', accent: 'var(--md-sys-color-secondary)' },
  merged: { icon: 'merge', accent: 'var(--md-sys-color-success)' },
  changes_requested: { icon: 'edit_off', accent: 'var(--md-sys-color-error)' },
};

// One round = the Overview slide plus the last slide (Recent activity when
// events exist, else Merged today). No PR spotlights in between.
function buildSlides(data: GitHubApiResponse, events: NotificationEvent[] | null): Slide[] {
  const last: Slide | null =
    events && events.length > 0
      ? { kind: 'events', events: [...events].reverse().slice(0, 8) }
      : data.columns.merged_today.length > 0
        ? { kind: 'merged', prs: data.columns.merged_today }
        : null;
  return last ? [{ kind: 'metrics', data }, last] : [{ kind: 'metrics', data }];
}

function eventTimeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}


function MosaicSlide({
  data,
  fortune,
}: {
  data: GitHubApiResponse;
  fortune: Fortune | null;
}) {
  const { metrics, columns } = data;
  const openPrs = [
    ...columns.needs_review,
    ...columns.changes_requested,
    ...columns.ready_to_merge,
  ];

  const byRepo = new Map<string, PullRequest[]>();
  for (const pr of openPrs) {
    const arr = byRepo.get(pr.repository.fullName) ?? [];
    arr.push(pr);
    byRepo.set(pr.repository.fullName, arr);
  }
  const repoTiles = [...byRepo.entries()]
    .map(([fullName, prs]) => ({ fullName, prs }))
    .sort((a, b) => b.prs.length - a.prs.length);

  // Morning report: giant clock, one headline number, one line of prose,
  // repos as a plain list. No boxes — nothing but whitespace.
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    {
      n: metrics.readyToMergeCount,
      label: 'ready to merge',
      caption: 'approved, no changes asked',
      icon: 'rocket_launch',
      color: 'var(--md-sys-color-secondary)',
    },
    {
      n: metrics.totalOpen,
      label: 'open PRs',
      caption: 'across all tracked repos',
      icon: 'code',
      color: 'var(--md-sys-color-primary)',
    },
    {
      n: metrics.mergedTodayCount,
      label: 'merged today',
      caption: 'since midnight UTC',
      icon: 'task_alt',
      color: 'var(--md-sys-color-success)',
    },
    {
      n: columns.needs_review.length,
      label: 'need review',
      caption: 'awaiting reviewers',
      icon: 'rate_review',
      color: 'var(--md-sys-color-tertiary)',
    },
    {
      n: metrics.staleCount,
      label: 'stale',
      caption: 'open over 24 hours',
      icon: 'hourglass_empty',
      color: 'var(--md-sys-color-warning)',
    },
    {
      n: columns.changes_requested.length,
      label: 'changes requested',
      caption: 'rework asked by reviewers',
      icon: 'rate_review_off',
      color: 'var(--md-sys-color-error)',
    },
  ];

  const minutes = Math.max(
    0,
    Math.floor((new Date().getTime() - new Date(metrics.lastUpdated).getTime()) / 60_000)
  );
  const shownRepos = repoTiles.slice(0, 8);
  const hiddenRepos = repoTiles.length - shownRepos.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Giant clock top-left, fortune top-right */}
      <div className="flex items-start justify-between gap-8">
        <div>
          <div className="text-[80px] leading-none tabular-nums text-[var(--md-sys-color-on-surface)]">
            {now.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
          <div className="mt-3 text-[24px] text-[var(--md-sys-color-on-surface-variant)]">
            {now.toLocaleDateString([], {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
        {fortune && (
          <div className="flex max-w-[620px] flex-col items-start gap-3">
            <md-icon
              className="text-[36px]"
              style={{ color: 'var(--md-sys-color-tertiary)' }}
            >
              format_quote
            </md-icon>
            <p className="text-[26px] leading-snug text-[var(--md-sys-color-on-surface)]">
              {fortune.text}
            </p>
            {fortune.author && (
              <span className="text-[18px] text-[var(--md-sys-color-on-surface-variant)]">
                — {fortune.author}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Repos as a plain list */}
      <div className="mt-8 flex flex-1 flex-col gap-y-5 overflow-hidden">
        {shownRepos.map(r => (
          <div
            key={r.fullName}
            className="flex items-center gap-6"
          >
            <span className="truncate text-[22px] font-medium text-[var(--md-sys-color-on-surface)]">
              {r.fullName}
            </span>
            <span className="flex shrink-0 items-center gap-5">
              {(
                [
                  {
                    n: r.prs.filter(p => p.column === 'needs_review').length,
                    label: 'need review',
                    color: 'var(--md-sys-color-primary)',
                  },
                  {
                    n: r.prs.filter(p => p.column === 'ready_to_merge').length,
                    label: 'ready to merge',
                    color: 'var(--md-sys-color-success)',
                  },
                  {
                    n: r.prs.filter(p => p.column === 'changes_requested')
                      .length,
                    label: 'changes requested',
                    color: 'var(--md-sys-color-error)',
                  },
                ] as const
              )
                .filter(s => s.n > 0)
                .map(s => (
                  <span
                    key={s.label}
                    className="flex items-center gap-2 text-[18px] text-[var(--md-sys-color-on-surface)]"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="tabular-nums">{s.n}</span> {s.label}
                  </span>
                ))}
            </span>
          </div>
        ))}
        {hiddenRepos > 0 && (
          <span className="text-[20px] text-[var(--md-sys-color-on-surface-variant)]">
            +{hiddenRepos} more repos
          </span>
        )}
      </div>

      {/* Stats as one uniform row, bottom-left */}
      <div className="mt-8 flex items-end gap-12">
        {stats.map(s => (
          <div key={s.label} className="flex flex-col">
            <div className="flex items-center gap-3">
              <md-icon
                className="text-[28px]"
                style={{ color: s.color }}
              >
                {s.icon}
              </md-icon>
              <span className="text-[44px] leading-none tabular-nums text-[var(--md-sys-color-on-surface)]">
                {s.n}
              </span>
            </div>
            <span className="ml-10 mt-1 text-[18px] text-[var(--md-sys-color-on-surface)]">
              {s.label}
            </span>
            <span className="ml-10 text-[15px] text-[var(--md-sys-color-on-surface-variant)]">
              {s.caption}
            </span>
          </div>
        ))}
        <span className="ml-auto mb-0 text-[18px] text-[var(--md-sys-color-on-surface-variant)]">
          Updated {minutes}m ago
        </span>
      </div>
    </div>
  );
}


function MergedSlide({ prs }: { prs: PullRequest[] }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="md-typescale-headline-medium text-[var(--md-sys-color-on-surface)]">
        Merged today
      </h2>
      <div className="flex flex-col gap-3">
        {prs.map(pr => (
          <div
            key={pr.id}
            className="flex items-center gap-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] px-6 py-4"
          >
            <md-icon style={{ color: 'var(--md-sys-color-success)' }}>task_alt</md-icon>
            <div className="flex-1 truncate text-left">
              <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
                {pr.title}
              </span>
              <span className="ml-3 md-typescale-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                {pr.repository.fullName} · #{pr.number}
              </span>
            </div>
            <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
              {pr.author.login}
            </span>
            <span className="md-typescale-title-medium text-[var(--md-sys-color-success)]">
              +{pr.stats.additions.toLocaleString()}
            </span>
            <span className="md-typescale-title-medium text-[var(--md-sys-color-error)]">
              −{pr.stats.deletions.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsSlide({ events }: { events: NotificationEvent[] }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="md-typescale-headline-medium text-[var(--md-sys-color-on-surface)]">
        Recent activity
      </h2>
      <div className="flex flex-col gap-3">
        {events.map((e, i) => (
          <div
            key={`${e.timestamp}-${i}`}
            className="flex items-center gap-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] px-6 py-4"
          >
            <md-icon style={{ color: EVENT_META[e.type].accent }}>{EVENT_META[e.type].icon}</md-icon>
            <div className="flex-1 truncate text-left">
              <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
                {e.pr.title || e.message}
              </span>
              <span className="ml-3 md-typescale-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                {e.pr.repository.fullName} · #{e.pr.number}
              </span>
            </div>
            <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface-variant)]">
              {eventTimeAgo(e.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SlideshowProps {
  data: GitHubApiResponse | null;
}

export default function Slideshow({ data }: SlideshowProps) {
  const [active, setActive] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [leaving, setLeaving] = React.useState(false);
  const [events, setEvents] = React.useState<NotificationEvent[] | null>(null);
  const [fortune, setFortune] = React.useState<Fortune | null>(null);
  const lastStartRef = React.useRef(0);

  // Deliberate input dismisses the slideshow early; manual start comes from
  // the slideshow button (gitdash:start-slideshow). Grace period after a
  // manual start so the click's own mousedown doesn't kill it instantly.
  React.useEffect(() => {
    const onDismiss = () => {
      if (new Date().getTime() - lastStartRef.current < 3000) return;
      console.log('[slideshow] dismissed by input');
      setActive(false);
    };
    for (const ev of DISMISS_EVENTS) window.addEventListener(ev, onDismiss);

    const onStart = () => {
      console.log('[slideshow] manual start');
      lastStartRef.current = new Date().getTime();
      setActive(true);
      setIndex(0);
    };
    window.addEventListener(
      'gitdash:start-slideshow' as keyof WindowEventMap,
      onStart
    );

    return () => {
      for (const ev of DISMISS_EVENTS) window.removeEventListener(ev, onDismiss);
      window.removeEventListener('gitdash:start-slideshow' as keyof WindowEventMap, onStart);
    };
  }, []);

  const slides = React.useMemo(
    () => (data ? buildSlides(data, events) : []),
    [data, events]
  );

  // Live timing: settings first, env fallback. Re-reads on every change, so
  // saving new timings mid-show re-arms the phases with the new values.
  const timing = React.useSyncExternalStore(
    subscribeSlideTiming,
    readSlideTiming,
    defaultSlideTiming
  );

  // Board phase only: every interval the slideshow takes over for one
  // full round, then the board comes back — a wallboard timer, not idle
  // detection. A round is however many slides there are, slideMs each.
  React.useEffect(() => {
    if (active) return;
    const ms = timing.intervalMs;
    const deadline = new Date().getTime() + ms;
    console.log(
      `[slideshow] board phase armed: ${ms}ms (${ms / 1000}s), fires at ${new Date(deadline).toISOString()}`
    );
    const id = setTimeout(() => {
      console.log('[slideshow] timer fired → starting one round');
      setActive(true);
      setIndex(0);
    }, ms);
    const countdown = setInterval(() => {
      const left = Math.ceil((deadline - new Date().getTime()) / 1000);
      console.log(`[slideshow] board countdown: ${left}s`);
    }, 1000);
    return () => {
      clearTimeout(id);
      clearInterval(countdown);
    };
  }, [active, timing]);

  // Rotate slides while active; hold on the last slide.
  React.useEffect(() => {
    if (!active) return;
    const ms = timing.slideMs;
    console.log(
      `[slideshow] rotation started: ${slides.length} slides, ${ms}ms each`
    );
    const id = setInterval(
      () => setIndex(i => Math.min(i + 1, slides.length - 1)),
      ms
    );
    return () => clearInterval(id);
  }, [active, timing, slides.length]);

  // Hold on the last slide for its full slideMs, then start the exit fade.
  React.useEffect(() => {
    if (!active || slides.length === 0 || index < slides.length - 1) return;
    const id = setTimeout(() => setLeaving(true), timing.slideMs);
    return () => clearTimeout(id);
  }, [active, index, slides.length, timing]);

  // After the fade, actually end the slideshow.
  React.useEffect(() => {
    if (!active || !leaving) return;
    const id = setTimeout(() => {
      console.log('[slideshow] round complete → back to board');
      setActive(false);
      setIndex(0);
      setLeaving(false);
    }, EXIT_FADE_MS);
    return () => clearTimeout(id);
  }, [active, leaving]);

  // Fresh events feed and a fresh fortune each time the slideshow starts.
  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/notifications/events');
        if (!res.ok) return;
        const json = (await res.json()) as NotificationEventsResponse;
        if (!cancelled && json.configured) setEvents(json.events);
      } catch {
        // Ignore; the events slide simply won't appear.
      }
      try {
        const res = await fetch('/api/fortunes');
        if (!res.ok) return;
        const json = (await res.json()) as { fortunes: Fortune[] };
        if (!cancelled && json.fortunes.length > 0) {
          const pick = json.fortunes[Math.floor(Math.random() * json.fortunes.length)];
          setFortune(pick);
        }
      } catch {
        // Ignore; the Overview slide simply shows no quote.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active || !data || slides.length === 0) return null;
  const slide = slides[index % slides.length];

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[var(--md-sys-color-surface)] px-12 py-8 ${
        leaving ? 'gd-leaving' : ''
      }`}
    >
      <style>{`@keyframes gdSlideFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } } .gd-slide { animation: gdSlideFade 0.5s ease; } @keyframes gdExitFade { from { opacity: 1; } to { opacity: 0; } } .gd-leaving { animation: gdExitFade ${EXIT_FADE_MS}ms ease-in forwards; }`}</style>

      <div
        key={index}
        className={`gd-slide flex flex-1 flex-col py-6 ${slide.kind === 'metrics' ? 'overflow-hidden' : 'justify-center'}`}
      >
        {slide.kind === 'metrics' && (
          <MosaicSlide data={slide.data} fortune={fortune} />
        )}
        {slide.kind === 'merged' && <MergedSlide prs={slide.prs} />}
        {slide.kind === 'events' && <EventsSlide events={slide.events} />}
      </div>

      <div className="flex items-center justify-between">
        <span className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          {slide.kind === 'metrics'
            ? 'Overview'
            : slide.kind === 'merged'
              ? 'Merged today'
              : 'Recent activity'}
          {' · '}
          {index + 1}/{slides.length}
        </span>
        <span className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Click or press any key to exit
        </span>
      </div>
    </div>
  );
}
