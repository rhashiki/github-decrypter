import type { WorkspaceId } from '@github-decrypter/workspace';

export const packageIdentity = '@github-decrypter/git' as const;
export const GIT_RUNTIME_SCHEMA = 'gd-git-runtime/1' as const;
export const CHANGE_TRACKING_SCHEMA = 'gd-change-tracking/1' as const;

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

export const CHANGE_ORIGINS = ['human', 'ai', 'mixed', 'unknown'] as const;
export type ChangeOrigin = (typeof CHANGE_ORIGINS)[number];

export const AI_CHANGE_SESSION_STATES = ['active', 'completed', 'cancelled', 'invalidated'] as const;
export type AiChangeSessionState = (typeof AI_CHANGE_SESSION_STATES)[number];

declare const aiChangeSessionIdBrand: unique symbol;
export type AiChangeSessionId = string & { readonly [aiChangeSessionIdBrand]: 'ai-change-session-id' };

export interface ChangePathAttribution {
  readonly path: string;
  readonly origin: ChangeOrigin;
  readonly digest: string;
  readonly staged: boolean;
  readonly unstaged: boolean;
  readonly untracked: boolean;
  readonly conflicted: boolean;
}

export interface ChangeTrackingCounts {
  readonly human: number;
  readonly ai: number;
  readonly mixed: number;
  readonly unknown: number;
}

export interface ChangeTrackingSnapshot {
  readonly schema: typeof CHANGE_TRACKING_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly paths: readonly ChangePathAttribution[];
  readonly counts: ChangeTrackingCounts;
  readonly observedAt: string;
}

export interface AiChangeSessionRecord {
  readonly schema: typeof CHANGE_TRACKING_SCHEMA;
  readonly id: AiChangeSessionId;
  readonly workspaceId: WorkspaceId;
  readonly jobId: string;
  readonly state: AiChangeSessionState;
  readonly baselineDigest: string;
  readonly baselinePaths: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly invalidationReason: string | null;
}
