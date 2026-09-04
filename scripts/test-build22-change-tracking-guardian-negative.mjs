import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-change-tracking.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Change Tracking Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const contractPath = path.join(root, 'packages/git/src/index.ts');
const contractOriginal = fs.readFileSync(contractPath, 'utf8');
try {
  fs.writeFileSync(contractPath, contractOriginal.replace("export const CHANGE_TRACKING_SCHEMA = 'gd-change-tracking/1' as const;", ''));
  expect('AG201');
} finally { fs.writeFileSync(contractPath, contractOriginal); }

const persistenceProbe = path.join(root, 'packages/git/src/__change_tracking_persistence_probe.ts');
try {
  fs.writeFileSync(persistenceProbe, "export const leakedChangeTable = 'gd_change_path_events';\n");
  expect('AG202');
} finally { fs.rmSync(persistenceProbe, { force: true }); }

const migrationsPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationsOriginal = fs.readFileSync(migrationsPath, 'utf8');
try {
  fs.writeFileSync(migrationsPath, migrationsOriginal.replace('state_digest TEXT NOT NULL CHECK', 'source_text TEXT,\n  state_digest TEXT NOT NULL CHECK'));
  expect('AG203');
} finally { fs.writeFileSync(migrationsPath, migrationsOriginal); }

const trackerPath = path.join(root, 'apps/local/src/change-tracker.ts');
const trackerOriginal = fs.readFileSync(trackerPath, 'utf8');
try {
  const start = trackerOriginal.indexOf('async beginAiChange(');
  assert.ok(start >= 0);
  const call = trackerOriginal.indexOf('await this.#authorizeAi(workspaceId, authorization);', start);
  assert.ok(call >= 0);
  const mutated = `${trackerOriginal.slice(0, call)}void authorization.token;${trackerOriginal.slice(call + 'await this.#authorizeAi(workspaceId, authorization);'.length)}`;
  fs.writeFileSync(trackerPath, mutated);
  expect('AG204');
} finally { fs.writeFileSync(trackerPath, trackerOriginal); }

try {
  fs.writeFileSync(trackerPath, `${trackerOriginal}\nexport const inferAi = () => 'ai';\n`);
  expect('AG205');
} finally { fs.writeFileSync(trackerPath, trackerOriginal); }

try {
  fs.writeFileSync(trackerPath, `${trackerOriginal}\nexport const forbiddenWorkspaceWrite = () => writeFileSync('x', 'y');\n`);
  expect('AG206');
} finally { fs.writeFileSync(trackerPath, trackerOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenChangeTrackingEndpoint = '/v1/change-tracking';\n`);
  expect('AG207');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const daemonPath = path.join(root, 'apps/local/src/daemon.ts');
const daemonOriginal = fs.readFileSync(daemonPath, 'utf8');
try {
  fs.writeFileSync(daemonPath, daemonOriginal.replace('getChangeTrackerStatus', 'getUntrackedChangeStatus'));
  expect('AG208');
} finally { fs.writeFileSync(daemonPath, daemonOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.changeTrackingAuthority.explicitAttributionBoundaries = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG209');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Change Tracking Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build22-change-tracking-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
