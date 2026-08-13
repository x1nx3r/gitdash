'use client';

import * as React from 'react';
import '@material/web/switch/switch.js';

interface M3SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
}

export default function M3Switch({ checked, onCheckedChange, ariaLabel }: M3SwitchProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // md-switch exposes state via `selected`, not `checked`.
    (el as unknown as { selected: boolean }).selected = checked;
    const handler = (e: Event) =>
      onCheckedChange((e.target as unknown as { selected: boolean }).selected);
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [checked, onCheckedChange]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <md-switch ref={ref as any} aria-label={ariaLabel}></md-switch>;
}
