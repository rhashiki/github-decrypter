import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.buildOrchestratorAuthority;
const planRule = policy.planAuthority;
const decisionRule = policy.decisionEngineAuthority;
const projectRulesRule = policy.projectRulesAuthority;
const impactRule = policy.impactSimulationAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 52 || rule.minimumBuild !== 52 || policy.phaseGates?.buildOrchestratorBuild !== 52
  || rule.ownerPackage !== '@github-decrypter/build' || rule.ownerSource !== 'packages/build/src/index.ts'
  || rule.planAuthorityBuild !== 48 || rule.decisionEngineBuild !== 49 || rule.projectRulesBuild !== 50
  || rule.impactSimulationBuild !== 51 || rule.schema !== 'gd-build-orchestrator/1'
  || rule.sourcePlanSchema !== 'gd-plan-authority/1' || rule.sourceProjectRulesSchema !== 'gd-project-rules/1'
  || rule.sourceImpactSimulationSchema !== 'gd-impact-simulation/1' || rule.mode !== 'BUILD'
  || rule.transition !== 'PLAN_TO_BUILD'
) {
  violations.push({ code: 'AG500', message: 'Build 52 Build Orchestrator policy is missing or inactive.' });
} else {
  const buildPackage = json('packages/build/package.json');
  const rootPackage = json('package.json');
  const buildVersion = versionBuild(buildPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const packageRule = policy.packageRules?.['@github-decrypter/build'];
  if (
    buildPackage.name !== '@github-decrypter/build' || buildVersion === null || buildVersion < 52
    || buildPackage.exports !== './src/index.ts'
    || JSON.stringify(buildPackage.dependencies ?? {}) !== JSON.stringify({ '@github-decrypter/plan': 'workspace:*' })
    || rootBuild === null || rootBuild < 52
    || !packageRule || packageRule.environmentNeutral !== true
    || JSON.stringify(packageRule.allowedWorkspaceDependencies) !== JSON.stringify(['@github-decrypter/plan'])
  ) violations.push({ code: 'AG501', message: 'Build 52 package/root identity, dependency boundary or package authority drifted.' });

  const source = read('packages/build/src/index.ts');
  for (const marker of [
    'BUILD_ORCHESTRATOR_BUILD = 52',
    "BUILD_ORCHESTRATOR_SCHEMA = 'gd-build-orchestrator/1'",
    "BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
    "BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA = 'gd-project-rules/1'",
    "BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA = 'gd-impact-simulation/1'",
    "BUILD_ORCHESTRATOR_MODE = 'BUILD'",
    "BUILD_ORCHESTRATOR_TRANSITION = 'PLAN_TO_BUILD'",
    'BUILD_ORCHESTRATOR_MAX_STEPS = 4096',
    'orchestrateBuild(',
    'buildTransitionAuthorized: true',
    'buildOrchestration: true',
    'mutationAuthorized: false',
    'toolExecution: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG502', message: 'Build Orchestrator core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalApprovedPlan(',
    'assertCanonicalProjectRules(',
    'assertCanonicalImpactSimulation(',
    'canonicalPlanMaterial(',
    'canonicalRulesMaterial(',
    'canonicalImpactMaterial(',
    'canonicalOrchestrationMaterial(',
    'buildStepFromTask(',
    'taskToStep',
    'buildOrder',
    'Object.freeze({',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG503', message: 'Build Orchestrator source binding, DAG mapping, digest binding or immutability is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /\.grant\s*\(|\.authorize\s*\(|\.enqueue\s*\(|\.claimNext\s*\(|spawn\s*\(|exec\s*\(|\.writeFile\s*\(/.test(source)) {
    violations.push({ code: 'AG504', message: 'Build Orchestrator gained environment, transport, execution or mutation authority.' });
  }
  for (const field of ['networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport','persistence','execution','scheduling','jobCreation','toolExecution','mutationAuthorized']) {
    if (rule[field] !== false) violations.push({ code: 'AG504', message: 'Build Orchestrator policy gained environment, transport, execution, mutation or persistence authority.', detail: field });
  }

  for (const [field, expected] of Object.entries({
    deterministic: true,
    environmentNeutral: true,
    workspaceScoped: true,
    explicitTransition: true,
    sourcePlanReadOnlyPreserved: true,
    projectRulesReadOnlyPreserved: true,
    impactSimulationReadOnlyPreserved: true,
    buildTransitionAuthorized: true,
    buildOrchestration: true,
    capabilitiesRequired: true,
    scopeLockRequired: true,
  })) if (rule[field] !== expected) violations.push({ code: 'AG505', message: 'Build Orchestrator transition/security contract drifted.', detail: field });
  if (rule.sourcePlanStatus !== 'approved' || rule.maxSteps !== 4096 || rule.digestAlgorithm !== 'sha256') {
    violations.push({ code: 'AG505', message: 'Build Orchestrator approved-Plan or deterministic limits drifted.' });
  }

  const downstream = {
    toolRuntimeBuild: 53,
    scopeIntelligenceBuild: 54,
    scopeLockBuild: 55,
    checkpointEngineBuild: 56,
    validationPipelineBuild: 57,
  };
  for (const [field, expected] of Object.entries(downstream)) if (rule[field] !== expected) {
    violations.push({ code: 'AG506', message: 'Build Orchestrator downstream Build ownership drifted.', detail: field });
  }
  for (const field of ['toolExecution','scopeIntelligence','scopeLock','checkpoints','validationPipeline','mutationAuthorized','execution','scheduling','jobCreation','persistence']) {
    if (rule[field] !== false) violations.push({ code: 'AG506', message: 'Build Orchestrator prematurely owns a downstream concern.', detail: field });
  }

  if (!planRule || planRule.minimumBuild !== 48 || planRule.readOnly !== true || planRule.runtimeEnforcedReadOnly !== true
      || planRule.buildTransitionAuthorized !== false || planRule.buildOrchestration !== false) {
    violations.push({ code: 'AG507', message: 'Build 52 no longer preserves Build 48 Plan Authority ownership.' });
  }
  if (!decisionRule || decisionRule.minimumBuild !== 49 || decisionRule.readOnly !== true
      || decisionRule.buildTransitionAuthorized !== false || decisionRule.buildOrchestration !== false) {
    violations.push({ code: 'AG507', message: 'Build 52 no longer preserves Build 49 Decision Engine ownership.' });
  }
  if (!projectRulesRule || projectRulesRule.minimumBuild !== 50 || projectRulesRule.readOnly !== true
      || projectRulesRule.buildTransitionAuthorized !== false || projectRulesRule.buildOrchestration !== false) {
    violations.push({ code: 'AG507', message: 'Build 52 no longer preserves Build 50 Project Rules ownership.' });
  }
  if (!impactRule || impactRule.minimumBuild !== 51 || impactRule.readOnly !== true
      || impactRule.buildTransitionAuthorized !== false || impactRule.buildOrchestration !== false) {
    violations.push({ code: 'AG507', message: 'Build 52 no longer preserves Build 51 Impact Simulation ownership.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  const studioSource = exists('apps/studio/src') ? fs.readdirSync(path.join(root, 'apps/studio/src'), { recursive: true, withFileTypes: false })
    .filter((entry) => typeof entry === 'string' && /\.[jt]sx?$/.test(entry))
    .map((entry) => read(`apps/studio/src/${entry}`)).join('\n') : '';
  if (localIndex.includes('@github-decrypter/build') || localIndex.includes('./build-orchestrator.js')
      || studioSource.includes('@github-decrypter/build')) {
    violations.push({ code: 'AG508', message: 'Build 52 prematurely introduced Local Runtime or Studio Build Orchestrator transport.' });
  }

  for (const required of [
    'packages/build/src/index.ts',
    'docs/architecture/BUILD_ORCHESTRATOR.md',
    'docs/builds/BUILD_52_BUILD_ORCHESTRATOR.md',
    'scripts/architecture-guardian-build-orchestrator.mjs',
    'scripts/test-build52-build-orchestrator.mjs',
    'scripts/test-build52-build-orchestrator-runtime.ts',
    'scripts/test-build52-build-orchestrator-guardian-negative.mjs',
    'scripts/tsconfig.build52-tests.json',
    '.github/workflows/build52-build-orchestrator.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG509', message: 'Required Build 52 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const scope = read('docs/product/V1_SCOPE.md');
  const architectureDoc = read('docs/architecture/BUILD_ORCHESTRATOR.md');
  const buildDoc = read('docs/builds/BUILD_52_BUILD_ORCHESTRATOR.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('BUILD operates only through explicit capabilities and Scope Lock')
      || !scope.includes('explicit transition from approved Plan to Build')
      || !scope.includes('Build Orchestrator')
      || !architectureDoc.includes('orchestrate != execute')
      || !architectureDoc.includes('Build 53 — Tool Runtime')
      || !buildDoc.includes('Build 53 — Tool Runtime')
      || !roadmap.includes('52. **Build Orchestrator**')) {
    violations.push({ code: 'AG509', message: 'Build 52 documentation does not preserve approved transition, execution boundary or downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-build-orchestrator-report/1',
  currentBuild: policy.currentBuild,
  orchestratorSchema: rule?.schema ?? null,
  sourcePlanStatus: rule?.sourcePlanStatus ?? null,
  mode: rule?.mode ?? null,
  buildTransitionAuthorized: rule?.buildTransitionAuthorized ?? null,
  buildOrchestration: rule?.buildOrchestration ?? null,
  mutationAuthorized: rule?.mutationAuthorized ?? null,
  toolExecution: rule?.toolExecution ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
