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
  'apps/local/src/job-types.ts',
  'apps/local/src/job-engine.ts',
  'scripts/architecture-guardian-jobs.mjs',
  'scripts/test-build12-durable-job-engine-runtime.ts',
  'docs/architecture/DURABLE_JOB_ENGINE.md',
  'docs/builds/BUILD_12_DURABLE_JOB_ENGINE.md',
]) {
  assert.ok(fs.existsSync(file), `Build 12 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const localPackage = json('apps/local/package.json');
assert.ok(patchVersion(rootPackage.version) >= 12, 'root version must not regress below Build 12');
assert.ok(patchVersion(localPackage.version) >= 12, 'Local Runtime version must not regress below Build 12');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-jobs.mjs'));
assert.ok(rootPackage.scripts?.['check:build12']);

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 12, 'Architecture Guardian must not regress below Build 12');
assert.equal(policy.phaseGates.durableJobEngineBuild, 12);
assert.equal(policy.phaseGates.crashPowerRecoveryBuild, 13);
assert.equal(policy.phaseGates.offlineExecutionBuild, 14);
assert.equal(policy.jobAuthority.ownerRoot, 'apps/local');
assert.equal(policy.jobAuthority.crashRecoveryBuild, 13);
assert.equal(policy.jobAuthority.jobControlTransportBuild, 47);

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of [
  "version: 2",
  "name: 'durable-job-engine'",
  'CREATE TABLE gd_jobs',
  'CREATE TABLE gd_job_dependencies',
  'CREATE TABLE gd_job_transitions',
  "'checkpointed'",
  "'waiting'",
  "'cancelled'",
  'lease_token',
  'lease_expires_at',
]) {
  assert.ok(migrations.includes(marker), `Build 12 migration marker missing: ${marker}`);
}

const engine = read('apps/local/src/job-engine.ts');
for (const marker of [
  'class DurableJobEngine',
  'claimNext(',
  'heartbeat(',
  'checkpoint(',
  'requestPause(',
  'requestCancel(',
  'resume(',
  'retry(',
  'skip(',
  'listExpiredLeases(',
  'WITH RECURSIVE lineage',
  "prerequisite.state NOT IN ('completed', 'skipped')",
]) {
  assert.ok(engine.includes(marker), `Build 12 engine marker missing: ${marker}`);
}

const server = read('apps/local/src/server.ts');
assert.ok(server.includes('jobsReady'));
assert.ok(server.includes('expiredLeases'));
assert.ok(!/\/v1\/jobs(?:\/|['"`])/.test(server), 'Build 12 must not expose job control HTTP endpoints');

const identity = read('apps/local/src/identity.ts');
assert.ok(identity.includes("'durable-jobs'"));
assert.ok(identity.includes("'job-dependencies'"));
assert.ok(identity.includes("'job-leases'"));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build12-durable-job-engine/1',
  minimumBuild: 12,
  currentBuild: policy.currentBuild,
  authority: policy.jobAuthority.ownerRoot,
  persistentQueue: true,
  dependencyDag: true,
  leaseTokens: true,
  automaticCrashRecovery: false,
  jobControlTransport: false,
}, null, 2));
