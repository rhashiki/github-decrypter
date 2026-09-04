import type { WorkspaceId } from '@github-decrypter/workspace';

export const packageIdentity = '@github-decrypter/git' as const;
export const GIT_RUNTIME_SCHEMA = 'gd-git-runtime/1' as const;

export const GIT_OPERATIONS = [
  'status',
  'diff',
  'log',
  'branches',
  'merge-base',
  'blame',
  'clone',
  'fetch',
  'pull',
  'checkout',
  'create-branch',
  'commit',
  'push',
  'stash-push',
  'stash-pop',
  'restore',
] as const;

export type GitOperation = (typeof GIT_OPERATIONS)[number];

export interface GitStatusSnapshot {
  readonly schema: typeof GIT_RUNTIME_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly repository: boolean;
  readonly branch: string | null;
  readonly head: string | null;
  readonly upstream: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly staged: readonly string[];
  readonly unstaged: readonly string[];
  readonly untracked: readonly string[];
  readonly conflicted: readonly string[];
  readonly clean: boolean;
  readonly observedAt: string;
}

export interface GitTextResult {
  readonly schema: typeof GIT_RUNTIME_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly operation: Extract<GitOperation, 'diff' | 'blame' | 'merge-base'>;
  readonly text: string;
  readonly observedAt: string;
}

export interface GitLogEntry {
  readonly hash: string;
  readonly parents: readonly string[];
  readonly authorName: string;
  readonly authorEmail: string;
  readonly authoredAt: string;
  readonly subject: string;
}

export interface GitLogResult {
  readonly schema: typeof GIT_RUNTIME_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly entries: readonly GitLogEntry[];
  readonly observedAt: string;
}

export interface GitBranchSummary {
  readonly name: string;
  readonly head: string;
  readonly upstream: string | null;
  readonly current: boolean;
}

export interface GitBranchesResult {
  readonly schema: typeof GIT_RUNTIME_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly branches: readonly GitBranchSummary[];
  readonly observedAt: string;
}

export interface GitMutationResult {
  readonly schema: typeof GIT_RUNTIME_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly operation: Exclude<GitOperation, 'status' | 'diff' | 'log' | 'branches' | 'merge-base' | 'blame'>;
  readonly changed: boolean;
  readonly output: string;
  readonly observedAt: string;
}
