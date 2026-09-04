import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));

for (const file of [
  'apps/local/src/git-runtime.ts',
  'packages/git/src/index.ts',
  'scripts/architecture-guardian-git-runtime.mjs',
  'scripts/test-build21-git-runtime-runtime.ts',
  'scripts/test-build21-git-runtime-guardian-negative.mjs',
  'docs/architecture/GIT_RUNTIME.md',
  'docs/builds/BUILD_21_GIT_RUNTIME.md',
]) {
  assert.ok(fs.existsSync(file), `Build 21 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const versionMatch = String(rootPackage.version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
assert.ok(versionMatch, 'root version must remain numeric semver');
const [, major, minor, patch] = versionMatch.map(Number);
assert.ok(major > 0 || minor > 0 || patch >= 21, 'root version must not regress below Build 21');
assert.ok(rootPackage.scripts?.['check:build21'], 'Build 21 regression command is required');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-git-runtime.mjs'));

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 21, 'Architecture Guardian must not regress below Build 21');
assert.equal(policy.phaseGates.gitRuntimeBuild, 21);
const rule = policy.gitRuntimeAuthority;
assert.equal(rule.ownerRoot, 'apps/local');
assert.equal(rule.contractPackage, '@github-decrypter/git');
assert.equal(rule.workspaceManagerBuild, 19);
assert.equal(rule.projectDetectionBuild, 20);
assert.equal(rule.changeTrackingBuild, 22);
assert.equal(rule.githubAppBuild, 23);
assert.equal(rule.commitWorkflowBuild, 109);
assert.equal(rule.pushWorkflowBuild, 110);
assert.equal(rule.gitWriteCapability, 'GIT_WRITE');
assert.equal(rule.networkCapability, 'NETWORK');
assert.equal(rule.denyByDefault, true);
assert.equal(rule.workspaceScoped, true);
assert.equal(rule.shellExecution, false);
assert.equal(rule.forcePush, false);
assert.equal(rule.hardReset, false);
assert.equal(rule.embeddedRemoteCredentials, false);
assert.equal(rule.externalTransport, false);

const contract = read('packages/git/src/index.ts');
for (const marker of ["GIT_RUNTIME_SCHEMA = 'gd-git-runtime/1'", 'GitStatusSnapshot', 'GitLogResult', 'GitBranchesResult', 'GitMutationResult']) {
  assert.ok(contract.includes(marker), `missing Git Runtime contract marker: ${marker}`);
}
assert.doesNotMatch(contract, /node:(?:fs|path|child_process|os|http|https|net|tls)|\bwindow\.|\bdocument\.|\bchrome\./);

const runtime = read('apps/local/src/git-runtime.ts');
for (const marker of [
  'class GitRuntime',
  "spawn('git'",
  'shell: false',
  "GIT_TERMINAL_PROMPT: '0'",
  "capability: 'GIT_WRITE'",
  "capability: 'NETWORK'",
  'resolveExistingPath',
  "['pull', '--ff-only'",
  'assertSafeRemoteUrl',
  'forcePush: false',
  'hardReset: false',
  'externalTransport: false',
]) {
  assert.ok(runtime.includes(marker), `missing Git Runtime marker: ${marker}`);
}
assert.doesNotMatch(runtime, /\b(?:exec|execSync|execFile|execFileSync|spawnSync)\s*\(|shell\s*:\s*true/);
assert.doesNotMatch(runtime, /['"]--force(?:-with-lease)?['"]|['"]reset['"][\s\S]{0,120}['"]--hard['"]/);

const lifecycle = read('apps/local/src/lifecycle.ts');
assert.ok(lifecycle.includes('gd.local.git.ready'));
assert.ok(lifecycle.includes('gd.local.git.operation'));
const daemon = read('apps/local/src/daemon.ts');
assert.ok(daemon.includes('createGitRuntime'));
assert.ok(daemon.includes('getGitRuntimeStatus'));
const server = read('apps/local/src/server.ts');
assert.ok(server.includes('gitRuntimeReady'));
assert.doesNotMatch(server, /\/v\d+\/(?:git|repository-git|git-runtime)(?:\b|\/)/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build21-git-runtime/1',
  minimumBuild: 21,
  currentBuild: policy.currentBuild,
  workspaceScoped: true,
  shellExecution: false,
  gitWriteCapability: 'GIT_WRITE',
  networkCapability: 'NETWORK',
  forcePush: false,
  hardReset: false,
  externalTransport: false,
}, null, 2));
