import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-recovery.mjs');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const recoveryRule = policy.recoveryAuthority;

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Recovery Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const rejected = [];
const studioProbe = path.join(root, 'apps/studio/src/__recovery_guardian_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedRecoveryTable = 'gd_runtime_sessions';\n");
  runExpecting('AG111');
  rejected.push('AG111');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const prematureOfflineProbeRequired = policy.currentBuild < recoveryRule.offlineExecutionBuild;
if (prematureOfflineProbeRequired) {
  const offlineProbe = path.join(root, 'apps/local/src/__offline_guardian_probe.ts');
  try {
    fs.writeFileSync(offlineProbe, "export const offlineExecution = () => 'premature';\n");
    runExpecting('AG112');
    rejected.push('AG112');
  } finally {
    fs.rmSync(offlineProbe, { force: true });
  }
}

const capabilityProbe = path.join(root, 'apps/local/src/__capability_guardian_probe.ts');
try {
  fs.writeFileSync(capabilityProbe, 'export class CapabilityGrant {}\n');
  runExpecting('AG113');
  rejected.push('AG113');
} finally {
  fs.rmSync(capabilityProbe, { force: true });
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Recovery Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build13-recovery-guardian-negative/2',
  currentBuild: policy.currentBuild,
  offlineExecutionBuild: recoveryRule.offlineExecutionBuild,
  rejected,
  prematureOfflineProbeRequired,
  restoredTreePasses: true,
}, null, 2));
