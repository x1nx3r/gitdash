import { NextResponse } from 'next/server';
import { listEvents, webhooksConfigured } from '@/lib/notificationHub';

export async function GET() {
  const configured = webhooksConfigured();
  return NextResponse.json({
    configured,
    events: configured ? await listEvents() : [],
  });
}
