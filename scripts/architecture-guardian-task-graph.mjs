import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.taskGraphCompilerAuthority;
const violations = [];

const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 40 || rule.minimumBuild !== 40 || policy.phaseGates?.taskGraphCompilerBuild !== 40
  || rule.ownerPackage !== '@github-decrypter/plan' || rule.ownerSource !== 'packages/plan/src/task-graph.ts'
  || rule.inputSchema !== 'gd-requirement-spec/1' || rule.schema !== 'gd-task-graph/1'
) {
  violations.push({ code: 'AG380', message: 'Build 40 Task Graph Compiler authority is missing or inactive.' });
} else {
  const source = read('packages/plan/src/task-graph.ts');
  const planPackage = json('packages/plan/package.json');
  const packageRule = policy.packageRules?.['@github-decrypter/plan'];
  const studioPackage = json('apps/studio/package.json');
  const extensionPackage = json('apps/extension/package.json');
  const localPackage = json('apps/local/package.json');
  const packageBuild = versionBuild(planPackage.version);

  if (
    planPackage.name !== '@github-decrypter/plan' || packageBuild === null || packageBuild < 40 || packageBuild > policy.currentBuild
    || planPackage.exports?.['./task-graph'] !== './src/task-graph.ts'
    || Object.keys(planPackage.dependencies ?? {}).length !== 0
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify([])
  ) violations.push({ code: 'AG381', message: 'Task Graph package identity/export/dependency boundary is inconsistent.' });

  for (const marker of [
    'TASK_GRAPH_COMPILER_BUILD = 40',
    "TASK_GRAPH_SCHEMA = 'gd-task-graph/1'",
    "TASK_GRAPH_SOURCE_SCHEMA = 'gd-requirement-spec/1'",
    'TASK_GRAPH_MAX_NODES = 4096',
    'TASK_GRAPH_MAX_EDGES = 16384',
    "TASK_GRAPH_TASK_KINDS = ['requirement']",
    'compileTaskGraph(',
    "keys.length !== 1 || keys[0] !== 'spec'",
    'declaredRequirementDependencies(',
    'topologicalOrder(',
    'Task Graph contains a dependency cycle.',
    'taskGraphCompilation: true',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG382', message: 'Task Graph deterministic DAG contract is incomplete.', detail: marker });

  if (
    rule.requirementCompilerBuild !== 39 || rule.maxNodes !== 4096 || rule.maxEdges !== 16384
    || rule.deterministic !== true || rule.syntaxDirected !== true || rule.environmentNeutral !== true
    || rule.explicitDependenciesOnly !== true || rule.dependencyInference !== false || rule.dagValidation !== true
    || rule.cycleRejection !== true || rule.invalidDependencyRejection !== true
    || JSON.stringify(rule.exactInputFields) !== JSON.stringify(['spec'])
    || JSON.stringify(rule.taskKinds) !== JSON.stringify(['requirement'])
    || JSON.stringify(rule.supportingKinds) !== JSON.stringify(['goal','constraint','acceptance','non-goal','context'])
  ) violations.push({ code: 'AG383', message: 'Task Graph structural/DAG policy drifted.' });
  if (!source.includes("/\\[depends\\s*:\\s*([^\\]]*)\\]/gi") || !source.includes("/^req-\\d{4}$/")) {
    violations.push({ code: 'AG383', message: 'Task Graph explicit dependency syntax is incomplete.' });
  }

  if (/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|indexedDB|caches)\b/.test(source)) {
    violations.push({ code: 'AG384', message: 'Task Graph Compiler gained network/browser authority.' });
  }
  if (
    /^\s*import\s+(?!type\b)/m.test(source)
    || /\bnode:[A-Za-z0-9_/-]+/.test(source)
    || /\bprocess\./.test(source)
    || /\b(?:child_process|LocalDatabase|SecretsVault)\b/.test(source)
  ) {
    violations.push({ code: 'AG384', message: 'Task Graph Compiler gained Node/filesystem/process/database/secret authority.' });
  }
  if (/@github-decrypter\/(?:ai|chat|context|tools|workspace|git)/.test(source)) {
    violations.push({ code: 'AG384', message: 'Task Graph Compiler gained a forbidden workspace dependency.' });
  }

  for (const [field, value] of Object.entries({
    dependencyInference: false,
    execution: false,
    scheduling: false,
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
      violations.push({ code: 'AG385', message: 'Task Graph Compiler gained a deferred downstream authority.', detail: field });
    }
  }
  for (const [field, value] of Object.entries({
    requirementCompilation: true,
    taskGraphCompilation: true,
    explicitDependenciesOnly: true,
    dagValidated: true,
  })) {
    if (rule[field] !== value || !source.includes(`${field}: true`)) {
      violations.push({ code: 'AG385', message: 'Task Graph Compiler lost a declared Build 40 authority.', detail: field });
    }
  }

  if (
    rule.networkAuthority !== false || rule.filesystemAuthority !== false || rule.databaseAuthority !== false
    || rule.storageAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
  ) violations.push({ code: 'AG386', message: 'Task Graph Compiler policy granted transport or persistence authority.' });
  for (const [name, pkg] of [['studio', studioPackage], ['extension', extensionPackage]]) {
    if (pkg.dependencies?.['@github-decrypter/plan']) violations.push({ code: 'AG386', message: `Build 40 activated plan compilation inside ${name} prematurely.` });
  }
  if (localPackage.dependencies?.['@github-decrypter/plan']) {
    const localSourceRoot = path.join(root, 'apps/local/src');
    const localSources = fs.readdirSync(localSourceRoot)
      .filter((entry) => entry.endsWith('.ts'))
      .map((entry) => fs.readFileSync(path.join(localSourceRoot, entry), 'utf8'))
      .join('\n');
    const authorizedPlanAuthorityConsumer = policy.currentBuild >= 48
      && policy.phaseGates?.planAuthorityBuild === 48
      && policy.planAuthority?.minimumBuild === 48
      && policy.planAuthority?.runtimeOwnerRoot === 'apps/local';
    const taskGraphActivated = /from\s+['"]@github-decrypter\/plan(?:\/task-graph)?['"]/.test(localSources)
      || /\bcompileTaskGraph\b/.test(localSources);
    if (!authorizedPlanAuthorityConsumer || taskGraphActivated) {
      violations.push({ code: 'AG386', message: 'Build 40 activated plan compilation inside local prematurely.' });
    }
  }

  if (
    rule.hierarchicalContextBuild !== 41 || rule.contextContinuationBuild !== 42 || rule.tokenAbstractionBuild !== 43
    || rule.conversationEngineBuild !== 44 || rule.attachmentEngineBuild !== 45 || rule.contextMentionsBuild !== 46
  ) violations.push({ code: 'AG387', message: 'Task Graph downstream ownership boundaries drifted.' });
  if (/\b(?:buildHierarchicalContext|continueContext|abstractTokens|resolveMention|ingestAttachment|routeModel|generate|executeTaskGraph)\b/.test(source)) {
    violations.push({ code: 'AG387', message: 'A later-roadmap engine leaked into Task Graph Compiler.' });
  }

  for (const required of [
    'packages/plan/src/task-graph.ts',
    'docs/architecture/TASK_GRAPH_COMPILER.md',
    'docs/builds/BUILD_40_TASK_GRAPH_COMPILER.md',
    'scripts/architecture-guardian-task-graph.mjs',
    'scripts/test-build40-task-graph.mjs',
    'scripts/test-build40-task-graph-runtime.ts',
    'scripts/test-build40-task-graph-guardian-negative.mjs',
    'scripts/tsconfig.build40-tests.json',
    '.github/workflows/build40-task-graph-compiler.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG388', message: 'Required Build 40 artifact is missing.', detail: required });

  if (!read('docs/architecture/TASK_GRAPH_COMPILER.md').includes('Build 41 — Hierarchical Context Engine')
      || !read('docs/builds/BUILD_40_TASK_GRAPH_COMPILER.md').includes('Build 42 — Context Continuation Engine')) {
    violations.push({ code: 'AG389', message: 'Build 40 documentation does not preserve downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-task-graph-report/1',
  currentBuild: policy.currentBuild,
  taskGraphSchema: rule?.schema ?? null,
  deterministic: rule?.deterministic ?? null,
  explicitDependenciesOnly: rule?.explicitDependenciesOnly ?? null,
  dagValidation: rule?.dagValidation ?? null,
  dependencyInference: rule?.dependencyInference ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
