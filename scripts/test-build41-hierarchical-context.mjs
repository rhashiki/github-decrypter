import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('packages/context/src/index.ts');
const pkg = JSON.parse(read('packages/context/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const versionMatch = typeof pkg.version === 'string' ? pkg.version.match(/^0\.0\.(\d+)$/) : null;
const packageBuild = versionMatch ? Number(versionMatch[1]) : null;

assert.equal(pkg.name, '@github-decrypter/context');
assert.ok(packageBuild !== null && packageBuild >= 41 && packageBuild <= policy.currentBuild);
assert.deepEqual(pkg.dependencies ?? {}, { '@github-decrypter/plan': 'workspace:*' });
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 1);

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
  'deterministic: true',
  'dependencyAware: true',
  'semanticExpansion: false',
  'contextContinuation: false',
  'tokenAbstraction: false',
  'projectMemory: false',
  'contextPackPersistence: false',
  'aiExecution: false',
  'execution: false',
  'persistence: false',
]) assert.ok(source.includes(marker), `missing Build 41 marker: ${marker}`);

assert.doesNotMatch(source, /^\s*import\s+(?!type\b)/m);
assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /(?:['"]node:|\bprocess\.|\brequire\s*\(|\bchild_process\b|\bspawn\s*\()/);
assert.doesNotMatch(source, /\b(?:LocalDatabase|SecretsVault)\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:ai|chat|tools|workspace|git|github-provider)/);
assert.doesNotMatch(source, /\b(?:continueContext|abstractTokens|resolveMention|ingestAttachment|rememberProject|persistContextPack|executeTaskGraph|routeModel|generate)\b/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build41-hierarchical-context-static/1',
  build: 41,
  package: '@github-decrypter/context',
  packageBuild,
  deterministic: true,
  dependencyAware: true,
  continuation: false,
  persistence: false,
}, null, 2));
