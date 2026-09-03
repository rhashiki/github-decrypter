import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  OfflineExecutionCoordinator,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build14-'));
let nowMs = Date.parse('2026-09-03T17:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const advance = (milliseconds: number) => { nowMs += milliseconds; };

try {
  const databasePath = join(tempRoot, 'offline.sqlite3');
  const database = new LocalDatabase({ path: databasePath, now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 4);
  assert.equal(database.listMigrations().length, 4);

  const events: string[] = [];
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build14-test' });
  bus.subscribe('gd.local.connectivity.changed', (event) => {
    events.push(`connectivity:${event.payload.previous}>${event.payload.current}`);
  });
  bus.subscribe('gd.local.offline.waiting', (event) => {
    events.push(`waiting:${event.payload.jobId}`);
  });
  bus.subscribe('gd.local.offline.resumed', (event) => {
    events.push(`resumed:${event.payload.jobId}`);
  });

  const jobs = new DurableJobEngine({ database, eventBus: bus, now });
  const offline = new OfflineExecutionCoordinator({ database, jobs, eventBus: bus, now });
  const initial = await offline.initialize();
  assert.equal(initial.connectivity, 'unknown');
  assert.equal(initial.localExecutionAvailable, true);
  assert.equal(initial.automaticNetworkProbe, false);

  const local = await jobs.enqueue({ kind: 'local.compile', payload: { local: true }, maxAttempts: 3 });
  const network = await jobs.enqueue({ kind: 'network.fetch-metadata', payload: { remote: true }, maxAttempts: 3 });
  await offline.declareNetworkRequired(network.id);
  assert.equal(jobs.getJob(network.id)?.state, 'waiting');
  assert.equal(jobs.getJob(network.id)?.attemptCount, 0);
  assert.equal(offline.status().waitingForNetwork, 1);

  const localClaim = await offline.claimNext('worker-local');
  assert.ok(localClaim);
  assert.equal(localClaim.job.id, local.id, 'local job must remain runnable while connectivity is unknown');
  await jobs.complete(local.id, localClaim.leaseToken, { compiled: true });

  await offline.markOffline('test-network-observer');
  const localOffline = await jobs.enqueue({ kind: 'local.test', payload: null });
  const offlineClaim = await offline.claimNext('worker-offline');
  assert.ok(offlineClaim);
  assert.equal(offlineClaim.job.id, localOffline.id, 'local work must continue while offline');
  await jobs.complete(localOffline.id, offlineClaim.leaseToken);
  assert.equal(jobs.getJob(network.id)?.state, 'waiting');

  await offline.markOnline('test-network-observer');
  assert.equal(jobs.getJob(network.id)?.state, 'queued');
  const networkClaim1 = await offline.claimNext('worker-network');
  assert.ok(networkClaim1);
  assert.equal(networkClaim1.job.id, network.id);
  assert.equal(networkClaim1.job.attemptCount, 1);

  await offline.markOffline('network-lost-during-job');
  await offline.waitForNetwork(network.id, networkClaim1.leaseToken, 'remote provider unavailable');
  assert.equal(jobs.getJob(network.id)?.state, 'waiting');
  assert.equal(jobs.getJob(network.id)?.attemptCount, 1, 'waiting for network must not consume an additional attempt');
  await assert.rejects(
    () => jobs.complete(network.id, networkClaim1.leaseToken),
    /lease|running/i,
    'stale lease must not mutate a job after it entered network wait',
  );

  advance(1_000);
  await offline.markOnline('network-restored');
  assert.equal(jobs.getJob(network.id)?.state, 'queued');
  const networkClaim2 = await offline.claimNext('worker-network-2');
  assert.ok(networkClaim2);
  assert.equal(networkClaim2.job.id, network.id);
  assert.equal(networkClaim2.job.attemptCount, 2);
  await jobs.complete(network.id, networkClaim2.leaseToken, { restored: true });

  const genericWait = await jobs.enqueue({ kind: 'local.external-prerequisite', payload: null, maxAttempts: 3 });
  const genericClaim = await offline.claimNext('worker-generic');
  assert.ok(genericClaim);
  assert.equal(genericClaim.job.id, genericWait.id);
  await jobs.wait(genericWait.id, genericClaim.leaseToken, new Date(nowMs + 60_000).toISOString(), 'non-network prerequisite');
  await offline.markOffline('generic-wait-isolation');
  await offline.markOnline('generic-wait-isolation');
  assert.equal(jobs.getJob(genericWait.id)?.state, 'waiting', 'generic waiting jobs must not be resumed by connectivity changes');
  await jobs.resume(genericWait.id);
  await jobs.requestCancel(genericWait.id, 'test cleanup');

  await offline.markOffline('persistence-check');
  const persistentNetwork = await jobs.enqueue({ kind: 'network.persist', payload: { survives: true }, maxAttempts: 2 });
  await offline.declareNetworkRequired(persistentNetwork.id);
  assert.equal(jobs.getJob(persistentNetwork.id)?.state, 'waiting');
  database.close();

  const reopenedDatabase = new LocalDatabase({ path: databasePath, now });
  reopenedDatabase.open();
  const reopenedJobs = new DurableJobEngine({ database: reopenedDatabase, now });
  const reopenedOffline = new OfflineExecutionCoordinator({ database: reopenedDatabase, jobs: reopenedJobs, now });
  const reopenedStatus = await reopenedOffline.initialize();
  assert.equal(reopenedStatus.connectivity, 'offline');
  assert.equal(reopenedStatus.waitingForNetwork, 1);
  assert.equal(reopenedJobs.getJob(persistentNetwork.id)?.state, 'waiting');
  await reopenedOffline.clearNetworkRequirement(persistentNetwork.id);
  assert.equal(reopenedJobs.getJob(persistentNetwork.id)?.state, 'queued');
  const reclassified = await reopenedOffline.claimNext('worker-reclassified');
  assert.ok(reclassified);
  assert.equal(reclassified.job.id, persistentNetwork.id);
  await reopenedJobs.complete(persistentNetwork.id, reclassified.leaseToken);
  reopenedDatabase.close();

  const daemonDatabasePath = join(tempRoot, 'daemon.sqlite3');
  const daemonLockPath = join(tempRoot, 'daemon.lock');
  const config = { host: '127.0.0.1', port: 0, lockPath: daemonLockPath, databasePath: daemonDatabasePath } as const;
  const daemon = new LocalRuntimeDaemon({ config, now });
  const address = await daemon.start();
  const health = await (await fetch(`${address.origin}/healthz`)).json() as Record<string, any>;
  assert.equal(health.build, 14);
  assert.equal(health.version, '0.0.14');
  assert.equal(health.database.schemaVersion, 4);
  assert.equal(health.offline.ready, true);
  assert.equal(health.offline.connectivity, 'unknown');
  assert.equal(health.offline.localExecutionAvailable, true);
  assert.equal(health.offline.automaticNetworkProbe, false);
  const readyResponse = await fetch(`${address.origin}/readyz`);
  assert.equal(readyResponse.status, 200, 'offline/unknown connectivity must not make local runtime unready');
  const ready = await readyResponse.json() as Record<string, any>;
  assert.equal(ready.offlineExecutionReady, true);
  assert.equal(ready.localExecutionAvailable, true);
  assert.equal((await fetch(`${address.origin}/v1/connectivity`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/jobs`)).status, 404);
  await daemon.stop('Build 14 verified');

  assert.ok(events.some((entry) => entry.startsWith('connectivity:')));
  assert.ok(events.some((entry) => entry.startsWith('waiting:')));
  assert.ok(events.some((entry) => entry.startsWith('resumed:')));

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build14-offline-execution-runtime/1',
    schemaVersion: 4,
    unknownFailsClosedForNetwork: true,
    localJobsRunOffline: true,
    networkJobsWaitDurably: true,
    networkResume: true,
    cooperativeMidRunWait: true,
    attemptBudgetPreserved: true,
    staleLeaseRejected: true,
    genericWaitIsolation: true,
    connectivityPersistsAcrossRestart: true,
    daemonReadyOffline: true,
    automaticNetworkProbe: false,
    jobControlHttp: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
