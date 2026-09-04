import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.gitRuntimeAuthority;
const violations = [];

function read(relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

if (!rule || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/git' || rule.minimumBuild !== 21) {
  violations.push({ code: 'AG190', message: 'Git Runtime policy is missing or invalid.' });
} else {
  const contract = read('packages/git/src/index.ts');
  for (const marker of [
    "GIT_RUNTIME_SCHEMA = 'gd-git-runtime/1'",
    'GitStatusSnapshot',
    'GitLogResult',
    'GitBranchesResult',
    'GitMutationResult',
  ]) {
    if (!contract.includes(marker)) violations.push({ code: 'AG191', message: 'Git Runtime contract invariant missing.', detail: marker });
  }
  if (/node:(?:fs|path|child_process|os|http|https|net|tls)|\bwindow\.|\bdocument\.|\bchrome\./.test(contract)) {
    violations.push({ code: 'AG191', message: 'Git Runtime contract stopped being environment-neutral.' });
  }

  const runtimePath = `${rule.ownerRoot}/src/git-runtime.ts`;
  const runtime = read(runtimePath);
  for (const marker of [
    'class GitRuntime',
    "spawn('git'",
    'shell: false',
    "GIT_TERMINAL_PROMPT: '0'",
    'gitWorkspaceResource',
    "capability: 'GIT_WRITE'",
    "capability: 'NETWORK'",
    'resolveExistingPath',
    "['pull', '--ff-only'",
    'assertSafeRemoteUrl',
    'may not embed credentials',
    'forcePush: false',
    'hardReset: false',
    'externalTransport: false',
  ]) {
    if (!runtime.includes(marker)) violations.push({ code: 'AG192', message: 'Git Runtime implementation invariant missing.', detail: marker });
  }

  if (/\b(?:exec|execSync|execFile|execFileSync|spawnSync)\s*\(|shell\s*:\s*true/.test(runtime)) {
    violations.push({ code: 'AG193', message: 'Git Runtime may not execute Git through a shell or generic exec primitive.' });
  }

  for (const method of ['clone', 'fetch', 'pull', 'checkout', 'createBranch', 'commit', 'push', 'stashPush', 'stashPop', 'restore']) {
    const start = runtime.indexOf(`async ${method}(`);
    if (start < 0) {
      violations.push({ code: 'AG194', message: 'Required Git mutation method is missing.', detail: method });
      continue;
    }
    const fragment = runtime.slice(start, start + 3_500);
    if (!fragment.includes('#authorizeMutation')) {
      violations.push({ code: 'AG194', message: 'Git mutation bypasses capability authorization.', detail: method });
    }
  }

  for (const method of ['clone', 'fetch', 'pull', 'push']) {
    const start = runtime.indexOf(`async ${method}(`);
    const fragment = start >= 0 ? runtime.slice(start, start + 3_500) : '';
    if (!fragment.includes('#authorizeMutation(workspaceId, authorization, true)') || !fragment.includes('network: true')) {
      violations.push({ code: 'AG195', message: 'Network Git mutation is not explicitly network-gated.', detail: method });
    }
  }
  if (!runtime.includes("this.#offline.status().connectivity !== 'online'")) {
    violations.push({ code: 'AG195', message: 'Git network operations must fail closed unless Offline Execution reports online.' });
  }

  if (/['"]--force(?:-with-lease)?['"]|['"]reset['"][\s\S]{0,120}['"]--hard['"]|['"]branch['"][\s\S]{0,80}['"]-D['"]/.test(runtime)) {
    violations.push({ code: 'AG196', message: 'Build 21 may not introduce force push, hard reset or forced branch deletion.' });
  }

  const server = read(`${rule.ownerRoot}/src/server.ts`);
  if (/\/v\d+\/(?:git|repository-git|git-runtime)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG197', message: 'Git Runtime HTTP/RPC control transport arrived before an owning transport phase.' });
  }

  const daemon = read(`${rule.ownerRoot}/src/daemon.ts`);
  for (const marker of ['createGitRuntime', 'git.initialize()', 'getGitRuntimeStatus', 'git.shutdown()']) {
    if (!daemon.includes(marker)) violations.push({ code: 'AG198', message: 'Git Runtime daemon integration invariant missing.', detail: marker });
  }
  const lifecycle = read(`${rule.ownerRoot}/src/lifecycle.ts`);
  for (const marker of ['gd.local.git.ready', 'gd.local.git.operation']) {
    if (!lifecycle.includes(marker)) violations.push({ code: 'AG198', message: 'Git Runtime event invariant missing.', detail: marker });
  }

  if (
    rule.workspaceManagerBuild !== 19
    || rule.projectDetectionBuild !== 20
    || rule.changeTrackingBuild !== 22
    || rule.githubAppBuild !== 23
    || rule.commitWorkflowBuild !== 109
    || rule.pushWorkflowBuild !== 110
    || rule.gitWriteCapability !== 'GIT_WRITE'
    || rule.networkCapability !== 'NETWORK'
    || rule.denyByDefault !== true
    || rule.workspaceScoped !== true
    || rule.shellExecution !== false
    || rule.forcePush !== false
    || rule.hardReset !== false
    || rule.embeddedRemoteCredentials !== false
    || rule.externalTransport !== false
  ) {
    violations.push({ code: 'AG199', message: 'Git Runtime machine-readable invariants were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relativeName of [
      runtimePath,
      'docs/architecture/GIT_RUNTIME.md',
      'docs/builds/BUILD_21_GIT_RUNTIME.md',
      'scripts/test-build21-git-runtime.mjs',
      'scripts/test-build21-git-runtime-runtime.ts',
      'scripts/test-build21-git-runtime-guardian-negative.mjs',
    ]) {
      if (!fs.existsSync(path.join(root, relativeName))) violations.push({ code: 'AG199', message: 'Required Build 21 artifact is missing.', detail: relativeName });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-git-runtime-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  contractPackage: rule?.contractPackage ?? null,
  gitWriteCapability: rule?.gitWriteCapability ?? null,
  networkCapability: rule?.networkCapability ?? null,
  workspaceScoped: rule?.workspaceScoped ?? null,
  shellExecution: rule?.shellExecution ?? null,
  forcePush: rule?.forcePush ?? null,
  hardReset: rule?.hardReset ?? null,
  externalTransport: rule?.externalTransport ?? null,
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
