import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-offline.mjs');

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Offline Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
}

const studioProbe = path.join(root, 'apps/studio/src/__offline_persistence_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const leakedConnectivityTable = 'gd_connectivity_state';\n");
  runExpecting('AG121');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

const offlinePath = path.join(root, 'apps/local/src/offline-execution.ts');
const offlineOriginal = fs.readFileSync(offlinePath, 'utf8');
try {
  fs.writeFileSync(offlinePath, `${offlineOriginal}\nexport const forbiddenAutomaticProbe = () => fetch('https://example.com');\n`);
  runExpecting('AG122');
} finally {
  fs.writeFileSync(offlinePath, offlineOriginal);
}

const capabilityProbe = path.join(root, 'apps/local/src/__offline_capability_probe.ts');
try {
  fs.writeFileSync(capabilityProbe, 'export class CapabilityGrant {}\n');
  runExpecting('AG123');
} finally {
  fs.rmSync(capabilityProbe, { force: true });
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Offline Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build14-offline-guardian-negative/1',
  rejected: ['AG121', 'AG122', 'AG123'],
  restoredTreePasses: true,
}, null, 2));
