'use client';

import * as React from 'react';
import '@material/web/button/text-button.js';
import { MAX_ZOOM, MIN_ZOOM, readZoom, setZoom, subscribeZoom } from '@/lib/zoom';
import {
  CLOCK_OPACITY_MAX,
  CLOCK_SIZE_MAX,
  CLOCK_SIZE_MIN,
  DEFAULT_CLOCK_SIZE,
  readClockOpacity,
  readClockSize,
  setClockOpacity,
  setClockSize,
  subscribeClockOpacity,
  subscribeClockSize,
} from '@/lib/clock';

export default function DisplayPanel() {
  const zoom = React.useSyncExternalStore(subscribeZoom, readZoom, () => 1);
  const clockOpacity = React.useSyncExternalStore(
    subscribeClockOpacity,
    readClockOpacity,
    () => CLOCK_OPACITY_MAX
  );
  const clockSize = React.useSyncExternalStore(
    subscribeClockSize,
    readClockSize,
    () => DEFAULT_CLOCK_SIZE
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Browser-zoom-style scaling for the whole app. Handy when the TV
          renders the dashboard too small or too large.
        </p>
        <div className="flex items-center justify-between">
          <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
            Zoom
          </span>
          <span className="md-typescale-label-medium tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
            {zoom.toFixed(1)}x
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="h-2 w-full accent-[var(--md-sys-color-primary)]"
          />
          <md-text-button
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            suppressHydrationWarning
          >
            Reset
          </md-text-button>
        </div>
      </div>

      <div className="h-px bg-[var(--md-sys-color-outline-variant)]" />

      <div className="flex flex-col gap-2">
        <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Size and opacity of the big clock pinned to the bottom-right of the
          screen.
        </p>
        <div className="flex items-center justify-between">
          <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
            Clock size
          </span>
          <span className="md-typescale-label-medium tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
            {clockSize}px
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={CLOCK_SIZE_MIN}
            max={CLOCK_SIZE_MAX}
            step={4}
            value={clockSize}
            onChange={e => setClockSize(Number(e.target.value))}
            className="h-2 w-full accent-[var(--md-sys-color-primary)]"
          />
          <md-text-button
            onClick={() => setClockSize(DEFAULT_CLOCK_SIZE)}
            disabled={clockSize === DEFAULT_CLOCK_SIZE}
            suppressHydrationWarning
          >
            Reset
          </md-text-button>
        </div>

        <div className="flex items-center justify-between">
          <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
            Clock opacity
          </span>
          <span className="md-typescale-label-medium tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
            {clockOpacity}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={CLOCK_OPACITY_MAX}
            step={5}
            value={clockOpacity}
            onChange={e => setClockOpacity(Number(e.target.value))}
            className="h-2 w-full accent-[var(--md-sys-color-primary)]"
          />
          <md-text-button
            onClick={() => setClockOpacity(CLOCK_OPACITY_MAX)}
            disabled={clockOpacity === CLOCK_OPACITY_MAX}
            suppressHydrationWarning
          >
            Reset
          </md-text-button>
        </div>
      </div>
    </div>
  );
}