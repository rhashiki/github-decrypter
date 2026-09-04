import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.githubProviderAuthority;
const violations = [];

function read(relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

if (!rule || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/github-provider' || rule.minimumBuild !== 24) {
  violations.push({ code: 'AG220', message: 'GitHub Provider authority policy is missing or invalid.' });
} else {
  const contract = read('packages/github-provider/src/index.ts');
  for (const marker of [
    "GITHUB_PROVIDER_SCHEMA = 'gd-github-provider/1'",
    "'repositories.list'",
    "'repository.get'",
    "'branches.list'",
    'GitHubRepositorySummary',
    'GitHubRepositoriesPage',
    'GitHubBranchesPage',
  ]) {
    if (!contract.includes(marker)) violations.push({ code: 'AG221', message: 'GitHub Provider contract invariant missing.', detail: marker });
  }
  if (/node:|\bfetch\s*\(|https?:\/\/|\bwindow\.|\bdocument\.|\bchrome\./.test(contract)) {
    violations.push({ code: 'AG221', message: 'GitHub Provider contract stopped being environment-neutral.' });
  }

  const runtime = read('apps/local/src/github-provider.ts');
  for (const marker of [
    'class GitHubProvider',
    'GITHUB_PROVIDER_INSTALLATIONS_RESOURCE',
    "capability: 'READ'",
    "capability: 'NETWORK'",
    "connectivity !== 'online'",
    'listRepositories',
    'getRepository',
    'listBranches',
    "method: 'GET'",
    'readOnly: true',
    'installationScoped: true',
    'installationTokenPersistence: false',
    'responsePersistence: false',
    'genericRequestApi: false',
    'collaborationMutation: false',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG222', message: 'GitHub Provider runtime invariant missing.', detail: marker });
  }

  for (const marker of [
    'this.#githubApp.listInstallations',
    "installation.state !== 'active'",
    'this.#githubApp.createInstallationAccessToken',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG223', message: 'GitHub Provider installation authority invariant missing.', detail: marker });
  }
  if (/installationTokenCache|new\s+Map\s*\([^)]*token|token\s*:\s*installationToken/.test(runtime)) {
    violations.push({ code: 'AG223', message: 'GitHub Provider may not cache installation access tokens.' });
  }

  if (!runtime.includes("method: 'GET'") || /method:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/.test(runtime)) {
    violations.push({ code: 'AG224', message: 'Build 24 GitHub Provider transport must remain GET-only.' });
  }
  for (const marker of [
    '/installation/repositories?per_page=',
    '/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}',
    '/branches?per_page=',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG224', message: 'GitHub Provider allowed read endpoint is missing.', detail: marker });
  }

  if (/LocalDatabase|gd_github_provider|INSERT\s+INTO|UPDATE\s+gd_|DELETE\s+FROM|CREATE\s+TABLE/.test(runtime)) {
    violations.push({ code: 'AG225', message: 'Build 24 GitHub Provider must not own response/cache persistence.' });
  }
  const migrations = read('apps/local/src/database-migrations.ts');
  if (/gd_github_provider/i.test(migrations)) {
    violations.push({ code: 'AG225', message: 'Build 24 must not add GitHub Provider cache tables.' });
  }

  if (/\b(?:createBlob|createTree|createCommit|createBranch|updateBranch|deleteBranch|createPullRequest|pushCommit|createIssue|listActionsRuns)\s*\(/.test(runtime)) {
    violations.push({ code: 'AG226', message: 'GitHub mutation/collaboration authority arrived before its owning Builds.' });
  }
  if (/\/(?:git\/blobs|git\/trees|git\/commits|git\/refs|pulls|issues|actions\/runs)(?:\b|\/)/.test(runtime)) {
    violations.push({ code: 'AG226', message: 'GitHub mutation/collaboration endpoints arrived before their owning Builds.' });
  }
  if (/\basync\s+(?:request|rawRequest|apiRequest)\s*\(/.test(runtime)) {
    violations.push({ code: 'AG226', message: 'Build 24 may not expose a generic GitHub request API.' });
  }

  const server = read('apps/local/src/server.ts');
  if (/\/v\d+\/(?:github-provider|github\/repositories|github\/branches|repositories)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG227', message: 'GitHub Provider HTTP/RPC transport arrived before an owning phase.' });
  }

  const daemon = read('apps/local/src/daemon.ts');
  for (const marker of ['createGitHubProvider', 'githubProvider.initialize()', 'githubProvider.shutdown()', 'get githubProvider()']) {
    if (!daemon.includes(marker)) violations.push({ code: 'AG228', message: 'GitHub Provider daemon integration invariant missing.', detail: marker });
  }
  const lifecycle = read('apps/local/src/lifecycle.ts');
  for (const marker of ['gd.local.github-provider.ready', 'gd.local.github-provider.operation']) {
    if (!lifecycle.includes(marker)) violations.push({ code: 'AG228', message: 'GitHub Provider lifecycle event invariant missing.', detail: marker });
  }

  const expectedOperations = ['repositories.list', 'repository.get', 'branches.list'];
  if (
    rule.githubAppBuild !== 23
    || rule.extensionBuild !== 25
    || rule.repositoryLauncherBuild !== 26
    || rule.commitWorkflowBuild !== 109
    || rule.pushWorkflowBuild !== 110
    || rule.pullRequestWorkflowBuild !== 111
    || rule.checksActionsBuild !== 112
    || rule.issuesIntegrationBuild !== 113
    || rule.readCapability !== 'READ'
    || rule.networkCapability !== 'NETWORK'
    || rule.installationScoped !== true
    || rule.installationTokenSource !== 'github-app-runtime'
    || JSON.stringify(rule.allowedOperations) !== JSON.stringify(expectedOperations)
    || rule.readOnly !== true
    || rule.installationTokenPersistence !== false
    || rule.responsePersistence !== false
    || rule.genericRequestApi !== false
    || rule.genericHttpTransport !== false
    || rule.repositoryMutation !== false
    || rule.collaborationMutation !== false
    || policy.phaseGates.githubProviderBuild !== 24
  ) {
    violations.push({ code: 'AG229', message: 'GitHub Provider machine-readable boundaries were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const required of [
      'packages/github-provider/package.json',
      'packages/github-provider/src/index.ts',
      'apps/local/src/github-provider.ts',
      'docs/architecture/GITHUB_PROVIDER.md',
      'docs/builds/BUILD_24_GITHUB_PROVIDER.md',
      'scripts/test-build24-github-provider.mjs',
      'scripts/test-build24-github-provider-runtime.ts',
      'scripts/test-build24-github-provider-guardian-negative.mjs',
      'scripts/tsconfig.build24-tests.json',
      '.github/workflows/build24-github-provider.yml',
    ]) {
      if (!fs.existsSync(path.join(root, required))) violations.push({ code: 'AG229', message: 'Required Build 24 artifact is missing.', detail: required });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-github-provider-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  contractPackage: rule?.contractPackage ?? null,
  allowedOperations: rule?.allowedOperations ?? null,
  readOnly: rule?.readOnly ?? null,
  installationScoped: rule?.installationScoped ?? null,
  responsePersistence: rule?.responsePersistence ?? null,
  genericRequestApi: rule?.genericRequestApi ?? null,
  repositoryMutation: rule?.repositoryMutation ?? null,
  collaborationMutation: rule?.collaborationMutation ?? null,
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
