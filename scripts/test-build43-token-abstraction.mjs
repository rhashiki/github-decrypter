import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('packages/context/src/token-abstraction.ts');
const pkg = JSON.parse(read('packages/context/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const versionMatch = typeof pkg.version === 'string' ? pkg.version.match(/^0\.0\.(\d+)$/) : null;
const packageBuild = versionMatch ? Number(versionMatch[1]) : null;

assert.ok(policy.currentBuild >= 43, 'Architecture Guardian must not regress below Build 43');
assert.equal(pkg.name, '@github-decrypter/context');
assert.equal(packageBuild, 43);
assert.deepEqual(pkg.dependencies ?? {}, { '@github-decrypter/plan': 'workspace:*' });
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 1);
assert.deepEqual(pkg.exports, {
  '.': './src/index.ts',
  './continuation': './src/continuation.ts',
  './token-abstraction': './src/token-abstraction.ts',
});

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
  'conversationHistory: false',
  'projectMemory: false',
  'aiExecution: false',
  'execution: false',
  'persistence: false',
]) assert.ok(source.includes(marker), `missing Build 43 marker: ${marker}`);

assert.doesNotMatch(source, /^\s*import\s+(?!type\b)/m);
assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/);
assert.doesNotMatch(source, /\b(?:LocalDatabase|SecretsVault)\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:ai|chat|tools|workspace|git|github-provider)/);
assert.doesNotMatch(source, /\b(?:tiktoken|sentencepiece|tokenizers|transformers)\b/i);
assert.doesNotMatch(source, /\b(?:tokenize|encodeTokens|truncateContext|summarizeContext|compressContext|generate)\s*\(/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build43-token-abstraction-static/1',
  build: 43,
  currentBuild: policy.currentBuild,
  package: '@github-decrypter/context',
  packageBuild,
  deterministic: true,
  finiteModelWindow: true,
  tokenizerExecution: false,
  silentTruncation: false,
  userFacingRawTokenBudget: false,
}, null, 2));
