import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.requirementCompilerAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 39 || rule.minimumBuild !== 39 || policy.phaseGates?.requirementCompilerBuild !== 39
  || rule.ownerPackage !== '@github-decrypter/plan' || rule.inputSchema !== 'gd-prompt-intake/1'
  || rule.schema !== 'gd-requirement-spec/1'
) {
  violations.push({ code: 'AG370', message: 'Build 39 Requirement Compiler authority is missing or inactive.' });
} else {
  const source = read('packages/plan/src/index.ts');
  const planPackage = json('packages/plan/package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/plan'];
  const studioPackage = json('apps/studio/package.json');
  const extensionPackage = json('apps/extension/package.json');
  const localPackage = json('apps/local/package.json');

  if (
    planPackage.name !== '@github-decrypter/plan' || versionBuild(planPackage.version) !== 39
    || Object.keys(planPackage.dependencies ?? {}).length !== 0
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify([])
  ) violations.push({ code: 'AG371', message: 'Requirement Compiler package identity/dependency boundary is inconsistent.' });

  for (const marker of [
    'REQUIREMENT_COMPILER_BUILD = 39',
    "REQUIREMENT_SPEC_SCHEMA = 'gd-requirement-spec/1'",
    'REQUIREMENT_MAX_ITEMS = 4096',
    'REQUIREMENT_KINDS =',
    'compileRequirements(',
    "keys.length !== 1 || keys[0] !== 'intake'",
    'digest.hex !== sha256Hex(row.normalizedText)',
    'Object.freeze(items)',
    'requirementCompilation: true',
    'syntaxDirected: true',
    'deterministic: true',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG372', message: 'Requirement Compiler deterministic contract is incomplete.', detail: marker });

  if (
    rule.promptIntakeBuild !== 38 || rule.maxItems !== 4096 || rule.sourceDigestBinding !== 'sha256'
    || rule.deterministic !== true || rule.syntaxDirected !== true || rule.environmentNeutral !== true
    || JSON.stringify(rule.exactInputFields) !== JSON.stringify(['intake'])
    || JSON.stringify(rule.kinds) !== JSON.stringify(['goal','requirement','constraint','acceptance','non-goal','context'])
  ) violations.push({ code: 'AG373', message: 'Requirement Compiler structural policy drifted.' });
  if (!source.includes('sourceDigest') || !source.includes('sourceLineCount') || !source.includes('sourceCharacterCount')) {
    violations.push({ code: 'AG373', message: 'Requirement Compiler source binding/structural metadata is incomplete.' });
  }

  if (/^\s*import\s/m.test(source) || /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)) {
    violations.push({ code: 'AG374', message: 'Requirement Compiler gained environment/network/browser authority.' });
  }
  if (/\b(?:node:|process\.|child_process|spawn\s*\(|exec\s*\(|LocalDatabase|SecretsVault)\b/.test(source)) {
    violations.push({ code: 'AG374', message: 'Requirement Compiler gained Node/filesystem/process/database/secret authority.' });
  }
  if (/@github-decrypter\/(?:ai|chat|context|tools|workspace|git)/.test(source)) {
    violations.push({ code: 'AG374', message: 'Requirement Compiler gained a forbidden workspace dependency.' });
  }

  for (const [field, value] of Object.entries({
    semanticInterpretation: false,
    taskGraphCompilation: false,
    contextCompilation: false,
    contextContinuation: false,
    tokenAbstraction: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    persistence: false,
  })) {
    if (rule[field] !== value || !source.includes(`${field}: false`)) {
      violations.push({ code: 'AG375', message: 'Requirement Compiler gained a deferred downstream authority.', detail: field });
    }
  }
  if (rule.requirementCompilation !== true || !source.includes('requirementCompilation: true')) {
    violations.push({ code: 'AG375', message: 'Requirement Compiler does not own its declared compilation boundary.' });
  }

  if (
    rule.networkAuthority !== false || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.storageAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
  ) violations.push({ code: 'AG376', message: 'Requirement Compiler policy granted transport or persistence authority.' });
  for (const [name, pkg] of [['studio', studioPackage], ['extension', extensionPackage], ['local', localPackage]]) {
    if (pkg.dependencies?.['@github-decrypter/plan']) violations.push({ code: 'AG376', message: `Build 39 activated Requirement Compiler inside ${name} prematurely.` });
  }

  if (
    rule.taskGraphCompilerBuild !== 40 || rule.hierarchicalContextBuild !== 41 || rule.contextContinuationBuild !== 42
    || rule.tokenAbstractionBuild !== 43 || rule.conversationEngineBuild !== 44 || rule.attachmentEngineBuild !== 45
    || rule.contextMentionsBuild !== 46
  ) violations.push({ code: 'AG377', message: 'Requirement Compiler downstream ownership boundaries drifted.' });
  if (/\b(?:compileTaskGraph|buildHierarchicalContext|continueContext|abstractTokens|resolveMention|ingestAttachment|routeModel|generate)\b/.test(source)) {
    violations.push({ code: 'AG377', message: 'A later-roadmap engine leaked into Requirement Compiler.' });
  }

  for (const required of [
    'packages/plan/src/index.ts',
    'docs/architecture/REQUIREMENT_COMPILER.md',
    'docs/builds/BUILD_39_REQUIREMENT_COMPILER.md',
    'scripts/architecture-guardian-requirement-compiler.mjs',
    'scripts/test-build39-requirement-compiler.mjs',
    'scripts/test-build39-requirement-compiler-runtime.ts',
    'scripts/test-build39-requirement-compiler-guardian-negative.mjs',
    'scripts/tsconfig.build39-tests.json',
    '.github/workflows/build39-requirement-compiler.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG378', message: 'Required Build 39 artifact is missing.', detail: required });

  if (!read('docs/architecture/REQUIREMENT_COMPILER.md').includes('Build 40 — Task Graph Compiler')
      || !read('docs/builds/BUILD_39_REQUIREMENT_COMPILER.md').includes('Build 41 — Hierarchical Context Engine')) {
    violations.push({ code: 'AG379', message: 'Build 39 documentation does not preserve downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-requirement-compiler-report/1',
  currentBuild: policy.currentBuild,
  requirementSpecSchema: rule?.schema ?? null,
  deterministic: rule?.deterministic ?? null,
  syntaxDirected: rule?.syntaxDirected ?? null,
  semanticInterpretation: rule?.semanticInterpretation ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
