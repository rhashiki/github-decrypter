import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.scopeLockAuthority;
const scopeRule = policy.scopeIntelligenceAuthority;
const toolRule = policy.toolRuntimeAuthority;
const capabilityRule = policy.capabilityAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 55 || rule.minimumBuild !== 55 || policy.phaseGates?.scopeLockBuild !== 55
  || rule.ownerPackage !== '@github-decrypter/scope' || rule.ownerSource !== 'packages/scope/src/lock.ts'
  || rule.buildOrchestratorBuild !== 52 || rule.toolRuntimeBuild !== 53 || rule.scopeIntelligenceBuild !== 54
  || rule.checkpointEngineBuild !== 56 || rule.validationPipelineBuild !== 57
  || rule.schema !== 'gd-scope-lock/1' || rule.sourceScopeSchema !== 'gd-scope-intelligence/1'
  || rule.sourceBuildSchema !== 'gd-build-orchestrator/1' || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG530', message: 'Build 55 Scope Lock policy is missing or inactive.' });
} else {
  const scopePackage = json('packages/scope/package.json');
  const toolsPackage = json('packages/tools/package.json');
  const rootPackage = json('package.json');
  const scopeVersion = versionBuild(scopePackage.version);
  const toolsVersion = versionBuild(toolsPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const scopePackageRule = policy.packageRules?.['@github-decrypter/scope'];
  const toolsPackageRule = policy.packageRules?.['@github-decrypter/tools'];
  if (
    scopePackage.name !== '@github-decrypter/scope' || scopeVersion === null || scopeVersion < 55
    || JSON.stringify(scopePackage.exports) !== JSON.stringify({ '.': './src/index.ts', './lock': './src/lock.ts' })
    || JSON.stringify(scopePackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/build': 'workspace:*' })
    || toolsPackage.name !== '@github-decrypter/tools' || toolsVersion === null || toolsVersion < 55
    || toolsPackage.exports !== './src/index.ts'
    || JSON.stringify(toolsPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/build': 'workspace:*', '@github-decrypter/scope': 'workspace:*' })
    || rootBuild === null || rootBuild < 55
    || !scopePackageRule || scopePackageRule.environmentNeutral !== true
    || JSON.stringify(scopePackageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/build'])
    || !toolsPackageRule || toolsPackageRule.environmentNeutral !== true
    || JSON.stringify(toolsPackageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/build','@github-decrypter/scope'])
  ) violations.push({ code: 'AG531', message: 'Build 55 package/root identity, export or dependency boundary drifted.' });

  const lockSource = read('packages/scope/src/lock.ts');
  const toolsSource = read('packages/tools/src/index.ts');
  for (const marker of [
    'SCOPE_LOCK_BUILD = 55',
    "SCOPE_LOCK_SCHEMA = 'gd-scope-lock/1'",
    "SCOPE_LOCK_SOURCE_SCOPE_SCHEMA = 'gd-scope-intelligence/1'",
    "SCOPE_LOCK_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
    "SCOPE_LOCK_MODE = 'BUILD'",
    'SCOPE_LOCK_MAX_CANDIDATES = 4096',
    "SCOPE_LOCK_MUTATION_ACCESS = Object.freeze(['write', 'execute']",
    'lockScope(',
    'assertCanonicalScopeLock(',
    'assertScopeLockAllowsMutation(',
  ]) if (!lockSource.includes(marker)) violations.push({ code: 'AG532', message: 'Scope Lock core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalScopeIntelligence(',
    'analyzeScope({',
    'canonicalLockMaterial(',
    'canonicalLockedSelection(',
    'sha256Hex(',
    'sourceScopeDigest',
    'sourceOrchestrationDigest',
    'lockDigest',
    'Object.freeze({',
  ]) if (!lockSource.includes(marker)) violations.push({ code: 'AG533', message: 'Scope Lock source binding, deterministic identity or immutability is incomplete.', detail: marker });

  for (const source of [lockSource, toolsSource]) {
    if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
        || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
      violations.push({ code: 'AG534', message: 'Build 55 gained direct environment, transport, execution or mutation authority.' });
    }
  }
  for (const field of [
    'automaticExpansion','semanticInference','capabilityGrantAuthority','mutationAuthorized','toolExecution','checkpoints',
    'validationPipeline','execution','scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
    'databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) {
    violations.push({ code: 'AG534', message: 'Scope Lock policy gained forbidden authority.', detail: field });
  }

  if (rule.deterministic !== true || rule.environmentNeutral !== true || rule.workspaceScoped !== true
      || rule.explicitLock !== true || rule.exactCandidateAllowlist !== true || rule.scopeIntelligence !== true
      || rule.scopeLockRequired !== true || rule.scopeLock !== true || rule.scopeLocked !== true
      || rule.mutationBoundarySatisfied !== true || rule.capabilitiesRequired !== true
      || rule.capabilityVerifierRequired !== true || rule.toolRuntimeScopedMutationIntegration !== true
      || JSON.stringify(rule.mutationAccess) !== JSON.stringify(['write','execute'])) {
    violations.push({ code: 'AG535', message: 'Scope Lock explicit allowlist, capability separation or lock boundary drifted.' });
  }
  for (const marker of [
    'exactCandidateAllowlist: true',
    'automaticExpansion: false',
    'semanticInference: false',
    'capabilitiesRequired: true',
    'capabilityVerifierRequired: true',
    'capabilityGrantAuthority: false',
    'mutationAuthorized: false',
    'candidate.buildStepId !== buildStepId',
    'candidate.access !== access',
  ]) if (!lockSource.includes(marker)) violations.push({ code: 'AG535', message: 'Scope Lock exact candidate/capability boundary is incomplete.', detail: marker });
  for (const marker of [
    'TOOL_RUNTIME_SCOPE_LOCK_INTEGRATION_BUILD = 55',
    "from '@github-decrypter/scope/lock'",
    'if (registration.descriptor.mutating)',
    'if (!scopeLock) throw new ToolRuntimeMutationBlockedError',
    'assertScopeLockAllowsMutation(',
    'if (await verifyCapability(request) !== true)',
    'mutationAuthorized = true',
  ]) if (!toolsSource.includes(marker)) violations.push({ code: 'AG535', message: 'Tool Runtime Scope Lock integration is incomplete.', detail: marker });

  if (rule.checkpointEngineBuild !== 56 || rule.validationPipelineBuild !== 57
      || rule.checkpoints !== false || rule.validationPipeline !== false || rule.persistence !== false
      || rule.scheduling !== false || rule.jobCreation !== false) {
    violations.push({ code: 'AG536', message: 'Scope Lock prematurely owns Build 56/57 or durable execution concerns.' });
  }

  if (!scopeRule || scopeRule.minimumBuild !== 54 || scopeRule.scopeLockBuild !== 55
      || scopeRule.scopeIntelligence !== true || scopeRule.scopeLock !== false || scopeRule.mutationAuthorized !== false) {
    violations.push({ code: 'AG537', message: 'Build 55 no longer preserves Build 54 advisory Scope Intelligence authority.' });
  }
  if (!toolRule || toolRule.minimumBuild !== 53 || toolRule.scopeLockBuild !== 55
      || toolRule.scopeLockConsumer !== true || toolRule.scopedMutationAuthorization !== true
      || toolRule.mutatingToolsBlockedWithoutScopeLock !== true || toolRule.capabilityVerifierRequired !== true
      || toolRule.capabilityGrantAuthority !== false || toolRule.mutationAuthorized !== false
      || toolRule.checkpoints !== false || toolRule.validationPipeline !== false) {
    violations.push({ code: 'AG537', message: 'Build 55 Tool Runtime integration or capability boundary drifted.' });
  }
  if (!capabilityRule || capabilityRule.minimumBuild !== 15 || capabilityRule.denyByDefault !== true
      || JSON.stringify(capabilityRule.requiredCapabilities) !== JSON.stringify(['READ','WRITE','EXECUTE','NETWORK','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS'])) {
    violations.push({ code: 'AG537', message: 'Build 55 no longer preserves Build 15 capability authority.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/scope/lock') || localIndex.includes('./scope-lock.js')
      || studioSource.includes('@github-decrypter/scope/lock') || studioSource.includes('@github-decrypter/tools')) {
    violations.push({ code: 'AG538', message: 'Build 55 prematurely introduced Local Runtime or Studio Scope Lock transport.' });
  }

  for (const required of [
    'packages/scope/src/lock.ts',
    'packages/tools/src/index.ts',
    'docs/architecture/SCOPE_LOCK.md',
    'docs/builds/BUILD_55_SCOPE_LOCK.md',
    'scripts/architecture-guardian-scope-lock.mjs',
    'scripts/test-build55-scope-lock.mjs',
    'scripts/test-build55-scope-lock-runtime.ts',
    'scripts/test-build55-scope-lock-guardian-negative.mjs',
    'scripts/tsconfig.build55-tests.json',
    '.github/workflows/build55-scope-lock.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG539', message: 'Required Build 55 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const architectureDoc = read('docs/architecture/SCOPE_LOCK.md');
  const buildDoc = read('docs/builds/BUILD_55_SCOPE_LOCK.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('BUILD operates only through explicit capabilities and Scope Lock')
      || !architectureDoc.includes('scope lock != capability grant')
      || !architectureDoc.includes('Build 56 — Checkpoint Engine')
      || !architectureDoc.includes('Build 57 — Validation Pipeline')
      || !buildDoc.includes('Build 56 — Checkpoint Engine')
      || !roadmap.includes('55. **Scope Lock**')) {
    violations.push({ code: 'AG539', message: 'Build 55 documentation does not preserve capability and downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-scope-lock-report/1',
  currentBuild: policy.currentBuild,
  scopeLockSchema: rule?.schema ?? null,
  exactCandidateAllowlist: rule?.exactCandidateAllowlist ?? null,
  capabilityGrantAuthority: rule?.capabilityGrantAuthority ?? null,
  mutationAuthorized: rule?.mutationAuthorized ?? null,
  toolRuntimeScopedMutationIntegration: rule?.toolRuntimeScopedMutationIntegration ?? null,
  checkpoints: rule?.checkpoints ?? null,
  validationPipeline: rule?.validationPipeline ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
