import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const policy = JSON.parse(read('architecture.guardian.json'));
const contract = read('packages/github-app/src/index.ts');
const runtime = read('apps/local/src/github-app-runtime.ts');
const migrations = read('apps/local/src/database-migrations.ts');
const server = read('apps/local/src/server.ts');
const daemon = read('apps/local/src/daemon.ts');

assert.ok(policy.currentBuild >= 23);
assert.equal(policy.phaseGates.githubAppBuild, 23);
assert.equal(policy.githubAppAuthority.minimumBuild, 23);
assert.equal(policy.githubAppAuthority.githubProviderBuild, 24);
assert.equal(policy.githubAppAuthority.extensionBuild, 25);
assert.equal(policy.githubAppAuthority.installationTokenPersistence, false);
assert.equal(policy.githubAppAuthority.webhookPayloadPersistence, false);
assert.equal(policy.githubAppAuthority.providerOperations, false);
assert.match(contract, /gd-github-app\/1/);
assert.match(contract, /RS256/);
assert.match(contract, /GITHUB_WEBHOOK_SIGNATURE_ALGORITHM = 'sha256'/);
assert.doesNotMatch(contract, /node:|\bfetch\s*\(/);
assert.match(migrations, /version: 11/);
assert.match(migrations, /CREATE TABLE gd_github_app_config/);
assert.match(migrations, /CREATE TABLE gd_github_app_installations/);
assert.match(migrations, /CREATE TABLE gd_github_webhook_deliveries/);
assert.match(runtime, /createInstallationAccessToken/);
assert.match(runtime, /createAppJwt/);
assert.match(runtime, /verifyWebhook/);
assert.match(runtime, /timingSafeEqual/);
assert.match(runtime, /installationTokenPersistence: false/);
assert.match(runtime, /webhookPayloadPersistence: false/);
assert.match(daemon, /githubApp\.initialize\(\)/);
assert.doesNotMatch(server, /\/v\d+\/(?:github|github-app|installations|webhooks|installation-token)/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build23-github-app-static/1',
  build: 23,
  currentBuild: policy.currentBuild,
  schemaVersion: 11,
  contractNeutral: true,
  jwtAlgorithm: 'RS256',
  webhookAlgorithm: 'sha256',
  providerOperationsInsideGitHubApp: false,
  extensionActivation: false,
  genericHttpTransport: false,
}, null, 2));
