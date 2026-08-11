'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import '@material/web/icon/icon.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/filled-button.js';
import '@material/web/labs/card/elevated-card.js';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const fieldRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const handler = (e: Event) =>
      setPassword(String((e.target as unknown as { value: string }).value));
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, []);

  // Already signed in (or auth disabled): skip the login screen.
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (!res.ok) return;
        const json = (await res.json()) as { enabled: boolean; authenticated: boolean };
        if (active && (!json.enabled || json.authenticated)) router.replace('/');
      } catch {
        // Keep the form; the submit will surface real errors.
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace('/');
        return;
      }
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(json?.error ?? 'Sign in failed');
    } catch {
      setError('Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--md-sys-color-surface)] p-6">
      <md-elevated-card className="w-full max-w-sm !block">
        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
              <md-icon style={{ fontSize: '28px' }} suppressHydrationWarning>
                dashboard
              </md-icon>
            </div>
            <h1 className="md-typescale-title-large text-[var(--md-sys-color-on-surface)]">
              GitDash
            </h1>
            <p className="md-typescale-body-medium text-[var(--md-sys-color-on-surface-variant)]">
              Sign in to view the dashboard
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={submit}>
            <md-outlined-text-field
              ref={fieldRef as React.Ref<never>}
              type="password"
              label="Password"
              aria-label="Password"
              className="w-full"
              suppressHydrationWarning
            ></md-outlined-text-field>

            {error && (
              <p className="md-typescale-body-small text-[var(--md-sys-color-error)]">
                {error}
              </p>
            )}

            <md-filled-button
              type="submit"
              disabled={submitting || password.length === 0}
              suppressHydrationWarning
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </md-filled-button>
          </form>
        </div>
      </md-elevated-card>
    </div>
  );
}
