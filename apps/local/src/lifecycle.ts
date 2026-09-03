import type { DurableJobId, DurableJobState } from './job-types.js';

export const LOCAL_RUNTIME_STATES = [
  'idle',
  'starting',
  'running',
  'stopping',
  'stopped',
  'failed',
] as const;

export type LocalRuntimeState = (typeof LOCAL_RUNTIME_STATES)[number];

export type LocalRuntimeLifecyclePayload = {
  readonly previous: LocalRuntimeState;
  readonly current: LocalRuntimeState;
  readonly reason: string | null;
};

export type LocalRuntimeDatabaseOpenedPayload = {
  readonly schemaVersion: number;
  readonly journalMode: string;
  readonly foreignKeys: boolean;
  readonly integrity: 'ok';
};

export type LocalRuntimeDatabaseClosedPayload = {
  readonly schemaVersion: number;
  readonly reason: string | null;
};

export type LocalRuntimeJobsReadyPayload = {
  readonly schemaVersion: number;
  readonly total: number;
  readonly nonTerminal: number;
  readonly expiredLeases: number;
};

export type LocalRuntimeJobChangedPayload = {
  readonly jobId: DurableJobId;
  readonly previousState: DurableJobState | null;
  readonly currentState: DurableJobState;
  readonly reason: string | null;
};

export type LocalRuntimeRecoveryReadyPayload = {
  readonly priorUncleanSessions: number;
  readonly startupRecovered: number;
};

export type LocalRuntimeRecoverySweepPayload = {
  readonly recovered: number;
  readonly requeued: number;
  readonly paused: number;
  readonly cancelled: number;
  readonly failed: number;
  readonly occurredAt: string;
};

export type LocalRuntimeRecoveryClosedPayload = {
  readonly handoffRecovered: number;
  readonly clean: boolean;
  readonly reason: string;
};

export type LocalRuntimeEventCatalog = {
  readonly 'gd.local.lifecycle': LocalRuntimeLifecyclePayload;
  readonly 'gd.local.database.opened': LocalRuntimeDatabaseOpenedPayload;
  readonly 'gd.local.database.closed': LocalRuntimeDatabaseClosedPayload;
  readonly 'gd.local.jobs.ready': LocalRuntimeJobsReadyPayload;
  readonly 'gd.local.job.changed': LocalRuntimeJobChangedPayload;
  readonly 'gd.local.recovery.ready': LocalRuntimeRecoveryReadyPayload;
  readonly 'gd.local.recovery.sweep': LocalRuntimeRecoverySweepPayload;
  readonly 'gd.local.recovery.closed': LocalRuntimeRecoveryClosedPayload;
};

export function isLocalRuntimeState(value: unknown): value is LocalRuntimeState {
  return typeof value === 'string' && LOCAL_RUNTIME_STATES.includes(value as LocalRuntimeState);
}
