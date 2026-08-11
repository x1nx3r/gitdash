import { NextResponse } from 'next/server';
import { listEvents, webhooksConfigured } from '@/lib/notificationHub';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;
  const configured = webhooksConfigured();
  return NextResponse.json({
    configured,
    events: configured ? await listEvents() : [],
  });
}
