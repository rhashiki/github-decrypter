import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('packages/context/src/continuation.ts');
const pkg = JSON.parse(read('packages/context/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const versionMatch = typeof pkg.version === 'string' ? pkg.version.match(/^0\.0\.(\d+)$/) : null;
const packageBuild = versionMatch ? Number(versionMatch[1]) : null;
const build42Exports = {
  '.': './src/index.ts',
  './continuation': './src/continuation.ts',
};
const build43Exports = {
  ...build42Exports,
  './token-abstraction': './src/token-abstraction.ts',
};
const expectedExports = policy.currentBuild >= 43 ? build43Exports : build42Exports;

assert.equal(pkg.name, '@github-decrypter/context');
assert.ok(packageBuild !== null && packageBuild >= 42 && packageBuild <= policy.currentBuild);
assert.deepEqual(pkg.dependencies ?? {}, { '@github-decrypter/plan': 'workspace:*' });
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 1);
assert.deepEqual(pkg.exports, expectedExports);

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
  'semanticExpansion: false',
  'tokenAbstraction: false',
  'projectMemory: false',
  'contextPackPersistence: false',
  'aiExecution: false',
  'execution: false',
  'persistence: false',
]) assert.ok(source.includes(marker), `missing Build 42 marker: ${marker}`);

assert.doesNotMatch(source, /^\s*import\s+(?!type\b)/m);
assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/);
assert.doesNotMatch(source, /\b(?:LocalDatabase|SecretsVault)\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:ai|chat|tools|workspace|git|github-provider)/);
assert.doesNotMatch(source, /\b(?:abstractTokens|resolveMention|ingestAttachment|rememberProject|persistContextPack|executeTaskGraph|routeModel|generate)\b/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build42-context-continuation-static/1',
  build: 42,
  package: '@github-decrypter/context',
  packageBuild,
  deterministic: true,
  sequentialHandoff: true,
  dependencyContextCarry: true,
  tokenAbstraction: false,
  persistence: false,
}, null, 2));
