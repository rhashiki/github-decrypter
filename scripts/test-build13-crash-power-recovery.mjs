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
  'apps/local/src/recovery-engine.ts',
  'scripts/architecture-guardian-recovery.mjs',
  'scripts/test-build13-crash-power-recovery-runtime.ts',
  'docs/architecture/CRASH_POWER_RECOVERY.md',
  'docs/builds/BUILD_13_CRASH_POWER_RECOVERY.md',
]) {
  assert.ok(fs.existsSync(file), `Build 13 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 13, 'root version must not regress below Build 13');
assert.ok(patchVersion(localPackage.version) >= 13, 'Local Runtime version must not regress below Build 13');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-recovery.mjs'));
assert.ok(rootPackage.scripts?.['check:build13']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 13, 'Architecture Guardian must not regress below Build 13');
assert.equal(policy.phaseGates.crashPowerRecoveryBuild, 13);
assert.equal(policy.phaseGates.offlineExecutionBuild, 14);
assert.equal(policy.phaseGates.capabilitySecurityBuild, 15);
assert.equal(policy.recoveryAuthority.ownerRoot, 'apps/local');
assert.equal(policy.recoveryAuthority.minimumBuild, 13);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  "version: 3",
  "name: 'crash-power-recovery'",
  'CREATE TABLE gd_runtime_sessions',
  'CREATE TABLE gd_job_recoveries',
  "'requeued'",
  'reconciled_at',
]) {
  assert.ok(migrations.includes(marker), `Build 13 migration marker missing: ${marker}`);
}

const recovery = read('apps/local/src/recovery-engine.ts');
for (const marker of [
  'class CrashPowerRecovery',
  'startSession(',
  'recoverAllRunning(',
  'sweepExpiredLeases(',
  'stopSession(',
  "action = 'cancelled'",
  "action = 'paused'",
  "action = 'requeued'",
  "action = 'failed'",
  'GD_RECOVERY_ATTEMPTS_EXHAUSTED',
]) {
  assert.ok(recovery.includes(marker), `Build 13 recovery marker missing: ${marker}`);
}

for (const forbidden of ['offlineExecution', 'waitForNetwork', 'CapabilityGrant', 'capabilityToken']) {
  assert.ok(!recovery.includes(forbidden), `Build 13 must not implement later authority: ${forbidden}`);
}

const daemon = read('apps/local/src/daemon.ts');
assert.ok(daemon.includes('startSession()'));
assert.ok(daemon.includes('startLeaseSweep()'));
assert.ok(daemon.includes('stopSession(reason)'));

const server = read('apps/local/src/server.ts');
assert.ok(server.includes('recoveryReady'));
assert.ok(server.includes('health.recovery.ready'));
assert.ok(!/\/v1\/jobs(?:\/|['"`])/.test(server), 'Build 13 must not expose job control HTTP endpoints');

const identity = read('apps/local/src/identity.ts');
assert.ok(identity.includes("'crash-recovery'"));
assert.ok(identity.includes("'runtime-sessions'"));
assert.ok(identity.includes("'lease-recovery'"));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build13-crash-power-recovery/1',
  minimumBuild: 13,
  currentBuild: policy.currentBuild,
  sessionJournal: true,
  recoveryLedger: true,
  startupRecovery: true,
  expiredLeaseSweep: true,
  offlineExecution: false,
  capabilitySecurity: false,
  jobControlTransport: false,
}, null, 2));
