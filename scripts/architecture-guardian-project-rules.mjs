import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.projectRulesAuthority;
const planRule = policy.planAuthority;
const decisionRule = policy.decisionEngineAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 50 || rule.minimumBuild !== 50 || policy.phaseGates?.projectRulesBuild !== 50
  || rule.ownerPackage !== '@github-decrypter/plan' || rule.ownerSource !== 'packages/plan/src/project-rules.ts'
  || rule.planAuthorityBuild !== 48 || rule.decisionEngineBuild !== 49
  || rule.schema !== 'gd-project-rules/1' || rule.sourcePlanSchema !== 'gd-plan-authority/1' || rule.mode !== 'PLAN'
) {
  violations.push({ code: 'AG480', message: 'Build 50 Project Rules policy is missing or inactive.' });
} else {
  const planPackage = json('packages/plan/package.json');
  const rootPackage = json('package.json');
  const planBuild = versionBuild(planPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  if (
    planPackage.name !== '@github-decrypter/plan' || planBuild === null || planBuild < 50
    || JSON.stringify(planPackage.exports) !== JSON.stringify({
      '.': './src/index.ts',
      './task-graph': './src/task-graph.ts',
      './authority': './src/authority.ts',
      './decision': './src/decision.ts',
      './project-rules': './src/project-rules.ts',
    })
    || Object.keys(planPackage.dependencies ?? {}).length !== 0
    || rootBuild === null || rootBuild < 50
  ) {
    violations.push({ code: 'AG481', message: 'Build 50 package/root identity or Project Rules export drifted.' });
  }

  const source = read('packages/plan/src/project-rules.ts');
  for (const marker of [
    'PROJECT_RULES_BUILD = 50',
    "PROJECT_RULES_SCHEMA = 'gd-project-rules/1'",
    "PROJECT_RULES_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
    "PROJECT_RULES_MODE = 'PLAN'",
    'PROJECT_RULES_MAX_RULES = 256',
    "PROJECT_RULE_KINDS = ['require', 'forbid', 'prefer']",
    'bindProjectRules(',
    'rulesDigest',
    'projectRulesApplied: true',
    'impactSimulationApplied: false',
    'buildTransitionAuthorized: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG482', message: 'Project Rules core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalSourcePlan(',
    'canonicalPlanMaterial(',
    'source Plan authority digest does not match canonical Plan material',
    'task order is invalid',
    'dependency order is invalid',
    'supporting requirement identities are invalid',
    'workspaceId must be an explicit opaque workspace identifier',
    'keys must be unique within a workspace constitution',
    'Object.freeze({',
    'Object.freeze(row.rules.map',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG483', message: 'Project Rules canonical Plan validation, workspace binding, digest binding or immutability is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /\.grant\s*\(|\.authorize\s*\(|\.enqueue\s*\(|\.claimNext\s*\(|spawn\s*\(|exec\s*\(|\.writeFile\s*\(/.test(source)) {
    violations.push({ code: 'AG484', message: 'Project Rules gained environment, transport, execution or mutation authority.' });
  }
  if (rule.environmentNeutral !== true || rule.networkAuthority !== false || rule.filesystemAuthority !== false
      || rule.databaseAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
      || rule.persistence !== false || rule.execution !== false || rule.scheduling !== false || rule.toolExecution !== false) {
    violations.push({ code: 'AG484', message: 'Project Rules policy gained environment, transport, execution or persistence authority.' });
  }

  for (const [field, expected] of Object.entries({
    deterministic: true,
    readOnly: true,
    planReadOnlyPreserved: true,
    workspaceScoped: true,
    explicitRulesOnly: true,
    semanticInference: false,
    automaticEvaluation: false,
    projectRules: true,
  })) {
    if (rule[field] !== expected) violations.push({ code: 'AG485', message: 'Project Rules semantic contract drifted.', detail: field });
  }
  if (JSON.stringify(rule.ruleKinds) !== JSON.stringify(['require','forbid','prefer'])
      || rule.sourcePlanStatus !== 'draft' || rule.maxRules !== 256
      || rule.maxTextCharacters !== 65536 || rule.maxWorkspaceIdCharacters !== 256) {
    violations.push({ code: 'AG485', message: 'Project Rules explicit workspace constitution limits drifted.' });
  }

  const downstream = {
    impactSimulationBuild: 51,
    buildOrchestratorBuild: 52,
    toolRuntimeBuild: 53,
    scopeIntelligenceBuild: 54,
    scopeLockBuild: 55,
    checkpointEngineBuild: 56,
    validationPipelineBuild: 57,
  };
  for (const [field, expected] of Object.entries(downstream)) {
    if (rule[field] !== expected) violations.push({ code: 'AG486', message: 'Project Rules downstream Build ownership drifted.', detail: field });
  }
  for (const [field, expected] of Object.entries({
    impactSimulation: false,
    buildTransitionAuthorized: false,
    buildOrchestration: false,
    toolExecution: false,
    scopeIntelligence: false,
    scopeLock: false,
    checkpoints: false,
    validationPipeline: false,
    execution: false,
    scheduling: false,
    persistence: false,
  })) {
    if (rule[field] !== expected) violations.push({ code: 'AG486', message: 'Project Rules prematurely owns a downstream concern.', detail: field });
  }

  if (!planRule || planRule.minimumBuild !== 48 || planRule.readOnly !== true || planRule.runtimeEnforcedReadOnly !== true
      || planRule.buildTransitionAuthorized !== false || planRule.projectRules !== false) {
    violations.push({ code: 'AG487', message: 'Build 50 no longer preserves Build 48 Plan Authority ownership.' });
  }
  if (!decisionRule || decisionRule.minimumBuild !== 49 || decisionRule.schema !== 'gd-decision-engine/1'
      || decisionRule.readOnly !== true || decisionRule.planReadOnlyPreserved !== true
      || decisionRule.projectRules !== false || decisionRule.impactSimulation !== false
      || decisionRule.buildTransitionAuthorized !== false) {
    violations.push({ code: 'AG487', message: 'Build 50 no longer preserves Build 49 Decision Engine ownership.' });
  }

  const localIndex = read('apps/local/src/index.ts');
  if (localIndex.includes("./project-rules.js") || localIndex.includes("./project-rules-engine.js")) {
    violations.push({ code: 'AG488', message: 'Build 50 prematurely introduced Local Runtime Project Rules transport.' });
  }

  for (const required of [
    'packages/plan/src/project-rules.ts',
    'docs/architecture/PROJECT_RULES_ENGINE.md',
    'docs/builds/BUILD_50_PROJECT_RULES_ENGINE.md',
    'scripts/architecture-guardian-project-rules.mjs',
    'scripts/test-build50-project-rules.mjs',
    'scripts/test-build50-project-rules-runtime.ts',
    'scripts/test-build50-project-rules-guardian-negative.mjs',
    'scripts/tsconfig.build50-tests.json',
    '.github/workflows/build50-project-rules-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG489', message: 'Required Build 50 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const scope = read('docs/product/V1_SCOPE.md');
  const architectureDoc = read('docs/architecture/PROJECT_RULES_ENGINE.md');
  const buildDoc = read('docs/builds/BUILD_50_PROJECT_RULES_ENGINE.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('PLAN is enforced read-only by the runtime')
      || !scope.includes('project rules/constitution per workspace')
      || !scope.includes('impact simulation before approved execution')
      || !architectureDoc.includes('Build 51')
      || !architectureDoc.includes('runtime-enforced read-only PLAN')
      || !buildDoc.includes('Build 51 — Impact Simulation')
      || !roadmap.includes('50. **Project Rules Engine**')) {
    violations.push({ code: 'AG489', message: 'Build 50 documentation does not preserve constitutional Project Rules/PLAN boundaries or downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-project-rules-report/1',
  currentBuild: policy.currentBuild,
  projectRulesSchema: rule?.schema ?? null,
  sourcePlanSchema: rule?.sourcePlanSchema ?? null,
  workspaceScoped: rule?.workspaceScoped ?? null,
  readOnly: rule?.readOnly ?? null,
  planReadOnlyPreserved: rule?.planReadOnlyPreserved ?? null,
  impactSimulation: rule?.impactSimulation ?? null,
  buildTransitionAuthorized: rule?.buildTransitionAuthorized ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
