export const JOBS_CENTER_BUILD = 47 as const;
export const JOBS_CENTER_JOB_SCHEMA = 'gd-jobs-center-job/1' as const;
export const JOBS_CENTER_LIST_SCHEMA = 'gd-jobs-center-list/1' as const;
export const JOBS_CENTER_DETAIL_SCHEMA = 'gd-jobs-center-detail/1' as const;
export const JOBS_CENTER_CONTROL_REQUEST_SCHEMA = 'gd-jobs-center-control-request/1' as const;
export const JOBS_CENTER_CONTROL_RESULT_SCHEMA = 'gd-jobs-center-control-result/1' as const;

export const JOBS_CENTER_STATES = [
  'queued', 'running', 'checkpointed', 'waiting', 'paused',
  'completed', 'failed', 'cancelled', 'skipped',
] as const;
export type JobsCenterState = (typeof JOBS_CENTER_STATES)[number];

export const JOBS_CENTER_ACTIONS = ['pause', 'resume', 'cancel', 'retry'] as const;
export type JobsCenterAction = (typeof JOBS_CENTER_ACTIONS)[number];

export interface JobsCenterJobView {
  readonly schema: typeof JOBS_CENTER_JOB_SCHEMA;
  readonly id: string;
  readonly kind: string;
  readonly state: JobsCenterState;
  readonly priority: number;
  readonly queueOrder: number;
  readonly availableAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly pauseRequested: boolean;
  readonly cancelRequested: boolean;
  readonly workerAssigned: boolean;
  readonly hasCheckpoint: boolean;
  readonly hasResult: boolean;
  readonly hasError: boolean;
  readonly allowedActions: readonly JobsCenterAction[];
}

export interface JobsCenterTransitionView {
  readonly id: number;
  readonly fromState: JobsCenterState | null;
  readonly toState: JobsCenterState;
  readonly occurredAt: string;
}

export interface JobsCenterListView {
  readonly schema: typeof JOBS_CENTER_LIST_SCHEMA;
  readonly jobs: readonly JobsCenterJobView[];
  readonly total: number;
  readonly nonTerminal: number;
  readonly expiredLeases: number;
  readonly counts: Readonly<Record<JobsCenterState, number>>;
  readonly payloadExposed: false;
  readonly leaseTokenExposed: false;
}

export interface JobsCenterDetailView {
  readonly schema: typeof JOBS_CENTER_DETAIL_SCHEMA;
  readonly job: JobsCenterJobView;
  readonly dependencies: readonly string[];
  readonly transitions: readonly JobsCenterTransitionView[];
  readonly payloadExposed: false;
  readonly checkpointContentExposed: false;
  readonly resultContentExposed: false;
  readonly errorContentExposed: false;
  readonly workerIdentityExposed: false;
  readonly leaseTokenExposed: false;
}

export interface JobsCenterControlRequest {
  readonly schema: typeof JOBS_CENTER_CONTROL_REQUEST_SCHEMA;
  readonly action: JobsCenterAction;
}

