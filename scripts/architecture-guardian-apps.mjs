import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const violations = [];

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function walk(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(absolute);
    }
  }
  return files.sort();
}

for (const [packageName, rule] of Object.entries(policy.appRules ?? {})) {
  const appName = packageName.replace('@github-decrypter/', '');
  const manifestPath = `apps/${appName}/package.json`;
  if (!fs.existsSync(path.join(root, manifestPath))) {
    violations.push({ code: 'AG033', message: `Guarded app manifest missing: ${manifestPath}` });
    continue;
  }

  const manifest = readJson(manifestPath);
  const dependencyBlocks = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].filter(Boolean);
  const allowedWorkspace = new Set(rule.allowedWorkspaceDependencies ?? []);
  const allowedExternal = new Set(rule.allowedExternalDependencies ?? []);

  for (const block of dependencyBlocks) {
    for (const dependency of Object.keys(block)) {
      if (dependency.startsWith('@github-decrypter/')) {
        if (!allowedWorkspace.has(dependency)) {
          violations.push({
            code: 'AG033',
            message: `${packageName} gained an undeclared workspace dependency.`,
            detail: dependency,
          });
        }
      } else if (!allowedExternal.has(dependency)) {
        violations.push({
          code: 'AG034',
          message: `${packageName} gained an undeclared external dependency.`,
          detail: dependency,
        });
      }
    }
  }

  const exceptions = rule.sourcePatternExceptions ?? {};
  for (const absolute of walk(`apps/${appName}/src`)) {
    const source = fs.readFileSync(absolute, 'utf8');
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    for (const patternSource of rule.forbiddenSourcePatterns ?? []) {
      const pattern = new RegExp(patternSource);
      if (!pattern.test(source)) continue;
      const allowedPaths = new Set(exceptions[patternSource] ?? []);
      if (allowedPaths.has(relative)) continue;
      violations.push({
        code: 'AG035',
        message: `${packageName} crossed into a forbidden platform authority.`,
        detail: `${relative} :: ${pattern}`,
      });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-app-report/1',
  currentBuild: policy.currentBuild,
  guardedApps: Object.keys(policy.appRules ?? {}),
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
