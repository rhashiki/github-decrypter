import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-approvals.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Approval Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const studioProbe = path.join(root, 'apps/studio/src/__approval_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const table = 'gd_approval_transactions';\n");
  expect('AG151');
} finally { fs.rmSync(studioProbe, { force: true }); }

const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationOriginal = fs.readFileSync(migrationPath, 'utf8');
try {
  fs.writeFileSync(migrationPath, migrationOriginal.replace('receipt_hash TEXT UNIQUE', 'receipt TEXT UNIQUE'));
  expect('AG152');
} finally { fs.writeFileSync(migrationPath, migrationOriginal); }

const authorityPath = path.join(root, 'apps/local/src/approval-transactions.ts');
const authorityOriginal = fs.readFileSync(authorityPath, 'utf8');
try {
  fs.writeFileSync(authorityPath, authorityOriginal.replace('receipt_hash = NULL', 'receipt_hash = receipt_hash'));
  expect('AG154');
} finally { fs.writeFileSync(authorityPath, authorityOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenApprovalEndpoint = '/v1/approvals';\n`);
  expect('AG155');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.approvalAuthority.oneShotReceipts = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG157');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Approval Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({ ok: true, schema: 'gd-build17-approval-guardian-negative/1', rejected, restoredTreePasses: true }, null, 2));
