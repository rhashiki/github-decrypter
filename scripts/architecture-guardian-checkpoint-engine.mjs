import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.checkpointEngineAuthority;
const toolRule = policy.toolRuntimeAuthority;
const scopeRule = policy.scopeLockAuthority;
const scopeIntelligenceRule = policy.scopeIntelligenceAuthority;
const jobRule = policy.jobAuthority;
const capabilityRule = policy.capabilityAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 56 || rule.minimumBuild !== 56 || policy.phaseGates?.checkpointEngineBuild !== 56
  || rule.ownerPackage !== '@github-decrypter/tools' || rule.ownerSource !== 'packages/tools/src/checkpoint.ts'
  || rule.durableJobEngineBuild !== 12 || rule.buildOrchestratorBuild !== 52 || rule.toolRuntimeBuild !== 53
  || rule.scopeIntelligenceBuild !== 54 || rule.scopeLockBuild !== 55 || rule.validationPipelineBuild !== 57
  || rule.schema !== 'gd-checkpoint-engine/1' || rule.sourceBuildSchema !== 'gd-build-orchestrator/1'
  || rule.sourceToolRuntimeSchema !== 'gd-tool-runtime/1' || rule.sourceScopeLockSchema !== 'gd-scope-lock/1'
  || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG540', message: 'Build 56 Checkpoint Engine policy is missing or inactive.' });
} else {
  const toolsPackage = json('packages/tools/package.json');
  const rootPackage = json('package.json');
  const toolsVersion = versionBuild(toolsPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const packageRule = policy.packageRules?.['@github-decrypter/tools'];
  const expectedToolsExports = policy.currentBuild >= 57
    ? { '.': './src/index.ts', './checkpoint': './src/checkpoint.ts', './validation': './src/validation.ts' }
    : { '.': './src/index.ts', './checkpoint': './src/checkpoint.ts' };
  if (
    toolsPackage.name !== '@github-decrypter/tools' || toolsVersion === null || toolsVersion < 56
    || JSON.stringify(toolsPackage.exports) !== JSON.stringify(expectedToolsExports)
    || JSON.stringify(toolsPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/build': 'workspace:*', '@github-decrypter/scope': 'workspace:*' })
    || rootBuild === null || rootBuild < 56 || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/build','@github-decrypter/scope'])
  ) violations.push({ code: 'AG541', message: 'Build 56 package/root identity, export or dependency boundary drifted.' });

  const source = read('packages/tools/src/checkpoint.ts');
  const toolsSource = read('packages/tools/src/index.ts');
  for (const marker of [
    'CHECKPOINT_ENGINE_BUILD = 56',
    "CHECKPOINT_ENGINE_SCHEMA = 'gd-checkpoint-engine/1'",
    "CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
    "CHECKPOINT_ENGINE_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
    "CHECKPOINT_ENGINE_SOURCE_SCOPE_LOCK_SCHEMA = 'gd-scope-lock/1'",
    "CHECKPOINT_ENGINE_KIND = 'tool-invocation'",
    "CHECKPOINT_ENGINE_RECOVERY_BOUNDARY = 'after-invocation'",
    'createCheckpoint(',
    'assertCanonicalCheckpoint(',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG542', message: 'Checkpoint Engine core contract is incomplete.', detail: marker });
  for (const marker of [
    'assertCanonicalOrchestration(',
    'assertCanonicalInvocation(',
    'assertCanonicalScopeLock(',
    'canonicalInvocationMaterial(',
    'canonicalCompletionMaterial(',
    'canonicalCheckpointMaterial(',
    'sourceCompletionDigest',
    'inputDigest',
    'resultDigest',
    'checkpointDigest',
    'sha256Hex(',
    'Object.freeze({',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG543', message: 'Checkpoint Engine source binding, completion/result proof or deterministic identity is incomplete.', detail: marker });

  for (const candidate of [source, toolsSource]) {
    if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(candidate)
        || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(candidate)) {
      violations.push({ code: 'AG544', message: 'Build 56 gained direct environment, transport, persistence or replay authority.' });
    }
  }
  for (const field of [
    'capabilityGrantAuthority','mutationAuthorized','toolExecution','execution','restoreExecution','validationPipeline',
    'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) violations.push({ code: 'AG544', message: 'Checkpoint Engine policy gained forbidden authority.', detail: field });

  if (rule.digestAlgorithm !== 'sha256' || rule.checkpointKind !== 'tool-invocation' || rule.recoveryBoundary !== 'after-invocation'
      || rule.deterministic !== true || rule.environmentNeutral !== true || rule.workspaceScoped !== true
      || rule.completedInvocationRequired !== true || rule.sourceInvocationReadOnlyPreserved !== true
      || rule.resultDigestBinding !== true || rule.scopeLockConsumer !== true || rule.scopeLockRequiredForMutation !== true
      || rule.recoveryAnchor !== true || rule.checkpoints !== true) {
    violations.push({ code: 'AG545', message: 'Checkpoint Engine completion/result/recovery boundary drifted.' });
  }
  for (const marker of [
    'TOOL_RUNTIME_CHECKPOINT_INTEGRATION_BUILD = 56',
    "TOOL_RUNTIME_COMPLETION_SCHEMA = 'gd-tool-runtime-completion/1'",
    'completionDigest',
    'sourceCompletionDigest',
    'resultDigestBinding: true',
    'completedInvocationRequired: true',
    'recoveryAnchor: true',
    'checkpoints: true',
  ]) if (!(source.includes(marker) || toolsSource.includes(marker))) violations.push({ code: 'AG545', message: 'Checkpoint Engine completion/result binding is incomplete.', detail: marker });

  if (rule.validationPipelineBuild !== 57 || rule.validationPipeline !== false || rule.restoreExecution !== false
      || rule.scheduling !== false || rule.jobCreation !== false || rule.persistence !== false) {
    violations.push({ code: 'AG546', message: 'Checkpoint Engine prematurely owns Build 57, replay or durable runtime concerns.' });
  }
  if (!source.includes('validationPipeline: false') || !source.includes('restoreExecution: false') || !source.includes('persistence: false')) {
    violations.push({ code: 'AG546', message: 'Checkpoint Engine source does not preserve downstream and persistence boundaries.' });
  }

  if (!toolRule || toolRule.minimumBuild !== 53 || toolRule.checkpointEngineBuild !== 56 || toolRule.checkpoints !== false
      || toolRule.toolExecution !== true || toolRule.execution !== true || toolRule.capabilityGrantAuthority !== false) {
    violations.push({ code: 'AG547', message: 'Build 56 no longer preserves Tool Runtime ownership and non-checkpoint authority.' });
  }
  if (!scopeRule || scopeRule.minimumBuild !== 55 || scopeRule.checkpointEngineBuild !== 56 || scopeRule.checkpoints !== false
      || scopeRule.scopeLock !== true || scopeRule.mutationAuthorized !== false) {
    violations.push({ code: 'AG547', message: 'Build 56 no longer preserves Scope Lock ownership.' });
  }
  if (!scopeIntelligenceRule || scopeIntelligenceRule.minimumBuild !== 54 || scopeIntelligenceRule.checkpoints !== false) {
    violations.push({ code: 'AG547', message: 'Build 56 no longer preserves Scope Intelligence boundary.' });
  }
  if (!jobRule || jobRule.ownerRoot !== 'apps/local' || jobRule.minimumBuild !== 12 || rule.durableJobEngineSovereign !== true) {
    violations.push({ code: 'AG547', message: 'Build 56 no longer preserves Durable Job Engine persistence/recovery sovereignty.' });
  }
  if (!capabilityRule || capabilityRule.minimumBuild !== 15 || capabilityRule.denyByDefault !== true) {
    violations.push({ code: 'AG547', message: 'Build 56 no longer preserves capability authority.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/tools/checkpoint') || localIndex.includes('./checkpoint-engine.js')
      || studioSource.includes('@github-decrypter/tools/checkpoint')) {
    violations.push({ code: 'AG548', message: 'Build 56 prematurely introduced Local Runtime or Studio checkpoint transport.' });
  }

  for (const required of [
    'packages/tools/src/checkpoint.ts',
    'docs/architecture/CHECKPOINT_ENGINE.md',
    'docs/builds/BUILD_56_CHECKPOINT_ENGINE.md',
    'scripts/architecture-guardian-checkpoint-engine.mjs',
    'scripts/test-build56-checkpoint-engine.mjs',
    'scripts/test-build56-checkpoint-engine-runtime.ts',
    'scripts/test-build56-checkpoint-engine-guardian-negative.mjs',
    'scripts/tsconfig.build56-tests.json',
    '.github/workflows/build56-checkpoint-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG549', message: 'Required Build 56 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const architectureDoc = read('docs/architecture/CHECKPOINT_ENGINE.md');
  const buildDoc = read('docs/builds/BUILD_56_CHECKPOINT_ENGINE.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('persistent checkpoints') || !architectureDoc.includes('checkpoint != persistence')
      || !architectureDoc.includes('checkpoint != mutation authority') || !architectureDoc.includes('checkpoint != restore execution')
      || !architectureDoc.includes('Build 12') || !architectureDoc.includes('Build 57 — Validation Pipeline')
      || !buildDoc.includes('Build 57 — Validation Pipeline') || !roadmap.includes('56. **Checkpoint Engine**')) {
    violations.push({ code: 'AG549', message: 'Build 56 documentation does not preserve recovery, persistence and downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-checkpoint-engine-report/1',
  currentBuild: policy.currentBuild,
  checkpointSchema: rule?.schema ?? null,
  completionResultBinding: rule?.resultDigestBinding ?? null,
  durableJobEngineSovereign: rule?.durableJobEngineSovereign ?? null,
  checkpoints: rule?.checkpoints ?? null,
  restoreExecution: rule?.restoreExecution ?? null,
  validationPipeline: rule?.validationPipeline ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);