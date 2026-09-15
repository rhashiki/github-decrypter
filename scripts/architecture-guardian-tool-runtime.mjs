import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.toolRuntimeAuthority;
const buildRule = policy.buildOrchestratorAuthority;
const capabilityRule = policy.capabilityAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 53 || rule.minimumBuild !== 53 || policy.phaseGates?.toolRuntimeBuild !== 53
  || rule.ownerPackage !== '@github-decrypter/tools' || rule.ownerSource !== 'packages/tools/src/index.ts'
  || rule.buildOrchestratorBuild !== 52 || rule.capabilitySecurityBuild !== 15
  || rule.schema !== 'gd-tool-runtime/1' || rule.sourceBuildSchema !== 'gd-build-orchestrator/1'
  || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG510', message: 'Build 53 Tool Runtime policy is missing or inactive.' });
} else {
  const toolsPackage = json('packages/tools/package.json');
  const rootPackage = json('package.json');
  const toolsVersion = versionBuild(toolsPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const packageRule = policy.packageRules?.['@github-decrypter/tools'];
  const expectedToolDependencies = policy.currentBuild >= 55
    ? ['@github-decrypter/build','@github-decrypter/scope']
    : ['@github-decrypter/build'];
  if (
    toolsPackage.name !== '@github-decrypter/tools' || toolsVersion === null || toolsVersion < 53
    || toolsPackage.exports !== './src/index.ts'
    || toolsPackage.dependencies?.['@github-decrypter/build'] !== 'workspace:*'
    || JSON.stringify(Object.keys(toolsPackage.dependencies ?? {}).sort()) !== JSON.stringify(expectedToolDependencies)
    || rootBuild === null || rootBuild < 53
    || !packageRule || packageRule.environmentNeutral !== true
    || !Array.isArray(packageRule.allowedWorkspaceDependencies)
    || !packageRule.allowedWorkspaceDependencies.includes('@github-decrypter/build')
    || (policy.currentBuild >= 55 && !packageRule.allowedWorkspaceDependencies.includes('@github-decrypter/scope'))
  ) violations.push({ code: 'AG511', message: 'Build 53 package/root identity, dependency boundary or package authority drifted.' });

  const source = read('packages/tools/src/index.ts');
  for (const marker of [
    'TOOL_RUNTIME_BUILD = 53',
    "TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
    "TOOL_RUNTIME_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
    "TOOL_RUNTIME_MODE = 'BUILD'",
    'TOOL_RUNTIME_MAX_TOOLS = 256',
    'TOOL_RUNTIME_CAPABILITIES = Object.freeze([',
    'createToolRuntime(',
    'toolExecution: true',
    'execution: true',
    'mutationAuthorized: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG512', message: 'Tool Runtime core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalOrchestration(',
    'canonicalOrchestrationMaterial(',
    'canonicalInvocationMaterial(',
    'sha256Hex(',
    'immutableToolValue(',
    'Object.freeze({',
    'sourceOrchestrationDigest',
    'invocationDigest',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG513', message: 'Tool Runtime Build binding, deterministic identity or immutability is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG514', message: 'Tool Runtime gained direct environment, transport or mutation authority.' });
  }
  for (const field of ['networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport','persistence','scheduling','jobCreation','mutationAuthorized']) {
    if (rule[field] !== false) violations.push({ code: 'AG514', message: 'Tool Runtime policy gained direct environment, transport, mutation or persistence authority.', detail: field });
  }

  const requiredCapabilities = ['READ','WRITE','EXECUTE','NETWORK','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS'];
  if (JSON.stringify(rule.requiredCapabilities) !== JSON.stringify(requiredCapabilities)
      || rule.denyByDefault !== true || rule.capabilityVerifierRequired !== true || rule.capabilityGrantAuthority !== false
      || rule.handlerDispatch !== true || rule.toolExecution !== true || rule.execution !== true
      || rule.mutatingToolsBlocked !== true || rule.scopeLockRequired !== true || rule.mutationAuthorized !== false) {
    violations.push({ code: 'AG515', message: 'Tool Runtime capability or default execute-without-mutate boundary drifted.' });
  }
  for (const marker of [
    'verifyCapability',
    'ToolRuntimeCapabilityError',
    'ToolRuntimeMutationBlockedError',
    'if (await verifyCapability(request) !== true)',
    'if (registration.descriptor.mutating)',
    'capabilityGrantAuthority: false',
    'denyByDefault: true',
    'scopeLockRequired: true',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG515', message: 'Tool Runtime capability enforcement is incomplete.', detail: marker });
  if (policy.currentBuild >= 55) {
    if (rule.scopeLockConsumer !== true || rule.scopedMutationAuthorization !== true
        || rule.mutatingToolsBlockedWithoutScopeLock !== true
        || !source.includes('TOOL_RUNTIME_SCOPE_LOCK_INTEGRATION_BUILD = 55')
        || !source.includes('assertCanonicalScopeLock(')
        || !source.includes('assertScopeLockAllowsMutation(')) {
      violations.push({ code: 'AG515', message: 'Tool Runtime Build 55 Scope Lock integration drifted.' });
    }
  }

  const downstream = {
    scopeIntelligenceBuild: 54,
    scopeLockBuild: 55,
    checkpointEngineBuild: 56,
    validationPipelineBuild: 57,
  };
  for (const [field, expected] of Object.entries(downstream)) if (rule[field] !== expected) {
    violations.push({ code: 'AG516', message: 'Tool Runtime downstream Build ownership drifted.', detail: field });
  }
  for (const field of ['scopeIntelligence','scopeLock','checkpoints','validationPipeline','mutationAuthorized','scheduling','jobCreation','persistence']) {
    if (rule[field] !== false) violations.push({ code: 'AG516', message: 'Tool Runtime prematurely owns a downstream concern.', detail: field });
  }

  if (!buildRule || buildRule.minimumBuild !== 52 || buildRule.toolRuntimeBuild !== 53
      || buildRule.toolExecution !== false || buildRule.execution !== false || buildRule.mutationAuthorized !== false
      || buildRule.scopeLockRequired !== true || buildRule.scopeLock !== false) {
    violations.push({ code: 'AG517', message: 'Build 53 no longer preserves Build 52 orchestration ownership and pre-runtime boundary.' });
  }
  if (!capabilityRule || capabilityRule.minimumBuild !== 15 || capabilityRule.denyByDefault !== true
      || JSON.stringify(capabilityRule.requiredCapabilities) !== JSON.stringify(requiredCapabilities)) {
    violations.push({ code: 'AG517', message: 'Build 53 no longer preserves Build 15 capability authority.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/tools') || localIndex.includes('./tool-runtime.js')
      || studioSource.includes('@github-decrypter/tools')) {
    violations.push({ code: 'AG518', message: 'Build 53 prematurely introduced Local Runtime or Studio Tool Runtime transport.' });
  }

  for (const required of [
    'packages/tools/src/index.ts',
    'docs/architecture/TOOL_RUNTIME.md',
    'docs/builds/BUILD_53_TOOL_RUNTIME.md',
    'scripts/architecture-guardian-tool-runtime.mjs',
    'scripts/test-build53-tool-runtime.mjs',
    'scripts/test-build53-tool-runtime-runtime.ts',
    'scripts/test-build53-tool-runtime-guardian-negative.mjs',
    'scripts/tsconfig.build53-tests.json',
    '.github/workflows/build53-tool-runtime.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG519', message: 'Required Build 53 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const architectureDoc = read('docs/architecture/TOOL_RUNTIME.md');
  const buildDoc = read('docs/builds/BUILD_53_TOOL_RUNTIME.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('BUILD operates only through explicit capabilities and Scope Lock')
      || !architectureDoc.includes('execute != mutate')
      || !architectureDoc.includes('Build 54 — Scope Intelligence')
      || !buildDoc.includes('Build 54 — Scope Intelligence')
      || !roadmap.includes('53. **Tool Runtime**')) {
    violations.push({ code: 'AG519', message: 'Build 53 documentation does not preserve capability, mutation or downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-tool-runtime-report/1',
  currentBuild: policy.currentBuild,
  toolRuntimeSchema: rule?.schema ?? null,
  mode: rule?.mode ?? null,
  denyByDefault: rule?.denyByDefault ?? null,
  toolExecution: rule?.toolExecution ?? null,
  execution: rule?.execution ?? null,
  mutationAuthorized: rule?.mutationAuthorized ?? null,
  scopeLock: rule?.scopeLock ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
