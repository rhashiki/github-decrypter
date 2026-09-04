import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspaceContract = fs.readFileSync('packages/workspace/src/index.ts', 'utf8');
const manager = fs.readFileSync('apps/local/src/workspace-manager.ts', 'utf8');
const migrations = fs.readFileSync('apps/local/src/database-migrations.ts', 'utf8');
const lifecycle = fs.readFileSync('apps/local/src/lifecycle.ts', 'utf8');
const daemon = fs.readFileSync('apps/local/src/daemon.ts', 'utf8');
const server = fs.readFileSync('apps/local/src/server.ts', 'utf8');
const guardian = JSON.parse(fs.readFileSync('architecture.guardian.json', 'utf8'));

assert.ok(guardian.currentBuild >= 19, 'Architecture Guardian must not regress below Build 19');
assert.equal(guardian.workspaceAuthority.ownerRoot, 'apps/local');
assert.equal(guardian.workspaceAuthority.contractPackage, '@github-decrypter/workspace');
assert.equal(guardian.workspaceAuthority.projectDetectionBuild, 20);
assert.equal(guardian.workspaceAuthority.gitRuntimeBuild, 21);
assert.equal(guardian.workspaceAuthority.multiWorkspaceBuild, 114);
assert.equal(guardian.workspaceAuthority.filesystemMutation, false);
assert.equal(guardian.workspaceAuthority.externalTransport, false);

for (const marker of ["WORKSPACE_SCHEMA = 'gd-workspace/1'", 'WorkspaceDescriptor', 'WorkspaceId', 'asWorkspaceId']) {
  assert.ok(workspaceContract.includes(marker), `missing workspace contract marker: ${marker}`);
}
for (const marker of ['CREATE TABLE gd_workspaces', 'MIGRATION_009_SQL', "name: 'workspace-manager'", 'version: 9']) {
  assert.ok(migrations.includes(marker), `missing migration marker: ${marker}`);
}
for (const marker of ['class WorkspaceManager', 'realpathSync', 'resolveExistingPath', 'filesystemMutation: false', 'externalTransport: false']) {
  assert.ok(manager.includes(marker), `missing manager marker: ${marker}`);
}
for (const marker of ['gd.local.workspace.ready', 'gd.local.workspace.registered', 'gd.local.workspace.opened', 'gd.local.workspace.unregistered']) {
  assert.ok(lifecycle.includes(marker), `missing event marker: ${marker}`);
}
assert.ok(daemon.includes('createWorkspaceManager'));
assert.ok(daemon.includes('getWorkspaceManagerStatus'));
assert.ok(server.includes('workspaceManagerReady'));
assert.ok(server.includes('registeredWorkspaces'));
assert.ok(server.includes('availableWorkspaces'));
assert.doesNotMatch(server, /\/v\d+\/(?:workspace|workspaces)(?:\b|\/)/i);
assert.doesNotMatch(manager, /\b(?:writeFile|appendFile|rmSync|unlink|mkdir|rename|copyFile|truncate|spawn|execFile|child_process)\b/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build19-workspace-manager/1',
  minimumBuild: 19,
  currentBuild: guardian.currentBuild,
  databaseSchema: 9,
  canonicalRoot: guardian.workspaceAuthority.canonicalRoot,
  pathContainment: guardian.workspaceAuthority.pathContainment,
  filesystemMutation: false,
  externalTransport: false,
}, null, 2));
