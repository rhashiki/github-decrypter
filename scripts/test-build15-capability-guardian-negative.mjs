import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-capabilities.mjs');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));

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

const phaseProbes = [
  {
    required: policy.currentBuild < policy.capabilityAuthority.secretsVaultBuild,
    filename: '__secrets_vault_probe.ts',
    source: 'export class SecretsVault {}\n',
    code: 'AG133',
  },
  {
    required: policy.currentBuild < policy.capabilityAuthority.approvalTransactionsBuild,
    filename: '__approval_transaction_probe.ts',
    source: 'export class ApprovalTransaction {}\n',
    code: 'AG134',
  },
  {
    required: policy.currentBuild < policy.capabilityAuthority.auditLedgerBuild,
    filename: '__audit_ledger_probe.ts',
    source: 'export class AuditLedger {}\n',
    code: 'AG135',
  },
];

for (const probeDefinition of phaseProbes) {
  if (!probeDefinition.required) continue;
  const probe = path.join(root, 'apps/local/src', probeDefinition.filename);
  try {
    fs.writeFileSync(probe, probeDefinition.source);
    runExpecting(probeDefinition.code);
    rejected.push(probeDefinition.code);
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
  const changedPolicy = JSON.parse(policyOriginal);
  changedPolicy.capabilityAuthority.denyByDefault = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(changedPolicy, null, 2)}\n`);
  runExpecting('AG137');
  rejected.push('AG137');
} finally {
  fs.writeFileSync(policyPath, policyOriginal);
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Capability Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build15-capability-guardian-negative/2',
  currentBuild: policy.currentBuild,
  rejected,
  prematureSecretsVaultProbeRequired: policy.currentBuild < policy.capabilityAuthority.secretsVaultBuild,
  restoredTreePasses: true,
}, null, 2));
