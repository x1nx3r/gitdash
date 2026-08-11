export interface PRDiffStats {
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface Author {
  login: string;
  avatarUrl: string;
  name?: string;
}

export interface Repository {
  name: string;
  fullName: string;
  owner: string;
}

export interface Reviewer {
  login: string;
  avatarUrl: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING';
}

export interface PullRequest {
  id: string | number;
  number: number;
  title: string;
  url: string;
  repository: Repository;
  author: Author;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string | null;
  isDraft: boolean;
  isStale: boolean;
  column: 'needs_review' | 'changes_requested' | 'ready_to_merge' | 'merged_today';
  stats: PRDiffStats;
  reviewers: Reviewer[];
  labels: string[];
}

export interface KanbanColumns {
  needs_review: PullRequest[];
  changes_requested: PullRequest[];
  ready_to_merge: PullRequest[];
  merged_today: PullRequest[];
}

export interface GitHubApiResponse {
  columns: KanbanColumns;
  metrics: {
    totalOpen: number;
    staleCount: number;
    readyToMergeCount: number;
    mergedTodayCount: number;
    lastUpdated: string;
  };
  isMockData?: boolean;
}

export interface Repo {
  name: string;
  fullName: string;
}

export interface RepoListResponse {
  repos: Repo[];
  isMockData: boolean;
}

export interface User {
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface UserListResponse {
  users: User[];
  isMockData: boolean;
  updatedAt: string;
}
