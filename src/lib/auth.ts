import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Minimal shared-password auth. Enabled only when DASHBOARD_PASSWORD is set;
 * without it the dashboard behaves exactly as before (no login required).
 */

export const SESSION_COOKIE_NAME = 'gitdash_session';
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export function authEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

function password(): string {
  return process.env.DASHBOARD_PASSWORD ?? '';
}

function sign(value: string): string {
  return createHmac('sha256', password()).update(value).digest('hex');
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  return `${expires}.${sign(`gitdash:${expires}`)}`;
}

export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const expires = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expires) || expires < Date.now() || !sig) return false;
  const expected = sign(`gitdash:${token.slice(0, dot)}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function isAuthenticated(request: Request): boolean {
  if (!authEnabled()) return true;
  return verifySessionToken(sessionFromRequest(request));
}

/** 401 response when auth is enabled and the request has no valid session. */
export function requireAuth(request: Request): NextResponse | null {
  if (isAuthenticated(request)) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
