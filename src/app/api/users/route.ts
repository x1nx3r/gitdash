import { NextResponse } from 'next/server';
import { Repo, User, UserListResponse } from '@/types/github';
import { getJson, putJson, ensureBucket, isS3Configured } from '@/lib/s3';
import { requireAuth } from '@/lib/auth';

const USERS_KEY = 'users.json';
const REFRESH_MS = 60 * 60 * 1000; // 1 hour

interface UsersCache {
  users: User[];
  updatedAt: string;
}

// Mirrors authors/reviewers referenced by the mock PRs.
const MOCK_USERS: User[] = [
  { login: 'alex_dev', name: 'Alex Rivera', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
  { login: 'marcus_k', name: 'Marcus Chen', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
  { login: 'elena_v', name: 'Elena Rostova', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' },
  { login: 'jordan_b', name: 'Jordan Blake', avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150' },
  { login: 'dave_tech', name: 'Dave Miller', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
  { login: 'sarah_m', name: 'Sarah Miller', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
];

function mergeUsers(lists: User[][]): User[] {
  const byLogin = new Map<string, User>();
  for (const list of lists) {
    for (const u of list) {
      if (!u?.login) continue;
      const prev = byLogin.get(u.login);
      byLogin.set(u.login, {
        login: u.login,
        name: u.name ?? prev?.name,
        avatarUrl: u.avatarUrl ?? prev?.avatarUrl,
      });
    }
  }
  return [...byLogin.values()].sort((a, b) => a.login.localeCompare(b.login));
}

async function deriveUsers(): Promise<User[]> {
  const pat = process.env.GITHUB_PAT;

  // 1. People observed in the current PR snapshot (authors + reviewers).
  const snapshot = await getJson<{ authors: User[]; reviewers: User[] }>('prs_users.json');
  const seen: User[] = [];
  if (snapshot) {
    seen.push(...snapshot.authors, ...snapshot.reviewers);
  }

  // 2. Contributors of every known repo (requires PAT).
  const contributors: User[] = [];
  if (pat) {
    const repos = (await getJson<Repo[]>('repos.json')) ?? [];
    const repoList = repos.length > 0 ? repos : await fetchAllRepos(pat);
    const batch = await Promise.all(
      repoList.slice(0, 20).map(async repo => {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${repo.fullName}/contributors?per_page=50`,
            { headers: { Authorization: `Bearer ${pat}` } }
          );
          if (!res.ok) return [];
          const data = await res.json();
          return data.map(
            (c: { login: string; avatar_url?: string; name?: string }) => ({
              login: c.login,
              name: c.name,
              avatarUrl: c.avatar_url,
            })
          );
        } catch {
          return [];
        }
      })
    );
    contributors.push(...batch.flat());
  }

  return mergeUsers([seen, contributors]);
}

async function fetchAllRepos(pat: string): Promise<Repo[]> {
  try {
    const res = await fetch(
      'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member',
      { headers: { Authorization: `Bearer ${pat}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r: { name: string; full_name: string }) => ({
      name: r.name,
      fullName: r.full_name,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const denied = requireAuth(request);
  if (denied) return denied;
  if (!isS3Configured()) {
    return NextResponse.json({
      users: MOCK_USERS,
      isMockData: true,
      updatedAt: new Date().toISOString(),
    } satisfies UserListResponse);
  }

  await ensureBucket();

  // Serve from cache when fresh; re-derive otherwise.
  const cached = await getJson<UsersCache>(USERS_KEY);
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < REFRESH_MS) {
    return NextResponse.json({
      users: cached.users,
      isMockData: false,
      updatedAt: cached.updatedAt,
    } satisfies UserListResponse);
  }

  const users = await deriveUsers();
  const updatedAt = new Date().toISOString();
  await putJson(USERS_KEY, { users, updatedAt } satisfies UsersCache);

  return NextResponse.json({ users, isMockData: false, updatedAt } satisfies UserListResponse);
}
