import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertJobsCenterControlResult,
  assertJobsCenterDetailView,
  assertJobsCenterListView,
} from '../packages/protocol/src/index.js';
import {
  DurableJobEngine,
  JobsCenter,
  LocalDatabase,
  LocalRuntimeDaemon,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build47-'));
const now = () => '2026-09-08T21:00:00.000Z';

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'jobs-center.sqlite3'), now });
  database.open();
  const engine = new DurableJobEngine({ database, now });
  const center = new JobsCenter({ jobs: engine });

  const pausable = await engine.enqueue({
    kind: 'build47.pause',
    payload: { secretPayloadMarker: 'must-not-leak' },
    maxAttempts: 3,
  });
  const cancellable = await engine.enqueue({ kind: 'build47.cancel', payload: { private: true } });
  const retryable = await engine.enqueue({ kind: 'build47.retry', payload: null, maxAttempts: 2 });

  const retryClaim = await engine.claimNext('build47-worker');
  assert.ok(retryClaim);
  assert.equal(retryClaim.job.id, pausable.id);
  await engine.wait(pausable.id, retryClaim.leaseToken, undefined, 'prepare paused control fixture');

  const retryClaim2 = await engine.claimNext('build47-worker');
  assert.ok(retryClaim2);
  assert.equal(retryClaim2.job.id, cancellable.id);
  await engine.complete(cancellable.id, retryClaim2.leaseToken);

  const retryClaim3 = await engine.claimNext('build47-worker');
  assert.ok(retryClaim3);
  assert.equal(retryClaim3.job.id, retryable.id);
  await engine.fail(retryable.id, retryClaim3.leaseToken, { privateErrorMarker: 'must-not-leak' });

  const initialList = center.list();
  assertJobsCenterListView(initialList);
  assert.equal(initialList.payloadExposed, false);
  assert.equal(initialList.leaseTokenExposed, false);
  assert.equal(initialList.jobs.length, 3);
  assert.equal(JSON.stringify(initialList).includes('secretPayloadMarker'), false);
  assert.equal(JSON.stringify(initialList).includes('privateErrorMarker'), false);
  assert.equal(JSON.stringify(initialList).includes('build47-worker'), false);
  assert.equal(JSON.stringify(initialList).includes('gd_lease_'), false);

  const waitingDetail = center.get(pausable.id);
  assert.ok(waitingDetail);
  assertJobsCenterDetailView(waitingDetail);
  assert.equal(waitingDetail.payloadExposed, false);
  assert.equal(waitingDetail.checkpointContentExposed, false);
  assert.equal(waitingDetail.resultContentExposed, false);
  assert.equal(waitingDetail.errorContentExposed, false);
  assert.equal(waitingDetail.workerIdentityExposed, false);
  assert.equal(waitingDetail.leaseTokenExposed, false);
  assert.deepEqual(waitingDetail.job.allowedActions, ['resume', 'cancel']);

  const resumed = await center.control({ jobId: pausable.id, action: 'resume' });
  assertJobsCenterControlResult(resumed);
  assert.equal(resumed.job.state, 'queued');
  assert.deepEqual(resumed.job.allowedActions, ['pause', 'cancel']);

  const paused = await center.control({ jobId: pausable.id, action: 'pause' });
  assert.equal(paused.job.state, 'paused');
  assert.deepEqual(paused.job.allowedActions, ['resume', 'cancel']);

  const cancelled = await center.control({ jobId: pausable.id, action: 'cancel' });
  assert.equal(cancelled.job.state, 'cancelled');
  assert.deepEqual(cancelled.job.allowedActions, []);

  const failedDetail = center.get(retryable.id);
  assert.ok(failedDetail);
  assert.deepEqual(failedDetail.job.allowedActions, ['retry']);
  assert.equal(failedDetail.job.hasError, true);
  assert.equal(JSON.stringify(failedDetail).includes('privateErrorMarker'), false);
  const retried = await center.control({ jobId: retryable.id, action: 'retry' });
  assert.equal(retried.job.state, 'queued');

  await assert.rejects(() => center.control({ jobId: retryable.id, action: 'retry' }), /not allowed/i);
  assert.equal('enqueue' in center, false);
  assert.equal('skip' in center, false);
  assert.equal('setPriority' in center, false);

  database.close();

  const daemon = new LocalRuntimeDaemon({
    config: {
      host: '127.0.0.1',
      port: 0,
      lockPath: join(tempRoot, 'daemon.lock'),
      databasePath: join(tempRoot, 'daemon.sqlite3'),
    },
    now,
  });
  const address = await daemon.start();
  const daemonJob = await daemon.jobs.enqueue({ kind: 'build47.http', payload: { hidden: 'payload' }, maxAttempts: 2 });

  const noHeader = await fetch(`${address.origin}/v1/jobs`);
  assert.equal(noHeader.status, 403);

  const wrongOrigin = await fetch(`${address.origin}/v1/jobs`, {
    headers: {
      origin: 'https://example.com',
      'x-github-decrypter-client': 'gd-studio-jobs-center/1',
    },
  });
  assert.equal(wrongOrigin.status, 403);

  const listResponse = await fetch(`${address.origin}/v1/jobs`, {
    headers: { 'x-github-decrypter-client': 'gd-studio-jobs-center/1' },
  });
  assert.equal(listResponse.status, 200);
  const listPayload: unknown = await listResponse.json();
  assertJobsCenterListView(listPayload);
  assert.equal(JSON.stringify(listPayload).includes('payload'), false);

  const detailResponse = await fetch(`${address.origin}/v1/jobs/${encodeURIComponent(daemonJob.id)}`, {
    headers: { 'x-github-decrypter-client': 'gd-studio-jobs-center/1' },
  });
  assert.equal(detailResponse.status, 200);
  const detailPayload: unknown = await detailResponse.json();
  assertJobsCenterDetailView(detailPayload);

  const controlResponse = await fetch(`${address.origin}/v1/jobs/${encodeURIComponent(daemonJob.id)}/control`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-decrypter-client': 'gd-studio-jobs-center/1',
    },
    body: JSON.stringify({ action: 'cancel' }),
  });
  assert.equal(controlResponse.status, 200);
  const controlPayload: unknown = await controlResponse.json();
  assertJobsCenterControlResult(controlPayload);
  assert.equal(controlPayload.action, 'cancel');
  assert.equal(controlPayload.job.state, 'cancelled');

  const invalidControl = await fetch(`${address.origin}/v1/jobs/${encodeURIComponent(daemonJob.id)}/control`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-decrypter-client': 'gd-studio-jobs-center/1',
    },
    body: JSON.stringify({ action: 'skip' }),
  });
  assert.equal(invalidControl.status, 400);

  const enqueueRoute = await fetch(`${address.origin}/v1/jobs/enqueue`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-decrypter-client': 'gd-studio-jobs-center/1',
    },
    body: JSON.stringify({ kind: 'forbidden', payload: null }),
  });
  assert.equal(enqueueRoute.status, 405);

  const preflight = await fetch(`${address.origin}/v1/jobs`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://127.0.0.1:5173',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'x-github-decrypter-client',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /X-GitHub-Decrypter-Client/i);

  await daemon.stop('Build 47 Jobs Center runtime validation complete');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build47-jobs-center-runtime/1',
    build: 47,
    durableJobEngineSovereign: true,
    safeProjectionOnly: true,
    allowedActions: ['pause','resume','cancel','retry'],
    forbiddenActions: ['enqueue','skip','priority'],
    payloadExposed: false,
    workerIdentityExposed: false,
    leaseTokenExposed: false,
    loopbackHttp: true,
    corsLoopbackOnly: true,
    canonicalClientHeaderRequired: true,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
