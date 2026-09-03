import type { JsonValue } from '@github-decrypter/protocol';

declare const durableJobIdBrand: unique symbol;

export type DurableJobId = string & { readonly [durableJobIdBrand]: 'durable-job' };

export const DURABLE_JOB_STATES = [
  'queued',
  'running',
  'checkpointed',
  'waiting',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'skipped',
] as const;

export type DurableJobState = (typeof DURABLE_JOB_STATES)[number];

export const DURABLE_JOB_TERMINAL_STATES = [
  'completed',
  'failed',
  'cancelled',
  'skipped',
] as const satisfies readonly DurableJobState[];

export interface DurableJobRecord {
  readonly id: DurableJobId;
  readonly kind: string;
  readonly payload: JsonValue;
  readonly state: DurableJobState;
  readonly priority: number;
  readonly queueOrder: number;
  readonly availableAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly workerId: string | null;
  readonly leaseExpiresAt: string | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly pauseRequested: boolean;
  readonly cancelRequested: boolean;
  readonly checkpoint: JsonValue | null;
  readonly result: JsonValue | null;
  readonly error: JsonValue | null;
}

export interface DurableJobTransition {
  readonly id: number;
  readonly jobId: DurableJobId;
  readonly fromState: DurableJobState | null;
  readonly toState: DurableJobState;
  readonly reason: string | null;
  readonly occurredAt: string;
}

export interface DurableJobEnqueueOptions {
  readonly kind: string;
  readonly payload: JsonValue;
  readonly priority?: number;
  readonly availableAt?: string;
  readonly maxAttempts?: number;
  readonly dependencies?: readonly DurableJobId[];
}

export interface DurableJobClaim {
  readonly job: DurableJobRecord;
  readonly leaseToken: string;
}

export interface DurableJobSummary {
  readonly total: number;
  readonly nonTerminal: number;
  readonly expiredLeases: number;
  readonly counts: Readonly<Record<DurableJobState, number>>;
}

export interface DurableJobEngineStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly summary: DurableJobSummary;
}

export function asDurableJobId(value: string): DurableJobId {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Durable job IDs must be non-empty strings.');
  return normalized as DurableJobId;
}

export function isDurableJobState(value: unknown): value is DurableJobState {
  return typeof value === 'string' && DURABLE_JOB_STATES.includes(value as DurableJobState);
}

export function isDurableJobTerminalState(value: DurableJobState): boolean {
  return (DURABLE_JOB_TERMINAL_STATES as readonly DurableJobState[]).includes(value);
}
