import type { Capability, CapabilityGrantId } from './capability-security.js';
import type { DurableJobId, DurableJobState } from './job-types.js';
import type { ConnectivityState } from './offline-execution.js';

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

export type LocalRuntimeOfflineReadyPayload = {
  readonly connectivity: ConnectivityState;
  readonly waitingForNetwork: number;
  readonly localExecutionAvailable: true;
  readonly automaticNetworkProbe: false;
};

export type LocalRuntimeConnectivityChangedPayload = {
  readonly previous: ConnectivityState;
  readonly current: ConnectivityState;
  readonly source: string;
  readonly observedAt: string;
  readonly waitingForNetwork: number;
};

export type LocalRuntimeOfflineWaitingPayload = {
  readonly jobId: DurableJobId;
  readonly reason: string;
  readonly blockedAt: string;
};

export type LocalRuntimeOfflineResumedPayload = {
  readonly jobId: DurableJobId;
  readonly resumedAt: string;
};

export type LocalRuntimeCapabilityReadyPayload = {
  readonly activeGrants: number;
  readonly restartRevocations: number;
  readonly denyByDefault: true;
  readonly plaintextTokenPersistence: false;
  readonly secretsVaultReady: false;
  readonly approvalTransactionsReady: false;
  readonly externalGrantTransport: false;
};

export type LocalRuntimeCapabilityGrantedPayload = {
  readonly grantId: CapabilityGrantId;
  readonly jobId: DurableJobId;
  readonly capabilities: readonly Capability[];
  readonly claimCount: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
};

export type LocalRuntimeCapabilityRevokedPayload = {
  readonly grantId: CapabilityGrantId;
  readonly jobId: DurableJobId;
  readonly reason: string;
  readonly revokedAt: string;
};

export type LocalRuntimeCapabilityDeniedPayload = {
  readonly grantId: CapabilityGrantId | null;
  readonly jobId: DurableJobId;
  readonly reason: string;
  readonly missingCapabilities: readonly Capability[];
  readonly missingCount: number;
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
  readonly 'gd.local.offline.ready': LocalRuntimeOfflineReadyPayload;
  readonly 'gd.local.connectivity.changed': LocalRuntimeConnectivityChangedPayload;
  readonly 'gd.local.offline.waiting': LocalRuntimeOfflineWaitingPayload;
  readonly 'gd.local.offline.resumed': LocalRuntimeOfflineResumedPayload;
  readonly 'gd.local.capability.ready': LocalRuntimeCapabilityReadyPayload;
  readonly 'gd.local.capability.granted': LocalRuntimeCapabilityGrantedPayload;
  readonly 'gd.local.capability.revoked': LocalRuntimeCapabilityRevokedPayload;
  readonly 'gd.local.capability.denied': LocalRuntimeCapabilityDeniedPayload;
};

export function isLocalRuntimeState(value: unknown): value is LocalRuntimeState {
  return typeof value === 'string' && LOCAL_RUNTIME_STATES.includes(value as LocalRuntimeState);
}
