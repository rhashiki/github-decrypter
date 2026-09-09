import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const planPackage = json('packages/plan/package.json');
const source = read('packages/plan/src/decision.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

const rootBuild = versionBuild(rootPackage.version);
const planBuild = versionBuild(planPackage.version);
assert.ok(policy.currentBuild >= 49);
assert.equal(policy.phaseGates?.decisionEngineBuild, 49);
assert.ok(rootBuild !== null && rootBuild >= 49);
assert.equal(planPackage.name, '@github-decrypter/plan');
assert.ok(planBuild !== null && planBuild >= 49);
assert.deepEqual(planPackage.exports, planBuild >= 50 ? {
  '.': './src/index.ts',
  './task-graph': './src/task-graph.ts',
  './authority': './src/authority.ts',
  './decision': './src/decision.ts',
  './project-rules': './src/project-rules.ts',
} : {
  '.': './src/index.ts',
  './task-graph': './src/task-graph.ts',
  './authority': './src/authority.ts',
  './decision': './src/decision.ts',
});
assert.deepEqual(Object.keys(planPackage.dependencies ?? {}), []);

for (const marker of [
  'DECISION_ENGINE_BUILD = 49',
  "DECISION_ENGINE_SCHEMA = 'gd-decision-engine/1'",
  "DECISION_ENGINE_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
  "DECISION_ENGINE_MODE = 'PLAN'",
  'DECISION_ENGINE_MIN_ALTERNATIVES = 2',
  'DECISION_ENGINE_MAX_ALTERNATIVES = 32',
  'resolveDecision(',
  'assertCanonicalSourcePlan(',
  'canonicalPlanMaterial(',
  'planReadOnlyPreserved: true',
  'explicitAlternativesOnly: true',
  'selectionDeclaredByCaller: true',
  'semanticInference: false',
  'automaticScoring: false',
  'decisionEngineApplied: true',
  'projectRulesApplied: false',
  'impactSimulationApplied: false',
  'buildTransitionAuthorized: false',
]) assert.ok(source.includes(marker), `Missing Decision Engine marker: ${marker}`);

for (const forbidden of [
  /\bnode:/,
  /\bprocess\./,
  /\bfetch\s*\(/,
  /\bwindow\./,
  /\bdocument\./,
  /\blocalStorage\b/,
  /\bindexedDB\b/,
  /\bnode:sqlite\b/,
  /\bchild_process\b/,
  /\bfs\./,
  /\.grant\s*\(/,
  /\.authorize\s*\(/,
  /\.enqueue\s*\(/,
  /spawn\s*\(/,
  /exec\s*\(/,
]) assert.equal(forbidden.test(source), false, `Decision Engine gained forbidden authority: ${forbidden}`);

const authority = policy.decisionEngineAuthority;
assert.ok(authority, 'Decision Engine central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/plan');
assert.equal(authority.ownerSource, 'packages/plan/src/decision.ts');
assert.equal(authority.minimumBuild, 49);
assert.equal(authority.planAuthorityBuild, 48);
assert.equal(authority.projectRulesBuild, 50);
assert.equal(authority.impactSimulationBuild, 51);
assert.equal(authority.buildOrchestratorBuild, 52);
assert.equal(authority.toolRuntimeBuild, 53);
assert.equal(authority.scopeIntelligenceBuild, 54);
assert.equal(authority.scopeLockBuild, 55);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.schema, 'gd-decision-engine/1');
assert.equal(authority.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(authority.mode, 'PLAN');
assert.equal(authority.readOnly, true);
assert.equal(authority.planReadOnlyPreserved, true);
assert.equal(authority.explicitAlternativesOnly, true);
assert.equal(authority.selectionDeclaredByCaller, true);
assert.equal(authority.semanticInference, false);
assert.equal(authority.automaticScoring, false);
assert.equal(authority.decisionEngine, true);
for (const field of [
  'projectRules','impactSimulation','buildTransitionAuthorized','buildOrchestration','toolExecution',
  'scopeIntelligence','scopeLock','checkpoints','validationPipeline','execution','scheduling','persistence',
  'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Decision Engine authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build49-decision-engine-static/1',
  build: 49,
  currentBuild: policy.currentBuild,
  decisionSchema: authority.schema,
  sourcePlanSchema: authority.sourcePlanSchema,
  planReadOnlyPreserved: true,
  buildTransitionAuthorized: false,
  nextBuild: 50,
}, null, 2));
