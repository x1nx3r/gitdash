import { NextResponse } from 'next/server';
import { authEnabled, isAuthenticated } from '@/lib/auth';

export async function GET(request: Request) {
  const enabled = authEnabled();
  return NextResponse.json({
    enabled,
    authenticated: isAuthenticated(request),
  });
}