export interface JobsCenterControlResult {
  readonly schema: typeof JOBS_CENTER_CONTROL_RESULT_SCHEMA;
  readonly action: JobsCenterAction;
  readonly job: JobsCenterJobView;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${label} fields are not canonical.`);
}

function iso(value: unknown, label: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new TypeError(`${label} must be a canonical ISO timestamp.`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new TypeError(`${label} must be a non-negative safe integer.`);
  return Number(value);
}

export function isJobsCenterState(value: unknown): value is JobsCenterState {
  return typeof value === 'string' && (JOBS_CENTER_STATES as readonly string[]).includes(value);
}

export function isJobsCenterAction(value: unknown): value is JobsCenterAction {
  return typeof value === 'string' && (JOBS_CENTER_ACTIONS as readonly string[]).includes(value);
}

export function assertJobsCenterJobView(value: unknown): asserts value is JobsCenterJobView {
  const row = record(value, 'Jobs Center job');
  exactKeys(row, [
    'schema','id','kind','state','priority','queueOrder','availableAt','createdAt','updatedAt','startedAt','finishedAt',
    'attemptCount','maxAttempts','pauseRequested','cancelRequested','workerAssigned','hasCheckpoint','hasResult','hasError','allowedActions',
  ], 'Jobs Center job');
  if (row.schema !== JOBS_CENTER_JOB_SCHEMA) throw new TypeError('Jobs Center job schema is invalid.');
  if (typeof row.id !== 'string' || !row.id.trim()) throw new TypeError('Jobs Center job id is invalid.');
  if (typeof row.kind !== 'string' || !row.kind.trim()) throw new TypeError('Jobs Center job kind is invalid.');
  if (!isJobsCenterState(row.state)) throw new TypeError('Jobs Center job state is invalid.');
  if (!Number.isSafeInteger(row.priority) || !Number.isSafeInteger(row.queueOrder)) throw new TypeError('Jobs Center queue metadata is invalid.');
  iso(row.availableAt, 'Jobs Center availableAt');
  iso(row.createdAt, 'Jobs Center createdAt');
  iso(row.updatedAt, 'Jobs Center updatedAt');
  iso(row.startedAt, 'Jobs Center startedAt', true);
  iso(row.finishedAt, 'Jobs Center finishedAt', true);
  nonNegativeInteger(row.attemptCount, 'Jobs Center attemptCount');
  if (!Number.isSafeInteger(row.maxAttempts) || Number(row.maxAttempts) < 1) throw new TypeError('Jobs Center maxAttempts is invalid.');
  for (const key of ['pauseRequested','cancelRequested','workerAssigned','hasCheckpoint','hasResult','hasError'] as const) {
    if (typeof row[key] !== 'boolean') throw new TypeError(`Jobs Center ${key} is invalid.`);
  }
  if (!Array.isArray(row.allowedActions) || !row.allowedActions.every(isJobsCenterAction)) throw new TypeError('Jobs Center allowedActions are invalid.');
}

export function assertJobsCenterListView(value: unknown): asserts value is JobsCenterListView {
  const row = record(value, 'Jobs Center list');
  exactKeys(row, ['schema','jobs','total','nonTerminal','expiredLeases','counts','payloadExposed','leaseTokenExposed'], 'Jobs Center list');
  if (row.schema !== JOBS_CENTER_LIST_SCHEMA || row.payloadExposed !== false || row.leaseTokenExposed !== false) throw new TypeError('Jobs Center list boundary is invalid.');
  if (!Array.isArray(row.jobs)) throw new TypeError('Jobs Center jobs must be an array.');
  row.jobs.forEach(assertJobsCenterJobView);
  nonNegativeInteger(row.total, 'Jobs Center total');
  nonNegativeInteger(row.nonTerminal, 'Jobs Center nonTerminal');
  nonNegativeInteger(row.expiredLeases, 'Jobs Center expiredLeases');
  const counts = record(row.counts, 'Jobs Center counts');
  exactKeys(counts, JOBS_CENTER_STATES, 'Jobs Center counts');
  for (const state of JOBS_CENTER_STATES) nonNegativeInteger(counts[state], `Jobs Center count ${state}`);
}

export function assertJobsCenterDetailView(value: unknown): asserts value is JobsCenterDetailView {
  const row = record(value, 'Jobs Center detail');
  exactKeys(row, [
    'schema','job','dependencies','transitions','payloadExposed','checkpointContentExposed','resultContentExposed',
    'errorContentExposed','workerIdentityExposed','leaseTokenExposed',
  ], 'Jobs Center detail');
  if (row.schema !== JOBS_CENTER_DETAIL_SCHEMA) throw new TypeError('Jobs Center detail schema is invalid.');
  for (const key of ['payloadExposed','checkpointContentExposed','resultContentExposed','errorContentExposed','workerIdentityExposed','leaseTokenExposed'] as const) {
    if (row[key] !== false) throw new TypeError(`Jobs Center ${key} boundary is invalid.`);
  }
  assertJobsCenterJobView(row.job);
  if (!Array.isArray(row.dependencies) || !row.dependencies.every((item) => typeof item === 'string' && item.length > 0)) throw new TypeError('Jobs Center dependencies are invalid.');
  if (!Array.isArray(row.transitions)) throw new TypeError('Jobs Center transitions must be an array.');
  for (const candidate of row.transitions) {
    const transition = record(candidate, 'Jobs Center transition');
    exactKeys(transition, ['id','fromState','toState','occurredAt'], 'Jobs Center transition');
    nonNegativeInteger(transition.id, 'Jobs Center transition id');
    if (transition.fromState !== null && !isJobsCenterState(transition.fromState)) throw new TypeError('Jobs Center transition fromState is invalid.');
    if (!isJobsCenterState(transition.toState)) throw new TypeError('Jobs Center transition toState is invalid.');
    iso(transition.occurredAt, 'Jobs Center transition occurredAt');
  }
}

export function assertJobsCenterControlRequest(value: unknown): asserts value is JobsCenterControlRequest {
  const row = record(value, 'Jobs Center control request');
  exactKeys(row, ['schema','action'], 'Jobs Center control request');
  if (row.schema !== JOBS_CENTER_CONTROL_REQUEST_SCHEMA || !isJobsCenterAction(row.action)) throw new TypeError('Jobs Center control request is invalid.');
}

export function assertJobsCenterControlResult(value: unknown): asserts value is JobsCenterControlResult {
  const row = record(value, 'Jobs Center control result');
  exactKeys(row, ['schema','action','job'], 'Jobs Center control result');
  if (row.schema !== JOBS_CENTER_CONTROL_RESULT_SCHEMA || !isJobsCenterAction(row.action)) throw new TypeError('Jobs Center control result is invalid.');
  assertJobsCenterJobView(row.job);
}
