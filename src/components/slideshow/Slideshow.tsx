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

type Slide =
  | { kind: 'metrics'; data: GitHubApiResponse }
  | { kind: 'pr'; pr: PullRequest; accent: string; columnLabel: string; columnIcon: string }
  | { kind: 'merged'; prs: PullRequest[] }
  | { kind: 'events'; events: NotificationEvent[] };

const COLUMN_META = {
  needs_review: {
    label: 'Needs review',
    icon: 'rate_review',
    accent: 'var(--md-sys-color-primary)',
  },
  changes_requested: {
    label: 'Changes requested',
    icon: 'rate_review_off',
    accent: 'var(--md-sys-color-error)',
  },
  ready_to_merge: {
    label: 'Ready to merge',
    icon: 'rocket_launch',
    accent: 'var(--md-sys-color-secondary)',
  },
} as const;

const EVENT_META: Record<NotificationEventType, { icon: string; accent: string }> = {
  new_pr: { icon: 'notifications', accent: 'var(--md-sys-color-primary)' },
  ready_to_merge: { icon: 'task_alt', accent: 'var(--md-sys-color-secondary)' },
  merged: { icon: 'merge', accent: 'var(--md-sys-color-success)' },
  changes_requested: { icon: 'edit_off', accent: 'var(--md-sys-color-error)' },
};

function buildSlides(data: GitHubApiResponse, events: NotificationEvent[] | null): Slide[] {
  const slides: Slide[] = [{ kind: 'metrics', data }];
  for (const key of ['needs_review', 'changes_requested', 'ready_to_merge'] as const) {
    const meta = COLUMN_META[key];
    for (const pr of data.columns[key]) {
      slides.push({ kind: 'pr', pr, accent: meta.accent, columnLabel: meta.label, columnIcon: meta.icon });
    }
  }
  if (data.columns.merged_today.length > 0) {
    slides.push({ kind: 'merged', prs: data.columns.merged_today });
  }
  if (events && events.length > 0) {
    slides.push({ kind: 'events', events: [...events].reverse().slice(0, 8) });
  }
  return slides;
}

function eventTimeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}


