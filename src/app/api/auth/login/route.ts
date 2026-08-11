import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { authEnabled, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  if (!authEnabled()) {
    return NextResponse.json(
      { error: 'Auth is not enabled (DASHBOARD_PASSWORD missing)' },
      { status: 400 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supplied = body.password ?? '';
  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  const a = createHmac('sha256', supplied).digest();
  const b = createHmac('sha256', expected).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
  return res;
}
