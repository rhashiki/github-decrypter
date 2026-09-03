import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  CrashPowerRecovery,
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  LOCAL_DATABASE_SCHEMA_VERSION,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build13-'));
let nowMs = Date.parse('2026-09-03T16:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const advance = (milliseconds: number) => { nowMs += milliseconds; };
const patchVersion = (value: unknown) => {
  const match = String(value ?? '').match(/^0\.0\.(\d+)$/);
  assert.ok(match, `expected pre-V1 runtime version, got ${value}`);
  return Number(match[1]);
};

try {
  const databasePath = join(tempRoot, 'recovery.sqlite3');
  const database1 = new LocalDatabase({ path: databasePath, now });
  const opened1 = database1.open();
  assert.ok(opened1.schemaVersion >= 3);
  assert.ok(LOCAL_DATABASE_SCHEMA_VERSION >= 3);
  assert.ok(database1.listMigrations().length >= 3);

  const events: string[] = [];
  const bus1 = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build13-session-1' });
  bus1.subscribe('gd.local.recovery.ready', (event) => {
    events.push(`ready:${event.payload.startupRecovered}`);
  });
  bus1.subscribe('gd.local.job.changed', (event) => {
    if (event.payload.reason?.startsWith('recovery:')) {
      events.push(`recovered:${event.payload.currentState}`);
    }
  });

  const engine1 = new DurableJobEngine({ database: database1, eventBus: bus1, now });
  const recovery1 = new CrashPowerRecovery({ database: database1, eventBus: bus1, now });
  const firstStatus = await recovery1.startSession();
  assert.equal(firstStatus.ready, true);
  assert.equal(firstStatus.priorUncleanSessions, 0);
  assert.equal(firstStatus.startupRecovered, 0);
  const firstSessionId = recovery1.sessionId!;

  const resumable = await engine1.enqueue({ kind: 'recovery.resumable', payload: { task: 1 }, maxAttempts: 3 });
  const resumableClaim1 = await engine1.claimNext('worker-resume-1');
  assert.ok(resumableClaim1);
  assert.equal(resumableClaim1.job.id, resumable.id);
  await engine1.checkpoint(resumable.id, resumableClaim1.leaseToken, { phase: 1, durable: true });
  await engine1.resume(resumable.id);
  const resumableClaim2 = await engine1.claimNext('worker-resume-2');
  assert.ok(resumableClaim2);
  assert.equal(resumableClaim2.job.attemptCount, 2);

  const cancellable = await engine1.enqueue({ kind: 'recovery.cancel', payload: null, maxAttempts: 3 });
  const cancelClaim = await engine1.claimNext('worker-cancel');
  assert.ok(cancelClaim);
  assert.equal(cancelClaim.job.id, cancellable.id);
  assert.equal((await engine1.requestCancel(cancellable.id, 'user cancelled before crash')).cancelRequested, true);

  const pausable = await engine1.enqueue({ kind: 'recovery.pause', payload: null, maxAttempts: 3 });
  const pauseClaim = await engine1.claimNext('worker-pause');
  assert.ok(pauseClaim);
  assert.equal(pauseClaim.job.id, pausable.id);
  assert.equal((await engine1.requestPause(pausable.id, 'user paused before crash')).pauseRequested, true);

  const exhausted = await engine1.enqueue({ kind: 'recovery.exhausted', payload: null, maxAttempts: 1 });
  const exhaustedClaim = await engine1.claimNext('worker-exhausted');
  assert.ok(exhaustedClaim);
  assert.equal(exhaustedClaim.job.id, exhausted.id);
  assert.equal(exhaustedClaim.job.attemptCount, 1);

  // Simulate abrupt process/power loss: database closes without recovery.stopSession().
  database1.close();
  advance(500);

  const database2 = new LocalDatabase({ path: databasePath, now });
  database2.open();
  const bus2 = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build13-session-2' });
  const engine2 = new DurableJobEngine({ database: database2, eventBus: bus2, now });
  const recovery2 = new CrashPowerRecovery({ database: database2, eventBus: bus2, now });
  const secondStatus = await recovery2.startSession();
  const secondSessionId = recovery2.sessionId!;

  assert.equal(secondStatus.ready, true);
  assert.equal(secondStatus.priorUncleanSessions, 1);
  assert.equal(secondStatus.startupRecovered, 4);
  assert.equal(engine2.getJob(resumable.id)?.state, 'queued');
  assert.deepEqual(engine2.getJob(resumable.id)?.checkpoint, { phase: 1, durable: true });
  assert.equal(engine2.getJob(resumable.id)?.attemptCount, 2);
  assert.equal(engine2.getJob(cancellable.id)?.state, 'cancelled');
  assert.equal(engine2.getJob(pausable.id)?.state, 'paused');
  assert.equal(engine2.getJob(exhausted.id)?.state, 'failed');
  assert.deepEqual(engine2.getJob(exhausted.id)?.error, {
    code: 'GD_RECOVERY_ATTEMPTS_EXHAUSTED',
    message: 'Interrupted durable job exhausted its retry budget.',
    reason: 'startup crash/power reconciliation',
    recoveredAt: now(),
  });

  await assert.rejects(() => engine2.complete(resumable.id, resumableClaim2.leaseToken, { stale: true }));
  await assert.rejects(() => engine2.acknowledgeCancel(cancellable.id, cancelClaim.leaseToken));
  await assert.rejects(() => engine2.acknowledgePause(pausable.id, pauseClaim.leaseToken));

  const recoveries = recovery2.listRecoveries();
  assert.equal(recoveries.length, 4);
  assert.deepEqual(
    recoveries.map((entry) => entry.action).sort(),
    ['cancelled', 'failed', 'paused', 'requeued'],
  );
  assert.equal(recovery2.listRecoveries(resumable.id)[0]?.previousWorkerId, 'worker-resume-2');

  const sessionsAfterCrash = recovery2.listSessions();
  const firstSession = sessionsAfterCrash.find((session) => session.id === firstSessionId);
  const secondSession = sessionsAfterCrash.find((session) => session.id === secondSessionId);
  assert.ok(firstSession);
  assert.ok(secondSession);
  assert.equal(firstSession.cleanShutdownAt, null);
  assert.ok(firstSession.reconciledAt);
  assert.equal(secondSession.priorUncleanSessions, 1);
  assert.equal(secondSession.startupRecoveredJobs, 4);

  const idempotent = await recovery2.recoverAllRunning('idempotency verification');
  assert.equal(idempotent.scanned, 0);
  assert.equal(recovery2.listRecoveries().length, 4);

  const resumableClaim3 = await engine2.claimNext('worker-resume-3');
  assert.ok(resumableClaim3);
  assert.equal(resumableClaim3.job.id, resumable.id);
  assert.equal(resumableClaim3.job.attemptCount, 3);
  assert.deepEqual(resumableClaim3.job.checkpoint, { phase: 1, durable: true });
  await engine2.complete(resumable.id, resumableClaim3.leaseToken, { recovered: true });

  const expiring = await engine2.enqueue({ kind: 'recovery.expired-lease', payload: null, maxAttempts: 3 });
  const expiringClaim1 = await engine2.claimNext('worker-expiring', 1_000);
  assert.ok(expiringClaim1);
  assert.equal(expiringClaim1.job.id, expiring.id);
  advance(2_000);
  const sweep = await recovery2.sweepExpiredLeases();
  assert.equal(sweep.scanned, 1);
  assert.equal(sweep.requeued, 1);
  assert.equal(engine2.getJob(expiring.id)?.state, 'queued');
  await assert.rejects(() => engine2.complete(expiring.id, expiringClaim1.leaseToken));
  const expiringClaim2 = await engine2.claimNext('worker-expiring-2');
  assert.ok(expiringClaim2);
  assert.equal(expiringClaim2.job.id, expiring.id);
  await engine2.complete(expiring.id, expiringClaim2.leaseToken);

  const handoff = await engine2.enqueue({ kind: 'recovery.clean-handoff', payload: { clean: true }, maxAttempts: 2 });
  const handoffClaim = await engine2.claimNext('worker-handoff');
  assert.ok(handoffClaim);
  assert.equal(handoffClaim.job.id, handoff.id);
  const handoffCount = await recovery2.stopSession('planned shutdown');
  assert.equal(handoffCount, 1);
  assert.equal(engine2.getJob(handoff.id)?.state, 'queued');
  const cleanSession = recovery2.listSessions().find((session) => session.id === secondSessionId);
  assert.ok(cleanSession?.cleanShutdownAt);
  assert.equal(cleanSession.shutdownReason, 'planned shutdown');
  database2.close();

  advance(500);
  const database3 = new LocalDatabase({ path: databasePath, now });
  database3.open();
  const recovery3 = new CrashPowerRecovery({ database: database3, now });
  const thirdStatus = await recovery3.startSession();
  assert.equal(thirdStatus.priorUncleanSessions, 0, 'reconciled crashes must not be counted forever');
  assert.equal(thirdStatus.startupRecovered, 0, 'clean shutdown handoff must leave no running orphan');
  await recovery3.stopSession('verification complete');
  database3.close();

  const daemonDatabasePath = join(tempRoot, 'daemon.sqlite3');
  const daemonLockPath = join(tempRoot, 'daemon.lock');
  const daemonEvents: string[] = [];
  const daemonBus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build13-daemon' });
  daemonBus.subscribe('gd.local.recovery.ready', (event) => {
    daemonEvents.push(`recovery-ready:${event.payload.startupRecovered}`);
  });
  daemonBus.subscribe('gd.local.recovery.closed', (event) => {
    daemonEvents.push(`recovery-closed:${event.payload.handoffRecovered}`);
  });
  const config = { host: '127.0.0.1', port: 0, lockPath: daemonLockPath, databasePath: daemonDatabasePath } as const;
  const daemon = new LocalRuntimeDaemon({ config, eventBus: daemonBus, now });
  const address = await daemon.start();
  const health = await (await fetch(`${address.origin}/healthz`)).json() as Record<string, any>;
  assert.ok(Number(health.build) >= 13);
  assert.ok(patchVersion(health.version) >= 13);
  assert.ok(Number(health.database.schemaVersion) >= 3);
  assert.equal(health.recovery.ready, true);
  assert.equal(health.recovery.sessionActive, true);
  assert.equal(health.recovery.healthy, true);
  const readiness = await (await fetch(`${address.origin}/readyz`)).json() as Record<string, any>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.recoveryReady, true);
  assert.equal((await fetch(`${address.origin}/v1/jobs`)).status, 404);

  const daemonJob = await daemon.jobs.enqueue({ kind: 'daemon.clean-handoff', payload: { survives: true }, maxAttempts: 2 });
  const daemonClaim = await daemon.jobs.claimNext('daemon-worker');
  assert.ok(daemonClaim);
  assert.equal(daemonClaim.job.id, daemonJob.id);
  await daemon.stop('Build 13 graceful restart');
  assert.deepEqual(daemonEvents, ['recovery-ready:0', 'recovery-closed:1']);

  const restarted = new LocalRuntimeDaemon({ config, now });
  const restartedAddress = await restarted.start();
  assert.equal(restarted.jobs.getJob(daemonJob.id)?.state, 'queued');
  const restartedHealth = await (await fetch(`${restartedAddress.origin}/healthz`)).json() as Record<string, any>;
  assert.equal(restartedHealth.recovery.priorUncleanSessions, 0);
  assert.equal(restartedHealth.recovery.startupRecovered, 0);
  await restarted.stop('Build 13 daemon recovery verified');

  assert.ok(events.includes('ready:0'));

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build13-crash-power-recovery-runtime/2',
    minimumSchemaVersion: 3,
    currentSchemaVersion: LOCAL_DATABASE_SCHEMA_VERSION,
    uncleanSessionDetection: true,
    startupRecovery: true,
    checkpointPreserved: true,
    cancelIntentPreserved: true,
    pauseIntentPreserved: true,
    retryBudgetPreserved: true,
    staleLeaseInvalidation: true,
    expiredLeaseSweep: true,
    recoveryIdempotent: true,
    gracefulShutdownHandoff: true,
    cleanSessionMarkers: true,
    daemonReadinessIntegration: true,
    allowsLaterSchemaMigrations: true,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