function MosaicSlide({ data }: { data: GitHubApiResponse }) {
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

  const states = [
    {
      n: columns.needs_review.length,
      label: 'need review',
      color: 'var(--md-sys-color-primary)',
    },
    {
      n: columns.ready_to_merge.length,
      label: 'ready to merge',
      color: 'var(--md-sys-color-success)',
    },
    {
      n: columns.changes_requested.length,
      label: 'changes requested',
      color: 'var(--md-sys-color-error)',
    },
    {
      n: metrics.staleCount,
      label: 'stale',
      color: 'var(--md-sys-color-warning)',
    },
    {
      n: metrics.mergedTodayCount,
      label: 'merged today',
      color: 'var(--md-sys-color-secondary)',
    },
  ].filter(s => s.n > 0);

  const minutes = Math.max(
    0,
    Math.floor((new Date().getTime() - new Date(metrics.lastUpdated).getTime()) / 60_000)
  );
  const shownRepos = repoTiles.slice(0, 8);
  const hiddenRepos = repoTiles.length - shownRepos.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Giant clock left, headline number right */}
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
        <div className="flex flex-col items-end text-right">
          <div className="flex items-center gap-4">
            <md-icon
              className="text-[44px]"
              style={{ color: 'var(--md-sys-color-secondary)' }}
            >
              rocket_launch
            </md-icon>
            <span className="text-[128px] leading-none tabular-nums text-[var(--md-sys-color-on-surface)]">
              {metrics.readyToMergeCount}
            </span>
          </div>
          <span className="mt-2 text-[24px] text-[var(--md-sys-color-on-surface-variant)]">
            ready to merge
          </span>
        </div>
      </div>

      {/* One line of prose: state dots + counts */}
      <div className="mt-6 flex items-center gap-8 text-[22px] text-[var(--md-sys-color-on-surface)]">
        {states.map(s => (
          <span key={s.label} className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span>
              <span className="font-semibold tabular-nums">{s.n}</span>{' '}
              {s.label}
            </span>
          </span>
        ))}
        <span className="text-[var(--md-sys-color-on-surface-variant)]">
          · {minutes}m ago
        </span>
      </div>

      {/* Repos as a plain list */}
      <div className="mt-8 grid flex-1 auto-rows-min grid-cols-2 content-start gap-x-24 gap-y-5">
        {shownRepos.map(r => (
          <div
            key={r.fullName}
            className="flex items-center justify-between gap-4"
          >
            <span className="truncate text-[22px] font-medium text-[var(--md-sys-color-on-surface)]">
              {r.fullName}
            </span>
            <span className="flex shrink-0 items-center gap-4">
              {(
                [
                  {
                    n: r.prs.filter(p => p.column === 'needs_review').length,
                    color: 'var(--md-sys-color-primary)',
                  },
                  {
                    n: r.prs.filter(p => p.column === 'ready_to_merge').length,
                    color: 'var(--md-sys-color-success)',
                  },
                  {
                    n: r.prs.filter(p => p.column === 'changes_requested')
                      .length,
                    color: 'var(--md-sys-color-error)',
                  },
                ] as const
              )
                .filter(s => s.n > 0)
                .map(s => (
                  <span
                    key={s.color}
                    className="flex items-center gap-2 tabular-nums text-[20px] text-[var(--md-sys-color-on-surface)]"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.n}
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
    </div>
  );
}

function PRSpotlight({ slide }: { slide: Extract<Slide, { kind: 'pr' }> }) {
  const { pr, accent, columnLabel, columnIcon } = slide;
  const hoursOpen = Math.max(
    1,
    Math.round((new Date().getTime() - new Date(pr.createdAt).getTime()) / 3_600_000)
  );
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <span
          className="flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{ backgroundColor: accent, color: '#fff' }}
        >
          <md-icon style={{ '--md-icon-size': '20px' }}>{columnIcon}</md-icon>
          <span className="md-typescale-label-large">{columnLabel}</span>
        </span>
        <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface-variant)]">
          {pr.repository.fullName} · #{pr.number}
        </span>
        {pr.isDraft && (
          <span className="rounded-full bg-[var(--md-sys-color-surface-container-highest)] px-3 py-1 md-typescale-label-medium text-[var(--md-sys-color-on-surface-variant)]">
            Draft
          </span>
        )}
      </div>
      <h2 className="md-typescale-display-small max-w-5xl text-[var(--md-sys-color-on-surface)]">
        {pr.title}
      </h2>
      <div className="flex items-center gap-4">
        {pr.author.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pr.author.avatarUrl} alt={pr.author.login} className="h-10 w-10 rounded-full" />
        )}
        <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface)]">
          {pr.author.login}
        </span>
        <span className="md-typescale-title-medium text-[var(--md-sys-color-success)]">
          +{pr.stats.additions.toLocaleString()}
        </span>
        <span className="md-typescale-title-medium text-[var(--md-sys-color-error)]">
          −{pr.stats.deletions.toLocaleString()}
        </span>
        <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface-variant)]">
          · {pr.stats.changedFiles} files
        </span>
        <span className="md-typescale-title-medium text-[var(--md-sys-color-on-surface-variant)]">
          · open {hoursOpen >= 24 ? `${Math.round(hoursOpen / 24)}d` : `${hoursOpen}h`}
        </span>
      </div>
      {pr.labels.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {pr.labels.map(l => (
            <span
              key={l}
              className="rounded-full bg-[var(--md-sys-color-surface-container-highest)] px-3 py-1 text-[var(--md-sys-color-on-surface-variant)]"
            >
              {l}
            </span>
          ))}
        </div>
      )}
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
  const [events, setEvents] = React.useState<NotificationEvent[] | null>(null);
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

  // End the slideshow once the last slide has had its full slideMs.
  React.useEffect(() => {
    if (!active || slides.length === 0 || index < slides.length - 1) return;
    const id = setTimeout(() => {
      console.log('[slideshow] round complete → back to board');
      setActive(false);
      setIndex(0);
    }, timing.slideMs);
    return () => clearTimeout(id);
  }, [active, index, slides.length, timing]);

  // Fresh events feed each time the slideshow starts.
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
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active || !data || slides.length === 0) return null;
  const slide = slides[index % slides.length];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--md-sys-color-surface)] px-12 py-8">
      <style>{`@keyframes gdSlideFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } } .gd-slide { animation: gdSlideFade 0.5s ease; }`}</style>

      <div
        key={index}
        className={`gd-slide flex flex-1 flex-col py-6 ${slide.kind === 'metrics' ? 'overflow-hidden' : 'justify-center'}`}
      >
        {slide.kind === 'metrics' && <MosaicSlide data={slide.data} />}
        {slide.kind === 'pr' && <PRSpotlight slide={slide} />}
        {slide.kind === 'merged' && <MergedSlide prs={slide.prs} />}
        {slide.kind === 'events' && <EventsSlide events={slide.events} />}
      </div>

      <div className="flex items-center justify-between">
        <span className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          {slide.kind === 'metrics'
            ? 'Overview'
            : slide.kind === 'pr'
              ? 'Pull request'
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
