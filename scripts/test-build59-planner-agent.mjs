import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const aiPackage = json('packages/ai/package.json');
const source = read('packages/ai/src/planner-agent.ts');

assert.ok(policy.currentBuild >= 59);
assert.equal(policy.phaseGates?.plannerAgentBuild, 59);
assert.ok(versionBuild(rootPackage.version) >= 59);
assert.equal(aiPackage.name, '@github-decrypter/ai');
assert.ok(versionBuild(aiPackage.version) >= 59);
const expectedExports = policy.currentBuild >= 61
  ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts' }
  : policy.currentBuild >= 60
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts' }
    : { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts' };
const expectedDependencies = policy.currentBuild >= 60
  ? { '@github-decrypter/plan': 'workspace:*', '@github-decrypter/tools': 'workspace:*' }
  : { '@github-decrypter/plan': 'workspace:*' };
assert.deepEqual(aiPackage.exports, expectedExports);
assert.deepEqual(aiPackage.dependencies, expectedDependencies);

for (const marker of [
  'PLANNER_AGENT_BUILD = 59',
  "PLANNER_AGENT_SCHEMA = 'gd-planner-agent/1'",
  "PLANNER_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
  "PLANNER_AGENT_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1'",
  "PLANNER_AGENT_ID = 'leonardo'",
  "PLANNER_AGENT_NAME = 'Leonardo'",
  "PLANNER_AGENT_ROLE = 'architect'",
  'createPlannerAgentBrief(',
  'assertCanonicalPlannerAgentBrief(',
  'assertCanonicalAgentRuntime(',
  'assertCanonicalDraftPlan(',
  'canonicalPlanMaterial(',
  'canonicalPlannerMaterial(',
  'planAuthorityConsumer: true',
  'draftPlanRequired: true',
  'planningAdvisoryOnly: true',
  'planReadOnlyPreserved: true',
  'planApprovalAuthority: false',
  'automaticAgentSelection: false',
  'orchestration: false',
  'agentExecution: false',
  'toolExecution: false',
  'mutationAuthorized: false',
]) assert.ok(source.includes(marker), `Missing Planner Agent marker: ${marker}`);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Build 59 gained forbidden environment authority: ${forbidden}`);

const authority = policy.plannerAgentAuthority;
assert.ok(authority, 'Planner Agent authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/ai');
assert.equal(authority.ownerSource, 'packages/ai/src/planner-agent.ts');
assert.equal(authority.minimumBuild, 59);
assert.equal(authority.agentRuntimeBuild, 58);
assert.equal(authority.planAuthorityBuild, 48);
assert.equal(authority.schema, 'gd-planner-agent/1');
assert.equal(authority.agentId, 'leonardo');
assert.equal(authority.agentName, 'Leonardo');
assert.equal(authority.agentRole, 'architect');
for (const field of [
  'namedAgentBinding','plannerAgent','planningSpecialization','planAuthorityConsumer',
  'draftPlanRequired','planningAdvisoryOnly','planReadOnlyPreserved','deterministic','environmentNeutral',
]) assert.equal(authority[field], true, `Planner Agent authority drifted: ${field}`);
for (const field of [
  'semanticInference','planApprovalAuthority','decisionAuthority','projectRulesAuthority','impactSimulationAuthority',
  'buildTransitionAuthority','automaticAgentSelection','orchestration','agentExecution','toolExecution','execution',
  'capabilityGrantAuthority','approvalAuthority','scopeAuthority','mutationAuthorized','scheduling','jobCreation',
  'persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Planner Agent authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build59-planner-agent-static/1',
  build: 59,
  agentId: authority.agentId,
  sourcePlanSchema: authority.sourcePlanSchema,
  nextBuild: 60,
}, null, 2));
