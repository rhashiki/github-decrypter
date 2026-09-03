import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-approvals.mjs');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Approval Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const rejected = [];

const studioProbe = path.join(root, 'apps/studio/src/__approval_persistence_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedApprovalTable = 'gd_approval_transactions';\n");
  runExpecting('AG151');
  rejected.push('AG151');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationOriginal = fs.readFileSync(migrationPath, 'utf8');
try {
  fs.writeFileSync(migrationPath, `${migrationOriginal}\n// receipt TEXT\n`);
  runExpecting('AG152');
  rejected.push('AG152');
} finally {
  fs.writeFileSync(migrationPath, migrationOriginal);
}

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenApprovalEndpoint = '/v1/approvals';\n`);
  runExpecting('AG154');
  rejected.push('AG154');
} finally {
  fs.writeFileSync(serverPath, serverOriginal);
}

const auditProbe = path.join(root, 'apps/local/src/__audit_ledger_probe.ts');
try {
  fs.writeFileSync(auditProbe, 'export class AuditLedger {}\n');
  runExpecting('AG155');
  rejected.push('AG155');
} finally {
  fs.rmSync(auditProbe, { force: true });
}

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.approvalAuthority.oneShotReceipts = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  runExpecting('AG156');
  rejected.push('AG156');
} finally {
  fs.writeFileSync(policyPath, policyOriginal);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Approval Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build17-approval-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
