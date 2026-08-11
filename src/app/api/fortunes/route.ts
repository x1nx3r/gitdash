import { NextResponse, NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { Fortune, getFortunes, saveFortunes } from '@/lib/fortunes';

const MAX_FORTUNES = 100;
const MAX_TEXT = 300;
const MAX_AUTHOR = 100;

function parseFortunes(body: unknown): Fortune[] | null {
  if (!Array.isArray(body)) return null;
  if (body.length > MAX_FORTUNES) return null;
  const out: Fortune[] = [];
  for (const item of body) {
    if (typeof item !== 'object' || item === null) return null;
    const f = item as Record<string, unknown>;
    if (typeof f.text !== 'string' || f.text.trim().length === 0) return null;
    if (f.text.length > MAX_TEXT) return null;
    if (f.author !== undefined && typeof f.author !== 'string') return null;
    if (typeof f.author === 'string' && f.author.length > MAX_AUTHOR) return null;
    out.push({ text: f.text.trim(), author: f.author?.trim() || undefined });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;
  const { fortunes, isDefault } = await getFortunes();
  return NextResponse.json({ fortunes, isDefault });
}

export async function PUT(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const fortunes = parseFortunes(body);
  if (!fortunes) {
    return NextResponse.json(
      { error: 'Expected an array of { text, author? }' },
      { status: 400 }
    );
  }
  await saveFortunes(fortunes);
  return NextResponse.json({ fortunes, isDefault: false });
}
