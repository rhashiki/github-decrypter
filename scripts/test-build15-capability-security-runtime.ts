import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  CAPABILITIES,
  CapabilitySecurityAuthority,
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  LOCAL_DATABASE_SCHEMA_VERSION,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build15-'));
let nowMs = Date.parse('2026-09-03T18:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const advance = (milliseconds: number) => { nowMs += milliseconds; };

try {
  const databasePath = join(tempRoot, 'capabilities.sqlite3');
  const database = new LocalDatabase({ path: databasePath, now });
  const opened = database.open();
  assert.ok(opened.schemaVersion >= 5);
  assert.ok(LOCAL_DATABASE_SCHEMA_VERSION >= 5);
  assert.ok(database.listMigrations().length >= 5);

  const events: string[] = [];
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build15-test' });
  bus.subscribe('gd.local.capability.ready', () => { events.push('ready'); });
  bus.subscribe('gd.local.capability.granted', (event) => { events.push(`granted:${event.payload.grantId}`); });
  bus.subscribe('gd.local.capability.revoked', (event) => { events.push(`revoked:${event.payload.grantId}`); });
  bus.subscribe('gd.local.capability.denied', (event) => { events.push(`denied:${event.payload.reason}`); });

  const jobs = new DurableJobEngine({ database, eventBus: bus, now });
  const authority = new CapabilitySecurityAuthority({
    database,
    eventBus: bus,
    now,
    processInstanceId: 'gd_process_build15_a',
  });
  const initialStatus = await authority.initialize();
  assert.equal(initialStatus.ready, true);
  assert.equal(initialStatus.denyByDefault, true);
  assert.equal(initialStatus.plaintextTokenPersistence, false);
  assert.equal(initialStatus.secretsVaultReady, false);
  assert.equal(initialStatus.approvalTransactionsReady, false);
  assert.equal(initialStatus.externalGrantTransport, false);

  const primaryJob = await jobs.enqueue({ kind: 'security.primary', payload: null, maxAttempts: 3 });
  const otherJob = await jobs.enqueue({ kind: 'security.other', payload: null, maxAttempts: 3 });

  const missingToken = await authority.authorize({
    jobId: primaryJob.id,
    requirements: [{ capability: 'READ', resource: 'gd://workspace/project/src/file.ts' }],
  }, null);
  assert.equal(missingToken.allowed, false);
  assert.equal(missingToken.reason, 'missing-or-invalid-token');

  const unknownToken = await authority.authorize({
    jobId: primaryJob.id,
    requirements: [{ capability: 'READ', resource: 'gd://workspace/project/src/file.ts' }],
  }, 'gd_cap_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  assert.equal(unknownToken.allowed, false);
  assert.equal(unknownToken.reason, 'unknown-token');

  const primary = authority.issueGrant({
    jobId: primaryJob.id,
    ttlMs: 60_000,
    label: 'primary scoped test grant',
    claims: [
      { capability: 'READ', resource: 'gd://workspace/project', match: 'prefix' },
      { capability: 'WRITE', resource: 'gd://workspace/project/src/file.ts', match: 'exact' },
      { capability: 'EXECUTE', resource: 'gd://runtime/process/test-runner', match: 'exact' },
      { capability: 'NETWORK', resource: 'gd://network/github.com', match: 'exact' },
      { capability: 'DATABASE_WRITE', resource: 'gd://database/project', match: 'prefix' },
      { capability: 'GIT_WRITE', resource: 'gd://git/repository/main', match: 'exact' },
      { capability: 'DESTRUCTIVE', resource: 'gd://operation/delete-file', match: 'exact' },
      { capability: 'SECRETS', resource: 'gd://secret/provider/api-key', match: 'exact' },
    ],
  });
  assert.deepEqual([...new Set(primary.grant.claims.map((claim) => claim.capability))].sort(), [...CAPABILITIES].sort());

  const tokenRow = database.read((sqlite) => sqlite.prepare(`
    SELECT token_hash FROM gd_capability_grants WHERE id = ?
  `).get(primary.grant.id) as Record<string, unknown> | undefined);
  assert.ok(tokenRow);
  assert.equal(typeof tokenRow.token_hash, 'string');
  assert.notEqual(tokenRow.token_hash, primary.token);
  assert.equal(String(tokenRow.token_hash).length, 64);
  assert.equal(JSON.stringify(tokenRow).includes(primary.token), false);

  const prefixAllowed = await authority.authorize({
    jobId: primaryJob.id,
    requirements: [{ capability: 'READ', resource: 'gd://workspace/project/src/deep/file.ts' }],
  }, primary.token);
  assert.equal(prefixAllowed.allowed, true);

  const exactAllowed = await authority.authorize({
    jobId: primaryJob.id,
    requirements: [{ capability: 'WRITE', resource: 'gd://workspace/project/src/file.ts' }],
  }, primary.token);
  assert.equal(exactAllowed.allowed, true);

  const exactDenied = await authority.authorize({
    jobId: primaryJob.id,
    requirements: [{ capability: 'WRITE', resource: 'gd://workspace/project/src/other.ts' }],
  }, primary.token);
  assert.equal(exactDenied.allowed, false);
  assert.equal(exactDenied.reason, 'missing-capability-or-scope');

  const multiAllowed = await authority.authorize({
    jobId: primaryJob.id,
    requirements: [
      { capability: 'WRITE', resource: 'gd://workspace/project/src/file.ts' },
      { capability: 'DESTRUCTIVE', resource: 'gd://operation/delete-file' },
    ],
  }, primary.token);
  assert.equal(multiAllowed.allowed, true);

  const wrongJob = await authority.authorize({
    jobId: otherJob.id,
    requirements: [{ capability: 'READ', resource: 'gd://workspace/project/src/file.ts' }],
  }, primary.token);
  assert.equal(wrongJob.allowed, false);
  assert.equal(wrongJob.reason, 'job-mismatch');

  const writeOnly = authority.issueGrant({
    jobId: otherJob.id,
    ttlMs: 60_000,
    claims: [{ capability: 'WRITE', resource: 'gd://workspace/other/file.ts', match: 'exact' }],
  });
  const noImplicitRead = await authority.authorize({
    jobId: otherJob.id,
    requirements: [{ capability: 'READ', resource: 'gd://workspace/other/file.ts' }],
  }, writeOnly.token);
  assert.equal(noImplicitRead.allowed, false, 'WRITE must not imply READ');

  const missingDestructive = await authority.authorize({
    jobId: otherJob.id,
    requirements: [
      { capability: 'WRITE', resource: 'gd://workspace/other/file.ts' },
      { capability: 'DESTRUCTIVE', resource: 'gd://operation/delete-file' },
    ],
  }, writeOnly.token);
  assert.equal(missingDestructive.allowed, false, 'destructive work must require its own explicit capability');
  assert.deepEqual(missingDestructive.missing.map((entry) => entry.capability), ['DESTRUCTIVE']);

  const revokeJob = await jobs.enqueue({ kind: 'security.revoke', payload: null });
  const revocable = authority.issueGrant({
    jobId: revokeJob.id,
    ttlMs: 60_000,
    claims: [{ capability: 'EXECUTE', resource: 'gd://runtime/process/linter', match: 'exact' }],
  });
  assert.equal(await authority.revokeGrant(revocable.grant.id, 'test revocation'), true);
  const revokedDecision = await authority.authorize({
    jobId: revokeJob.id,
    requirements: [{ capability: 'EXECUTE', resource: 'gd://runtime/process/linter' }],
  }, revocable.token);
  assert.equal(revokedDecision.allowed, false);
  assert.equal(revokedDecision.reason, 'grant-revoked');

  const expiryJob = await jobs.enqueue({ kind: 'security.expiry', payload: null });
  const expiring = authority.issueGrant({
    jobId: expiryJob.id,
    ttlMs: 1_000,
    claims: [{ capability: 'NETWORK', resource: 'gd://network/example.test', match: 'exact' }],
  });
  advance(1_001);
  const expiredDecision = await authority.authorize({
    jobId: expiryJob.id,
    requirements: [{ capability: 'NETWORK', resource: 'gd://network/example.test' }],
  }, expiring.token);
  assert.equal(expiredDecision.allowed, false);
  assert.equal(expiredDecision.reason, 'grant-expired');

  const terminalJob = await jobs.enqueue({ kind: 'security.terminal', payload: null });
  const terminalGrant = authority.issueGrant({
    jobId: terminalJob.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: 'gd://workspace/terminal', match: 'prefix' }],
  });
  await jobs.skip(terminalJob.id, 'terminal capability test');
  const terminalDecision = await authority.authorize({
    jobId: terminalJob.id,
    requirements: [{ capability: 'READ', resource: 'gd://workspace/terminal/file.ts' }],
  }, terminalGrant.token);
  assert.equal(terminalDecision.allowed, false);
  assert.equal(terminalDecision.reason, 'job-terminal');
  assert.throws(() => authority.issueGrant({
    jobId: terminalJob.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: 'gd://workspace/terminal', match: 'prefix' }],
  }), /terminal job/i);

  const crashJob = await jobs.enqueue({ kind: 'security.restart', payload: null });
  const crashGrant = authority.issueGrant({
    jobId: crashJob.id,
    ttlMs: 60_000,
    claims: [{ capability: 'READ', resource: 'gd://workspace/restart', match: 'prefix' }],
  });
  const beforeRestart = authority.status();
  assert.ok(beforeRestart.activeGrants >= 1);

  database.close();

  const reopenedDatabase = new LocalDatabase({ path: databasePath, now });
  reopenedDatabase.open();
  const reopenedAuthority = new CapabilitySecurityAuthority({
    database: reopenedDatabase,
    now,
    processInstanceId: 'gd_process_build15_b',
  });
  const afterRestart = await reopenedAuthority.initialize();
  assert.ok(afterRestart.restartRevocations >= 1);
  const staleDecision = await reopenedAuthority.authorize({
    jobId: crashJob.id,
    requirements: [{ capability: 'READ', resource: 'gd://workspace/restart/file.ts' }],
  }, crashGrant.token);
  assert.equal(staleDecision.allowed, false);
  assert.equal(staleDecision.reason, 'stale-process-grant');
  await reopenedAuthority.shutdown('restart test complete');
  reopenedDatabase.close();

  const daemonDatabasePath = join(tempRoot, 'daemon.sqlite3');
  const daemonLockPath = join(tempRoot, 'daemon.lock');
  const daemonVaultKeyPath = join(tempRoot, 'daemon-vault.key');
  const config = {
    host: '127.0.0.1',
    port: 0,
    lockPath: daemonLockPath,
    databasePath: daemonDatabasePath,
    vaultKeyPath: daemonVaultKeyPath,
  } as const;
  const daemon = new LocalRuntimeDaemon({ config, now });
  const address = await daemon.start();
  const health = await (await fetch(`${address.origin}/healthz`)).json() as Record<string, any>;
  assert.ok(health.build >= 15);
  assert.ok(/^0\.0\.\d+$/.test(health.version));
  assert.ok(health.database.schemaVersion >= 5);
  assert.equal(health.capabilities.ready, true);
  assert.equal(health.capabilities.denyByDefault, true);
  assert.equal(health.capabilities.plaintextTokenPersistence, false);
  assert.equal(health.capabilities.secretsVaultReady, health.build >= 16);
  assert.equal(health.capabilities.approvalTransactionsReady, false);
  assert.equal(health.capabilities.externalGrantTransport, false);
  const readiness = await (await fetch(`${address.origin}/readyz`)).json() as Record<string, any>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.capabilitySecurityReady, true);
  if (health.build >= 16) assert.equal(readiness.secretsVaultReady, true);
  assert.equal(readiness.denyByDefault, true);
  assert.equal((await fetch(`${address.origin}/v1/capabilities`)).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/grants`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/jobs`)).status, 404);
  await daemon.stop('Build 15 verified');

  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(events.includes('ready'));
  assert.ok(events.some((entry) => entry.startsWith('granted:')));
  assert.ok(events.some((entry) => entry.startsWith('revoked:')));
  assert.ok(events.some((entry) => entry.startsWith('denied:')));

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build15-capability-security-runtime/2',
    minimumSchemaVersion: 5,
    currentSchemaVersion: LOCAL_DATABASE_SCHEMA_VERSION,
    capabilities: CAPABILITIES,
    denyByDefault: true,
    tokenHashOnly: true,
    exactScope: true,
    prefixScope: true,
    noCapabilityImplication: true,
    multiCapabilityRequirements: true,
    jobBinding: true,
    expiry: true,
    revocation: true,
    terminalJobDenial: true,
    restartFailsClosed: true,
    daemonReadinessIntegration: true,
    externalGrantTransport: false,
    allowsLaterSecretsVault: true,
    approvalTransactions: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
