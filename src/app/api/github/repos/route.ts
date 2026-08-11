import { NextResponse } from 'next/server';
import { Repo, RepoListResponse } from '@/types/github';
import { isS3Configured, putJson } from '@/lib/s3';

// Mirrors the repos referenced by getMockPullRequests() in the PRs route.
const MOCK_REPOS: Repo[] = [
  { name: 'core-service', fullName: 'org/core-service' },
  { name: 'api-gateway', fullName: 'org/api-gateway' },
  { name: 'backend-pipeline', fullName: 'org/backend-pipeline' },
  { name: 'web-frontend', fullName: 'org/web-frontend' },
  { name: 'infra-ops', fullName: 'org/infra-ops' },
  { name: 'auth-service', fullName: 'org/auth-service' },
];

export async function GET() {
  const pat = process.env.GITHUB_PAT;

  if (pat) {
    try {
      const response = await fetch(
        'https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member',
        {
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
          },
          next: { revalidate: 300 },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const repos: Repo[] = data.map((item: { name: string; full_name: string }) => ({
          name: item.name,
          fullName: item.full_name,
        }));
        if (isS3Configured()) void putJson('repos.json', repos);
        const result: RepoListResponse = { repos, isMockData: false };
        return NextResponse.json(result);
      }
    } catch (error) {
      console.error('GitHub repos error, falling back to mock data:', error);
    }
  }

  return NextResponse.json({ repos: MOCK_REPOS, isMockData: !pat } satisfies RepoListResponse);
}
