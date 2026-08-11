'use client';

import * as React from 'react';
import '@material/web/slider/slider.js';

interface M3SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  onValueChange: (value: number) => void;
}

export default function M3Slider({
  value,
  min = 0,
  max = 1,
  step = 0.05,
  ariaLabel,
  onValueChange,
}: M3SliderProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = el as unknown as {
      min: number;
      max: number;
      step: number;
      value: number;
    };
    target.min = min;
    target.max = max;
    target.step = step;
    target.value = value;
    const handler = (e: Event) =>
      onValueChange(Number((e.target as unknown as { value: number }).value));
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [value, min, max, step, onValueChange]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <md-slider ref={ref as any} aria-label={ariaLabel}></md-slider>;
}
