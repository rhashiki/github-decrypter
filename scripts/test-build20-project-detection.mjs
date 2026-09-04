import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));

for (const file of [
  'apps/local/src/project-detector.ts',
  'scripts/architecture-guardian-project-detection.mjs',
  'scripts/test-build20-project-detection-runtime.ts',
  'scripts/test-build20-project-detection-guardian-negative.mjs',
  'docs/architecture/PROJECT_DETECTION.md',
  'docs/builds/BUILD_20_PROJECT_DETECTION.md',
]) {
  assert.ok(fs.existsSync(file), `Build 20 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const versionMatch = String(rootPackage.version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
assert.ok(versionMatch, 'root version must remain numeric semver');
const [, major, minor, patch] = versionMatch.map(Number);
assert.ok(major > 0 || minor > 0 || patch >= 20, 'root version must not regress below Build 20');
assert.ok(rootPackage.scripts?.['check:build20'], 'Build 20 regression command is required');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-project-detection.mjs'));

const policy = json('architecture.guardian.json');
assert.ok(policy.currentBuild >= 20, 'Architecture Guardian must not regress below Build 20');
assert.equal(policy.phaseGates.projectDetectionBuild, 20);
const rule = policy.projectDetectionAuthority;
assert.equal(rule.ownerRoot, 'apps/local');
assert.equal(rule.contractPackage, '@github-decrypter/workspace');
assert.equal(rule.workspaceManagerBuild, 19);
assert.equal(rule.gitRuntimeBuild, 21);
assert.equal(rule.rootOnly, true);
assert.equal(rule.readOnly, true);
assert.equal(rule.filesystemMutation, false);
assert.equal(rule.networkAccess, false);
assert.equal(rule.gitAuthority, false);
assert.equal(rule.externalTransport, false);
assert.equal(rule.maxPackageJsonBytes, 1048576);

const contract = read('packages/workspace/src/index.ts');
for (const marker of ["PROJECT_DETECTION_SCHEMA = 'gd-project-detection/1'", 'ProjectDetectionResult', 'ProjectPackageManager', 'ProjectFramework', 'ProjectDetectionConfidence']) {
  assert.ok(contract.includes(marker), `missing detection contract marker: ${marker}`);
}

const detector = read('apps/local/src/project-detector.ts');
for (const marker of ['class ProjectDetector', 'MAX_PACKAGE_JSON_BYTES', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock', "framework: 'next'", "framework: 'astro'", "framework: 'react'", "framework: 'vue'", "framework: 'svelte'", "framework: 'vite'", "framework: 'vanilla'", 'readOnly: true', 'filesystemMutation: false', 'networkAccess: false', 'gitAuthority: false', 'externalTransport: false']) {
  assert.ok(detector.includes(marker), `missing Project Detector marker: ${marker}`);
}
assert.doesNotMatch(detector, /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|unlinkSync|mkdirSync|renameSync|copyFileSync|truncateSync|spawnSync|spawn|execSync|execFile|child_process)\b/);
assert.doesNotMatch(detector, /node:(?:http|https|net|tls|dgram)|\bfetch\s*\(/);
assert.doesNotMatch(detector, /\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\b/);

const lifecycle = read('apps/local/src/lifecycle.ts');
assert.ok(lifecycle.includes('gd.local.project-detection.ready'));
assert.ok(lifecycle.includes('gd.local.project.detected'));
const daemon = read('apps/local/src/daemon.ts');
assert.ok(daemon.includes('createProjectDetector'));
assert.ok(daemon.includes('getProjectDetectionStatus'));
const server = read('apps/local/src/server.ts');
assert.ok(server.includes('projectDetectionReady'));
assert.doesNotMatch(server, /\/v\d+\/(?:project(?:-detection)?|detect-project|detection)(?:\b|\/)/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build20-project-detection/1',
  minimumBuild: 20,
  currentBuild: policy.currentBuild,
  packageManagers: ['pnpm', 'npm', 'yarn', 'bun', 'unknown'],
  frameworks: ['next', 'astro', 'react', 'vue', 'svelte', 'vite', 'vanilla', 'unknown'],
  rootOnly: true,
  readOnly: true,
  filesystemMutation: false,
  networkAccess: false,
  gitAuthority: false,
  externalTransport: false,
}, null, 2));
