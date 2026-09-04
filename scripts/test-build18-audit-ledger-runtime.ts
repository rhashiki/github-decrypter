import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  ApprovalTransactions,
  AuditLedger,
  CapabilitySecurityAuthority,
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  SecretsVault,
  AUDIT_GENESIS_HASH,
  LOCAL_DATABASE_SCHEMA_VERSION,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build18-'));
let nowMs = Date.parse('2026-09-03T21:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'audit.sqlite3'), now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 8);
  assert.equal(LOCAL_DATABASE_SCHEMA_VERSION, 8);
  assert.equal(database.listMigrations().length, 8);

  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build18-test', now });
  const audit = new AuditLedger({ database, eventBus: bus, now });
  const initial = await audit.initialize();
  assert.equal(initial.ready, true);
  assert.equal(initial.integrity, 'ok');
  assert.equal(initial.entryCount, 0);
  assert.equal(initial.headHash, AUDIT_GENESIS_HASH);
  assert.equal(initial.appendOnly, true);
  assert.equal(initial.hashChain, 'sha256');
  assert.equal(initial.sensitivePayloadPersistence, false);
  assert.equal(initial.externalTransport, false);

  const first = audit.append({
    category: 'runtime', action: 'runtime.test.started', actor: 'test', subject: 'build18', outcome: 'success',
    metadata: { safe: true, nested: { z: 2, a: 1 } },
  });
  assert.equal(first.sequence, 1);
  assert.equal(first.previousHash, AUDIT_GENESIS_HASH);
  assert.match(first.entryHash, /^[a-f0-9]{64}$/);

  const second = audit.append({
    category: 'runtime', action: 'runtime.test.progress', actor: 'test', subject: 'build18', outcome: 'success',
    metadata: { step: 2 },
  });
  assert.equal(second.sequence, 2);
  assert.equal(second.previousHash, first.entryHash);
  assert.notEqual(second.entryHash, first.entryHash);
  const verified = audit.verifyIntegrity();
  assert.equal(verified.entryCount, 2);
  assert.equal(verified.headHash, second.entryHash);

  assert.throws(() => database.transaction((sqlite) => {
    sqlite.prepare("UPDATE gd_audit_entries SET actor = 'mutated' WHERE seq = 1").run();
  }), /append-only/i);
  assert.throws(() => database.transaction((sqlite) => {
    sqlite.prepare('DELETE FROM gd_audit_entries WHERE seq = 1').run();
  }), /append-only/i);

  const jobs = new DurableJobEngine({ database, eventBus: bus, now });
  const capabilities = new CapabilitySecurityAuthority({ database, eventBus: bus, now, processInstanceId: 'gd_process_build18' });
  await capabilities.initialize();
  const job = await jobs.enqueue({ kind: 'audit.security-events', payload: null });
  const secretResource = 'gd://secret/provider/build18-key';
  const secretValue = 'build18-super-secret-value';
  const grant = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60_000,
    claims: [
      { capability: 'SECRETS', resource: secretResource, match: 'exact' },
      { capability: 'DESTRUCTIVE', resource: secretResource, match: 'exact' },
    ],
  });

  const vault = new SecretsVault({ database, capabilities, eventBus: bus, keyPath: join(tempRoot, 'vault.key'), now });
  await vault.initialize();
  const stored = await vault.putSecret({ jobId: job.id, token: grant.token, resource: secretResource, value: secretValue });

  const approvals = new ApprovalTransactions({ database, eventBus: bus, now });
  await approvals.initialize();
  const request = await approvals.request({
    jobId: job.id,
    action: 'delete-reviewed-file',
    summary: 'Delete reviewed file',
    requirements: [{ capability: 'DESTRUCTIVE', resource: 'gd://workspace/project/reviewed.txt' }],
    payloadDigest: digest('reviewed-payload'),
    ttlMs: 60_000,
  });
  const approved = await approvals.approve({ transactionId: request.id, actor: 'user:build18', reason: 'reviewed' });
  await approvals.consume(request.id, approved.receipt, request.payloadDigest);

  const rowsText = database.read((sqlite) => JSON.stringify(sqlite.prepare(`
    SELECT category, action, actor, subject, job_id, outcome, metadata_json
    FROM gd_audit_entries ORDER BY seq
  `).all()));
  assert.equal(rowsText.includes(grant.token), false);
  assert.equal(rowsText.includes(approved.receipt), false);
  assert.equal(rowsText.includes(secretValue), false);
  assert.equal(rowsText.includes(secretResource), false);
  assert.ok(rowsText.includes(stored.id));
  assert.ok(rowsText.includes(request.id));
  assert.ok(rowsText.includes('user:build18'));
  assert.ok(audit.status().entryCount >= 7);
  assert.equal(audit.verifyIntegrity().headHash, audit.status().headHash);

  approvals.shutdown();
  vault.shutdown();
  await capabilities.shutdown('Build 18 security event capture complete');
  audit.shutdown();
  database.close();

  const tamperPath = join(tempRoot, 'tamper.sqlite3');
  const tamperDatabase = new LocalDatabase({ path: tamperPath, now });
  tamperDatabase.open();
  const tamperAudit = new AuditLedger({ database: tamperDatabase, now });
  await tamperAudit.initialize();
  tamperAudit.append({ category: 'runtime', action: 'tamper.target', actor: 'test', subject: 'entry', outcome: 'success', metadata: { original: true } });
  tamperAudit.shutdown();
  tamperDatabase.transaction((sqlite) => {
    sqlite.exec('DROP TRIGGER gd_audit_entries_no_update;');
    sqlite.prepare("UPDATE gd_audit_entries SET metadata_json = '{\"original\":false}' WHERE seq = 1").run();
  });
  tamperDatabase.close();

  const reopenedTamperDatabase = new LocalDatabase({ path: tamperPath, now });
  reopenedTamperDatabase.open();
  const reopenedTamperAudit = new AuditLedger({ database: reopenedTamperDatabase, now });
  await assert.rejects(reopenedTamperAudit.initialize(), /entry-hash mismatch/i);
  reopenedTamperDatabase.close();

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
  assert.equal(daemon.audit.status().ready, true);
  assert.equal(daemon.audit.status().integrity, 'ok');
  assert.equal(daemon.database.status?.schemaVersion, 8);
  const health = await (await fetch(`${address.origin}/healthz`)).json() as Record<string, any>;
  assert.equal(health.build, 18);
  assert.equal(health.version, '0.0.18');
  assert.equal(health.database.schemaVersion, 8);
  assert.equal(health.audit.ready, true);
  assert.equal(health.audit.integrity, 'ok');
  assert.equal(health.audit.appendOnly, true);
  assert.equal(health.audit.hashChain, 'sha256');
  const readiness = await (await fetch(`${address.origin}/readyz`)).json() as Record<string, any>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.auditLedgerReady, true);
  assert.equal(readiness.auditIntegrity, 'ok');
  assert.equal((await fetch(`${address.origin}/v1/audit`)).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/audit-ledger`)).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/ledger`)).status, 404);
  await daemon.stop('Build 18 verified');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build18-audit-ledger-runtime/1',
    schemaVersion: LOCAL_DATABASE_SCHEMA_VERSION,
    appendOnlyTriggers: true,
    sha256Chain: true,
    startupIntegrityVerification: true,
    mutationRejected: true,
    tamperDetected: true,
    securityEventMetadataOnly: true,
    sensitivePayloadPersistence: false,
    daemonReadinessIntegration: true,
    externalTransport: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
