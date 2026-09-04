import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.workspaceAuthority;
const violations = [];

function read(relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

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
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) files.push(absolute);
    }
  }
  return files.sort();
}

if (!rule || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/workspace' || rule.minimumBuild !== 19) {
  violations.push({ code: 'AG170', message: 'Workspace Manager policy is missing or invalid.' });
} else {
  const contract = read('packages/workspace/src/index.ts');
  for (const marker of ["WORKSPACE_SCHEMA = 'gd-workspace/1'", 'type WorkspaceId', 'interface WorkspaceDescriptor', 'asWorkspaceId']) {
    if (!contract.includes(marker)) violations.push({ code: 'AG171', message: 'Workspace contract invariant missing.', detail: marker });
  }
  if (/node:(?:fs|path|child_process|os)|\bwindow\.|\bdocument\.|\bchrome\./.test(contract)) {
    violations.push({ code: 'AG171', message: 'Workspace contract package stopped being environment-neutral.' });
  }

  const migration = read(`${rule.ownerRoot}/src/database-migrations.ts`);
  for (const marker of ['const MIGRATION_009_SQL', 'CREATE TABLE gd_workspaces', "name: 'workspace-manager'", 'version: 9']) {
    if (!migration.includes(marker)) violations.push({ code: 'AG172', message: 'Workspace registry migration invariant missing.', detail: marker });
  }

  const manager = read(`${rule.ownerRoot}/src/workspace-manager.ts`);
  for (const marker of ['class WorkspaceManager', 'realpathSync', 'relative(', 'resolveExistingPath(', 'filesystemMutation: false', 'externalTransport: false']) {
    if (!manager.includes(marker)) violations.push({ code: 'AG173', message: 'Workspace root/containment invariant missing.', detail: marker });
  }

  const forbiddenMutation = /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|rm|unlinkSync|unlink|mkdirSync|mkdir|renameSync|rename|copyFileSync|copyFile|truncateSync|truncate|chmodSync|chmod|chownSync|chown|symlinkSync|symlink|linkSync|link|spawnSync|spawn|execSync|execFileSync|execFile|exec)\b/;
  if (forbiddenMutation.test(manager)) {
    violations.push({ code: 'AG174', message: 'Build 19 Workspace Manager may register and resolve existing roots but may not mutate the filesystem.' });
  }

  const ownerPrefix = `${rule.ownerRoot}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relativeName = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_workspaces\b/.test(source) && !relativeName.startsWith(ownerPrefix)) {
      violations.push({ code: 'AG175', message: 'Workspace registry persistence authority escaped apps/local.', detail: relativeName });
    }
  }

  const server = read(`${rule.ownerRoot}/src/server.ts`);
  if (/\/v\d+\/(?:workspace|workspaces)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG176', message: 'Workspace control/query HTTP transport arrived before its owning transport phase.' });
  }

  if (policy.currentBuild < rule.projectDetectionBuild) {
    for (const absolute of walk(rule.ownerRoot)) {
      const relativeName = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\b(?:detectFramework|detectPackageManager|projectDetection|frameworkDetector)\b/.test(source)) {
        violations.push({ code: 'AG177', message: `Project Detection arrived before Build ${rule.projectDetectionBuild}.`, detail: relativeName });
      }
    }
  }

  if (policy.currentBuild < rule.gitRuntimeBuild) {
    const source = manager;
    if (/\b(?:git\s+clone|git\s+fetch|git\s+pull|simple-git|isomorphic-git|child_process)\b/i.test(source)) {
      violations.push({ code: 'AG178', message: `Git Runtime authority arrived before Build ${rule.gitRuntimeBuild}.` });
    }
  }

  if (
    rule.canonicalRoot !== 'realpath'
    || rule.pathContainment !== true
    || rule.filesystemMutation !== false
    || rule.externalTransport !== false
    || rule.multiWorkspaceBuild !== 114
  ) {
    violations.push({ code: 'AG179', message: 'Workspace Manager machine-readable invariants were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relativeName of [
      `${rule.ownerRoot}/src/workspace-manager.ts`,
      'packages/workspace/src/index.ts',
      'docs/architecture/WORKSPACE_MANAGER.md',
      'docs/builds/BUILD_19_WORKSPACE_MANAGER.md',
    ]) {
      if (!fs.existsSync(path.join(root, relativeName))) violations.push({ code: 'AG179', message: 'Required Build 19 artifact is missing.', detail: relativeName });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-workspace-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  contractPackage: rule?.contractPackage ?? null,
  canonicalRoot: rule?.canonicalRoot ?? null,
  pathContainment: rule?.pathContainment ?? null,
  filesystemMutation: rule?.filesystemMutation ?? null,
  externalTransport: rule?.externalTransport ?? null,
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
