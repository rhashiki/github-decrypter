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
  'scripts/test-build17-approval-transactions-runtime.ts',
  'docs/architecture/APPROVAL_TRANSACTIONS.md',
  'docs/builds/BUILD_17_APPROVAL_TRANSACTIONS.md',
]) {
  assert.ok(fs.existsSync(file), `Build 17 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 17, 'root version must not regress below Build 17');
assert.ok(patchVersion(localPackage.version) >= 17, 'Local Runtime version must not regress below Build 17');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-approvals.mjs'));
assert.ok(rootPackage.scripts?.['check:build17']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 17, 'Architecture Guardian must not regress below Build 17');
assert.equal(policy.phaseGates.approvalTransactionsBuild, 17);
assert.equal(policy.phaseGates.auditLedgerBuild, 18);
assert.equal(policy.approvalAuthority.ownerRoot, 'apps/local');
assert.equal(policy.approvalAuthority.minimumBuild, 17);
assert.equal(policy.approvalAuthority.humanReviewRequired, true);
assert.equal(policy.approvalAuthority.oneShotReceipts, true);
assert.equal(policy.approvalAuthority.plaintextReceiptPersistence, false);
assert.equal(policy.approvalAuthority.payloadDigestBinding, true);
assert.equal(policy.approvalAuthority.externalDecisionTransport, false);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  'version: 7',
  "name: 'approval-transactions'",
  'CREATE TABLE gd_approval_transactions',
  'requirements_json TEXT NOT NULL',
  'payload_digest TEXT NOT NULL',
  'receipt_hash TEXT UNIQUE',
  "reviewer_kind TEXT CHECK (reviewer_kind IS NULL OR reviewer_kind = 'human')",
]) {
  assert.ok(migrations.includes(marker), `Build 17 migration marker missing: ${marker}`);
}
assert.equal(/\breceipt\s+TEXT\b/.test(migrations), false, 'plaintext approval receipt column must not exist');

const approvals = read('apps/local/src/approval-transactions.ts');
for (const marker of [
  'class ApprovalTransactions',
  "APPROVAL_RECEIPT_PREFIX = 'gd_approval_v1_'",
  'randomBytes(32)',
  "createHash('sha256')",
  'payloadDigest',
  "reviewerKind: 'human'",
  'oneShotReceipts: true',
  'plaintextReceiptPersistence: false',
  'request(',
  'approve(',
  'deny(',
  'consume(',
  'expireDue(',
]) {
  assert.ok(approvals.includes(marker), `Build 17 authority marker missing: ${marker}`);
}

const server = read('apps/local/src/server.ts');
assert.ok(server.includes('approvalTransactionsReady'));
assert.ok(server.includes('getApprovalTransactionsStatus'));
assert.equal(/\/v\d+\/(?:approvals?|approve|deny|decisions?)(?:\b|\/)/i.test(server), false);
assert.equal(/\.(?:approve|deny|consume)\s*\(/.test(server), false, 'server must not execute approval decisions');

const identity = read('apps/local/src/identity.ts');
assert.ok(identity.includes("'approval-transactions'"));
assert.ok(identity.includes("'human-approval-receipts'"));
assert.ok(identity.includes("'payload-digest-binding'"));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build17-approval-transactions/1',
  minimumBuild: 17,
  currentBuild: policy.currentBuild,
  humanReviewRequired: true,
  oneShotReceipts: true,
  payloadDigestBinding: true,
  plaintextReceiptPersistence: false,
  externalDecisionTransport: false,
  auditLedger: false,
}, null, 2));
