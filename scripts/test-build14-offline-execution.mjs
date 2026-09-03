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
  'apps/local/src/offline-execution.ts',
  'scripts/architecture-guardian-offline.mjs',
  'scripts/test-build14-offline-execution-runtime.ts',
  'docs/architecture/OFFLINE_EXECUTION.md',
  'docs/builds/BUILD_14_OFFLINE_EXECUTION.md',
]) {
  assert.ok(fs.existsSync(file), `Build 14 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 14, 'root version must not regress below Build 14');
assert.ok(patchVersion(localPackage.version) >= 14, 'Local Runtime version must not regress below Build 14');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-offline.mjs'));
assert.ok(rootPackage.scripts?.['check:build14']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 14, 'Architecture Guardian must not regress below Build 14');
assert.equal(policy.phaseGates.offlineExecutionBuild, 14);
assert.equal(policy.phaseGates.capabilitySecurityBuild, 15);
assert.equal(policy.offlineAuthority.ownerRoot, 'apps/local');
assert.equal(policy.offlineAuthority.minimumBuild, 14);
assert.equal(policy.offlineAuthority.automaticNetworkProbe, false);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  "version: 4",
  "name: 'offline-execution'",
  'CREATE TABLE gd_connectivity_state',
  'CREATE TABLE gd_connectivity_events',
  'CREATE TABLE gd_job_network_requirements',
  "'unknown', 'online', 'offline'",
  'blocked_for_network',
]) {
  assert.ok(migrations.includes(marker), `Build 14 migration marker missing: ${marker}`);
}

const offline = read('apps/local/src/offline-execution.ts');
for (const marker of [
  'class OfflineExecutionCoordinator',
  'declareNetworkRequired(',
  'setConnectivity(',
  'markOnline(',
  'markOffline(',
  'claimNext(',
  'waitForNetwork(',
  'network unavailable; preserved for offline execution',
  'network connectivity restored',
  'automaticNetworkProbe: false',
]) {
  assert.ok(offline.includes(marker), `Build 14 coordinator marker missing: ${marker}`);
}
assert.ok(!/\bfetch\s*\(|\bhttps?\.(?:request|get)\s*\(|\bnet\.connect\s*\(|\btls\.connect\s*\(/.test(offline));

const server = read('apps/local/src/server.ts');
assert.ok(server.includes('offlineExecutionReady'));
assert.ok(server.includes('localExecutionAvailable'));
assert.ok(server.includes('automaticNetworkProbe: false'));
assert.ok(!/\/v1\/(?:jobs|connectivity|offline)(?:\/|['"`])/.test(server));

const identity = read('apps/local/src/identity.ts');
assert.ok(identity.includes("'offline-execution'"));
assert.ok(identity.includes("'connectivity-state'"));
assert.ok(identity.includes("'network-wait-resume'"));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build14-offline-execution/1',
  minimumBuild: 14,
  currentBuild: policy.currentBuild,
  localWorkOffline: true,
  networkWorkWaits: true,
  connectivityPersistent: true,
  automaticNetworkProbe: false,
  capabilitySecurity: false,
  jobControlTransport: false,
}, null, 2));
