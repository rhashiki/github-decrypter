export const GITHUB_PROVIDER_SCHEMA = 'gd-github-provider/1' as const;

export const GITHUB_PROVIDER_OPERATIONS = [
  'repositories.list',
  'repository.get',
  'branches.list',
] as const;

export type GitHubProviderOperation = (typeof GITHUB_PROVIDER_OPERATIONS)[number];

export interface GitHubRepositoryIdentity {
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
}

export interface GitHubRepositorySummary extends GitHubRepositoryIdentity {
  readonly id: number;
  readonly nodeId: string;
  readonly private: boolean;
  readonly fork: boolean;
  readonly archived: boolean;
  readonly disabled: boolean;
  readonly defaultBranch: string | null;
  readonly htmlUrl: string;
  readonly cloneUrl: string;
  readonly updatedAt: string | null;
}

export interface GitHubRepositoriesPage {
  readonly schema: typeof GITHUB_PROVIDER_SCHEMA;
  readonly installationId: number;
  readonly page: number;
  readonly perPage: number;
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly repositories: readonly GitHubRepositorySummary[];
}

export interface GitHubBranchSummary {
  readonly name: string;
  readonly commitSha: string;
  readonly protected: boolean;
}

export interface GitHubBranchesPage {
  readonly schema: typeof GITHUB_PROVIDER_SCHEMA;
  readonly installationId: number;
  readonly repository: GitHubRepositoryIdentity;
  readonly page: number;
  readonly perPage: number;
  readonly hasMore: boolean;
  readonly branches: readonly GitHubBranchSummary[];
}

export interface GitHubRepositoryResult {
  readonly schema: typeof GITHUB_PROVIDER_SCHEMA;
  readonly installationId: number;
  readonly repository: GitHubRepositorySummary;
}

export function normalizeGitHubProviderPage(value: number | undefined): number {
  const page = value ?? 1;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) {
    throw new TypeError('GitHub Provider page must be an integer between 1 and 10000.');
  }
  return page;
}

export function normalizeGitHubProviderPerPage(value: number | undefined): number {
  const perPage = value ?? 30;
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new TypeError('GitHub Provider perPage must be an integer between 1 and 100.');
  }
  return perPage;
}

export function normalizeGitHubOwner(value: string): string {
  const owner = value.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || owner.endsWith('-')) {
    throw new TypeError('GitHub repository owner is invalid.');
  }
  return owner;
}

export function normalizeGitHubRepositoryName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 100 || name === '.' || name === '..' || /[\s/\\?#]/.test(name)) {
    throw new TypeError('GitHub repository name is invalid.');
  }
  return name;
}

export function normalizeGitHubBranchName(value: string): string {
  const name = value.trim();
  if (
    !name
    || name.length > 255
    || /[\u0000-\u001f\u007f~^:?*[\\]/.test(name)
    || name.startsWith('/')
    || name.endsWith('/')
    || name.startsWith('.')
    || name.endsWith('.')
    || name.includes('//')
    || name.includes('..')
    || name.includes('/.')
    || name.includes('@{')
    || name.endsWith('.lock')
  ) {
    throw new TypeError('GitHub branch name is invalid.');
  }
  return name;
}
