import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const buildPackage = json('packages/build/package.json');
const source = read('packages/build/src/index.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.ok(policy.currentBuild >= 52);
assert.equal(policy.phaseGates?.buildOrchestratorBuild, 52);
assert.ok(versionBuild(rootPackage.version) >= 52);
assert.equal(buildPackage.name, '@github-decrypter/build');
assert.ok(versionBuild(buildPackage.version) >= 52);
assert.equal(buildPackage.exports, './src/index.ts');
assert.deepEqual(buildPackage.dependencies, { '@github-decrypter/plan': 'workspace:*' });
assert.deepEqual(policy.packageRules?.['@github-decrypter/build']?.allowedWorkspaceDependencies, ['@github-decrypter/plan']);
assert.equal(policy.packageRules?.['@github-decrypter/build']?.environmentNeutral, true);

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
  'assertCanonicalApprovedPlan(',
  'assertCanonicalProjectRules(',
  'assertCanonicalImpactSimulation(',
  'canonicalOrchestrationMaterial(',
  'explicitTransition: true',
  'buildTransitionAuthorized: true',
  'buildOrchestration: true',
  'capabilitiesRequired: true',
  'scopeLockRequired: true',
  'mutationAuthorized: false',
  'toolExecution: false',
]) assert.ok(source.includes(marker), `Missing Build Orchestrator marker: ${marker}`);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/, /\bfs\./,
  /\.grant\s*\(/, /\.authorize\s*\(/, /\.enqueue\s*\(/, /\.claimNext\s*\(/,
  /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Build Orchestrator gained forbidden authority: ${forbidden}`);

const authority = policy.buildOrchestratorAuthority;
assert.ok(authority, 'Build Orchestrator central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/build');
assert.equal(authority.ownerSource, 'packages/build/src/index.ts');
assert.equal(authority.minimumBuild, 52);
assert.equal(authority.planAuthorityBuild, 48);
assert.equal(authority.decisionEngineBuild, 49);
assert.equal(authority.projectRulesBuild, 50);
assert.equal(authority.impactSimulationBuild, 51);
assert.equal(authority.toolRuntimeBuild, 53);
assert.equal(authority.scopeIntelligenceBuild, 54);
assert.equal(authority.scopeLockBuild, 55);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(authority.sourceProjectRulesSchema, 'gd-project-rules/1');
assert.equal(authority.sourceImpactSimulationSchema, 'gd-impact-simulation/1');
assert.equal(authority.schema, 'gd-build-orchestrator/1');
assert.equal(authority.sourcePlanStatus, 'approved');
assert.equal(authority.mode, 'BUILD');
assert.equal(authority.transition, 'PLAN_TO_BUILD');
assert.equal(authority.digestAlgorithm, 'sha256');
assert.equal(authority.maxSteps, 4096);
for (const field of [
  'deterministic','environmentNeutral','workspaceScoped','explicitTransition','sourcePlanReadOnlyPreserved',
  'projectRulesReadOnlyPreserved','impactSimulationReadOnlyPreserved','buildTransitionAuthorized',
  'buildOrchestration','capabilitiesRequired','scopeLockRequired',
]) assert.equal(authority[field], true, `Build Orchestrator authority drifted: ${field}`);
for (const field of [
  'mutationAuthorized','toolExecution','scopeIntelligence','scopeLock','checkpoints','validationPipeline',
  'execution','scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority',
  'studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Build Orchestrator authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build52-build-orchestrator-static/1',
  build: 52,
  orchestratorSchema: authority.schema,
  sourcePlanStatus: authority.sourcePlanStatus,
  explicitTransition: true,
  buildTransitionAuthorized: true,
  buildOrchestration: true,
  mutationAuthorized: false,
  toolExecution: false,
  nextBuild: 53,
}, null, 2));
