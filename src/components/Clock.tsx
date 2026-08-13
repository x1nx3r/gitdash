'use client';

import * as React from 'react';
import {
  readClockOpacity,
  readClockSize,
  subscribeClockOpacity,
  subscribeClockSize,
} from '@/lib/clock';
import {
  isSlideshowActive,
  subscribeSlideshowActive,
} from '@/lib/slideshowActive';

/**
 * Wallboard clock: pinned to the bottom-right of the screen, styled like the
 * slideshow's giant clock (M3 Roboto, tabular numerals). Hides while the
 * slideshow owns the screen. Opacity is user-configurable (settings →
 * Display).
 */
export default function Clock() {
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const opacity = React.useSyncExternalStore(
    subscribeClockOpacity,
    readClockOpacity,
    () => 100
  );
  const size = React.useSyncExternalStore(
    subscribeClockSize,
    readClockSize,
    () => 80
  );
  const slideshowOn = React.useSyncExternalStore(
    subscribeSlideshowActive,
    isSlideshowActive,
    () => false
  );
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [mounted]);

  if (!now || slideshowOn) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-20 right-8 z-[60] select-none text-right"
      style={{ opacity: opacity / 100 }}
    >
      <div
        className="leading-none tabular-nums text-[var(--md-sys-color-on-surface)]"
        style={{ fontSize: size }}
      >
        {now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </div>
      <div
        className="mt-2 text-[var(--md-sys-color-on-surface-variant)]"
        style={{ fontSize: Math.round(size * 0.3) }}
      >
        {now.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </div>
    </div>
  );
}