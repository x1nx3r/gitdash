'use client';

import * as React from 'react';
import '@material/web/textfield/outlined-text-field.js';

interface M3TextFieldProps {
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  onValueChange: (value: string) => void;
}

export default function M3TextField({
  value,
  placeholder,
  ariaLabel,
  onValueChange,
}: M3TextFieldProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = el as unknown as { value: string; placeholder?: string };
    target.value = value;
    if (placeholder !== undefined) target.placeholder = placeholder;
    const handler = (e: Event) =>
      onValueChange(String((e.target as unknown as { value: string }).value));
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [value, placeholder, onValueChange]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <md-outlined-text-field ref={ref as any} aria-label={ariaLabel}></md-outlined-text-field>;
}
