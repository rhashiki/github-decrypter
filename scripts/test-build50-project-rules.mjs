import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const planPackage = json('packages/plan/package.json');
const source = read('packages/plan/src/project-rules.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.equal(policy.currentBuild, 50);
assert.equal(policy.phaseGates?.projectRulesBuild, 50);
assert.equal(rootPackage.version, '0.0.50');
assert.equal(planPackage.name, '@github-decrypter/plan');
assert.equal(planPackage.version, '0.0.50');
assert.deepEqual(planPackage.exports, {
  '.': './src/index.ts',
  './task-graph': './src/task-graph.ts',
  './authority': './src/authority.ts',
  './decision': './src/decision.ts',
  './project-rules': './src/project-rules.ts',
});
assert.deepEqual(Object.keys(planPackage.dependencies ?? {}), []);
assert.equal(versionBuild(rootPackage.version), 50);
assert.equal(versionBuild(planPackage.version), 50);

for (const marker of [
  'PROJECT_RULES_BUILD = 50',
  "PROJECT_RULES_SCHEMA = 'gd-project-rules/1'",
  "PROJECT_RULES_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
  "PROJECT_RULES_MODE = 'PLAN'",
  'PROJECT_RULES_MAX_RULES = 256',
  "PROJECT_RULE_KINDS = ['require', 'forbid', 'prefer']",
  'bindProjectRules(',
  'assertCanonicalSourcePlan(',
  'canonicalPlanMaterial(',
  'workspaceScoped: true',
  'explicitRulesOnly: true',
  'semanticInference: false',
  'automaticEvaluation: false',
  'projectRulesApplied: true',
  'impactSimulationApplied: false',
  'buildTransitionAuthorized: false',
]) assert.ok(source.includes(marker), `Missing Project Rules marker: ${marker}`);

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
  /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Project Rules gained forbidden authority: ${forbidden}`);

const authority = policy.projectRulesAuthority;
assert.ok(authority, 'Project Rules central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/plan');
assert.equal(authority.ownerSource, 'packages/plan/src/project-rules.ts');
assert.equal(authority.minimumBuild, 50);
assert.equal(authority.planAuthorityBuild, 48);
assert.equal(authority.decisionEngineBuild, 49);
assert.equal(authority.impactSimulationBuild, 51);
assert.equal(authority.buildOrchestratorBuild, 52);
assert.equal(authority.toolRuntimeBuild, 53);
assert.equal(authority.scopeIntelligenceBuild, 54);
assert.equal(authority.scopeLockBuild, 55);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.schema, 'gd-project-rules/1');
assert.equal(authority.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(authority.mode, 'PLAN');
assert.equal(authority.digestAlgorithm, 'sha256');
assert.equal(authority.maxRules, 256);
assert.equal(authority.maxTextCharacters, 65536);
assert.equal(authority.maxWorkspaceIdCharacters, 256);
assert.deepEqual(authority.ruleKinds, ['require','forbid','prefer']);
assert.equal(authority.deterministic, true);
assert.equal(authority.environmentNeutral, true);
assert.equal(authority.sourcePlanStatus, 'draft');
assert.equal(authority.readOnly, true);
assert.equal(authority.planReadOnlyPreserved, true);
assert.equal(authority.workspaceScoped, true);
assert.equal(authority.explicitRulesOnly, true);
assert.equal(authority.semanticInference, false);
assert.equal(authority.automaticEvaluation, false);
assert.equal(authority.projectRules, true);
for (const field of [
  'impactSimulation','buildTransitionAuthorized','buildOrchestration','toolExecution',
  'scopeIntelligence','scopeLock','checkpoints','validationPipeline','execution','scheduling','persistence',
  'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Project Rules authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build50-project-rules-static/1',
  build: 50,
  projectRulesSchema: authority.schema,
  sourcePlanSchema: authority.sourcePlanSchema,
  workspaceScoped: true,
  explicitRulesOnly: true,
  planReadOnlyPreserved: true,
  impactSimulationApplied: false,
  buildTransitionAuthorized: false,
  nextBuild: 51,
}, null, 2));
