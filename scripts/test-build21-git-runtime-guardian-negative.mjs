import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-git-runtime.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Git Runtime Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const contractPath = path.join(root, 'packages/git/src/index.ts');
const contractOriginal = fs.readFileSync(contractPath, 'utf8');
try {
  fs.writeFileSync(contractPath, contractOriginal.replace("export const GIT_RUNTIME_SCHEMA = 'gd-git-runtime/1' as const;", ''));
  expect('AG191');
} finally { fs.writeFileSync(contractPath, contractOriginal); }

const runtimePath = path.join(root, 'apps/local/src/git-runtime.ts');
const runtimeOriginal = fs.readFileSync(runtimePath, 'utf8');
try {
  fs.writeFileSync(runtimePath, runtimeOriginal.replace('shell: false,', 'shell: true,'));
  expect('AG193');
} finally { fs.writeFileSync(runtimePath, runtimeOriginal); }

try {
  fs.writeFileSync(runtimePath, runtimeOriginal.replace('async commit(', 'async commitWithoutAuthorization('));
  expect('AG194');
} finally { fs.writeFileSync(runtimePath, runtimeOriginal); }

try {
  fs.writeFileSync(runtimePath, runtimeOriginal.replace("if (network && this.#offline.status().connectivity !== 'online')", 'if (false)'));
  expect('AG195');
} finally { fs.writeFileSync(runtimePath, runtimeOriginal); }

try {
  fs.writeFileSync(runtimePath, `${runtimeOriginal}\nexport const forbiddenForcePush = '--force';\n`);
  expect('AG196');
} finally { fs.writeFileSync(runtimePath, runtimeOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenGitEndpoint = '/v1/git';\n`);
  expect('AG197');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const daemonPath = path.join(root, 'apps/local/src/daemon.ts');
const daemonOriginal = fs.readFileSync(daemonPath, 'utf8');
try {
  fs.writeFileSync(daemonPath, daemonOriginal.replace('getGitRuntimeStatus', 'getPrematureGitRuntimeStatus'));
  expect('AG198');
} finally { fs.writeFileSync(daemonPath, daemonOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.gitRuntimeAuthority.forcePush = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG199');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Git Runtime Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build21-git-runtime-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
