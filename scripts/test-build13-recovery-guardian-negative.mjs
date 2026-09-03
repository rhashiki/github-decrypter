import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-recovery.mjs');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Recovery Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const studioProbe = path.join(root, 'apps/studio/src/__recovery_guardian_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedRecoveryTable = 'gd_runtime_sessions';\n");
  runExpecting('AG111');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const offlineProbe = path.join(root, 'apps/local/src/__offline_guardian_probe.ts');
try {
  fs.writeFileSync(offlineProbe, "export const offlineExecution = () => 'premature';\n");
  runExpecting('AG112');
} finally {
  fs.rmSync(offlineProbe, { force: true });
}

const capabilityProbe = path.join(root, 'apps/local/src/__capability_guardian_probe.ts');
try {
  fs.writeFileSync(capabilityProbe, "export class CapabilityGrant {}\n");
  runExpecting('AG113');
} finally {
  fs.rmSync(capabilityProbe, { force: true });
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Recovery Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build13-recovery-guardian-negative/1',
  rejected: ['AG111', 'AG112', 'AG113'],
  restoredTreePasses: true,
}, null, 2));
