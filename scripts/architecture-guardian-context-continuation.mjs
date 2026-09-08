import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.contextContinuationAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 42 || rule.minimumBuild !== 42 || policy.phaseGates?.contextContinuationBuild !== 42
  || rule.ownerPackage !== '@github-decrypter/context' || rule.ownerSource !== 'packages/context/src/continuation.ts'
  || rule.schema !== 'gd-context-continuation/1'
) {
  violations.push({ code: 'AG400', message: 'Build 42 Context Continuation authority is missing or inactive.' });
} else {
  const source = read('packages/context/src/continuation.ts');
  const contextPackage = json('packages/context/package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/context'];
  const studioPackage = json('apps/studio/package.json');
  const extensionPackage = json('apps/extension/package.json');
  const localPackage = json('apps/local/package.json');
  const packageBuild = versionBuild(contextPackage.version);
  const expectedExports = { '.': './src/index.ts', './continuation': './src/continuation.ts' };

  if (
    contextPackage.name !== '@github-decrypter/context' || packageBuild === null || packageBuild < 42 || packageBuild > policy.currentBuild
    || JSON.stringify(contextPackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(contextPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/plan': 'workspace:*' })
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan'])
  ) violations.push({ code: 'AG401', message: 'Context Continuation package identity/export/dependency boundary is inconsistent.' });

  for (const marker of [
    'CONTEXT_CONTINUATION_BUILD = 42',
    "CONTEXT_CONTINUATION_SCHEMA = 'gd-context-continuation/1'",
    "CONTEXT_CONTINUATION_SOURCE_SCHEMA = 'gd-hierarchical-context/1'",
    "CONTEXT_CONTINUATION_ROOT_ID = 'ctx-root'",
    'CONTEXT_CONTINUATION_MAX_FRAMES = 4096',
    'CONTEXT_CONTINUATION_MAX_LEVELS = 4096',
    'compileContextContinuation(',
    'previousFrameId',
    'previousTaskContextId',
    'directDependencyContextIds',
    'inheritedDependencyContextIds',
    'carriedContextIds',
    'contextContinuation: true',
    'deterministic: true',
    'sequentialHandoff: true',
    'dependencyContextCarry: true',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG402', message: 'Context Continuation deterministic handoff contract is incomplete.', detail: marker });

  if (
    rule.hierarchicalContextBuild !== 41 || rule.inputSchema !== 'gd-hierarchical-context/1'
    || rule.rootContextId !== 'ctx-root' || rule.maxFrames !== 4096 || rule.maxLevels !== 4096
    || rule.sourceDigestBinding !== 'sha256' || rule.deterministic !== true
    || rule.sequentialHandoff !== true || rule.dependencyContextCarry !== true
    || rule.environmentNeutral !== true || JSON.stringify(rule.exactInputFields) !== JSON.stringify(['context'])
  ) violations.push({ code: 'AG403', message: 'Context Continuation structural policy drifted.' });

  if (/^\s*import\s+(?!type\b)/m.test(source)) {
    violations.push({ code: 'AG404', message: 'Context Continuation gained a runtime import.' });
  }
  if (/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)) {
    violations.push({ code: 'AG404', message: 'Context Continuation gained network/browser authority.' });
  }
  if (/(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\(|\bLocalDatabase\b|\bSecretsVault\b)/.test(source)) {
    violations.push({ code: 'AG404', message: 'Context Continuation gained Node/process/database/secret authority.' });
  }
  if (/@github-decrypter\/(?:ai|chat|tools|workspace|git|github-provider)/.test(source)) {
    violations.push({ code: 'AG404', message: 'Context Continuation gained a forbidden workspace dependency.' });
  }

  for (const [field, value] of Object.entries({
    requirementCompilation: true,
    taskGraphCompilation: true,
    contextCompilation: true,
    contextContinuation: true,
    deterministic: true,
    sequentialHandoff: true,
    dependencyContextCarry: true,
  })) {
    if (rule[field] !== value || !source.includes(`${field}: true`)) {
      violations.push({ code: 'AG405', message: 'Context Continuation lost a declared Build 42 authority.', detail: field });
    }
  }
  for (const [field, value] of Object.entries({
    semanticExpansion: false,
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
      violations.push({ code: 'AG405', message: 'Context Continuation gained a deferred downstream authority.', detail: field });
    }
  }

  if (
    rule.networkAuthority !== false || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.storageAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
  ) violations.push({ code: 'AG406', message: 'Context Continuation policy granted transport or persistence authority.' });
  for (const [name, pkg] of [['studio', studioPackage], ['extension', extensionPackage], ['local', localPackage]]) {
    if (pkg.dependencies?.['@github-decrypter/context']) {
      violations.push({ code: 'AG406', message: `Build 42 activated Context Continuation inside ${name} prematurely.` });
    }
  }

  if (
    rule.tokenAbstractionBuild !== 43 || rule.conversationEngineBuild !== 44
    || rule.attachmentEngineBuild !== 45 || rule.contextMentionsBuild !== 46
    || rule.projectMemoryBuild !== 66 || rule.finalContextEngineBuild !== 67
  ) violations.push({ code: 'AG407', message: 'Context Continuation downstream ownership boundaries drifted.' });
  if (/\b(?:abstractTokens|resolveMention|ingestAttachment|rememberProject|persistContextPack|executeTaskGraph|routeModel|generate)\b/.test(source)) {
    violations.push({ code: 'AG407', message: 'A later-roadmap engine leaked into Context Continuation.' });
  }

  for (const required of [
    'packages/context/src/continuation.ts',
    'docs/architecture/CONTEXT_CONTINUATION_ENGINE.md',
    'docs/builds/BUILD_42_CONTEXT_CONTINUATION_ENGINE.md',
    'scripts/architecture-guardian-context-continuation.mjs',
    'scripts/test-build42-context-continuation.mjs',
    'scripts/test-build42-context-continuation-runtime.ts',
    'scripts/test-build42-context-continuation-guardian-negative.mjs',
    'scripts/tsconfig.build42-tests.json',
    '.github/workflows/build42-context-continuation-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG408', message: 'Required Build 42 artifact is missing.', detail: required });

  if (!read('docs/architecture/CONTEXT_CONTINUATION_ENGINE.md').includes('Build 43 — Token Abstraction Layer')
      || !read('docs/architecture/CONTEXT_CONTINUATION_ENGINE.md').includes('Build 66 — Project Memory')
      || !read('docs/builds/BUILD_42_CONTEXT_CONTINUATION_ENGINE.md').includes('Build 67 — Context Engine vFinal')) {
    violations.push({ code: 'AG409', message: 'Build 42 documentation does not preserve downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-context-continuation-report/1',
  currentBuild: policy.currentBuild,
  contextContinuationSchema: rule?.schema ?? null,
  deterministic: rule?.deterministic ?? null,
  sequentialHandoff: rule?.sequentialHandoff ?? null,
  dependencyContextCarry: rule?.dependencyContextCarry ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
