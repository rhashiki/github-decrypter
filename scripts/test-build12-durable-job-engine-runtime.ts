import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build12-'));
const databasePath = join(tempRoot, 'jobs.sqlite3');
let nowMs = Date.parse('2026-09-03T15:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const advance = (milliseconds: number) => { nowMs += milliseconds; };

try {
  const database = new LocalDatabase({ path: databasePath, now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 2);
  assert.equal(database.listMigrations().length, 2);

  const changes: string[] = [];
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build12-test' });
  bus.subscribe('gd.local.job.changed', (event) => {
    changes.push(`${event.payload.previousState ?? 'none'}>${event.payload.currentState}`);
  });

  const engine = new DurableJobEngine({ database, eventBus: bus, now });
  assert.equal(engine.status().ready, true);

  const root = await engine.enqueue({
    kind: 'build.root',
    payload: { task: 'root' },
    maxAttempts: 3,
  });
  const dependent = await engine.enqueue({
    kind: 'build.dependent',
    payload: { task: 'dependent' },
    priority: 100,
    maxAttempts: 2,
    dependencies: [root.id],
  });
  const priority = await engine.enqueue({
    kind: 'build.priority',
    payload: { task: 'priority' },
    priority: 10,
  });

  const first = await engine.claimNext('worker-a');
  assert.ok(first);
  assert.equal(first.job.id, priority.id, 'blocked high-priority dependency must not outrank runnable work');
  assert.match(first.leaseToken, /^gd_lease_/);
  const heartbeat = engine.heartbeat(first.job.id, first.leaseToken, 60_000);
  assert.equal(heartbeat.state, 'running');
  assert.ok(Date.parse(heartbeat.leaseExpiresAt!) > nowMs);
  await engine.complete(first.job.id, first.leaseToken, { ok: true });

  const rootClaim1 = await engine.claimNext('worker-a');
  assert.ok(rootClaim1);
  assert.equal(rootClaim1.job.id, root.id);
  const checkpointed = await engine.checkpoint(root.id, rootClaim1.leaseToken, { phase: 1 });
  assert.equal(checkpointed.state, 'checkpointed');
  assert.deepEqual(checkpointed.checkpoint, { phase: 1 });

  await engine.resume(root.id);
  const rootClaim2 = await engine.claimNext('worker-b');
  assert.ok(rootClaim2);
  assert.equal(rootClaim2.job.id, root.id);
  assert.equal(rootClaim2.job.attemptCount, 2);
  await engine.complete(root.id, rootClaim2.leaseToken, { done: true });

  const dependentClaim1 = await engine.claimNext('worker-b');
  assert.ok(dependentClaim1);
  assert.equal(dependentClaim1.job.id, dependent.id);
  await engine.fail(dependent.id, dependentClaim1.leaseToken, { code: 'TRANSIENT' });
  assert.equal(engine.getJob(dependent.id)?.state, 'failed');
  await engine.retry(dependent.id);
  const dependentClaim2 = await engine.claimNext('worker-c');
  assert.ok(dependentClaim2);
  assert.equal(dependentClaim2.job.attemptCount, 2);
  await engine.complete(dependent.id, dependentClaim2.leaseToken, { retried: true });

  const pausable = await engine.enqueue({ kind: 'control.pause', payload: null, maxAttempts: 5 });
  assert.equal((await engine.requestPause(pausable.id)).state, 'paused');
  await engine.resume(pausable.id);
  const pauseClaim = await engine.claimNext('worker-control');
  assert.ok(pauseClaim);
  assert.equal(pauseClaim.job.id, pausable.id);
  const pauseRequested = await engine.requestPause(pausable.id);
  assert.equal(pauseRequested.state, 'running');
  assert.equal(pauseRequested.pauseRequested, true);
  assert.equal((await engine.acknowledgePause(pausable.id, pauseClaim.leaseToken)).state, 'paused');
  await engine.resume(pausable.id);
  const waitClaim = await engine.claimNext('worker-control');
  assert.ok(waitClaim);
  await engine.wait(pausable.id, waitClaim.leaseToken, new Date(nowMs + 10_000).toISOString(), 'external prerequisite');
  assert.equal(engine.getJob(pausable.id)?.state, 'waiting');
  await engine.resume(pausable.id);
  const finalPauseClaim = await engine.claimNext('worker-control');
  assert.ok(finalPauseClaim);
  await engine.complete(pausable.id, finalPauseClaim.leaseToken);

  const cancellable = await engine.enqueue({ kind: 'control.cancel', payload: null });
  assert.equal((await engine.requestCancel(cancellable.id)).state, 'cancelled');

  const skipped = await engine.enqueue({ kind: 'dag.skip', payload: null });
  const afterSkipped = await engine.enqueue({ kind: 'dag.after-skip', payload: null, dependencies: [skipped.id] });
  await engine.skip(skipped.id, 'not required');
  const afterSkipClaim = await engine.claimNext('worker-dag');
  assert.ok(afterSkipClaim);
  assert.equal(afterSkipClaim.job.id, afterSkipped.id, 'skipped dependency must satisfy the DAG edge');
  await engine.complete(afterSkipped.id, afterSkipClaim.leaseToken);

  const expiring = await engine.enqueue({ kind: 'lease.expiring', payload: { durable: true } });
  const expiringClaim = await engine.claimNext('worker-expiring', 1_000);
  assert.ok(expiringClaim);
  assert.equal(expiringClaim.job.id, expiring.id);
  advance(2_000);
  assert.deepEqual(engine.listExpiredLeases().map((job) => job.id), [expiring.id]);
  assert.equal(engine.summary().expiredLeases, 1);

  database.close();
  assert.equal(existsSync(databasePath), true);
  const reopenedDatabase = new LocalDatabase({ path: databasePath, now });
  reopenedDatabase.open();
  const reopenedEngine = new DurableJobEngine({ database: reopenedDatabase, now });
  assert.equal(reopenedEngine.getJob(root.id)?.state, 'completed');
  assert.equal(reopenedEngine.getJob(expiring.id)?.state, 'running');
  assert.equal(reopenedEngine.listExpiredLeases().length, 1, 'Build 12 detects but does not auto-recover expired running jobs');
  await reopenedEngine.acknowledgeCancel(expiring.id, expiringClaim.leaseToken, 'test cleanup');

  const cycleA = await reopenedEngine.enqueue({ kind: 'dag.cycle-a', payload: null });
  const cycleB = await reopenedEngine.enqueue({ kind: 'dag.cycle-b', payload: null, dependencies: [cycleA.id] });
  await assert.rejects(() => reopenedEngine.addDependency(cycleA.id, cycleB.id), /cycle/i);
  await reopenedEngine.requestCancel(cycleA.id);
  await reopenedEngine.requestCancel(cycleB.id);
  assert.ok(reopenedEngine.listTransitions(root.id).length >= 4);
  reopenedDatabase.close();

  const daemonDatabasePath = join(tempRoot, 'daemon.sqlite3');
  const daemonLockPath = join(tempRoot, 'daemon.lock');
  const daemonEvents: string[] = [];
  const daemonBus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build12-daemon-test' });
  daemonBus.subscribe('gd.local.jobs.ready', (event) => {
    daemonEvents.push(`ready:${event.payload.schemaVersion}`);
  });
  const config = { host: '127.0.0.1', port: 0, lockPath: daemonLockPath, databasePath: daemonDatabasePath } as const;
  const daemon = new LocalRuntimeDaemon({ config, eventBus: daemonBus, now });
  const address = await daemon.start();
  assert.equal(daemon.jobs.status().ready, true);
  const health = await (await fetch(`${address.origin}/healthz`)).json() as Record<string, any>;
  assert.equal(health.build, 12);
  assert.equal(health.version, '0.0.12');
  assert.equal(health.database.schemaVersion, 2);
  assert.equal(health.jobs.ready, true);
  const ready = await (await fetch(`${address.origin}/readyz`)).json() as Record<string, any>;
  assert.equal(ready.jobsReady, true);
  assert.equal((await fetch(`${address.origin}/v1/jobs`)).status, 404, 'job control transport must not arrive in Build 12');

  const daemonJob = await daemon.jobs.enqueue({ kind: 'daemon.persist', payload: { survives: true } });
  await daemon.stop('Build 12 restart test');
  assert.deepEqual(daemonEvents, ['ready:2']);

  const restarted = new LocalRuntimeDaemon({ config, now });
  await restarted.start();
  assert.deepEqual(restarted.jobs.getJob(daemonJob.id)?.payload, { survives: true });
  await restarted.stop('Build 12 persistence verified');

  assert.ok(changes.includes('none>queued'));
  assert.ok(changes.includes('queued>running'));
  assert.ok(changes.includes('running>checkpointed'));
  assert.ok(changes.includes('running>completed'));

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build12-durable-job-engine-runtime/1',
    schemaVersion: 2,
    persistenceAcrossRestart: true,
    deterministicQueue: true,
    dependencyDag: true,
    cycleRejected: true,
    leaseTokens: true,
    heartbeat: true,
    checkpointResume: true,
    pauseResume: true,
    waitResume: true,
    cancel: true,
    skip: true,
    retryBudget: true,
    expiredLeaseDetection: true,
    automaticCrashRecovery: false,
    jobControlHttp: false,
    daemonIntegration: true,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
