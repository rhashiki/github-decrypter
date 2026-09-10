import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const policy = json('architecture.guardian.json');
const rule = policy.decisionEngineAuthority;
const planRule = policy.planAuthority;
const violations = [];
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

if (
  !rule || policy.currentBuild < 49 || rule.minimumBuild !== 49 || policy.phaseGates?.decisionEngineBuild !== 49
  || rule.ownerPackage !== '@github-decrypter/plan' || rule.ownerSource !== 'packages/plan/src/decision.ts'
  || rule.planAuthorityBuild !== 48 || rule.schema !== 'gd-decision-engine/1'
  || rule.sourcePlanSchema !== 'gd-plan-authority/1' || rule.mode !== 'PLAN'
) {
  violations.push({ code: 'AG470', message: 'Build 49 Decision Engine policy is missing or inactive.' });
} else {
  const planPackage = json('packages/plan/package.json');
  const rootPackage = json('package.json');
  const planBuild = versionBuild(planPackage.version);
  const rootBuild = versionBuild(rootPackage.version);
  const expectedPlanExports = planBuild !== null && planBuild >= 50
    ? {
      '.': './src/index.ts',
      './task-graph': './src/task-graph.ts',
      './authority': './src/authority.ts',
      './decision': './src/decision.ts',
      './project-rules': './src/project-rules.ts',
    }
    : {
      '.': './src/index.ts',
      './task-graph': './src/task-graph.ts',
      './authority': './src/authority.ts',
      './decision': './src/decision.ts',
    };
  if (
    planPackage.name !== '@github-decrypter/plan' || planBuild === null || planBuild < 49
    || JSON.stringify(planPackage.exports) !== JSON.stringify(expectedPlanExports)
    || Object.keys(planPackage.dependencies ?? {}).length !== 0
    || rootBuild === null || rootBuild < 49
  ) {
    violations.push({ code: 'AG471', message: 'Build 49 package/root identity or Decision Engine export drifted.' });
  }

  const source = read('packages/plan/src/decision.ts');
  for (const marker of [
    'DECISION_ENGINE_BUILD = 49',
    "DECISION_ENGINE_SCHEMA = 'gd-decision-engine/1'",
    "DECISION_ENGINE_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
    "DECISION_ENGINE_MODE = 'PLAN'",
    'DECISION_ENGINE_MIN_ALTERNATIVES = 2',
    'DECISION_ENGINE_MAX_ALTERNATIVES = 32',
    'resolveDecision(',
    'decisionDigest',
    'decisionEngineApplied: true',
    'buildTransitionAuthorized: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG472', message: 'Decision Engine core contract is incomplete.', detail: marker });

  for (const marker of [
    'assertCanonicalSourcePlan(',
    'canonicalPlanMaterial(',
    'source Plan authority digest does not match canonical Plan material',
    'task order is invalid',
    'dependency order is invalid',
    'Object.freeze({',
    'Object.freeze(row.alternatives.map',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG473', message: 'Decision Engine canonical Plan validation, digest binding or immutability is incomplete.', detail: marker });

  if (/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bnode:sqlite\b|\bchild_process\b|\bfs\.|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
      || /\.grant\s*\(|\.authorize\s*\(|\.enqueue\s*\(|\.claimNext\s*\(|spawn\s*\(|exec\s*\(|\.writeFile\s*\(/.test(source)) {
    violations.push({ code: 'AG474', message: 'Decision Engine gained environment, transport, execution or mutation authority.' });
  }
  if (rule.environmentNeutral !== true || rule.networkAuthority !== false || rule.filesystemAuthority !== false
      || rule.databaseAuthority !== false || rule.studioTransport !== false || rule.localRuntimeTransport !== false
      || rule.persistence !== false || rule.execution !== false || rule.scheduling !== false || rule.toolExecution !== false) {
    violations.push({ code: 'AG474', message: 'Decision Engine policy gained environment, transport, execution or persistence authority.' });
  }

  for (const [field, expected] of Object.entries({
    readOnly: true,
    planReadOnlyPreserved: true,
    explicitAlternativesOnly: true,
    selectionDeclaredByCaller: true,
    semanticInference: false,
    automaticScoring: false,
    decisionEngine: true,
  })) {
    if (rule[field] !== expected) violations.push({ code: 'AG475', message: 'Decision Engine semantic contract drifted.', detail: field });
  }
  for (const marker of [
    'source Plan remains draft',
    'alternative labels must be unique',
    'selectedAlternativeOrdinal does not identify a declared alternative',
    'explicitAlternativesOnly: true',
    'selectionDeclaredByCaller: true',
    'semanticInference: false',
    'automaticScoring: false',
  ]) if (!source.includes(marker)) violations.push({ code: 'AG475', message: 'Decision Engine explicit-choice semantics are incomplete.', detail: marker });

  const downstream = {
    projectRulesBuild: 50,
    impactSimulationBuild: 51,
    buildOrchestratorBuild: 52,
    toolRuntimeBuild: 53,
    scopeIntelligenceBuild: 54,
    scopeLockBuild: 55,
    checkpointEngineBuild: 56,
    validationPipelineBuild: 57,
  };
  for (const [field, expected] of Object.entries(downstream)) {
    if (rule[field] !== expected) violations.push({ code: 'AG476', message: 'Decision Engine downstream Build ownership drifted.', detail: field });
  }
  for (const [field, expected] of Object.entries({
    projectRules: false,
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
    if (rule[field] !== expected) violations.push({ code: 'AG476', message: 'Decision Engine prematurely owns a downstream concern.', detail: field });
  }

  const localIndex = read('apps/local/src/index.ts');
  if (!planRule || planRule.minimumBuild !== 48 || planRule.readOnly !== true || planRule.runtimeEnforcedReadOnly !== true
      || planRule.buildTransitionAuthorized !== false || planRule.decisionEngine !== false
      || localIndex.includes("./decision.js") || localIndex.includes("./decision-engine.js")) {
    violations.push({ code: 'AG477', message: 'Build 49 no longer preserves Build 48 PLAN read-only/runtime ownership.' });
  }

  for (const required of [
    'packages/plan/src/decision.ts',
    'docs/architecture/DECISION_ENGINE.md',
    'docs/builds/BUILD_49_DECISION_ENGINE.md',
    'scripts/architecture-guardian-decision-engine.mjs',
    'scripts/test-build49-decision-engine.mjs',
    'scripts/test-build49-decision-engine-runtime.ts',
    'scripts/test-build49-decision-engine-guardian-negative.mjs',
    'scripts/tsconfig.build49-tests.json',
    '.github/workflows/build49-decision-engine.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG478', message: 'Required Build 49 artifact is missing.', detail: required });

  const constitution = read('docs/product/PRODUCT_CONSTITUTION_V1.md');
  const scope = read('docs/product/V1_SCOPE.md');
  const architectureDoc = read('docs/architecture/DECISION_ENGINE.md');
  const buildDoc = read('docs/builds/BUILD_49_DECISION_ENGINE.md');
  const roadmap = read('docs/product/ROADMAP_V1.md');
  if (!constitution.includes('PLAN is enforced read-only by the runtime')
      || !scope.includes('Decision Engine for meaningful architectural alternatives')
      || !scope.includes('explicit transition from approved Plan to Build')
      || !architectureDoc.includes('Build 50 — Project Rules')
      || !architectureDoc.includes('runtime-enforced read-only PLAN')
      || !buildDoc.includes('Build 50 — Project Rules')
      || !roadmap.includes('49. **Decision Engine**')) {
    violations.push({ code: 'AG479', message: 'Build 49 documentation does not preserve constitutional Decision/PLAN boundaries or downstream ownership.' });
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-decision-engine-report/1',
  currentBuild: policy.currentBuild,
  decisionSchema: rule?.schema ?? null,
  sourcePlanSchema: rule?.sourcePlanSchema ?? null,
  readOnly: rule?.readOnly ?? null,
  planReadOnlyPreserved: rule?.planReadOnlyPreserved ?? null,
  buildTransitionAuthorized: rule?.buildTransitionAuthorized ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
