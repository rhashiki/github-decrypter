import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policyPath = path.join(root, 'architecture.guardian.json');

const violations = [];
const warnings = [];

function rel(absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function violation(code, message, detail = undefined) {
  violations.push({ code, message, ...(detail === undefined ? {} : { detail }) });
}

function warning(code, message, detail = undefined) {
  warnings.push({ code, message, ...(detail === undefined ? {} : { detail }) });
}

function walkFiles(relativeRoot, predicate = () => true) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  if (fs.statSync(absoluteRoot).isFile()) return predicate(absoluteRoot) ? [absoluteRoot] : [];

  const files = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && predicate(absolute)) files.push(absolute);
    }
  }
  return files.sort();
}

function sourceFiles(relativeRoot) {
  return walkFiles(relativeRoot, (absolute) => /\.(?:[cm]?[jt]sx?)$/.test(absolute));
}

function sourceImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function resolveRelativeImport(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path.resolve(path.dirname(importer), specifier);
}

if (!fs.existsSync(policyPath)) {
  console.error('Architecture Guardian policy missing: architecture.guardian.json');
  process.exit(1);
}

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

if (policy.schema !== 'gd-architecture-guardian/1') {
  violation('AG001', 'Unsupported Architecture Guardian policy schema.', policy.schema);
}
if (!Number.isSafeInteger(policy.currentBuild) || policy.currentBuild < 1) {
  violation('AG002', 'currentBuild must be a positive integer.', policy.currentBuild);
}
if (policy.product !== 'GitHub Decrypter') {
  violation('AG003', 'Canonical product identity drifted.', policy.product);
}

// Authority documents are mandatory inputs, not optional prose.
for (const authority of policy.authorities ?? []) {
  if (!exists(authority)) violation('AG010', `Required product authority missing: ${authority}`);
}

if (exists('docs/product/NORTH_STAR_MANIFESTO.md')) {
  const northStar = read('docs/product/NORTH_STAR_MANIFESTO.md');
  const expectedHash = policy.northStar?.sourceSha256;
  if (expectedHash && !northStar.includes(expectedHash)) {
    violation('AG011', 'North Star source provenance hash is missing or changed.', expectedHash);
  }
  for (const principle of policy.northStar?.requiredPrinciples ?? []) {
    if (!northStar.includes(`**${principle}**`)) {
      violation('AG012', `North Star principle missing: ${principle}`);
    }
  }
  for (const phrase of [
    'teste gratuito de 24 horas',
    'plano mensal',
    'plano semestral',
    'plano anual',
    'plano vitalício',
    'Local-first **não** significa software gratuito',
    'O usuário permanece autoridade final',
  ]) {
    if (!northStar.includes(phrase)) violation('AG013', `North Star normative requirement missing: ${phrase}`);
  }
}

if (exists('docs/product/NORTH_STAR_ROADMAP_MAPPING.md')) {
  const mapping = read('docs/product/NORTH_STAR_ROADMAP_MAPPING.md');
  for (const block of policy.northStar?.requiredRoadmapBlocks ?? []) {
    if (!mapping.includes(block)) violation('AG014', `North Star roadmap block is not explicitly mapped: ${block}`);
  }
  if (!mapping.includes('1 → 134')) {
    violation('AG015', 'Roadmap mapping must preserve canonical Build sequence 1 → 134.');
  }
}

// Foundational workspace boundaries may grow, but may not disappear.
for (const app of policy.workspace?.apps ?? []) {
  const manifestPath = `apps/${app}/package.json`;
  if (!exists(manifestPath)) violation('AG020', `Foundational app missing: ${app}`);
  else if (json(manifestPath).name !== `@github-decrypter/${app}`) {
    violation('AG021', `App package identity drifted: ${app}`);
  }
}
for (const pkg of policy.workspace?.packages ?? []) {
  const manifestPath = `packages/${pkg}/package.json`;
  if (!exists(manifestPath)) violation('AG022', `Foundational package missing: ${pkg}`);
  else if (json(manifestPath).name !== `@github-decrypter/${pkg}`) {
    violation('AG023', `Package identity drifted: ${pkg}`);
  }
}

