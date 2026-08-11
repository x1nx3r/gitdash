import { NextResponse } from 'next/server';
import { NotificationSettings } from '@/types/notifications';
import { getJson, putJson, ensureBucket, isS3Configured } from '@/lib/s3';
import { requireAuth } from '@/lib/auth';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  volume: 0.7,
  sound: 'chime',
  events: {
    new_pr: true,
    ready_to_merge: true,
    merged: true,
    changes_requested: true,
  },
  soundByEvent: {},
};

function configKey(login: string): string {
  return `configs/${login.toLowerCase()}.json`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ login: string }> }
) {
  const denied = requireAuth(request);
  if (denied) return denied;
  const { login } = await params;
  if (!login) return NextResponse.json({ error: 'login required' }, { status: 400 });

  if (!isS3Configured()) {
    return NextResponse.json(DEFAULT_SETTINGS);
  }

  await ensureBucket();
  const config = await getJson<NotificationSettings>(configKey(login));
  // Merge with defaults so missing keys still work as the user edits.
  return NextResponse.json({ ...DEFAULT_SETTINGS, ...config });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ login: string }> }
) {
  const denied = requireAuth(request);
  if (denied) return denied;
  const { login } = await params;
  if (!login) return NextResponse.json({ error: 'login required' }, { status: 400 });

  let body: Partial<NotificationSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const config: NotificationSettings = {
    ...DEFAULT_SETTINGS,
    ...body,
    events: { ...DEFAULT_SETTINGS.events, ...body.events },
    soundByEvent: { ...body.soundByEvent },
  };

  if (!isS3Configured()) {
    // No storage configured: accept and discard (dev mode).
    return NextResponse.json(config);
  }

  await ensureBucket();
  await putJson(configKey(login), config);
  return NextResponse.json(config);
}
