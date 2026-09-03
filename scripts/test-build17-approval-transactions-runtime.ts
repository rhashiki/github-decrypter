import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  ApprovalTransactions,
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  LOCAL_DATABASE_SCHEMA_VERSION,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build17-'));
let nowMs = Date.parse('2026-09-03T23:30:00.000Z');
const now = () => new Date(nowMs).toISOString();
const advance = (ms: number) => { nowMs += ms; };
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

try {
  const databasePath = join(tempRoot, 'approvals.sqlite3');
  const database = new LocalDatabase({ path: databasePath, now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 7);
  assert.equal(LOCAL_DATABASE_SCHEMA_VERSION, 7);
  assert.equal(database.listMigrations().length, 7);

  const events: string[] = [];
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build17-test' });
  for (const name of [
    'gd.local.approval.ready',
    'gd.local.approval.requested',
    'gd.local.approval.decided',
    'gd.local.approval.consumed',
    'gd.local.approval.cancelled',
  ] as const) {
    bus.subscribe(name, (event) => { events.push(JSON.stringify(event.payload)); });
  }

  const jobs = new DurableJobEngine({ database, eventBus: bus, now });
  const approvals = new ApprovalTransactions({ database, eventBus: bus, now });
  const status = await approvals.initialize();
  assert.equal(status.ready, true);
  assert.equal(status.humanReviewRequired, true);
  assert.equal(status.oneShotReceipts, true);
  assert.equal(status.plaintextReceiptPersistence, false);
  assert.equal(status.payloadDigestBinding, true);
  assert.equal(status.externalDecisionTransport, false);

  const payload = JSON.stringify({ operation: 'delete', path: 'src/obsolete.ts' });
  const payloadDigest = digest(payload);
  const job = await jobs.enqueue({ kind: 'approval.primary', payload: null, maxAttempts: 2 });
  const pending = await approvals.request({
    jobId: job.id,
    action: 'delete-file',
    summary: 'Delete src/obsolete.ts after human confirmation',
    requirements: [
      { capability: 'WRITE', resource: 'gd://workspace/project/src/obsolete.ts' },
      { capability: 'DESTRUCTIVE', resource: 'gd://workspace/project/src/obsolete.ts' },
    ],
    payloadDigest,
    ttlMs: 60_000,
  });
  assert.equal(pending.state, 'pending');
  assert.equal(pending.payloadDigest, payloadDigest);
  assert.equal(pending.requirements.length, 2);

  await assert.rejects(
    approvals.approve({ transactionId: pending.id, reviewerId: 'model-agent' as string, reviewerKind: 'model' as any }),
    /reviewerKind="human"/i,
  );

  const approved = await approvals.approve({
    transactionId: pending.id,
    reviewerId: 'human:test-user',
    reviewerKind: 'human',
    reason: 'Reviewed exact destructive operation',
  });
  assert.equal(approved.transaction.state, 'approved');
  assert.ok(approved.receipt.startsWith('gd_approval_v1_'));

  const receiptRow = database.read((sqlite) => sqlite.prepare(`
    SELECT receipt_hash, action, summary, payload_digest FROM gd_approval_transactions WHERE id = ?
  `).get(pending.id) as Record<string, unknown> | undefined);
  assert.ok(receiptRow);
  assert.equal(typeof receiptRow.receipt_hash, 'string');
  assert.match(String(receiptRow.receipt_hash), /^[a-f0-9]{64}$/);
  assert.notEqual(receiptRow.receipt_hash, approved.receipt);
  assert.equal(JSON.stringify(receiptRow).includes(approved.receipt), false);

  await assert.rejects(
    approvals.consume(pending.id, approved.receipt, digest('changed payload')),
    /payload digest mismatch/i,
  );
  await assert.rejects(
    approvals.consume(pending.id, 'gd_approval_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', payloadDigest),
    /invalid|already consumed|changed concurrently/i,
  );

  const consumed = await approvals.consume(pending.id, approved.receipt, payloadDigest);
  assert.equal(consumed.state, 'consumed');
  await assert.rejects(
    approvals.consume(pending.id, approved.receipt, payloadDigest),
    /not approved/i,
  );
  const consumedHash = database.read((sqlite) => sqlite.prepare(
    'SELECT receipt_hash FROM gd_approval_transactions WHERE id = ?',
  ).get(pending.id) as Record<string, unknown> | undefined);
  assert.equal(consumedHash?.receipt_hash, null);

  const deniedJob = await jobs.enqueue({ kind: 'approval.denied', payload: null });
  const deniedRequest = await approvals.request({
    jobId: deniedJob.id,
    action: 'network-upload',
    summary: 'Upload build artifact',
    requirements: [{ capability: 'NETWORK', resource: 'gd://network/github.com' }],
    payloadDigest: digest('denied payload'),
    ttlMs: 60_000,
  });
  const denied = await approvals.deny({
    transactionId: deniedRequest.id,
    reviewerId: 'human:test-user',
    reviewerKind: 'human',
    reason: 'Not authorized',
  });
  assert.equal(denied.state, 'denied');
  await assert.rejects(
    approvals.consume(denied.id, 'gd_approval_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', denied.payloadDigest),
    /not approved/i,
  );

  const cancelledJob = await jobs.enqueue({ kind: 'approval.cancelled', payload: null });
  const cancelledRequest = await approvals.request({
    jobId: cancelledJob.id,
    action: 'write-file',
    summary: 'Write generated file',
    requirements: [{ capability: 'WRITE', resource: 'gd://workspace/project/generated.ts' }],
    payloadDigest: digest('cancel payload'),
    ttlMs: 60_000,
  });
  assert.equal(await approvals.cancel(cancelledRequest.id, 'user changed mind'), true);
  assert.equal(approvals.get(cancelledRequest.id)?.state, 'cancelled');

  const expiringJob = await jobs.enqueue({ kind: 'approval.expire', payload: null });
  const expiringRequest = await approvals.request({
    jobId: expiringJob.id,
    action: 'execute-command',
    summary: 'Execute test command',
    requirements: [{ capability: 'EXECUTE', resource: 'gd://runtime/process/test' }],
    payloadDigest: digest('expire payload'),
    ttlMs: 1_000,
  });
  advance(1_001);
  await assert.rejects(
    approvals.approve({ transactionId: expiringRequest.id, reviewerId: 'human:test-user', reviewerKind: 'human' }),
    /expired/i,
  );
  assert.equal(approvals.get(expiringRequest.id)?.state, 'expired');

  const terminalJob = await jobs.enqueue({ kind: 'approval.terminal', payload: null });
  await jobs.skip(terminalJob.id, 'make terminal');
  await assert.rejects(
    approvals.request({
      jobId: terminalJob.id,
      action: 'write-file',
      summary: 'Should not be approved',
      requirements: [{ capability: 'WRITE', resource: 'gd://workspace/project/terminal.ts' }],
      payloadDigest: digest('terminal payload'),
      ttlMs: 60_000,
    }),
    /terminal job/i,
  );

  approvals.shutdown();
  database.close();

  const reopenedDatabase = new LocalDatabase({ path: databasePath, now });
  reopenedDatabase.open();
  const reopenedApprovals = new ApprovalTransactions({ database: reopenedDatabase, now });
  await reopenedApprovals.initialize();
  assert.equal(reopenedApprovals.get(pending.id)?.state, 'consumed');
  assert.equal(reopenedApprovals.get(denied.id)?.state, 'denied');
  assert.equal(reopenedApprovals.get(cancelledRequest.id)?.state, 'cancelled');
  assert.equal(reopenedApprovals.get(expiringRequest.id)?.state, 'expired');
  reopenedApprovals.shutdown();
  reopenedDatabase.close();

  const daemon = new LocalRuntimeDaemon({
    config: {
      host: '127.0.0.1',
      port: 0,
      lockPath: join(tempRoot, 'daemon.lock'),
      databasePath: join(tempRoot, 'daemon.sqlite3'),
      vaultKeyPath: join(tempRoot, 'daemon-vault.key'),
    },
    now,
  });
  const address = await daemon.start();
  const health = await (await fetch(`${address.origin}/healthz`)).json() as Record<string, any>;
  assert.equal(health.build, 17);
  assert.equal(health.version, '0.0.17');
  assert.equal(health.database.schemaVersion, 7);
  assert.equal(health.approvals.ready, true);
  assert.equal(health.approvals.humanReviewRequired, true);
  assert.equal(health.approvals.oneShotReceipts, true);
  assert.equal(health.approvals.plaintextReceiptPersistence, false);
  assert.equal(health.approvals.payloadDigestBinding, true);
  assert.equal(health.approvals.externalDecisionTransport, false);
  assert.equal(health.capabilities.approvalTransactionsReady, true);
  const readiness = await (await fetch(`${address.origin}/readyz`)).json() as Record<string, any>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.approvalTransactionsReady, true);
  assert.equal((await fetch(`${address.origin}/v1/approvals`)).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/approve`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/deny`, { method: 'POST' })).status, 404);
  await daemon.stop('Build 17 verified');

  await new Promise((resolve) => setImmediate(resolve));
  const eventText = events.join('\n');
  assert.equal(eventText.includes(approved.receipt), false);
  assert.equal(eventText.includes(payload), false);
  assert.ok(events.some((entry) => entry.includes('humanReviewRequired')));
  assert.ok(events.some((entry) => entry.includes('delete-file')));
  assert.ok(events.some((entry) => entry.includes('approved')));

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build17-approval-transactions-runtime/1',
    schemaVersion: LOCAL_DATABASE_SCHEMA_VERSION,
    durablePersistence: true,
    humanReviewRequired: true,
    oneShotReceipts: true,
    receiptHashOnly: true,
    payloadDigestBinding: true,
    wrongDigestRejected: true,
    replayRejected: true,
    denialFailClosed: true,
    cancellation: true,
    expiration: true,
    terminalJobDenial: true,
    daemonReadinessIntegration: true,
    externalDecisionTransport: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
