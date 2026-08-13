import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getBlob,
  getJson,
  isS3Configured,
  removeObject,
  putJson,
} from '@/lib/s3';
import { SoundLibraryEntry } from '@/types/notifications';

const LIBRARY_KEY = 'sounds/library.json';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAuth(request);
  if (denied) return denied;
  if (!isS3Configured()) {
    return NextResponse.json({ error: 'storage not configured' }, { status: 503 });
  }

  const { id } = await params;
  const entries = await getJson<SoundLibraryEntry[]>(LIBRARY_KEY);
  const entry = Array.isArray(entries) ? entries.find(e => e.id === id) : null;
  if (!entry) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const blob = await getBlob(entry.key);
  if (!blob) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return new Response(blob.data as unknown as BodyInit, {
    headers: {
      'Content-Type': blob.contentType,
      'Content-Length': String(blob.data.byteLength),
      'Cache-Control': 'private, max-age=60',
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAuth(request);
  if (denied) return denied;
  if (!isS3Configured()) {
    return NextResponse.json({ error: 'storage not configured' }, { status: 503 });
  }

  const { id } = await params;
  const entries = await getJson<SoundLibraryEntry[]>(LIBRARY_KEY);
  const entry = Array.isArray(entries) ? entries.find(e => e.id === id) : null;
  if (!Array.isArray(entries) || !entry) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  await removeObject(entry.key);
  await putJson(
    LIBRARY_KEY,
    entries.filter(e => e.id !== id)
  );

  return NextResponse.json({ ok: true });
}