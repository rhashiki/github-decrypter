import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const planPackage = json('packages/plan/package.json');
const source = read('packages/plan/src/impact-simulation.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.ok(policy.currentBuild >= 51);
assert.equal(policy.phaseGates?.impactSimulationBuild, 51);
assert.ok(versionBuild(rootPackage.version) >= 51);
assert.equal(planPackage.name, '@github-decrypter/plan');
assert.ok(versionBuild(planPackage.version) >= 51);
for (const [key, path] of Object.entries({
  '.': './src/index.ts',
  './task-graph': './src/task-graph.ts',
  './authority': './src/authority.ts',
  './decision': './src/decision.ts',
  './project-rules': './src/project-rules.ts',
  './impact-simulation': './src/impact-simulation.ts',
})) assert.equal(planPackage.exports?.[key], path, `Missing required plan export ${key}.`);
assert.deepEqual(Object.keys(planPackage.dependencies ?? {}), []);

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
  'assertCanonicalPlan(',
  'assertCanonicalProjectRules(',
  'canonicalImpactMaterial(',
  'explicitImpactsOnly: true',
  'semanticInference: false',
  'automaticEvaluation: false',
  'impactSimulationApplied: true',
  'buildTransitionAuthorized: false',
]) assert.ok(source.includes(marker), `Missing Impact Simulation marker: ${marker}`);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/, /\bfs\./,
  /\.grant\s*\(/, /\.authorize\s*\(/, /\.enqueue\s*\(/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Impact Simulation gained forbidden authority: ${forbidden}`);

const authority = policy.impactSimulationAuthority;
assert.ok(authority, 'Impact Simulation central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/plan');
assert.equal(authority.ownerSource, 'packages/plan/src/impact-simulation.ts');
assert.equal(authority.minimumBuild, 51);
assert.equal(authority.planAuthorityBuild, 48);
assert.equal(authority.decisionEngineBuild, 49);
assert.equal(authority.projectRulesBuild, 50);
assert.equal(authority.buildOrchestratorBuild, 52);
assert.equal(authority.toolRuntimeBuild, 53);
assert.equal(authority.scopeIntelligenceBuild, 54);
assert.equal(authority.scopeLockBuild, 55);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.schema, 'gd-impact-simulation/1');
assert.equal(authority.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(authority.sourceProjectRulesSchema, 'gd-project-rules/1');
assert.equal(authority.mode, 'PLAN');
assert.equal(authority.digestAlgorithm, 'sha256');
assert.equal(authority.maxImpacts, 256);
assert.equal(authority.maxReferences, 256);
assert.equal(authority.maxTextCharacters, 65536);
assert.equal(authority.maxAreaCharacters, 256);
assert.deepEqual(authority.effects, ['positive','neutral','negative']);
assert.deepEqual(authority.severities, ['low','medium','high','critical']);
for (const field of [
  'deterministic','environmentNeutral','readOnly','planReadOnlyPreserved','projectRulesReadOnlyPreserved',
  'workspaceScoped','explicitImpactsOnly','impactSimulation',
]) assert.equal(authority[field], true, `Impact Simulation authority drifted: ${field}`);
assert.equal(authority.sourcePlanStatus, 'draft');
for (const field of [
  'semanticInference','automaticEvaluation','buildTransitionAuthorized','buildOrchestration','toolExecution',
  'scopeIntelligence','scopeLock','checkpoints','validationPipeline','execution','scheduling','persistence',
  'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Impact Simulation authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build51-impact-simulation-static/1',
  build: 51,
  impactSimulationSchema: authority.schema,
  sourcePlanSchema: authority.sourcePlanSchema,
  sourceProjectRulesSchema: authority.sourceProjectRulesSchema,
  explicitImpactsOnly: true,
  planReadOnlyPreserved: true,
  projectRulesReadOnlyPreserved: true,
  buildTransitionAuthorized: false,
  nextBuild: 52,
}, null, 2));
