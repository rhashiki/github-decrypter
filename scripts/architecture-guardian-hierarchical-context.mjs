import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.hierarchicalContextAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 41 || rule.minimumBuild !== 41 || policy.phaseGates?.hierarchicalContextBuild !== 41
  || rule.ownerPackage !== '@github-decrypter/context' || rule.ownerSource !== 'packages/context/src/index.ts'
  || rule.schema !== 'gd-hierarchical-context/1'
) {
  violations.push({ code: 'AG390', message: 'Build 41 Hierarchical Context authority is missing or inactive.' });
} else {
  const source = read('packages/context/src/index.ts');
  const contextPackage = json('packages/context/package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/context'];
  const studioPackage = json('apps/studio/package.json');
  const extensionPackage = json('apps/extension/package.json');
  const localPackage = json('apps/local/package.json');
  const packageBuild = versionBuild(contextPackage.version);

  if (
    contextPackage.name !== '@github-decrypter/context' || packageBuild === null || packageBuild < 41 || packageBuild > policy.currentBuild
    || contextPackage.exports !== './src/index.ts'
    || JSON.stringify(contextPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/plan': 'workspace:*' })
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan'])
  ) violations.push({ code: 'AG391', message: 'Hierarchical Context package identity/dependency boundary is inconsistent.' });

  for (const marker of [
    'HIERARCHICAL_CONTEXT_BUILD = 41',
    "HIERARCHICAL_CONTEXT_SCHEMA = 'gd-hierarchical-context/1'",
    "HIERARCHICAL_CONTEXT_SPEC_SCHEMA = 'gd-requirement-spec/1'",
    "HIERARCHICAL_CONTEXT_GRAPH_SCHEMA = 'gd-task-graph/1'",
    'HIERARCHICAL_CONTEXT_MAX_TASKS = 4096',
    'HIERARCHICAL_CONTEXT_MAX_LEVELS = 4096',
    'buildHierarchicalContext(',
    'dependencyClosureFor(',
    "id: 'ctx-root'",
    "id: `ctx-level-${String(depth).padStart(4, '0')}`",
    'contextCompilation: true',
    'hierarchical: true',
    'dependencyAware: true',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG392', message: 'Hierarchical Context deterministic hierarchy contract is incomplete.', detail: marker });

  if (
    rule.requirementCompilerBuild !== 39 || rule.taskGraphCompilerBuild !== 40
    || JSON.stringify(rule.inputSchemas) !== JSON.stringify(['gd-requirement-spec/1','gd-task-graph/1'])
    || rule.maxTasks !== 4096 || rule.maxLevels !== 4096
    || JSON.stringify(rule.globalKinds) !== JSON.stringify(['goal','constraint','acceptance','non-goal','context'])
    || rule.sourceDigestBinding !== 'sha256' || rule.deterministic !== true || rule.dependencyAware !== true
    || rule.hierarchy !== 'root>levels>tasks' || rule.environmentNeutral !== true
    || JSON.stringify(rule.exactInputFields) !== JSON.stringify(['spec','graph'])
  ) violations.push({ code: 'AG393', message: 'Hierarchical Context structural policy drifted.' });

  if (/^\s*import\s+(?!type\b)/m.test(source)) {
    violations.push({ code: 'AG394', message: 'Hierarchical Context gained a runtime import.' });
  }
  if (/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)) {
    violations.push({ code: 'AG394', message: 'Hierarchical Context gained network/browser authority.' });
  }
  if (/(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\(|\bLocalDatabase\b|\bSecretsVault\b)/.test(source)) {
    violations.push({ code: 'AG394', message: 'Hierarchical Context gained Node/process/database/secret authority.' });
  }
  if (/@github-decrypter\/(?:ai|chat|tools|workspace|git|github-provider)/.test(source)) {
    violations.push({ code: 'AG394', message: 'Hierarchical Context gained a forbidden workspace dependency.' });
  }

  for (const [field, value] of Object.entries({
    semanticExpansion: false,
    contextContinuation: false,
    tokenAbstraction: false,
    projectMemory: false,
    contextPackPersistence: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    execution: false,
    persistence: false,
  })) {
    if (rule[field] !== value || !source.includes(`${field}: false`)) {
      violations.push({ code: 'AG395', message: 'Hierarchical Context gained a deferred downstream authority.', detail: field });
    }
  }
  for (const [field, value] of Object.entries({
    requirementCompilation: true,
    taskGraphCompilation: true,
    contextCompilation: true,
    hierarchical: true,
    deterministic: true,
    dependencyAware: true,
  })) {
    if (rule[field] !== value || !source.includes(`${field}: true`)) {
      violations.push({ code: 'AG395', message: 'Hierarchical Context lost a declared Build 41 authority.', detail: field });
    }
  }

  if (
    rule.networkAuthority !== false || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.storageAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
  ) violations.push({ code: 'AG396', message: 'Hierarchical Context policy granted transport or persistence authority.' });
  for (const [name, pkg] of [['studio', studioPackage], ['extension', extensionPackage], ['local', localPackage]]) {
    if (pkg.dependencies?.['@github-decrypter/context']) {
      violations.push({ code: 'AG396', message: `Build 41 activated context compilation inside ${name} prematurely.` });
    }
  }

  if (
    rule.contextContinuationBuild !== 42 || rule.tokenAbstractionBuild !== 43 || rule.conversationEngineBuild !== 44
    || rule.attachmentEngineBuild !== 45 || rule.contextMentionsBuild !== 46
    || rule.projectMemoryBuild !== 66 || rule.finalContextEngineBuild !== 67
  ) violations.push({ code: 'AG397', message: 'Hierarchical Context downstream ownership boundaries drifted.' });
  if (/\b(?:continueContext|abstractTokens|resolveMention|ingestAttachment|rememberProject|persistContextPack|executeTaskGraph|routeModel|generate)\b/.test(source)) {
    violations.push({ code: 'AG397', message: 'A later-roadmap engine leaked into Hierarchical Context.' });
  }

  for (const required of [
    'packages/context/src/index.ts',
    'docs/architecture/HIERARCHICAL_CONTEXT_ENGINE.md',
    'docs/builds/BUILD_41_HIERARCHICAL_CONTEXT_ENGINE.md',
    'scripts/architecture-guardian-hierarchical-context.mjs',
    'scripts/test-build41-hierarchical-context.mjs',
    'scripts/test-build41-hierarchical-context-runtime.ts',
    'scripts/test-build41-hierarchical-context-guardian-negative.mjs',
    'scripts/tsconfig.build41-tests.json',
    '.github/workflows/build41-hierarchical-context-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG398', message: 'Required Build 41 artifact is missing.', detail: required });

  if (!read('docs/architecture/HIERARCHICAL_CONTEXT_ENGINE.md').includes('Build 42 — Context Continuation Engine')
      || !read('docs/architecture/HIERARCHICAL_CONTEXT_ENGINE.md').includes('Build 66 — Project Memory')
      || !read('docs/builds/BUILD_41_HIERARCHICAL_CONTEXT_ENGINE.md').includes('Build 43 — Token Abstraction Layer')) {
    violations.push({ code: 'AG399', message: 'Build 41 documentation does not preserve downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-hierarchical-context-report/1',
  currentBuild: policy.currentBuild,
  hierarchicalContextSchema: rule?.schema ?? null,
  deterministic: rule?.deterministic ?? null,
  dependencyAware: rule?.dependencyAware ?? null,
  contextContinuation: rule?.contextContinuation ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