// Package dependency authority for sensitive foundation packages.
for (const [packageName, rule] of Object.entries(policy.packageRules ?? {})) {
  const packageDir = packageName.replace('@github-decrypter/', '');
  const manifestPath = `packages/${packageDir}/package.json`;
  if (!exists(manifestPath)) {
    violation('AG030', `Guarded package manifest missing: ${manifestPath}`);
    continue;
  }
  const manifest = json(manifestPath);
  const dependencyBlocks = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].filter(Boolean);
  const internalDependencies = new Set();
  for (const block of dependencyBlocks) {
    for (const dependency of Object.keys(block)) {
      if (dependency.startsWith('@github-decrypter/')) internalDependencies.add(dependency);
    }
  }
  const allowed = new Set(rule.allowedWorkspaceDependencies ?? []);
  for (const dependency of internalDependencies) {
    if (!allowed.has(dependency)) {
      violation('AG031', `${packageName} gained a forbidden workspace dependency.`, dependency);
    }
  }
}

// Environment-neutral foundations cannot acquire transport/platform authority.
const neutralPatterns = [
  /\bchrome\./,
  /\bwindow\./,
  /\bdocument\./,
  /\bprocess\./,
  /from\s+['"]node:/,
  /\bWebSocket\b/,
  /\bXMLHttpRequest\b/,
  /\bfetch\s*\(/,
  /\blocalStorage\b/,
  /\bindexedDB\b/,
  /https?:\/\//,
];
for (const [packageName, rule] of Object.entries(policy.packageRules ?? {})) {
  if (!rule.environmentNeutral) continue;
  const packageDir = packageName.replace('@github-decrypter/', '');
  for (const absolute of sourceFiles(`packages/${packageDir}/src`)) {
    const source = fs.readFileSync(absolute, 'utf8');
    for (const pattern of neutralPatterns) {
      if (pattern.test(source)) {
        violation('AG032', `${packageName} contains environment-specific authority.`, `${rel(absolute)} :: ${pattern}`);
      }
    }
  }
}

// Cross-boundary imports are resolved structurally instead of by naming convention alone.
const legacyRoots = new Set(policy.legacyMigrationRoots ?? []);
for (const absolute of [...sourceFiles('apps'), ...sourceFiles('packages')]) {
  const relativeFile = rel(absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  const specifiers = sourceImportSpecifiers(source);
  const importerApp = relativeFile.match(/^apps\/([^/]+)\//)?.[1];
  const importerIsPackage = relativeFile.startsWith('packages/');

  for (const specifier of specifiers) {
    if (importerIsPackage && /^@github-decrypter\/(?:studio|extension|local)(?:\/|$)/.test(specifier)) {
      violation('AG040', 'A reusable package imports an application package.', `${relativeFile} -> ${specifier}`);
    }
    if (importerApp) {
      const otherApp = specifier.match(/^@github-decrypter\/(studio|extension|local)(?:\/|$)/)?.[1];
      if (otherApp && otherApp !== importerApp) {
        violation('AG041', 'An app imports another app directly instead of a shared package.', `${relativeFile} -> ${specifier}`);
      }
    }

    const resolved = resolveRelativeImport(absolute, specifier);
    if (!resolved) continue;
    const resolvedRelative = rel(resolved);

    if (importerIsPackage && resolvedRelative.startsWith('apps/')) {
      violation('AG042', 'A package crosses into apps/ through a relative import.', `${relativeFile} -> ${specifier}`);
    }
    if (importerApp && resolvedRelative.startsWith('apps/') && !resolvedRelative.startsWith(`apps/${importerApp}/`)) {
      violation('AG043', 'An app crosses directly into another app.', `${relativeFile} -> ${specifier}`);
    }

    const topLevel = resolvedRelative.split('/')[0];
    if (legacyRoots.has(topLevel)) {
      violation('AG044', 'New monorepo authority imports an inherited migration root directly.', `${relativeFile} -> ${specifier}`);
    }
  }
}

// Legacy Lovable/cloud release authority may remain in historical docs, never active surfaces.
for (const activeRoot of policy.activeAuthorityRoots ?? []) {
  if (!exists(activeRoot)) continue;
  const absolute = path.join(root, activeRoot);
  const files = fs.statSync(absolute).isFile()
    ? [absolute]
    : walkFiles(activeRoot, (file) => /\.(?:json|ya?ml|[cm]?[jt]sx?|html|css|md)$/.test(file));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const token of policy.forbiddenActiveAuthorityTokens ?? []) {
      if (source.includes(token)) {
        violation('AG050', `Forbidden inherited authority token in active surface: ${token}`, rel(file));
      }
    }
  }
}

// Build-stage gates prevent future features from arriving early and make later enablement explicit.
const currentBuild = policy.currentBuild;
const phase = policy.phaseGates ?? {};
if (currentBuild < phase.localDaemonBuild) {
  for (const premature of ['apps/local/src/daemon.ts', 'apps/local/src/server.ts']) {
    if (exists(premature)) violation('AG060', `Local daemon authority arrived before Build ${phase.localDaemonBuild}.`, premature);
  }
}
if (currentBuild < phase.studioReactBuild) {
  for (const premature of ['apps/studio/src/main.tsx', 'apps/studio/src/App.tsx', 'apps/studio/vite.config.ts']) {
    if (exists(premature)) violation('AG061', `Studio React/Vite authority arrived before Build ${phase.studioReactBuild}.`, premature);
  }
}
if (currentBuild < phase.extensionActivationBuild && exists('manifest.json')) {
  const manifest = json('manifest.json');
  if (manifest.background) violation('AG062', `Extension background authority arrived before Build ${phase.extensionActivationBuild}.`);
  if ((manifest.content_scripts ?? []).length > 0) violation('AG063', `Extension content scripts arrived before Build ${phase.extensionActivationBuild}.`);
  if ((manifest.host_permissions ?? []).length > 0) violation('AG064', `Extension host permissions arrived before Build ${phase.extensionActivationBuild}.`);
}

// Workflow mutation authority is fail-closed until an explicit allowlist amendment.
const workflowFiles = walkFiles('.github/workflows', (absolute) => /\.ya?ml$/.test(absolute));
for (const absolute of workflowFiles) {
  const relativeFile = rel(absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  const allowlisted = new Set(policy.workflow?.writePermissionAllowlist ?? []).has(relativeFile);
  if (!allowlisted) {
    for (const permission of policy.workflow?.forbiddenWritePermissions ?? []) {
      const writePattern = new RegExp(`(^|\\n)\\s*${permission.replace('-', '\\-')}\\s*:\\s*write\\s*(?:#.*)?(?=\\n|$)`, 'i');
      if (writePattern.test(source)) {
        violation('AG070', `Workflow gained write permission without Architecture Guardian allowlist: ${permission}`, relativeFile);
      }
    }
  }
  if (currentBuild < phase.releaseAuthorityBuild) {
    if (/(^|\n)\s*release\s*:/i.test(source)) violation('AG071', `Release-trigger authority arrived before Build ${phase.releaseAuthorityBuild}.`, relativeFile);
    if (/(^|\n)\s*tags\s*:\s*(?:\n|\[).*\bv\*?/is.test(source)) violation('AG072', `Version-tag publication trigger arrived before Build ${phase.releaseAuthorityBuild}.`, relativeFile);
  }
}

// Build numbering stays integer and roadmap stage matches the repository gate.
if (exists('docs/builds')) {
  const buildNumbers = [];
  for (const entry of fs.readdirSync(path.join(root, 'docs/builds'))) {
    if (/^BUILD_\d+\.\d+/.test(entry)) violation('AG080', 'Decimal/ad-hoc Build numbering is forbidden.', entry);
    const match = entry.match(/^BUILD_(\d+)_/);
    if (match) buildNumbers.push(Number(match[1]));
  }
  const maxDocumentedBuild = buildNumbers.length ? Math.max(...buildNumbers) : 0;
  if (maxDocumentedBuild !== currentBuild) {
    violation('AG081', 'Architecture Guardian currentBuild must match the latest documented Build.', { currentBuild, maxDocumentedBuild });
  }
}

if (exists('package.json')) {
  const version = String(json('package.json').version ?? '');
  if (currentBuild < 134 && version !== `0.0.${currentBuild}`) {
    violation('AG082', 'Pre-V1 root version must track the current Build.', { expected: `0.0.${currentBuild}`, actual: version });
  }
}

// Informational warning: Build 9 cannot semantically prove product intent; review checklist remains required.
warning(
  'AGW01',
  'Semantic North Star alignment cannot be fully automated. Product-affecting PRs must answer the North Star review checklist.',
);

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-report/1',
  currentBuild,
  checkedAuthorities: policy.authorities?.length ?? 0,
  violations,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
