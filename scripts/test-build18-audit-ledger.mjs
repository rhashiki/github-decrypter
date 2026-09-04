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
  'apps/local/src/audit-ledger.ts',
  'scripts/architecture-guardian-audit.mjs',
  'docs/architecture/AUDIT_LEDGER.md',
  'docs/builds/BUILD_18_AUDIT_LEDGER.md',
]) assert.ok(fs.existsSync(file), `Build 18 artifact missing: ${file}`);

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 18);
assert.ok(patchVersion(localPackage.version) >= 18);
assert.ok(rootPackage.scripts.guardian.includes('architecture-guardian-audit.mjs'));
assert.ok(rootPackage.scripts['check:build18']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 18);
assert.equal(policy.phaseGates.auditLedgerBuild, 18);
assert.equal(policy.auditAuthority.ownerRoot, 'apps/local');
assert.equal(policy.auditAuthority.appendOnly, true);
assert.equal(policy.auditAuthority.hashChain, 'sha256');
assert.equal(policy.auditAuthority.integrityVerificationOnStartup, true);
assert.equal(policy.auditAuthority.securityEventMetadataOnly, true);
assert.equal(policy.auditAuthority.externalTransport, false);
assert.equal(policy.auditAuthority.transactionLedgerBuild, 77);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  'version: 8',
  "name: 'audit-ledger'",
  'CREATE TABLE gd_audit_entries',
  'previous_hash TEXT NOT NULL',
  'entry_hash TEXT NOT NULL UNIQUE',
  'CREATE TRIGGER gd_audit_entries_no_update',
  'CREATE TRIGGER gd_audit_entries_no_delete',
]) assert.ok(migrations.includes(marker), `Build 18 migration marker missing: ${marker}`);

const authority = read('apps/local/src/audit-ledger.ts');
for (const marker of [
  'class AuditLedger',
  "AUDIT_ENTRY_SCHEMA = 'gd-audit-entry/1'",
  'AUDIT_GENESIS_HASH',
  "createHash('sha256')",
  'verifyIntegrity()',
  'appendOnly: true',
  "hashChain: 'sha256'",
  'sensitivePayloadPersistence: false',
  'externalTransport: false',
]) assert.ok(authority.includes(marker), `Build 18 authority marker missing: ${marker}`);

const server = read('apps/local/src/server.ts');
assert.ok(!/\/v\d+\/(?:audit|audits|audit-ledger|ledger)(?:\b|\/)/i.test(server));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build18-audit-ledger/1',
  minimumBuild: 18,
  currentBuild: policy.currentBuild,
  appendOnly: true,
  hashChain: 'sha256',
  integrityVerificationOnStartup: true,
  securityEventMetadataOnly: true,
  externalTransport: false,
  transactionLedger: false,
}, null, 2));
