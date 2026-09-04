import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.offlineAuthority;
const violations = [];

function walk(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(absolute);
    }
  }
  return files.sort();
}

if (!rule || typeof rule.ownerRoot !== 'string' || !Number.isSafeInteger(rule.minimumBuild)) {
  violations.push({ code: 'AG120', message: 'Offline Execution authority policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot.replace(/\/$/, '')}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_(?:connectivity_state|connectivity_events|job_network_requirements)\b/.test(source)
      && !relative.startsWith(ownerPrefix)) {
      violations.push({
        code: 'AG121',
        message: 'Offline/connectivity persistence authority escaped apps/local.',
        detail: relative,
      });
    }
  }

  if (rule.automaticNetworkProbe !== false) {
    violations.push({
      code: 'AG122',
      message: 'Build 14 must keep automatic outbound network probing disabled.',
      detail: 'architecture.guardian.json',
    });
  }

  const githubAppRule = policy.githubAppAuthority;
  const githubAppNetworkAuthorized = Boolean(
    githubAppRule
    && policy.currentBuild >= githubAppRule.minimumBuild
    && Number.isSafeInteger(rule.githubAppNetworkBuild)
    && rule.githubAppNetworkBuild === githubAppRule.minimumBuild,
  );
  const githubAppRuntimePath = githubAppNetworkAuthorized
    ? `${githubAppRule.ownerRoot}/src/github-app-runtime.ts`
    : null;

  for (const absolute of walk(`${rule.ownerRoot}/src`)) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    const gitRuntimePath = policy.gitRuntimeAuthority
      && policy.currentBuild >= policy.gitRuntimeAuthority.minimumBuild
      ? `${policy.gitRuntimeAuthority.ownerRoot}/src/git-runtime.ts`
      : null;
    let probeSource = relative === gitRuntimePath
      ? source.replace(/\basync\s+fetch\s*\(/, 'async __git_fetch_method__(')
      : source;

    if (relative === githubAppRuntimePath) {
      const hasExplicitOnlineGate = source.includes("connectivity !== 'online'");
      const hasNetworkCapabilityGate = source.includes("capability: 'NETWORK'");
      const hasInstallationTokenBoundary = source.includes('createInstallationAccessToken');
      if (hasExplicitOnlineGate && hasNetworkCapabilityGate && hasInstallationTokenBoundary) {
        probeSource = probeSource.replaceAll('this.#fetch(', '__authorized_github_app_request__(');
      }
    }

    if (/\bfetch\s*\(|\bhttps?\.(?:request|get)\s*\(|\bnet\.connect\s*\(|\btls\.connect\s*\(|\bdns\.(?:lookup|resolve|promises)\b/.test(probeSource)) {
      violations.push({
        code: 'AG122',
        message: 'Automatic/outbound network probing is not authorized by Build 14.',
        detail: relative,
      });
    }
  }

  if (policy.currentBuild >= (policy.githubAppAuthority?.minimumBuild ?? Number.POSITIVE_INFINITY)
    && rule.githubAppNetworkBuild !== policy.githubAppAuthority.minimumBuild) {
    violations.push({
      code: 'AG122',
      message: 'GitHub App network authority must remain pinned to its owning build.',
      detail: 'architecture.guardian.json',
    });
  }

  if (policy.currentBuild < rule.capabilitySecurityBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/CapabilityGrant|capabilityToken|authorizeCapability|CAPABILITY_[A-Z_]+/.test(source)) {
        violations.push({
          code: 'AG123',
          message: `Capability Security authority arrived before Build ${rule.capabilitySecurityBuild}.`,
          detail: relative,
        });
      }
    }
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relative of [
      `${rule.ownerRoot}/src/offline-execution.ts`,
      'docs/architecture/OFFLINE_EXECUTION.md',
      'docs/builds/BUILD_14_OFFLINE_EXECUTION.md',
    ]) {
      if (!fs.existsSync(path.join(root, relative))) {
        violations.push({ code: 'AG124', message: 'Offline Execution authority artifact is missing.', detail: relative });
      }
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-offline-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  capabilitySecurityBuild: rule?.capabilitySecurityBuild ?? null,
  githubAppNetworkBuild: rule?.githubAppNetworkBuild ?? null,
  automaticNetworkProbe: rule?.automaticNetworkProbe ?? null,
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
