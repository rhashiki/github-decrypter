import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const policy = JSON.parse(read('architecture.guardian.json'));
const contract = read('packages/github-provider/src/index.ts');
const runtime = read('apps/local/src/github-provider.ts');
const daemon = read('apps/local/src/daemon.ts');
const lifecycle = read('apps/local/src/lifecycle.ts');
const server = read('apps/local/src/server.ts');
const migrations = read('apps/local/src/database-migrations.ts');

assert.equal(policy.currentBuild, 24);
assert.equal(policy.phaseGates.githubProviderBuild, 24);
assert.equal(policy.githubProviderAuthority.githubAppBuild, 23);
assert.equal(policy.githubProviderAuthority.extensionBuild, 25);
assert.deepEqual(policy.githubProviderAuthority.allowedOperations, [
  'repositories.list',
  'repository.get',
  'branches.list',
]);
assert.equal(policy.githubProviderAuthority.readOnly, true);
assert.equal(policy.githubProviderAuthority.installationScoped, true);
assert.equal(policy.githubProviderAuthority.installationTokenPersistence, false);
assert.equal(policy.githubProviderAuthority.responsePersistence, false);
assert.equal(policy.githubProviderAuthority.genericRequestApi, false);
assert.equal(policy.githubProviderAuthority.repositoryMutation, false);
assert.equal(policy.githubProviderAuthority.collaborationMutation, false);

assert.match(contract, /gd-github-provider\/1/);
assert.match(contract, /repositories\.list/);
assert.match(contract, /repository\.get/);
assert.match(contract, /branches\.list/);
assert.doesNotMatch(contract, /node:|\bfetch\s*\(|https?:\/\//);

assert.match(runtime, /class GitHubProvider/);
assert.match(runtime, /createInstallationAccessToken/);
assert.match(runtime, /listRepositories/);
assert.match(runtime, /getRepository/);
assert.match(runtime, /listBranches/);
assert.match(runtime, /method: 'GET'/);
assert.match(runtime, /capability: 'READ'/);
assert.match(runtime, /capability: 'NETWORK'/);
assert.match(runtime, /connectivity !== 'online'/);
assert.match(runtime, /installationTokenPersistence: false/);
assert.match(runtime, /responsePersistence: false/);
assert.match(runtime, /genericRequestApi: false/);
assert.match(runtime, /collaborationMutation: false/);
assert.doesNotMatch(runtime, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
assert.doesNotMatch(runtime, /\b(?:createBlob|createTree|createCommit|createBranch|updateBranch|deleteBranch|createPullRequest|createIssue|listActionsRuns)\s*\(/);
assert.doesNotMatch(runtime, /LocalDatabase|gd_github_provider|installationTokenCache/);

assert.match(daemon, /githubProvider\.initialize\(\)/);
assert.match(daemon, /githubProvider\.shutdown\(\)/);
assert.match(lifecycle, /gd\.local\.github-provider\.ready/);
assert.match(lifecycle, /gd\.local\.github-provider\.operation/);
assert.doesNotMatch(server, /\/v\d+\/(?:github-provider|github\/repositories|github\/branches|repositories)(?:\b|\/)/i);
assert.doesNotMatch(migrations, /gd_github_provider/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build24-github-provider-static/1',
  build: 24,
  databaseSchemaUnchanged: 11,
  readOnly: true,
  installationScoped: true,
  operations: policy.githubProviderAuthority.allowedOperations,
  installationTokenPersistence: false,
  responsePersistence: false,
  genericRequestApi: false,
  repositoryMutation: false,
  collaborationMutation: false,
  genericHttpTransport: false,
}, null, 2));
