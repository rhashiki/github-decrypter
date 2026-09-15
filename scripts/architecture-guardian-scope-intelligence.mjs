import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.scopeIntelligenceAuthority;
const buildRule = policy.buildOrchestratorAuthority;
const toolRule = policy.toolRuntimeAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 54 || rule.minimumBuild !== 54 || policy.phaseGates?.scopeIntelligenceBuild !== 54
  || rule.ownerPackage !== '@github-decrypter/scope' || rule.ownerSource !== 'packages/scope/src/index.ts'
  || rule.buildOrchestratorBuild !== 52 || rule.toolRuntimeBuild !== 53
  || rule.scopeLockBuild !== 55 || rule.checkpointEngineBuild !== 56 || rule.validationPipelineBuild !== 57
  || rule.schema !== 'gd-scope-intelligence/1' || rule.sourceBuildSchema !== 'gd-build-orchestrator/1'
  || rule.mode !== 'BUILD'
) {
  violations.push({ code: 'AG520', message: 'Build 54 Scope Intelligence policy is missing or inactive.' });
} else {
  const scopePackage = json('packages/scope/package.json');
  const rootPackage = json('package.json');
  const scopeVersion = versionBuild(scopePackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const packageRule = policy.packageRules?.['@github-decrypter/scope'];
  const expectedExports = scopeVersion !== null && scopeVersion >= 55
    ? { '.': './src/index.ts', './lock': './src/lock.ts' }
    : './src/index.ts';
  if (
    scopePackage.name !== '@github-decrypter/scope' || scopeVersion === null || scopeVersion < 54
    || JSON.stringify(scopePackage.exports) !== JSON.stringify(expectedExports)
    || JSON.stringify(scopePackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/build': 'workspace:*' })
    || rootBuild === null || rootBuild < 54
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/build'])
  ) violations.push({ code: 'AG521', message: 'Build 54 package/root identity, dependency boundary or package authority drifted.' });

  const source = read('packages/scope/src/index.ts');
  for (const marker of [
    'SCOPE_INTELLIGENCE_BUILD = 54',
    "SCOPE_INTELLIGENCE_SCHEMA = 'gd-scope-intelligence/1'",
    "SCOPE_INTELLIGENCE_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
    "SCOPE_INTELLIGENCE_MODE = 'BUILD'",
    'SCOPE_INTELLIGENCE_MAX_CANDIDATES = 4096',
    "SCOPE_ACCESS_KINDS = Object.freeze(['read', 'write', 'execute']",
    'analyzeScope(',
    'scopeIntelligence: true',
    'scopeLock: false',
    'scopeLocked: false',
    'mutationAuthorized: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG522', message: 'Scope Intelligence core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalOrchestration(',
    'canonicalOrchestrationMaterial(',
    'canonicalScopeMaterial(',
    'sha256Hex(',
    'sourceOrchestrationDigest',
    'scopeDigest',
    'Object.freeze({',
    'Object.freeze(row.candidates.map',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG523', message: 'Scope Intelligence Build binding, deterministic identity or immutability is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
    violations.push({ code: 'AG524', message: 'Scope Intelligence gained direct environment, transport, execution or mutation authority.' });
  }
  for (const field of [
    'semanticInference','automaticDiscovery','scopeLock','scopeLocked','mutationAuthorized','capabilityGrantAuthority','toolExecution',
    'execution','checkpoints','validationPipeline','scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
    'databaseAuthority','studioTransport','localRuntimeTransport',
  ]) if (rule[field] !== false) {
    violations.push({ code: 'AG524', message: 'Scope Intelligence policy gained forbidden authority.', detail: field });
  }

  if (rule.advisoryOnly !== true || rule.explicitCandidatesOnly !== true || rule.scopeIntelligence !== true
      || rule.scopeLockRequired !== true || rule.deterministic !== true || rule.workspaceScoped !== true
      || JSON.stringify(rule.accessKinds) !== JSON.stringify(['read','write','execute'])) {
    violations.push({ code: 'AG525', message: 'Scope Intelligence advisory/explicit-candidate boundary drifted.' });
  }
  for (const marker of [
    'advisoryOnly: true',
    'explicitCandidatesOnly: true',
    'semanticInference: false',
    'automaticDiscovery: false',
    'coveredBuildStepIds',
    'uncoveredBuildStepIds',
    'writeCandidateIds',
    'executeCandidateIds',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG525', message: 'Scope Intelligence structural analysis contract is incomplete.', detail: marker });

  const downstream = { scopeLockBuild: 55, checkpointEngineBuild: 56, validationPipelineBuild: 57 };
  for (const [field, expected] of Object.entries(downstream)) if (rule[field] !== expected) {
    violations.push({ code: 'AG526', message: 'Scope Intelligence downstream Build ownership drifted.', detail: field });
  }
  for (const field of ['scopeLock','scopeLocked','mutationAuthorized','checkpoints','validationPipeline','execution']) if (rule[field] !== false) {
    violations.push({ code: 'AG526', message: 'Scope Intelligence prematurely owns a downstream concern.', detail: field });
  }

  if (!buildRule || buildRule.minimumBuild !== 52 || buildRule.scopeIntelligenceBuild !== 54
      || buildRule.scopeIntelligence !== false || buildRule.scopeLock !== false || buildRule.mutationAuthorized !== false) {
    violations.push({ code: 'AG527', message: 'Build 54 no longer preserves Build 52 pre-scope orchestration boundary.' });
  }
  if (!toolRule || toolRule.minimumBuild !== 53 || toolRule.scopeIntelligenceBuild !== 54
      || toolRule.scopeIntelligence !== false || toolRule.scopeLock !== false || toolRule.mutationAuthorized !== false
      || toolRule.mutatingToolsBlocked !== true) {
    violations.push({ code: 'AG527', message: 'Build 54 no longer preserves Build 53 execute-without-mutate boundary.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/scope') || localIndex.includes('./scope-intelligence.js')
      || studioSource.includes('@github-decrypter/scope')) {
    violations.push({ code: 'AG528', message: 'Build 54 prematurely introduced Local Runtime or Studio Scope Intelligence transport.' });
  }

  for (const required of [
    'packages/scope/src/index.ts',
    'docs/architecture/SCOPE_INTELLIGENCE.md',
    'docs/builds/BUILD_54_SCOPE_INTELLIGENCE.md',
    'scripts/architecture-guardian-scope-intelligence.mjs',
    'scripts/test-build54-scope-intelligence.mjs',
    'scripts/test-build54-scope-intelligence-runtime.ts',
    'scripts/test-build54-scope-intelligence-guardian-negative.mjs',
    'scripts/tsconfig.build54-tests.json',
    '.github/workflows/build54-scope-intelligence.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG529', message: 'Required Build 54 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const architectureDoc = read('docs/architecture/SCOPE_INTELLIGENCE.md');
  const buildDoc = read('docs/builds/BUILD_54_SCOPE_INTELLIGENCE.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('BUILD operates only through explicit capabilities and Scope Lock')
      || !architectureDoc.includes('scope intelligence != scope lock')
      || !architectureDoc.includes('Build 55 — Scope Lock')
      || !buildDoc.includes('Build 55 — Scope Lock')
      || !roadmap.includes('54. **Scope Intelligence**')) {
    violations.push({ code: 'AG529', message: 'Build 54 documentation does not preserve Scope Lock and downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-scope-intelligence-report/1',
  currentBuild: policy.currentBuild,
  scopeIntelligenceSchema: rule?.schema ?? null,
  advisoryOnly: rule?.advisoryOnly ?? null,
  scopeIntelligence: rule?.scopeIntelligence ?? null,
  scopeLock: rule?.scopeLock ?? null,
  mutationAuthorized: rule?.mutationAuthorized ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
