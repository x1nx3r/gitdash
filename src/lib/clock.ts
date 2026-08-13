export const CLOCK_OPACITY_KEY = 'gitdash_clock_opacity';
export const CLOCK_OPACITY_MAX = 100;
export const DEFAULT_CLOCK_OPACITY = 100;

export const CLOCK_SIZE_KEY = 'gitdash_clock_size';
export const CLOCK_SIZE_MIN = 40;
export const CLOCK_SIZE_MAX = 160;
export const DEFAULT_CLOCK_SIZE = 80;

/** Clock overlay opacity in percent (0-100). Client only. */
export function readClockOpacity(): number {
  try {
    const raw = Number(localStorage.getItem(CLOCK_OPACITY_KEY));
    if (!Number.isFinite(raw)) return DEFAULT_CLOCK_OPACITY;
    return Math.min(CLOCK_OPACITY_MAX, Math.max(0, Math.round(raw)));
  } catch {
    return DEFAULT_CLOCK_OPACITY;
  }
}

/** Persist the clock opacity and notify subscribers. Client only. */
export function setClockOpacity(opacity: number): void {
  try {
    localStorage.setItem(CLOCK_OPACITY_KEY, String(opacity));
  } catch {
    // Ignore; applies for this session only.
  }
  window.dispatchEvent(new Event('gitdash:clock-opacity-change'));
}

/** React subscription for the clock opacity. Client only. */
export function subscribeClockOpacity(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(
    'gitdash:clock-opacity-change' as keyof WindowEventMap,
    onChange
  );
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(
      'gitdash:clock-opacity-change' as keyof WindowEventMap,
      onChange
    );
  };
}

/** Clock time font size in px (CLOCK_SIZE_MIN..CLOCK_SIZE_MAX). Client only. */
export function readClockSize(): number {
  try {
    const raw = Number(localStorage.getItem(CLOCK_SIZE_KEY));
    if (!Number.isFinite(raw)) return DEFAULT_CLOCK_SIZE;
    return Math.min(CLOCK_SIZE_MAX, Math.max(CLOCK_SIZE_MIN, Math.round(raw)));
  } catch {
    return DEFAULT_CLOCK_SIZE;
  }
}

/** Persist the clock size and notify subscribers. Client only. */
export function setClockSize(size: number): void {
  try {
    localStorage.setItem(CLOCK_SIZE_KEY, String(size));
  } catch {
    // Ignore; applies for this session only.
  }
  window.dispatchEvent(new Event('gitdash:clock-size-change'));
}

/** React subscription for the clock size. Client only. */
export function subscribeClockSize(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(
    'gitdash:clock-size-change' as keyof WindowEventMap,
    onChange
  );
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(
      'gitdash:clock-size-change' as keyof WindowEventMap,
      onChange
    );
  };
}