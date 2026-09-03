import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-capabilities.mjs');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Capability Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const rejected = [];

const studioProbe = path.join(root, 'apps/studio/src/__capability_persistence_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedCapabilityTable = 'gd_capability_grants';\n");
  runExpecting('AG131');
  rejected.push('AG131');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationOriginal = fs.readFileSync(migrationPath, 'utf8');
try {
  fs.writeFileSync(migrationPath, `${migrationOriginal}\n// capability_token TEXT\n`);
  runExpecting('AG132');
  rejected.push('AG132');
} finally {
  fs.writeFileSync(migrationPath, migrationOriginal);
}

for (const [filename, source, code] of [
  ['__secrets_vault_probe.ts', 'export class SecretsVault {}\n', 'AG133'],
  ['__approval_transaction_probe.ts', 'export class ApprovalTransaction {}\n', 'AG134'],
  ['__audit_ledger_probe.ts', 'export class AuditLedger {}\n', 'AG135'],
]) {
  const probe = path.join(root, 'apps/local/src', filename);
  try {
    fs.writeFileSync(probe, source);
    runExpecting(code);
    rejected.push(code);
  } finally {
    fs.rmSync(probe, { force: true });
  }
}

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenCapabilityEndpoint = '/v1/capabilities';\n`);
  runExpecting('AG136');
  rejected.push('AG136');
} finally {
  fs.writeFileSync(serverPath, serverOriginal);
}

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.capabilityAuthority.denyByDefault = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  runExpecting('AG137');
  rejected.push('AG137');
} finally {
  fs.writeFileSync(policyPath, policyOriginal);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Capability Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build15-capability-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
