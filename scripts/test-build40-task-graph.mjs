import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('packages/plan/src/task-graph.ts');
const pkg = JSON.parse(read('packages/plan/package.json'));
const policy = JSON.parse(read('architecture.guardian.json'));
const versionMatch = typeof pkg.version === 'string' ? pkg.version.match(/^0\.0\.(\d+)$/) : null;
const packageBuild = versionMatch ? Number(versionMatch[1]) : null;

assert.equal(pkg.name, '@github-decrypter/plan');
assert.ok(packageBuild !== null && packageBuild >= 40 && packageBuild <= policy.currentBuild);
assert.equal(pkg.exports?.['./task-graph'], './src/task-graph.ts');
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);

for (const marker of [
  'TASK_GRAPH_COMPILER_BUILD = 40',
  "TASK_GRAPH_SCHEMA = 'gd-task-graph/1'",
  "TASK_GRAPH_SOURCE_SCHEMA = 'gd-requirement-spec/1'",
  'TASK_GRAPH_MAX_NODES = 4096',
  'TASK_GRAPH_MAX_EDGES = 16384',
  "TASK_GRAPH_TASK_KINDS = ['requirement']",
  'compileTaskGraph(',
  'declaredRequirementDependencies(',
  'topologicalOrder(',
  'requirementCompilation: true',
  'taskGraphCompilation: true',
  'explicitDependenciesOnly: true',
  'dependencyInference: false',
  'dagValidated: true',
  'execution: false',
  'scheduling: false',
  'contextCompilation: false',
  'contextContinuation: false',
  'tokenAbstraction: false',
  'aiExecution: false',
  'persistence: false',
]) assert.ok(source.includes(marker), `missing Build 40 marker: ${marker}`);

assert.doesNotMatch(source, /^\s*import\s+(?!type\b)/m);
assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/);
assert.doesNotMatch(source, /\b(?:node:|process\.|require\s*\(|child_process|spawn\s*\(|exec\s*\()\b/);
assert.doesNotMatch(source, /@github-decrypter\/(?:ai|chat|context|tools|workspace|git)/);
assert.doesNotMatch(source, /\b(?:buildHierarchicalContext|continueContext|abstractTokens|resolveMention|ingestAttachment|routeModel|generate|executeTaskGraph)\b/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build40-task-graph-static/1',
  build: 40,
  package: '@github-decrypter/plan',
  packageBuild,
  deterministic: true,
  explicitDependenciesOnly: true,
  dependencyInference: false,
  execution: false,
}, null, 2));
