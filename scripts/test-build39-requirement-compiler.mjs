import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('packages/plan/src/index.ts');
const pkg = JSON.parse(read('packages/plan/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const versionMatch = typeof pkg.version === 'string' ? pkg.version.match(/^0\.0\.(\d+)$/) : null;
const packageBuild = versionMatch ? Number(versionMatch[1]) : null;

assert.equal(pkg.name, '@github-decrypter/plan');
assert.ok(packageBuild !== null && packageBuild >= 39 && packageBuild <= policy.currentBuild);
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);

for (const marker of [
  'REQUIREMENT_COMPILER_BUILD = 39',
  "REQUIREMENT_SPEC_SCHEMA = 'gd-requirement-spec/1'",
  'REQUIREMENT_MAX_ITEMS = 4096',
  'REQUIREMENT_KINDS =',
  'compileRequirements(',
  'requirementCompilation: true',
  'syntaxDirected: true',
  'deterministic: true',
  'semanticInterpretation: false',
  'taskGraphCompilation: false',
  'contextCompilation: false',
  'contextContinuation: false',
  'tokenAbstraction: false',
  'attachmentIngestion: false',
  'mentionResolution: false',
  'conversationHistory: false',
  'aiExecution: false',
  'persistence: false',
]) assert.ok(source.includes(marker), `missing Build 39 marker: ${marker}`);

assert.doesNotMatch(source, /^\s*import\s/m);
assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /\b(?:node:|process\.|require\s*\(|child_process|spawn\s*\(|exec\s*\()\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:ai|chat|context|tools|workspace|git)/);
assert.doesNotMatch(source, /\b(?:compileTaskGraph|buildHierarchicalContext|continueContext|abstractTokens|resolveMention|ingestAttachment|routeModel|generate)\b/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build39-requirement-compiler-static/1',
  build: 39,
  package: '@github-decrypter/plan',
  packageBuild,
  syntaxDirected: true,
  deterministic: true,
  semanticInterpretation: false,
  aiExecution: false,
}, null, 2));
