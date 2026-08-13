import { NextResponse, NextRequest } from 'next/server';
import { getBoardForScope } from '@/lib/boardCache';
import { requireAuth } from '@/lib/auth';

function parseIncludedRepos(request: NextRequest): string[] {
  const raw = request.nextUrl.searchParams.get('repos');
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;
  const includedRepos = parseIncludedRepos(request);
  // ?force=1 skips the 30s cache: an SSE events nudge just told us the board
  // changed, so fetch the current GitHub state instead of a stale snapshot.
  const force = request.nextUrl.searchParams.get('force') === '1';
  const result = await getBoardForScope(includedRepos, force);
  return NextResponse.json(result);
}