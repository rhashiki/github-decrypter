import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.githubAppAuthority;
const violations = [];

function read(relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

if (!rule || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/github-app' || rule.minimumBuild !== 23) {
  violations.push({ code: 'AG210', message: 'GitHub App authority policy is missing or invalid.' });
} else {
  const contract = read('packages/github-app/src/index.ts');
  for (const marker of [
    "GITHUB_APP_SCHEMA = 'gd-github-app/1'",
    "GITHUB_APP_JWT_ALGORITHM = 'RS256'",
    "GITHUB_WEBHOOK_SIGNATURE_ALGORITHM = 'sha256'",
    'GitHubAppConfigurationRecord',
    'GitHubAppInstallationRecord',
    'GitHubInstallationAccessToken',
    'GitHubWebhookVerification',
    'persistable: false',
  ]) {
    if (!contract.includes(marker)) violations.push({ code: 'AG211', message: 'GitHub App contract invariant missing.', detail: marker });
  }
  if (/node:|\bfetch\s*\(|\bwindow\.|\bdocument\.|\bchrome\./.test(contract)) {
    violations.push({ code: 'AG211', message: 'GitHub App contract stopped being environment-neutral.' });
  }

  const migrations = read('apps/local/src/database-migrations.ts');
  for (const marker of [
    'const MIGRATION_011_SQL',
    'CREATE TABLE gd_github_app_config',
    'CREATE TABLE gd_github_app_installations',
    'CREATE TABLE gd_github_webhook_deliveries',
    "name: 'github-app'",
    'version: 11',
  ]) {
    if (!migrations.includes(marker)) violations.push({ code: 'AG212', message: 'GitHub App schema invariant missing.', detail: marker });
  }
  const schemaStart = migrations.indexOf('const MIGRATION_011_SQL');
  const schemaEnd = migrations.indexOf('function checksum', schemaStart);
  const schema = schemaStart >= 0 && schemaEnd > schemaStart ? migrations.slice(schemaStart, schemaEnd) : '';
  if (/\b(?:private_key|webhook_secret|access_token|installation_token|jwt|payload|raw_body|body)\s+(?:TEXT|BLOB)\b/i.test(schema)) {
    violations.push({ code: 'AG212', message: 'GitHub App schema may not persist secrets, installation tokens, JWTs or webhook payloads.' });
  }

  const runtime = read('apps/local/src/github-app-runtime.ts');
  for (const marker of [
    'class GitHubAppRuntime',
    'GITHUB_APP_PRIVATE_KEY_RESOURCE',
    'GITHUB_APP_WEBHOOK_SECRET_RESOURCE',
    "capability: 'NETWORK'",
    "capability: 'DATABASE_WRITE'",
    "capability: 'READ'",
    'this.#vault.readSecret',
    'this.#vault.putSecret',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG213', message: 'GitHub App capability/Vault invariant missing.', detail: marker });
  }
  const vault = read('apps/local/src/secrets-vault.ts');
  if (!vault.includes("requirements: [{ capability: 'SECRETS', resource }]")) {
    violations.push({ code: 'AG213', message: 'Secrets Vault no longer enforces SECRETS capability for GitHub App secret access.' });
  }

  for (const marker of [
    "createSign('RSA-SHA256')",
    "alg: GITHUB_APP_JWT_ALGORITHM",
    'issuedAtSeconds = nowSeconds - 60',
    'expiresAtSeconds = nowSeconds + 540',
    'persistable: false',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG214', message: 'GitHub App JWT invariant missing.', detail: marker });
  }

  for (const marker of [
    'createInstallationAccessToken',
    "connectivity !== 'online'",
    '/app/installations/${installationId}/access_tokens',
    'installationTokenPersistence: false',
    'expiresMs > nowMs + 3_700_000',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG215', message: 'GitHub installation token invariant missing.', detail: marker });
  }
  if (/INSERT[^;]*(?:access_token|installation_token|jwt)/is.test(runtime)) {
    violations.push({ code: 'AG215', message: 'Installation token/JWT persistence is forbidden.' });
  }

  for (const marker of [
    'verifyWebhook',
    "createHmac('sha256', secret)",
    'timingSafeEqual',
    'rawBody',
    'INSERT OR IGNORE INTO gd_github_webhook_deliveries',
    'payloadPersistence: false',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG216', message: 'GitHub webhook verification invariant missing.', detail: marker });
  }
  if (/gd_github_webhook_deliveries[\s\S]{0,600}\b(?:payload|body|content)\b/i.test(schema)) {
    violations.push({ code: 'AG216', message: 'Webhook replay metadata table may not persist payload/body content.' });
  }

  const server = read('apps/local/src/server.ts');
  if (/\/v\d+\/(?:github|github-app|installations|webhooks|installation-token|repositories|pulls|issues)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG217', message: 'Generic GitHub HTTP/RPC surface arrived before its owning build.' });
  }
  if (/\b(?:listRepositories|getRepository|createPullRequest|pushCommit|createIssue)\s*\(/.test(runtime)) {
    violations.push({ code: 'AG217', message: 'GitHub Provider operations arrived before Build 24.' });
  }

  const daemon = read('apps/local/src/daemon.ts');
  for (const marker of ['createGitHubAppRuntime', 'githubApp.initialize()', 'githubApp.shutdown()', 'get githubApp()']) {
    if (!daemon.includes(marker)) violations.push({ code: 'AG218', message: 'GitHub App daemon integration invariant missing.', detail: marker });
  }
  const lifecycle = read('apps/local/src/lifecycle.ts');
  for (const marker of [
    'gd.local.github-app.ready',
    'gd.local.github-app.configured',
    'gd.local.github-app.installation.changed',
    'gd.local.github-app.installation-token.created',
    'gd.local.github-app.webhook.verified',
  ]) {
    if (!lifecycle.includes(marker)) violations.push({ code: 'AG218', message: 'GitHub App lifecycle event invariant missing.', detail: marker });
  }

  if (
    rule.gitRuntimeBuild !== 21
    || rule.changeTrackingBuild !== 22
    || rule.githubProviderBuild !== 24
    || rule.extensionBuild !== 25
    || rule.commitWorkflowBuild !== 109
    || rule.jwtAlgorithm !== 'RS256'
    || rule.jwtMaxTtlSeconds !== 600
    || rule.webhookSignatureAlgorithm !== 'sha256'
    || rule.webhookRawBodyVerification !== true
    || rule.privateKeyStorage !== 'secrets-vault'
    || rule.webhookSecretStorage !== 'secrets-vault'
    || rule.installationTokenPersistence !== false
    || rule.webhookPayloadPersistence !== false
    || rule.deliveryReplayMetadataOnly !== true
    || rule.installationTokenExchange !== true
    || rule.providerOperations !== false
    || rule.genericHttpTransport !== false
    || policy.phaseGates.githubAppBuild !== 23
  ) {
    violations.push({ code: 'AG219', message: 'GitHub App machine-readable boundaries were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const required of [
      'packages/github-app/package.json',
      'packages/github-app/src/index.ts',
      'apps/local/src/github-app-runtime.ts',
      'docs/builds/BUILD_23_GITHUB_APP.md',
      'scripts/test-build23-github-app.mjs',
      'scripts/test-build23-github-app-runtime.ts',
      'scripts/test-build23-github-app-guardian-negative.mjs',
      'scripts/tsconfig.build23-tests.json',
      '.github/workflows/build23-github-app.yml',
    ]) {
      if (!fs.existsSync(path.join(root, required))) violations.push({ code: 'AG219', message: 'Required Build 23 artifact is missing.', detail: required });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-github-app-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  contractPackage: rule?.contractPackage ?? null,
  jwtAlgorithm: rule?.jwtAlgorithm ?? null,
  installationTokenPersistence: rule?.installationTokenPersistence ?? null,
  webhookPayloadPersistence: rule?.webhookPayloadPersistence ?? null,
  providerOperations: rule?.providerOperations ?? null,
  genericHttpTransport: rule?.genericHttpTransport ?? null,
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
