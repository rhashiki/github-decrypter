import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.impactSimulationAuthority;
const planRule = policy.planAuthority;
const decisionRule = policy.decisionEngineAuthority;
const projectRulesRule = policy.projectRulesAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 51 || rule.minimumBuild !== 51 || policy.phaseGates?.impactSimulationBuild !== 51
  || rule.ownerPackage !== '@github-decrypter/plan' || rule.ownerSource !== 'packages/plan/src/impact-simulation.ts'
  || rule.planAuthorityBuild !== 48 || rule.decisionEngineBuild !== 49 || rule.projectRulesBuild !== 50
  || rule.schema !== 'gd-impact-simulation/1' || rule.sourcePlanSchema !== 'gd-plan-authority/1'
  || rule.sourceProjectRulesSchema !== 'gd-project-rules/1' || rule.mode !== 'PLAN'
) {
  violations.push({ code: 'AG490', message: 'Build 51 Impact Simulation policy is missing or inactive.' });
} else {
  const planPackage = json('packages/plan/package.json');
  const rootPackage = json('package.json');
  const planBuild = versionBuild(planPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const requiredPlanExports = {
    '.': './src/index.ts',
    './task-graph': './src/task-graph.ts',
    './authority': './src/authority.ts',
    './decision': './src/decision.ts',
    './project-rules': './src/project-rules.ts',
    './impact-simulation': './src/impact-simulation.ts',
  };
  if (
    planPackage.name !== '@github-decrypter/plan' || planBuild === null || planBuild < 51
    || Object.entries(requiredPlanExports).some(([key, value]) => planPackage.exports?.[key] !== value)
    || Object.keys(planPackage.dependencies ?? {}).length !== 0
    || rootBuild === null || rootBuild < 51
  ) violations.push({ code: 'AG491', message: 'Build 51 package/root identity or required Impact Simulation exports drifted.' });

  const source = read('packages/plan/src/impact-simulation.ts');
  for (const marker of [
    'IMPACT_SIMULATION_BUILD = 51',
    "IMPACT_SIMULATION_SCHEMA = 'gd-impact-simulation/1'",
    "IMPACT_SIMULATION_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
    "IMPACT_SIMULATION_SOURCE_RULES_SCHEMA = 'gd-project-rules/1'",
    "IMPACT_SIMULATION_MODE = 'PLAN'",
    'IMPACT_SIMULATION_MAX_IMPACTS = 256',
    "IMPACT_EFFECTS = ['positive', 'neutral', 'negative']",
    "IMPACT_SEVERITIES = ['low', 'medium', 'high', 'critical']",
    'simulateImpact(',
    'impactDigest',
    'impactSimulationApplied: true',
    'buildTransitionAuthorized: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG492', message: 'Impact Simulation core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalPlan(',
    'assertCanonicalProjectRules(',
    'canonicalPlanMaterial(',
    'canonicalRulesMaterial(',
    'canonicalImpactMaterial(',
    'source Plan authority digest does not match canonical Plan material',
    'Project Rules digest does not match canonical rules material',
    'relatedRuleKeys',
    'relatedTaskIds',
    'Object.freeze({',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG493', message: 'Impact Simulation source binding, reference validation, digest binding or immutability is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /\.grant\s*\(|\.authorize\s*\(|\.enqueue\s*\(|\.claimNext\s*\(|spawn\s*\(|exec\s*\(|\.writeFile\s*\(/.test(source)) {
    violations.push({ code: 'AG494', message: 'Impact Simulation gained environment, transport, execution or mutation authority.' });
  }
  for (const field of ['networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport','persistence','execution','scheduling','toolExecution']) {
    if (rule[field] !== false) violations.push({ code: 'AG494', message: 'Impact Simulation policy gained environment, transport, execution or persistence authority.', detail: field });
  }

  for (const [field, expected] of Object.entries({
    deterministic: true,
    environmentNeutral: true,
    readOnly: true,
    planReadOnlyPreserved: true,
    projectRulesReadOnlyPreserved: true,
    workspaceScoped: true,
    explicitImpactsOnly: true,
    semanticInference: false,
    automaticEvaluation: false,
    impactSimulation: true,
  })) if (rule[field] !== expected) violations.push({ code: 'AG495', message: 'Impact Simulation semantic contract drifted.', detail: field });
  if (rule.sourcePlanStatus !== 'draft' || rule.maxImpacts !== 256 || rule.maxReferences !== 256
      || rule.maxTextCharacters !== 65536 || rule.maxAreaCharacters !== 256
      || JSON.stringify(rule.effects) !== JSON.stringify(['positive','neutral','negative'])
      || JSON.stringify(rule.severities) !== JSON.stringify(['low','medium','high','critical'])) {
    violations.push({ code: 'AG495', message: 'Impact Simulation explicit observation limits drifted.' });
  }

  const downstream = {
    buildOrchestratorBuild: 52,
    toolRuntimeBuild: 53,
    scopeIntelligenceBuild: 54,
    scopeLockBuild: 55,
    checkpointEngineBuild: 56,
    validationPipelineBuild: 57,
  };
  for (const [field, expected] of Object.entries(downstream)) if (rule[field] !== expected) {
    violations.push({ code: 'AG496', message: 'Impact Simulation downstream Build ownership drifted.', detail: field });
  }
  for (const field of ['buildTransitionAuthorized','buildOrchestration','toolExecution','scopeIntelligence','scopeLock','checkpoints','validationPipeline','execution','scheduling','persistence']) {
    if (rule[field] !== false) violations.push({ code: 'AG496', message: 'Impact Simulation prematurely owns a downstream concern.', detail: field });
  }

  if (!planRule || planRule.minimumBuild !== 48 || planRule.readOnly !== true || planRule.runtimeEnforcedReadOnly !== true
      || planRule.impactSimulation !== false || planRule.buildTransitionAuthorized !== false) {
    violations.push({ code: 'AG497', message: 'Build 51 no longer preserves Build 48 Plan Authority ownership.' });
  }
  if (!decisionRule || decisionRule.minimumBuild !== 49 || decisionRule.readOnly !== true
      || decisionRule.impactSimulation !== false || decisionRule.buildTransitionAuthorized !== false) {
    violations.push({ code: 'AG497', message: 'Build 51 no longer preserves Build 49 Decision Engine ownership.' });
  }
  if (!projectRulesRule || projectRulesRule.minimumBuild !== 50 || projectRulesRule.readOnly !== true
      || projectRulesRule.impactSimulation !== false || projectRulesRule.buildTransitionAuthorized !== false) {
    violations.push({ code: 'AG497', message: 'Build 51 no longer preserves Build 50 Project Rules ownership.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  if (localIndex.includes("./impact-simulation.js") || localIndex.includes("./impact-simulation-engine.js")) {
    violations.push({ code: 'AG498', message: 'Build 51 prematurely introduced Local Runtime Impact Simulation transport.' });
  }

  for (const required of [
    'packages/plan/src/impact-simulation.ts',
    'docs/architecture/IMPACT_SIMULATION.md',
    'docs/builds/BUILD_51_IMPACT_SIMULATION.md',
    'scripts/architecture-guardian-impact-simulation.mjs',
    'scripts/test-build51-impact-simulation.mjs',
    'scripts/test-build51-impact-simulation-runtime.ts',
    'scripts/test-build51-impact-simulation-guardian-negative.mjs',
    'scripts/tsconfig.build51-tests.json',
    '.github/workflows/build51-impact-simulation.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG499', message: 'Required Build 51 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const scope = read('docs/product/V1_SCOPE.md');
  const architectureDoc = read('docs/architecture/IMPACT_SIMULATION.md');
  const buildDoc = read('docs/builds/BUILD_51_IMPACT_SIMULATION.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('PLAN is enforced read-only by the runtime')
      || !scope.includes('impact simulation before approved execution')
      || !scope.includes('explicit transition from approved Plan to Build')
      || !architectureDoc.includes('Build 52 — Build Orchestrator')
      || !architectureDoc.includes('read-only')
      || !buildDoc.includes('Build 52 — Build Orchestrator')
      || !roadmap.includes('51. **Impact Simulation**')) {
    violations.push({ code: 'AG499', message: 'Build 51 documentation does not preserve Impact Simulation/PLAN boundaries or downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-impact-simulation-report/1',
  currentBuild: policy.currentBuild,
  impactSimulationSchema: rule?.schema ?? null,
  sourcePlanSchema: rule?.sourcePlanSchema ?? null,
  sourceProjectRulesSchema: rule?.sourceProjectRulesSchema ?? null,
  readOnly: rule?.readOnly ?? null,
  explicitImpactsOnly: rule?.explicitImpactsOnly ?? null,
  buildTransitionAuthorized: rule?.buildTransitionAuthorized ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
