'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Blocks the whole dashboard (providers + pages) until a valid session
 * exists, so nothing is fetched before the user signs in. The /login page
 * is always rendered and handles its own redirects.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/status');
        const json = (await res.json()) as { enabled: boolean; authenticated: boolean };
        if (!active) return;
        if (json.enabled && !json.authenticated) {
          router.replace('/login');
          return;
        }
      } catch {
        // Server unreachable: let children render; the data routes still
        // enforce 401 server-side, so nothing sensitive leaks.
      }
      setOk(true);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (pathname === '/login') return <>{children}</>;
  if (!ok) return null;
  return <>{children}</>;
}
