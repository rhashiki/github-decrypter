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
  'apps/local/src/capability-security.ts',
  'scripts/architecture-guardian-capabilities.mjs',
  'scripts/test-build15-capability-security-runtime.ts',
  'docs/architecture/CAPABILITY_SECURITY_MODEL.md',
  'docs/builds/BUILD_15_CAPABILITY_SECURITY_MODEL.md',
]) {
  assert.ok(fs.existsSync(file), `Build 15 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 15, 'root version must not regress below Build 15');
assert.ok(patchVersion(localPackage.version) >= 15, 'Local Runtime version must not regress below Build 15');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-capabilities.mjs'));
assert.ok(rootPackage.scripts?.['check:build15']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 15, 'Architecture Guardian must not regress below Build 15');
assert.equal(policy.phaseGates.capabilitySecurityBuild, 15);
assert.equal(policy.phaseGates.secretsVaultBuild, 16);
assert.equal(policy.phaseGates.approvalTransactionsBuild, 17);
assert.equal(policy.phaseGates.auditLedgerBuild, 18);
assert.equal(policy.capabilityAuthority.ownerRoot, 'apps/local');
assert.equal(policy.capabilityAuthority.minimumBuild, 15);
assert.equal(policy.capabilityAuthority.denyByDefault, true);
assert.equal(policy.capabilityAuthority.plaintextTokenPersistence, false);
assert.equal(policy.capabilityAuthority.externalGrantTransport, false);
assert.deepEqual(policy.capabilityAuthority.requiredCapabilities, [
  'READ', 'WRITE', 'EXECUTE', 'NETWORK', 'DATABASE_WRITE', 'GIT_WRITE', 'DESTRUCTIVE', 'SECRETS',
]);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  "version: 5",
  "name: 'capability-security-model'",
  'CREATE TABLE gd_capability_grants',
  'CREATE TABLE gd_capability_claims',
  'token_hash TEXT NOT NULL UNIQUE',
  "'READ', 'WRITE', 'EXECUTE', 'NETWORK', 'DATABASE_WRITE'",
  "'GIT_WRITE', 'DESTRUCTIVE', 'SECRETS'",
  "match_mode TEXT NOT NULL CHECK (match_mode IN ('exact', 'prefix'))",
]) {
  assert.ok(migrations.includes(marker), `Build 15 migration marker missing: ${marker}`);
}
assert.ok(!/\b(?:capability_)?token\s+TEXT\b/.test(migrations), 'plaintext token column must not exist');

const capability = read('apps/local/src/capability-security.ts');
for (const marker of [
  'class CapabilitySecurityAuthority',
  "CAPABILITY_TOKEN_PREFIX = 'gd_cap_v1_'",
  'randomBytes(32)',
  "createHash('sha256')",
  'issueGrant(',
  'authorize(',
  'assertAuthorized(',
  'revokeGrant(',
  'revokeJobGrants(',
  'CAPABILITY_RESTART_REVOCATION_REASON',
  'denyByDefault: true',
  'plaintextTokenPersistence: false',
  'secretsVaultReady: false',
  'approvalTransactionsReady: false',
  'externalGrantTransport: false',
]) {
  assert.ok(capability.includes(marker), `Build 15 capability marker missing: ${marker}`);
}

const server = read('apps/local/src/server.ts');
assert.ok(server.includes('capabilitySecurityReady'));
assert.ok(server.includes('denyByDefault'));
assert.ok(!/\/v\d+\/(?:capabilities|capability|grants|grant)(?:\b|\/)/i.test(server));
assert.ok(!server.includes('issueGrant('));

const identity = read('apps/local/src/identity.ts');
assert.ok(identity.includes("'capability-security'"));
assert.ok(identity.includes("'deny-by-default'"));
assert.ok(identity.includes("'scoped-capability-grants'"));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build15-capability-security/1',
  minimumBuild: 15,
  currentBuild: policy.currentBuild,
  capabilities: policy.capabilityAuthority.requiredCapabilities,
  denyByDefault: true,
  plaintextTokenPersistence: false,
  processBoundUntilVault: true,
  externalGrantTransport: false,
  secretsVault: false,
  approvalTransactions: false,
  auditLedger: false,
}, null, 2));
