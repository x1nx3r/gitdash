/**
 * Slideshow timing. Settings win: values saved from the Settings page
 * (localStorage, per device) override the NEXT_PUBLIC env defaults.
 * Slideshow.tsx reads this module on every re-arm, so a change applies
 * from the next phase; the subscribe helpers make React re-render live.
 */

export const SLIDESHOW_TIMING_KEY = 'gitdash_slideshow_timing';

export interface SlideTiming {
  intervalMs: number;
  slideMs: number;
}

/** Floor values — a 1s interval would turn the wall into a strobe. */
export const MIN_INTERVAL_SEC = 10;
export const MIN_SLIDE_SEC = 2;

function envDuration(raw: string | undefined, fallbackMs: number): number {
  if (!raw) return fallbackMs;
  const m = /^(\d+(?:\.\d+)?)\s*([smh])?$/i.exec(raw.trim());
  if (!m) return fallbackMs;
  const value = parseFloat(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  const factor = unit === 's' ? 1000 : unit === 'h' ? 3_600_000 : 60_000;
  return value * factor;
}

// NOTE: NEXT_PUBLIC_ vars must be read via STATIC process.env.X access —
// Next.js inlines those into client bundles at compile time. Computed
// access (process.env[name]) is not inlined and silently yields undefined.
const ENV_INTERVAL_MS = envDuration(process.env.NEXT_PUBLIC_SLIDESHOW_INTERVAL_MIN, 15 * 60_000);
const ENV_SLIDE_MS = envDuration(process.env.NEXT_PUBLIC_SLIDESHOW_SLIDE_SEC, 15 * 1000);

const envFallback: SlideTiming = { intervalMs: ENV_INTERVAL_MS, slideMs: ENV_SLIDE_MS };

// Snapshot cache so useSyncExternalStore sees a stable object reference.
let cached: SlideTiming | null = null;

function parseSaved(raw: string | null): SlideTiming | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { intervalSec?: unknown; slideSec?: unknown };
    const intervalSec = Number(j.intervalSec);
    const slideSec = Number(j.slideSec);
    if (
      !Number.isFinite(intervalSec) ||
      !Number.isFinite(slideSec) ||
      intervalSec < MIN_INTERVAL_SEC ||
      slideSec < MIN_SLIDE_SEC
    ) {
      return null;
    }
    return { intervalMs: intervalSec * 1000, slideMs: slideSec * 1000 };
  } catch {
    return null;
  }
}

/** Effective timing: saved settings first, env defaults as fallback. */
export function readSlideTiming(): SlideTiming {
  let value: SlideTiming | null = null;
  try {
    value = parseSaved(localStorage.getItem(SLIDESHOW_TIMING_KEY));
  } catch {
    value = null;
  }
  if (!value) value = envFallback;
  if (cached && cached.intervalMs === value.intervalMs && cached.slideMs === value.slideMs) {
    return cached;
  }
  cached = value;
  return value;
}

/** Server-safe snapshot (no localStorage on the server). */
export function defaultSlideTiming(): SlideTiming {
  return envFallback;
}

/** Persist timing and notify subscribers. Client only. */
export function saveSlideTiming(intervalSec: number, slideSec: number): void {
  try {
    localStorage.setItem(
      SLIDESHOW_TIMING_KEY,
      JSON.stringify({ intervalSec, slideSec })
    );
  } catch {
    // Ignore; the app keeps its env defaults for this session.
  }
  window.dispatchEvent(new Event('gitdash:timing-change'));
}

/** Drop saved settings; env defaults take over again. Client only. */
export function clearSlideTiming(): void {
  try {
    localStorage.removeItem(SLIDESHOW_TIMING_KEY);
  } catch {
    // Ignore.
  }
  window.dispatchEvent(new Event('gitdash:timing-change'));
}

/** React subscription: local changes and changes from other tabs. */
export function subscribeSlideTiming(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('gitdash:timing-change' as keyof WindowEventMap, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('gitdash:timing-change' as keyof WindowEventMap, onChange);
  };
}
