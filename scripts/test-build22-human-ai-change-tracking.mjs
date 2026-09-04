import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));

for (const file of [
  'apps/local/src/change-tracker.ts',
  'scripts/architecture-guardian-change-tracking.mjs',
  'scripts/test-build22-human-ai-change-tracking-runtime.ts',
  'scripts/test-build22-change-tracking-guardian-negative.mjs',
  'docs/architecture/HUMAN_AI_CHANGE_TRACKING.md',
  'docs/builds/BUILD_22_HUMAN_AI_CHANGE_TRACKING.md',
]) {
  assert.ok(fs.existsSync(file), `Build 22 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const versionMatch = String(rootPackage.version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
assert.ok(versionMatch, 'root version must remain numeric semver');
const [, major, minor, patch] = versionMatch.map(Number);
assert.ok(major > 0 || minor > 0 || patch >= 22, 'root version must not regress below Build 22');
assert.ok(rootPackage.scripts?.['check:build22'], 'Build 22 regression command is required');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-change-tracking.mjs'));

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 22, 'Architecture Guardian must not regress below Build 22');
assert.equal(policy.phaseGates.changeTrackingBuild, 22);
const rule = policy.changeTrackingAuthority;
assert.equal(rule.ownerRoot, 'apps/local');
assert.equal(rule.contractPackage, '@github-decrypter/git');
assert.equal(rule.gitRuntimeBuild, 21);
assert.equal(rule.githubAppBuild, 23);
assert.equal(rule.agentRuntimeBuild, 58);
assert.equal(rule.codingAgentBuild, 60);
assert.equal(rule.commitWorkflowBuild, 109);
assert.equal(rule.workspaceScoped, true);
assert.equal(rule.pathLevel, true);
assert.equal(rule.hunkLevel, false);
assert.equal(rule.explicitAttributionBoundaries, true);
assert.equal(rule.aiWriteCapability, 'WRITE');
assert.equal(rule.contentPersistence, false);
assert.equal(rule.filesystemMutation, false);
assert.equal(rule.externalTransport, false);

const contract = read('packages/git/src/index.ts');
for (const marker of [
  "CHANGE_TRACKING_SCHEMA = 'gd-change-tracking/1'",
  "CHANGE_ORIGINS = ['human', 'ai', 'mixed', 'unknown']",
  'ChangePathAttribution',
  'ChangeTrackingSnapshot',
  'AiChangeSessionRecord',
]) {
  assert.ok(contract.includes(marker), `missing Change Tracking contract marker: ${marker}`);
}

const migrations = read('apps/local/src/database-migrations.ts');
for (const marker of ['MIGRATION_010_SQL', 'CREATE TABLE gd_change_sessions', 'CREATE TABLE gd_change_path_events', "name: 'human-ai-change-tracking'", 'version: 10']) {
  assert.ok(migrations.includes(marker), `missing Change Tracking migration marker: ${marker}`);
}

const tracker = read('apps/local/src/change-tracker.ts');
for (const marker of ['class ChangeTracker', 'observeHumanChanges', 'beginAiChange', 'completeAiChange', 'cancelAiChange', "capability: 'WRITE'", "return 'mixed'", "origin: 'unknown'", 'contentPersistence: false', 'filesystemMutation: false', 'externalTransport: false']) {
  assert.ok(tracker.includes(marker), `missing Change Tracker marker: ${marker}`);
}
assert.doesNotMatch(tracker, /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|unlinkSync|unlink|mkdirSync|mkdir|renameSync|rename|copyFileSync|copyFile|truncateSync|truncate|chmodSync|chmod)\s*\(/);

const lifecycle = read('apps/local/src/lifecycle.ts');
for (const marker of ['gd.local.change-tracking.ready', 'gd.local.change-tracking.human-observed', 'gd.local.change-tracking.ai-started', 'gd.local.change-tracking.ai-completed', 'gd.local.change-tracking.invalidated']) {
  assert.ok(lifecycle.includes(marker));
}
const daemon = read('apps/local/src/daemon.ts');
assert.ok(daemon.includes('createChangeTracker'));
assert.ok(daemon.includes('getChangeTrackerStatus'));
const server = read('apps/local/src/server.ts');
assert.ok(server.includes('changeTrackingReady'));
assert.doesNotMatch(server, /\/v\d+\/(?:change-tracking|changes|attribution|change-origin)(?:\b|\/)/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build22-human-ai-change-tracking/1',
  minimumBuild: 22,
  currentBuild: policy.currentBuild,
  origins: ['human', 'ai', 'mixed', 'unknown'],
  explicitAttributionBoundaries: true,
  aiWriteCapability: 'WRITE',
  pathLevel: true,
  hunkLevel: false,
  contentPersistence: false,
  filesystemMutation: false,
  externalTransport: false,
}, null, 2));
