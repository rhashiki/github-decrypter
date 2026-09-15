import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const toolsPackage = json('packages/tools/package.json');
const checkpointSource = read('packages/tools/src/checkpoint.ts');
const toolsSource = read('packages/tools/src/index.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.ok(policy.currentBuild >= 56);
assert.equal(policy.phaseGates?.checkpointEngineBuild, 56);
assert.ok(versionBuild(rootPackage.version) >= 56);
assert.equal(toolsPackage.name, '@github-decrypter/tools');
assert.ok(versionBuild(toolsPackage.version) >= 56);
assert.deepEqual(toolsPackage.exports, { '.': './src/index.ts', './checkpoint': './src/checkpoint.ts' });
assert.deepEqual(toolsPackage.dependencies, { '@github-decrypter/build': 'workspace:*', '@github-decrypter/scope': 'workspace:*' });
assert.deepEqual(policy.packageRules?.['@github-decrypter/tools']?.allowedWorkspaceDependencies, ['@github-decrypter/build','@github-decrypter/scope']);

for (const marker of [
  'CHECKPOINT_ENGINE_BUILD = 56',
  "CHECKPOINT_ENGINE_SCHEMA = 'gd-checkpoint-engine/1'",
  "CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
  "CHECKPOINT_ENGINE_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
  "CHECKPOINT_ENGINE_SOURCE_SCOPE_LOCK_SCHEMA = 'gd-scope-lock/1'",
  "CHECKPOINT_ENGINE_MODE = 'BUILD'",
  "CHECKPOINT_ENGINE_KIND = 'tool-invocation'",
  "CHECKPOINT_ENGINE_RECOVERY_BOUNDARY = 'after-invocation'",
  'createCheckpoint(',
  'assertCanonicalCheckpoint(',
  'canonicalCheckpointMaterial(',
  'canonicalCompletionMaterial(',
  'sourceCompletionDigest',
  'resultDigestBinding: true',
  'recoveryAnchor: true',
  'durableJobEngineSovereign: true',
  'checkpoints: true',
  'restoreExecution: false',
  'validationPipeline: false',
  'persistence: false',
]) assert.ok(checkpointSource.includes(marker), `Missing Checkpoint Engine marker: ${marker}`);

for (const marker of [
  'TOOL_RUNTIME_CHECKPOINT_INTEGRATION_BUILD = 56',
  "TOOL_RUNTIME_COMPLETION_SCHEMA = 'gd-tool-runtime-completion/1'",
  'canonicalCompletionMaterial(',
  'completionDigest',
  'checkpoints: false',
]) assert.ok(toolsSource.includes(marker), `Missing Tool Runtime Build 56 completion marker: ${marker}`);

for (const source of [checkpointSource, toolsSource]) {
  for (const forbidden of [
    /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
    /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/, /\bfs\./,
    /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
  ]) assert.equal(forbidden.test(source), false, `Build 56 gained forbidden environment authority: ${forbidden}`);
}

const authority = policy.checkpointEngineAuthority;
assert.ok(authority, 'Checkpoint Engine central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/tools');
assert.equal(authority.ownerSource, 'packages/tools/src/checkpoint.ts');
assert.equal(authority.minimumBuild, 56);
assert.equal(authority.durableJobEngineBuild, 12);
assert.equal(authority.buildOrchestratorBuild, 52);
assert.equal(authority.toolRuntimeBuild, 53);
assert.equal(authority.scopeIntelligenceBuild, 54);
assert.equal(authority.scopeLockBuild, 55);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.schema, 'gd-checkpoint-engine/1');
assert.equal(authority.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(authority.sourceToolRuntimeSchema, 'gd-tool-runtime/1');
assert.equal(authority.sourceScopeLockSchema, 'gd-scope-lock/1');
assert.equal(authority.mode, 'BUILD');
assert.equal(authority.digestAlgorithm, 'sha256');
assert.equal(authority.checkpointKind, 'tool-invocation');
assert.equal(authority.recoveryBoundary, 'after-invocation');
for (const field of [
  'deterministic','environmentNeutral','workspaceScoped','completedInvocationRequired','sourceInvocationReadOnlyPreserved',
  'resultDigestBinding','scopeLockConsumer','scopeLockRequiredForMutation','recoveryAnchor','durableJobEngineSovereign','checkpoints',
]) assert.equal(authority[field], true, `Checkpoint Engine authority drifted: ${field}`);
for (const field of [
  'capabilityGrantAuthority','mutationAuthorized','toolExecution','execution','restoreExecution','validationPipeline',
  'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Checkpoint Engine authority boundary drifted: ${field}`);

assert.equal(policy.toolRuntimeAuthority?.checkpoints, false);
assert.equal(policy.scopeLockAuthority?.checkpoints, false);
assert.equal(policy.scopeIntelligenceAuthority?.checkpoints, false);
assert.equal(policy.jobAuthority?.ownerRoot, 'apps/local');
assert.equal(policy.jobAuthority?.minimumBuild, 12);
assert.equal(policy.checkpointEngineAuthority?.durableJobEngineSovereign, true);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build56-checkpoint-engine-static/1',
  build: 56,
  checkpointSchema: authority.schema,
  completionDigestBinding: true,
  resultDigestBinding: true,
  durableJobEngineSovereign: true,
  restoreExecution: false,
  nextBuild: 57,
}, null, 2));