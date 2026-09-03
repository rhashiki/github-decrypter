import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-offline.mjs');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const offlineBuild = policy.offlineAuthority?.minimumBuild ?? 14;
const capabilityBuild = policy.offlineAuthority?.capabilitySecurityBuild ?? 15;

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Offline Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const rejected = [];

const studioProbe = path.join(root, 'apps/studio/src/__offline_persistence_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedConnectivityTable = 'gd_connectivity_state';\n");
  runExpecting('AG121');
  rejected.push('AG121');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const offlinePath = path.join(root, 'apps/local/src/offline-execution.ts');
const offlineOriginal = fs.readFileSync(offlinePath, 'utf8');
try {
  fs.writeFileSync(offlinePath, `${offlineOriginal}\nexport const forbiddenAutomaticProbe = () => fetch('https://example.com');\n`);
  runExpecting('AG122');
  rejected.push('AG122');
} finally {
  fs.writeFileSync(offlinePath, offlineOriginal);
}

if (policy.currentBuild < capabilityBuild) {
  const capabilityProbe = path.join(root, 'apps/local/src/__offline_capability_probe.ts');
  try {
    fs.writeFileSync(capabilityProbe, 'export class CapabilityGrant {}\n');
    runExpecting('AG123');
    rejected.push('AG123');
  } finally {
    fs.rmSync(capabilityProbe, { force: true });
  }
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Offline Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build14-offline-guardian-negative/2',
  currentBuild: policy.currentBuild,
  offlineBuild,
  capabilityBuild,
  rejected,
  prematureCapabilityProbeRequired: policy.currentBuild < capabilityBuild,
  restoredTreePasses: true,
}, null, 2));
