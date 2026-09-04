import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-workspace.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Workspace Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const contractPath = path.join(root, 'packages/workspace/src/index.ts');
const contractOriginal = fs.readFileSync(contractPath, 'utf8');
try {
  fs.writeFileSync(contractPath, `${contractOriginal}\nexport const forbiddenFs = 'node:fs';\n`);
  expect('AG171');
} finally { fs.writeFileSync(contractPath, contractOriginal); }

const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationOriginal = fs.readFileSync(migrationPath, 'utf8');
try {
  fs.writeFileSync(migrationPath, migrationOriginal.replace('CREATE TABLE gd_workspaces', 'CREATE TABLE gd_workspace_registry'));
  expect('AG172');
} finally { fs.writeFileSync(migrationPath, migrationOriginal); }

const managerPath = path.join(root, 'apps/local/src/workspace-manager.ts');
const managerOriginal = fs.readFileSync(managerPath, 'utf8');
try {
  fs.writeFileSync(managerPath, managerOriginal.replaceAll('realpathSync', 'canonicalizePath'));
  expect('AG173');
} finally { fs.writeFileSync(managerPath, managerOriginal); }

try {
  fs.writeFileSync(managerPath, `${managerOriginal}\nexport const forbiddenMutation = 'writeFile';\n`);
  expect('AG174');
} finally { fs.writeFileSync(managerPath, managerOriginal); }

const studioProbe = path.join(root, 'apps/studio/src/__workspace_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const table = 'gd_workspaces';\n");
  expect('AG175');
} finally { fs.rmSync(studioProbe, { force: true }); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenWorkspaceEndpoint = '/v1/workspaces';\n`);
  expect('AG176');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.workspaceAuthority.filesystemMutation = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG179');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Workspace Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build19-workspace-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
