import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-vault.mjs');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Vault Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const rejected = [];

const studioProbe = path.join(root, 'apps/studio/src/__vault_persistence_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedVaultTable = 'gd_vault_secrets';\n");
  runExpecting('AG141');
  rejected.push('AG141');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationOriginal = fs.readFileSync(migrationPath, 'utf8');
try {
  fs.writeFileSync(migrationPath, migrationOriginal.replace(
    'resource_ciphertext BLOB NOT NULL,',
    'resource TEXT NOT NULL,\n  resource_ciphertext BLOB NOT NULL,',
  ));
  runExpecting('AG142');
  rejected.push('AG142');
} finally {
  fs.writeFileSync(migrationPath, migrationOriginal);
}

const keyStorePath = path.join(root, 'apps/local/src/vault-key-store.ts');
const keyStoreOriginal = fs.readFileSync(keyStorePath, 'utf8');
try {
  fs.writeFileSync(keyStorePath, keyStoreOriginal.replaceAll('0o600', '0o644'));
  runExpecting('AG143');
  rejected.push('AG143');
} finally {
  fs.writeFileSync(keyStorePath, keyStoreOriginal);
}

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenVaultEndpoint = '/v1/secrets';\n`);
  runExpecting('AG145');
  rejected.push('AG145');
} finally {
  fs.writeFileSync(serverPath, serverOriginal);
}

const legacyVaultPath = path.join(root, 'security/vault.js');
try {
  fs.mkdirSync(path.dirname(legacyVaultPath), { recursive: true });
  fs.writeFileSync(legacyVaultPath, 'export const legacyVault = true;\n');
  runExpecting('AG146');
  rejected.push('AG146');
} finally {
  fs.rmSync(legacyVaultPath, { force: true });
}

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.vaultAuthority.plaintextPersistence = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  runExpecting('AG147');
  rejected.push('AG147');
} finally {
  fs.writeFileSync(policyPath, policyOriginal);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Vault Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build16-vault-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
