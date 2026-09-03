import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const patchVersion = (value) => {
  const match = String(value ?? '').match(/^0\.0\.(\d+)$/);
  assert.ok(match, `expected pre-V1 0.0.x version, got ${value}`);
  return Number(match[1]);
};

for (const file of [
  'apps/local/src/secrets-vault.ts',
  'apps/local/src/vault-key-store.ts',
  'scripts/architecture-guardian-vault.mjs',
  'scripts/test-build16-secrets-vault-runtime.ts',
  'docs/architecture/SECRETS_VAULT.md',
  'docs/builds/BUILD_16_SECRETS_VAULT.md',
]) {
  assert.ok(fs.existsSync(file), `Build 16 artifact missing: ${file}`);
}
assert.equal(fs.existsSync('security/vault.js'), false, 'inherited remote Vault authority must be removed');

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 16, 'root version must not regress below Build 16');
assert.ok(patchVersion(localPackage.version) >= 16, 'Local Runtime version must not regress below Build 16');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-vault.mjs'));
assert.ok(rootPackage.scripts?.['check:build16']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 16, 'Architecture Guardian must not regress below Build 16');
assert.equal(policy.phaseGates.secretsVaultBuild, 16);
assert.equal(policy.phaseGates.approvalTransactionsBuild, 17);
assert.equal(policy.phaseGates.auditLedgerBuild, 18);
assert.equal(policy.vaultAuthority.ownerRoot, 'apps/local');
assert.equal(policy.vaultAuthority.minimumBuild, 16);
assert.equal(policy.vaultAuthority.cipher, 'AES-256-GCM');
assert.equal(policy.vaultAuthority.kdf, 'HKDF-SHA256');
assert.equal(policy.vaultAuthority.keyBackend, 'local-key-file-v1');
assert.equal(policy.vaultAuthority.keyFileMode, '0600');
assert.equal(policy.vaultAuthority.plaintextPersistence, false);
assert.equal(policy.vaultAuthority.plaintextResourcePersistence, false);
assert.equal(policy.vaultAuthority.masterKeyInDatabase, false);
assert.equal(policy.vaultAuthority.externalTransport, false);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  'version: 6',
  "name: 'secrets-vault'",
  'CREATE TABLE gd_vault_metadata',
  'CREATE TABLE gd_vault_secrets',
  'resource_hmac TEXT NOT NULL UNIQUE',
  'resource_ciphertext BLOB NOT NULL',
  'value_ciphertext BLOB NOT NULL',
]) {
  assert.ok(migrations.includes(marker), `Build 16 migration marker missing: ${marker}`);
}
const vaultTable = migrations.match(/CREATE TABLE gd_vault_secrets[\s\S]*?\) STRICT;/)?.[0] ?? '';
assert.equal(/\b(?:secret_?value|value|resource)\s+TEXT\b/i.test(vaultTable), false, 'Vault table must not contain plaintext value/resource columns');

const keyStore = read('apps/local/src/vault-key-store.ts');
for (const marker of ['LOCAL_VAULT_KEY_BYTES = 32', 'randomBytes(LOCAL_VAULT_KEY_BYTES)', '0o600', 'withKey<T>']) {
  assert.ok(keyStore.includes(marker), `Build 16 key-store marker missing: ${marker}`);
}
assert.equal(keyStore.includes('gd_vault_secrets'), false);

const vault = read('apps/local/src/secrets-vault.ts');
for (const marker of [
  "SECRETS_VAULT_CIPHER = 'AES-256-GCM'",
  "SECRETS_VAULT_KDF = 'HKDF-SHA256'",
  "createCipheriv('aes-256-gcm'",
  "createDecipheriv('aes-256-gcm'",
  "createHmac('sha256'",
  "capability: 'SECRETS'",
  "capability: 'DESTRUCTIVE'",
  'putSecret(',
  'readSecret(',
  'deleteSecret(',
]) {
  assert.ok(vault.includes(marker), `Build 16 Vault marker missing: ${marker}`);
}

const server = read('apps/local/src/server.ts');
assert.ok(server.includes('secretsVaultReady'));
assert.ok(server.includes('getSecretsVaultStatus'));
assert.equal(/\/v\d+\/(?:vault|vaults|secret|secrets)(?:\b|\/)/i.test(server), false);
assert.equal(/(?:putSecret|readSecret|deleteSecret)\s*\(/.test(server), false);

const identity = read('apps/local/src/identity.ts');
assert.ok(identity.includes("'secrets-vault'"));
assert.ok(identity.includes("'encrypted-secret-storage'"));
assert.ok(identity.includes("'capability-gated-secrets'"));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build16-secrets-vault/1',
  minimumBuild: 16,
  currentBuild: policy.currentBuild,
  cipher: policy.vaultAuthority.cipher,
  kdf: policy.vaultAuthority.kdf,
  keyBackend: policy.vaultAuthority.keyBackend,
  plaintextPersistence: false,
  plaintextResourcePersistence: false,
  externalTransport: false,
  inheritedRemoteVault: false,
}, null, 2));
