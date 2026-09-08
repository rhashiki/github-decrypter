import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.tokenAbstractionAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 43 || rule.minimumBuild !== 43 || policy.phaseGates?.tokenAbstractionBuild !== 43
  || rule.ownerPackage !== '@github-decrypter/context' || rule.ownerSource !== 'packages/context/src/token-abstraction.ts'
  || rule.schema !== 'gd-token-abstraction/1'
) {
  violations.push({ code: 'AG410', message: 'Build 43 Token Abstraction authority is missing or inactive.' });
} else {
  const source = read('packages/context/src/token-abstraction.ts');
  const contextPackage = json('packages/context/package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/context'];
  const studioPackage = json('apps/studio/package.json');
  const extensionPackage = json('apps/extension/package.json');
  const localPackage = json('apps/local/package.json');
  const packageBuild = versionBuild(contextPackage.version);
  const expectedExports = {
    '.': './src/index.ts',
    './continuation': './src/continuation.ts',
    './token-abstraction': './src/token-abstraction.ts',
  };

  if (
    contextPackage.name !== '@github-decrypter/context' || packageBuild !== 43
    || JSON.stringify(contextPackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(contextPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/plan': 'workspace:*' })
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan'])
  ) violations.push({ code: 'AG411', message: 'Token Abstraction package identity/export/dependency boundary is inconsistent.' });

  for (const marker of [
    'TOKEN_ABSTRACTION_BUILD = 43',
    "TOKEN_ABSTRACTION_SCHEMA = 'gd-token-abstraction/1'",
    "TOKEN_ABSTRACTION_SOURCE_SCHEMA = 'gd-context-continuation/1'",
    "TOKEN_ABSTRACTION_ROOT_ID = 'ctx-root'",
    'TOKEN_ABSTRACTION_MAX_FRAMES = 4096',
    "TOKEN_ABSTRACTION_ENVELOPE_PREFIX = 'ctxwin-'",
    'abstractTokenWindow(',
    'contextWindowTokens',
    'reservedOutputTokens',
    'usableInputTokens',
    "metering: 'unmeasured'",
    "fitStatus: 'unknown'",
    "overflowDecision: 'deferred'",
    'tokenAbstraction: true',
    'finiteModelWindow: true',
    'userFacingRawTokenBudget: false',
    'infiniteContextClaim: false',
    'tokenizerExecution: false',
    'contentTokenEstimation: false',
    'silentTruncation: false',
    'semanticCompression: false',
    'orchestrationRequired: true',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG412', message: 'Token Abstraction deterministic finite-window contract is incomplete.', detail: marker });

  if (
    rule.contextContinuationBuild !== 42 || rule.inputSchema !== 'gd-context-continuation/1'
    || rule.rootContextId !== 'ctx-root' || rule.maxFrames !== 4096 || rule.sourceDigestBinding !== 'sha256'
    || rule.deterministic !== true || rule.finiteModelWindow !== true || rule.environmentNeutral !== true
    || JSON.stringify(rule.exactInputFields) !== JSON.stringify(['continuation','window'])
    || JSON.stringify(rule.windowFields) !== JSON.stringify(['contextWindowTokens','reservedOutputTokens'])
    || rule.metering !== 'unmeasured' || rule.fitStatus !== 'unknown' || rule.overflowDecision !== 'deferred'
  ) violations.push({ code: 'AG413', message: 'Token Abstraction structural policy drifted.' });

  if (/^\s*import\s+(?!type\b)/m.test(source)) {
    violations.push({ code: 'AG414', message: 'Token Abstraction gained a runtime import.' });
  }
  if (/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)) {
    violations.push({ code: 'AG414', message: 'Token Abstraction gained network/browser authority.' });
  }
  if (/(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\(|\bLocalDatabase\b|\bSecretsVault\b)/.test(source)) {
    violations.push({ code: 'AG414', message: 'Token Abstraction gained Node/process/database/secret authority.' });
  }
  if (/@github-decrypter\/(?:ai|chat|tools|workspace|git|github-provider)/.test(source)) {
    violations.push({ code: 'AG414', message: 'Token Abstraction gained a forbidden workspace dependency.' });
  }
  if (/\b(?:tiktoken|sentencepiece|tokenizers|transformers)\b/i.test(source)
      || /\b(?:tokenize|encodeTokens|truncateContext|summarizeContext|compressContext|generate)\s*\(/.test(source)) {
    violations.push({ code: 'AG414', message: 'Token Abstraction gained tokenizer, truncation, compression or generation execution.' });
  }

  for (const field of [
    'requirementCompilation','taskGraphCompilation','contextCompilation','contextContinuation','tokenAbstraction',
    'deterministic','finiteModelWindow','orchestrationRequired',
  ]) {
    if (rule[field] !== true || !source.includes(`${field}: true`)) {
      violations.push({ code: 'AG415', message: 'Token Abstraction lost a declared Build 43 authority.', detail: field });
    }
  }
  for (const field of [
    'userFacingRawTokenBudget','infiniteContextClaim','tokenizerExecution','contentTokenEstimation','silentTruncation',
    'semanticCompression','attachmentIngestion','mentionResolution','conversationHistory','projectMemory',
    'contextPackPersistence','aiExecution','execution','persistence',
  ]) {
    if (rule[field] !== false || !source.includes(`${field}: false`)) {
      violations.push({ code: 'AG415', message: 'Token Abstraction gained a deferred or prohibited authority.', detail: field });
    }
  }

  if (
    rule.networkAuthority !== false || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.storageAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
  ) violations.push({ code: 'AG416', message: 'Token Abstraction policy granted transport or persistence authority.' });
  for (const [name, pkg] of [['studio', studioPackage], ['extension', extensionPackage], ['local', localPackage]]) {
    if (pkg.dependencies?.['@github-decrypter/context']) {
      violations.push({ code: 'AG416', message: `Build 43 activated Token Abstraction inside ${name} prematurely.` });
    }
  }

  if (
    rule.conversationEngineBuild !== 44 || rule.attachmentEngineBuild !== 45 || rule.contextMentionsBuild !== 46
    || rule.projectMemoryBuild !== 66 || rule.finalContextEngineBuild !== 67
  ) violations.push({ code: 'AG417', message: 'Token Abstraction downstream ownership boundaries drifted.' });
  if (/\b(?:resolveMention|ingestAttachment|rememberProject|persistContextPack|executeTaskGraph|routeModel|generateConversation)\b/.test(source)) {
    violations.push({ code: 'AG417', message: 'A later-roadmap engine leaked into Token Abstraction.' });
  }

  for (const required of [
    'packages/context/src/token-abstraction.ts',
    'docs/architecture/TOKEN_ABSTRACTION_LAYER.md',
    'docs/builds/BUILD_43_TOKEN_ABSTRACTION_LAYER.md',
    'scripts/architecture-guardian-token-abstraction.mjs',
    'scripts/test-build43-token-abstraction.mjs',
    'scripts/test-build43-token-abstraction-runtime.ts',
    'scripts/test-build43-token-abstraction-guardian-negative.mjs',
    'scripts/tsconfig.build43-tests.json',
    '.github/workflows/build43-token-abstraction-layer.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG418', message: 'Required Build 43 artifact is missing.', detail: required });

  const architectureDoc = read('docs/architecture/TOKEN_ABSTRACTION_LAYER.md');
  const buildDoc = read('docs/builds/BUILD_43_TOKEN_ABSTRACTION_LAYER.md');
  const scopeDoc = read('docs/product/V1_SCOPE.md');
  if (!architectureDoc.includes('Build 44 — Conversation Engine')
      || !architectureDoc.includes('finite model context windows')
      || !buildDoc.includes('Build 66 — Project Memory')
      || !scopeDoc.includes('no user-facing dependence on raw token budgeting for normal workflow')
      || !scopeDoc.includes('false infinite-context claims')) {
    violations.push({ code: 'AG419', message: 'Build 43 documentation does not preserve finite-window or downstream ownership policy.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-token-abstraction-report/1',
  currentBuild: policy.currentBuild,
  tokenAbstractionSchema: rule?.schema ?? null,
  deterministic: rule?.deterministic ?? null,
  finiteModelWindow: rule?.finiteModelWindow ?? null,
  tokenizerExecution: rule?.tokenizerExecution ?? null,
  silentTruncation: rule?.silentTruncation ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
