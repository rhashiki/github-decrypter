import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-github-app.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `GitHub App Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const contractPath = path.join(root, 'packages/github-app/src/index.ts');
const contractOriginal = fs.readFileSync(contractPath, 'utf8');
try {
  fs.writeFileSync(contractPath, contractOriginal.replace("export const GITHUB_APP_SCHEMA = 'gd-github-app/1' as const;", ''));
  expect('AG211');
} finally { fs.writeFileSync(contractPath, contractOriginal); }

const migrationsPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationsOriginal = fs.readFileSync(migrationsPath, 'utf8');
try {
  fs.writeFileSync(migrationsPath, migrationsOriginal.replace(
    'CREATE TABLE gd_github_app_config (',
    'CREATE TABLE gd_github_app_config (\n  access_token TEXT,',
  ));
  expect('AG212');
} finally { fs.writeFileSync(migrationsPath, migrationsOriginal); }

const runtimePath = path.join(root, 'apps/local/src/github-app-runtime.ts');
const runtimeOriginal = fs.readFileSync(runtimePath, 'utf8');
try {
  fs.writeFileSync(runtimePath, runtimeOriginal.replaceAll('installationTokenPersistence: false', 'installationTokenPersistence: true'));
  expect('AG215');
} finally { fs.writeFileSync(runtimePath, runtimeOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenGitHubAppEndpoint = '/v1/github-app/installations';\n`);
  expect('AG217');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.githubAppAuthority.providerOperations = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG219');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `GitHub App Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build23-github-app-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
