import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth';
import {
  ensureBucket,
  getJson,
  isS3Configured,
  putBlob,
  putJson,
} from '@/lib/s3';
import { SoundLibraryEntry } from '@/types/notifications';

const LIBRARY_KEY = 'sounds/library.json';
const MAX_SOUND_BYTES = 2 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
  'audio/x-m4a': 'm4a',
};

async function listLibrary(): Promise<SoundLibraryEntry[]> {
  const entries = await getJson<SoundLibraryEntry[]>(LIBRARY_KEY);
  return Array.isArray(entries) ? entries : [];
}

export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;
  if (!isS3Configured()) {
    return NextResponse.json({ sounds: [], isMock: true });
  }
  const sounds = await listLibrary();
  return NextResponse.json({ sounds, isMock: false });
}

export async function POST(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;
  if (!isS3Configured()) {
    return NextResponse.json({ error: 'storage not configured' }, { status: 503 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('audio/')) {
    return NextResponse.json({ error: 'only audio files are accepted' }, { status: 415 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOUND_BYTES) {
    return NextResponse.json(
      { error: `file must be between 1 byte and ${MAX_SOUND_BYTES} bytes` },
      { status: 413 }
    );
  }

  const baseType = contentType.split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[baseType] ?? 'bin';
  const id = randomUUID();
  const key = `sounds/library/${id}.${ext}`;
  let name = request.headers.get('x-file-name')?.trim() || '';
  try {
    name = decodeURIComponent(name);
  } catch {
    // Malformed encoding: keep the raw value.
  }
  if (!name) name = `${id}.${ext}`;

  await ensureBucket();
  await putBlob(key, bytes, baseType);

  const entry: SoundLibraryEntry = { id, name, key };
  const sounds = await listLibrary();
  await putJson(LIBRARY_KEY, [...sounds, entry]);

  return NextResponse.json(entry);
}