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
  const result = await getBoardForScope(includedRepos);
  return NextResponse.json(result);
}