import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApprovalTransactions,
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  LOCAL_DATABASE_SCHEMA_VERSION,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build17-'));
let nowMs = Date.parse('2026-09-03T20:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const advance = (ms: number) => { nowMs += ms; };
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'approvals.sqlite3'), now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 7);
  assert.equal(LOCAL_DATABASE_SCHEMA_VERSION, 7);

  const jobs = new DurableJobEngine({ database, now });
  const approvals = new ApprovalTransactions({ database, now });
  const status = await approvals.initialize();
  assert.equal(status.ready, true);
  assert.equal(status.oneShotReceipts, true);
  assert.equal(status.plaintextReceiptPersistence, false);
  assert.equal(status.externalDecisionTransport, false);

  const job = await jobs.enqueue({ kind: 'approval.primary', payload: null, maxAttempts: 2 });
  const payloadDigest = digest('{"operation":"delete-file","path":"src/old.ts"}');
  const requested = await approvals.request({
    jobId: job.id,
    action: 'delete-file',
    summary: 'Delete src/old.ts after explicit review',
    requirements: [
      { capability: 'WRITE', resource: 'gd://workspace/project/src/old.ts' },
      { capability: 'DESTRUCTIVE', resource: 'gd://workspace/project/src/old.ts' },
    ],
    payloadDigest,
    ttlMs: 60_000,
  });
  assert.equal(requested.state, 'pending');

  const approved = await approvals.approve({ transactionId: requested.id, actor: 'user:test', reason: 'reviewed exact diff' });
  assert.equal(approved.transaction.state, 'approved');
  assert.ok(approved.receipt.startsWith('gd_approval_v1_'));

  const row = database.read((sqlite) => sqlite.prepare('SELECT receipt_hash, payload_digest FROM gd_approval_transactions WHERE id = ?').get(requested.id) as Record<string, unknown>);
  assert.equal(typeof row.receipt_hash, 'string');
  assert.equal(String(row.receipt_hash).length, 64);
  assert.equal(JSON.stringify(row).includes(approved.receipt), false);
  assert.equal(row.payload_digest, payloadDigest);

  await assert.rejects(() => approvals.consume(requested.id, approved.receipt, digest('different payload')), /payload digest mismatch/i);
  const consumed = await approvals.consume(requested.id, approved.receipt, payloadDigest);
  assert.equal(consumed.state, 'consumed');
  await assert.rejects(() => approvals.consume(requested.id, approved.receipt, payloadDigest), /not approved/i);
  const consumedRow = database.read((sqlite) => sqlite.prepare('SELECT receipt_hash FROM gd_approval_transactions WHERE id = ?').get(requested.id) as Record<string, unknown>);
  assert.equal(consumedRow.receipt_hash, null);

  const deniedJob = await jobs.enqueue({ kind: 'approval.denied', payload: null });
  const deniedRequest = await approvals.request({
    jobId: deniedJob.id,
    action: 'network-publish',
    summary: 'Publish a remote change',
    requirements: [{ capability: 'NETWORK', resource: 'gd://network/github.com' }],
    payloadDigest: digest('publish-v1'),
    ttlMs: 60_000,
  });
  const denied = await approvals.deny({ transactionId: deniedRequest.id, actor: 'user:test', reason: 'not authorized' });
  assert.equal(denied.state, 'denied');
  await assert.rejects(() => approvals.consume(denied.id, 'gd_approval_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', denied.payloadDigest), /not approved/i);

  const expiredJob = await jobs.enqueue({ kind: 'approval.expired', payload: null });
  const expiredRequest = await approvals.request({
    jobId: expiredJob.id,
    action: 'execute-command',
    summary: 'Execute reviewed command',
    requirements: [{ capability: 'EXECUTE', resource: 'gd://runtime/process/test' }],
    payloadDigest: digest('command-v1'),
    ttlMs: 1_000,
  });
  const expiring = await approvals.approve({ transactionId: expiredRequest.id, actor: 'user:test' });
  advance(1_001);
  await assert.rejects(() => approvals.consume(expiredRequest.id, expiring.receipt, expiredRequest.payloadDigest), /expired/i);
  assert.equal(approvals.get(expiredRequest.id)?.state, 'expired');

  const terminalJob = await jobs.enqueue({ kind: 'approval.terminal', payload: null });
  await jobs.skip(terminalJob.id, 'terminal test');
  await assert.rejects(() => approvals.request({
    jobId: terminalJob.id,
    action: 'write',
    summary: 'Must fail for terminal job',
    requirements: [{ capability: 'WRITE', resource: 'gd://workspace/project/file.ts' }],
    payloadDigest: digest('terminal'),
    ttlMs: 60_000,
  }), /terminal job/i);

  database.close();

  const daemon = new LocalRuntimeDaemon({
    config: {
      host: '127.0.0.1', port: 0,
      lockPath: join(tempRoot, 'daemon.lock'),
      databasePath: join(tempRoot, 'daemon.sqlite3'),
      vaultKeyPath: join(tempRoot, 'daemon.vault.key'),
    },
    now,
  });
  const address = await daemon.start();
  assert.equal(daemon.approvals.status().ready, true);
  assert.equal(daemon.database.status?.schemaVersion, 7);
  assert.equal((await fetch(`${address.origin}/v1/approvals`)).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/approval-transactions`, { method: 'POST' })).status, 404);
  await daemon.stop('Build 17 verified');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build17-approval-transactions-runtime/1',
    schemaVersion: LOCAL_DATABASE_SCHEMA_VERSION,
    jobBound: true,
    payloadDigestBound: true,
    receiptHashOnly: true,
    oneShotConsumption: true,
    replayRejected: true,
    denyAndExpiryFailClosed: true,
    terminalJobsRejected: true,
    daemonLifecycleIntegration: true,
    externalDecisionTransport: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
