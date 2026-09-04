import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  CapabilitySecurityAuthority,
  DurableJobEngine,
  LocalDatabase,
  LocalRuntimeDaemon,
  SecretsVault,
  LOCAL_DATABASE_SCHEMA_VERSION,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build16-'));
let nowMs = Date.parse('2026-09-03T20:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const patchVersion = (value: unknown): number => {
  const match = String(value ?? '').match(/^0\.0\.(\d+)$/);
  assert.ok(match, `expected pre-V1 0.0.x version, got ${String(value)}`);
  return Number(match[1]);
};

try {
  const databasePath = join(tempRoot, 'vault.sqlite3');
  const keyPath = join(tempRoot, 'vault.key');
  const database = new LocalDatabase({ path: databasePath, now });
  const opened = database.open();
  assert.ok(opened.schemaVersion >= 6);
  assert.ok(LOCAL_DATABASE_SCHEMA_VERSION >= 6);
  assert.ok(database.listMigrations().length >= 6);

  const events: string[] = [];
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build16-test' });
  bus.subscribe('gd.local.vault.ready', (event) => { events.push(JSON.stringify(event.payload)); });
  bus.subscribe('gd.local.vault.secret.changed', (event) => { events.push(JSON.stringify(event.payload)); });

  const jobs = new DurableJobEngine({ database, eventBus: bus, now });
  const capabilities = new CapabilitySecurityAuthority({ database, eventBus: bus, now, processInstanceId: 'gd_process_build16_a' });
  await capabilities.initialize();
  const vault = new SecretsVault({ database, capabilities, eventBus: bus, keyPath, now });
  const vaultStatus = await vault.initialize();
  assert.equal(vaultStatus.ready, true);
  assert.equal(vaultStatus.secretCount, 0);
  assert.equal(vaultStatus.cipher, 'AES-256-GCM');
  assert.equal(vaultStatus.kdf, 'HKDF-SHA256');
  assert.equal(vaultStatus.plaintextPersistence, false);
  assert.equal(vaultStatus.plaintextResourcePersistence, false);
  assert.equal(vaultStatus.externalTransport, false);

  if (process.platform !== 'win32') assert.equal(statSync(keyPath).mode & 0o777, 0o600);

  const resource = 'gd://secret/provider/build16-api-key';
  const value = 'super-secret-build16-value';
  const rotatedValue = 'rotated-secret-build16-value';
  const job = await jobs.enqueue({ kind: 'vault.primary', payload: null, maxAttempts: 2 });
  const grant = capabilities.issueGrant({ jobId: job.id, ttlMs: 60_000, claims: [{ capability: 'SECRETS', resource, match: 'exact' }] });

  await assert.rejects(vault.putSecret({ jobId: job.id, token: 'gd_cap_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', resource, value }), /authorization denied/i);
  const stored = await vault.putSecret({ jobId: job.id, token: grant.token, resource, value });
  assert.equal(stored.resource, resource);
  assert.ok(stored.id.startsWith('gd_secret_'));
  assert.equal(await vault.readSecret({ jobId: job.id, token: grant.token, resource }), value);

  const rawBeforeUpdate = database.read((sqlite) => sqlite.prepare(`
    SELECT resource_hmac,
           hex(resource_ciphertext) AS resource_ciphertext_hex,
           hex(value_ciphertext) AS value_ciphertext_hex
    FROM gd_vault_secrets WHERE id = ?
  `).get(stored.id) as Record<string, unknown> | undefined);
  assert.ok(rawBeforeUpdate);
  const rawEncoded = JSON.stringify(rawBeforeUpdate);
  assert.equal(rawEncoded.includes(resource), false);
  assert.equal(rawEncoded.includes(value), false);
  assert.match(String(rawBeforeUpdate.resource_hmac), /^[a-f0-9]{64}$/);

  const updated = await vault.putSecret({ jobId: job.id, token: grant.token, resource, value: rotatedValue });
  assert.equal(updated.id, stored.id);
  assert.equal(await vault.readSecret({ jobId: job.id, token: grant.token, resource }), rotatedValue);
  const rawAfterUpdate = database.read((sqlite) => sqlite.prepare('SELECT hex(value_ciphertext) AS value_ciphertext_hex FROM gd_vault_secrets WHERE id = ?').get(stored.id) as Record<string, unknown> | undefined);
  assert.ok(rawAfterUpdate);
  assert.notEqual(rawAfterUpdate.value_ciphertext_hex, rawBeforeUpdate.value_ciphertext_hex);

  const otherJob = await jobs.enqueue({ kind: 'vault.other', payload: null });
  const wrongScope = capabilities.issueGrant({ jobId: otherJob.id, ttlMs: 60_000, claims: [{ capability: 'SECRETS', resource: 'gd://secret/provider/other-key', match: 'exact' }] });
  await assert.rejects(vault.readSecret({ jobId: otherJob.id, token: wrongScope.token, resource }), /authorization denied/i);

  const deleteResource = 'gd://secret/provider/delete-test';
  const deleteJob = await jobs.enqueue({ kind: 'vault.delete', payload: null });
  const secretOnly = capabilities.issueGrant({ jobId: deleteJob.id, ttlMs: 60_000, claims: [{ capability: 'SECRETS', resource: deleteResource, match: 'exact' }] });
  await vault.putSecret({ jobId: deleteJob.id, token: secretOnly.token, resource: deleteResource, value: 'delete-me' });
  await assert.rejects(vault.deleteSecret({ jobId: deleteJob.id, token: secretOnly.token, resource: deleteResource }), /authorization denied/i);
  const destructive = capabilities.issueGrant({ jobId: deleteJob.id, ttlMs: 60_000, claims: [
    { capability: 'SECRETS', resource: deleteResource, match: 'exact' },
    { capability: 'DESTRUCTIVE', resource: deleteResource, match: 'exact' },
  ] });
  assert.equal(await vault.deleteSecret({ jobId: deleteJob.id, token: destructive.token, resource: deleteResource }), true);
  assert.equal(await vault.readSecret({ jobId: deleteJob.id, token: destructive.token, resource: deleteResource }), null);

  vault.shutdown();
  await capabilities.shutdown('Build 16 first process complete');
  database.close();

  const reopenedDatabase = new LocalDatabase({ path: databasePath, now });
  reopenedDatabase.open();
  const reopenedJobs = new DurableJobEngine({ database: reopenedDatabase, now });
  const reopenedCapabilities = new CapabilitySecurityAuthority({ database: reopenedDatabase, now, processInstanceId: 'gd_process_build16_b' });
  await reopenedCapabilities.initialize();
  const reopenedVault = new SecretsVault({ database: reopenedDatabase, capabilities: reopenedCapabilities, keyPath, now });
  await reopenedVault.initialize();
  const persistedGrant = reopenedCapabilities.issueGrant({ jobId: job.id, ttlMs: 60_000, claims: [{ capability: 'SECRETS', resource, match: 'exact' }] });
  assert.equal(await reopenedVault.readSecret({ jobId: job.id, token: persistedGrant.token, resource }), rotatedValue);

  reopenedDatabase.transaction((sqlite) => { sqlite.prepare('UPDATE gd_vault_secrets SET value_ciphertext = ? WHERE id = ?').run(randomBytes(24), stored.id); });
  await assert.rejects(reopenedVault.readSecret({ jobId: job.id, token: persistedGrant.token, resource }), /authenticate|authentication|Unsupported state|unable/i);

  reopenedVault.shutdown();
  await reopenedCapabilities.shutdown('Build 16 second process complete');
  reopenedDatabase.close();
  void reopenedJobs;

  const wrongKeyPath = join(tempRoot, 'wrong-vault.key');
  writeFileSync(wrongKeyPath, randomBytes(32), { mode: 0o600 });
  if (process.platform !== 'win32') chmodSync(wrongKeyPath, 0o600);
  const mismatchDatabase = new LocalDatabase({ path: databasePath, now });
  mismatchDatabase.open();
  const mismatchCapabilities = new CapabilitySecurityAuthority({ database: mismatchDatabase, now, processInstanceId: 'gd_process_build16_c' });
  await mismatchCapabilities.initialize();
  const mismatchVault = new SecretsVault({ database: mismatchDatabase, capabilities: mismatchCapabilities, keyPath: wrongKeyPath, now });
  await assert.rejects(mismatchVault.initialize(), /does not match this database/i);
  await mismatchCapabilities.shutdown('mismatch test complete');
  mismatchDatabase.close();

  const daemon = new LocalRuntimeDaemon({
    config: {
      host: '127.0.0.1', port: 0,
      lockPath: join(tempRoot, 'daemon.lock'),
      databasePath: join(tempRoot, 'daemon.sqlite3'),
      vaultKeyPath: join(tempRoot, 'daemon-vault.key'),
    },
    now,
  });
  const address = await daemon.start();
  const health = await (await fetch(`${address.origin}/healthz`)).json() as Record<string, any>;
  assert.ok(Number(health.build) >= 16);
  assert.ok(patchVersion(health.version) >= 16);
  assert.ok(Number(health.database.schemaVersion) >= 6);
  assert.equal(health.vault.ready, true);
  assert.equal(health.vault.secretCount, 0);
  assert.equal(health.vault.plaintextPersistence, false);
  assert.equal(health.vault.plaintextResourcePersistence, false);
  assert.equal(health.vault.externalTransport, false);
  assert.equal(health.capabilities.secretsVaultReady, true);
  const readiness = await (await fetch(`${address.origin}/readyz`)).json() as Record<string, any>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.secretsVaultReady, true);
  assert.equal((await fetch(`${address.origin}/v1/vault`)).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/secrets`)).status, 404);
  assert.equal((await fetch(`${address.origin}/v1/secret/provider`)).status, 404);
  await daemon.stop('Build 16 verified');

  await new Promise((resolve) => setImmediate(resolve));
  const eventText = events.join('\n');
  assert.equal(eventText.includes(value), false);
  assert.equal(eventText.includes(rotatedValue), false);
  assert.equal(eventText.includes(resource), false);
  assert.ok(events.some((entry) => entry.includes('AES-256-GCM')));
  assert.ok(events.some((entry) => entry.includes('created')));
  assert.ok(events.some((entry) => entry.includes('updated')));
  assert.ok(events.some((entry) => entry.includes('deleted')));

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build16-secrets-vault-runtime/2',
    minimumSchemaVersion: 6,
    currentSchemaVersion: LOCAL_DATABASE_SCHEMA_VERSION,
    encryptedValuesAtRest: true,
    encryptedResourceNamesAtRest: true,
    hmacLookup: true,
    capabilityGated: true,
    destructiveDeleteGate: true,
    persistenceAcrossRestart: true,
    authenticatedTamperDetection: true,
    keyMismatchFailsClosed: true,
    ownerOnlyKeyFile: process.platform === 'win32' ? 'platform-managed' : true,
    daemonReadinessIntegration: true,
    externalTransport: false,
    allowsLaterSchemaMigrations: true,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
