import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-github-provider.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `GitHub Provider Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const contractPath = path.join(root, 'packages/github-provider/src/index.ts');
const contractOriginal = fs.readFileSync(contractPath, 'utf8');
try {
  fs.writeFileSync(contractPath, contractOriginal.replace("export const GITHUB_PROVIDER_SCHEMA = 'gd-github-provider/1' as const;", ''));
  expect('AG221');
} finally { fs.writeFileSync(contractPath, contractOriginal); }

const runtimePath = path.join(root, 'apps/local/src/github-provider.ts');
const runtimeOriginal = fs.readFileSync(runtimePath, 'utf8');
try {
  fs.writeFileSync(runtimePath, runtimeOriginal.replace("method: 'GET'", "method: 'POST'"));
  expect('AG224');
} finally { fs.writeFileSync(runtimePath, runtimeOriginal); }

try {
  fs.writeFileSync(runtimePath, `${runtimeOriginal}\nexport async function createPullRequest() { return null; }\n`);
  expect('AG226');
} finally { fs.writeFileSync(runtimePath, runtimeOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenGitHubProviderEndpoint = '/v1/github-provider/repositories';\n`);
  expect('AG227');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.githubProviderAuthority.collaborationMutation = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG229');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `GitHub Provider Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build24-github-provider-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
