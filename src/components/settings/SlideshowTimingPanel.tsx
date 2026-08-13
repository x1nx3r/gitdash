'use client';

import * as React from 'react';
import '@material/web/button/text-button.js';
import M3TextField from '@/components/notifications/M3TextField';
import {
  MIN_INTERVAL_SEC,
  MIN_SLIDE_SEC,
  clearSlideTiming,
  defaultSlideTiming,
  readSlideTiming,
  saveSlideTiming,
  subscribeSlideTiming,
} from '@/lib/slideshowTiming';

function TimingField({
  value,
  min,
  placeholder,
  ariaLabel,
  onValid,
}: {
  value: number;
  min: number;
  placeholder: string;
  ariaLabel: string;
  onValid: (seconds: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  return (
    <M3TextField
      value={draft}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      onValueChange={v => {
        setDraft(v);
        const n = Number(v);
        if (Number.isFinite(n) && n >= min) onValid(n);
      }}
    />
  );
}

export default function SlideshowTimingPanel() {
  const timing = React.useSyncExternalStore(
    subscribeSlideTiming,
    readSlideTiming,
    defaultSlideTiming
  );
  const intervalSec = Math.round(timing.intervalMs / 1000);
  const slideSec = Math.round(timing.slideMs / 1000);

  return (
    <div className="flex flex-col gap-4">
      <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
        Interval: how long the board shows before the slideshow takes over.
        Slide: how long each slide stays up. Changes apply from the next
        round.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TimingField
          value={intervalSec}
          min={MIN_INTERVAL_SEC}
          placeholder="Interval (seconds)"
          ariaLabel="Slideshow interval in seconds"
          onValid={s => saveSlideTiming(s, slideSec)}
        />
        <TimingField
          value={slideSec}
          min={MIN_SLIDE_SEC}
          placeholder="Slide (seconds)"
          ariaLabel="Seconds per slide"
          onValid={s => saveSlideTiming(intervalSec, s)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          Falls back to NEXT_PUBLIC_SLIDESHOW_INTERVAL_MIN / SLIDE_SEC when
          cleared.
        </span>
        <md-text-button onClick={clearSlideTiming} suppressHydrationWarning>
          Reset to defaults
        </md-text-button>
      </div>
    </div>
  );
}