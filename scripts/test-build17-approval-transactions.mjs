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
  'apps/local/src/approval-transactions.ts',
  'scripts/architecture-guardian-approvals.mjs',
  'docs/architecture/APPROVAL_TRANSACTIONS.md',
  'docs/builds/BUILD_17_APPROVAL_TRANSACTIONS.md',
]) assert.ok(fs.existsSync(file), `Build 17 artifact missing: ${file}`);

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 17);
assert.ok(patchVersion(localPackage.version) >= 17);
assert.ok(rootPackage.scripts.guardian.includes('architecture-guardian-approvals.mjs'));
assert.ok(rootPackage.scripts['check:build17']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 17);
assert.equal(policy.phaseGates.approvalTransactionsBuild, 17);
assert.equal(policy.phaseGates.auditLedgerBuild, 18);
assert.equal(policy.approvalAuthority.ownerRoot, 'apps/local');
assert.equal(policy.approvalAuthority.oneShotReceipts, true);
assert.equal(policy.approvalAuthority.plaintextReceiptPersistence, false);
assert.equal(policy.approvalAuthority.payloadDigestBinding, 'sha256');
assert.equal(policy.approvalAuthority.externalDecisionTransport, false);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  "migration(7, 'approval-transactions'",
  'CREATE TABLE gd_approval_transactions',
  'payload_digest TEXT NOT NULL',
  'receipt_hash TEXT UNIQUE',
]) assert.ok(migrations.includes(marker), `Build 17 migration marker missing: ${marker}`);
assert.ok(!/\breceipt\s+TEXT\b/i.test(migrations));

const authority = read('apps/local/src/approval-transactions.ts');
for (const marker of [
  'class ApprovalTransactions',
  "APPROVAL_RECEIPT_PREFIX = 'gd_approval_v1_'",
  'randomBytes(32)',
  "createHash('sha256')",
  'payloadDigest',
  "state = 'consumed'",
  'receipt_hash = NULL',
  'externalDecisionTransport: false',
]) assert.ok(authority.includes(marker), `Build 17 authority marker missing: ${marker}`);

const server = read('apps/local/src/server.ts');
assert.ok(!/\/v\d+\/(?:approvals?|approval-transactions?)(?:\b|\/)/i.test(server));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build17-approval-transactions/1',
  minimumBuild: 17,
  currentBuild: policy.currentBuild,
  oneShotReceipts: true,
  payloadDigestBinding: 'sha256',
  externalDecisionTransport: false,
  auditLedger: false,
}, null, 2));
