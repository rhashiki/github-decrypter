import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const aiPackage = json('packages/ai/package.json');
const source = read('packages/ai/src/review-agent.ts');

assert.ok(policy.currentBuild >= 63);
assert.equal(policy.phaseGates?.reviewAgentBuild, 63);
assert.ok(versionBuild(rootPackage.version) >= 63);
assert.equal(aiPackage.name, '@github-decrypter/ai');
assert.ok(versionBuild(aiPackage.version) >= 63);
assert.deepEqual(aiPackage.exports, {
  '.': './src/index.ts',
  './agent-runtime': './src/agent-runtime.ts',
  './planner-agent': './src/planner-agent.ts',
  './coding-agent': './src/coding-agent.ts',
  './database-agent': './src/database-agent.ts',
  './testing-agent': './src/testing-agent.ts',
  './review-agent': './src/review-agent.ts',
});
assert.deepEqual(aiPackage.dependencies, {
  '@github-decrypter/plan': 'workspace:*',
  '@github-decrypter/tools': 'workspace:*',
});

for (const marker of [
  'REVIEW_AGENT_BUILD = 63',
  "REVIEW_AGENT_SCHEMA = 'gd-review-agent/1'",
  "REVIEW_AGENT_ID = 'weizenbaum'",
  "REVIEW_AGENT_NAME = 'Weizenbaum'",
  "REVIEW_AGENT_ROLE = 'reviewer-critic'",
  'createReviewAgentReport(',
  'assertCanonicalReviewAgentReport(',
  'assertCanonicalCodingAgentExecution(',
  'assertCanonicalDatabaseAgentExecution(',
  'assertCanonicalTestingAgentExecution(',
  'reviewAdvisoryOnly: true',
  'sourceReadOnlyPreserved: true',
  'vetoAuthority: false',
  'approvalAuthority: false',
  'completionAuthority: false',
  'validationAuthority: false',
  'architectureEnforcementAuthority: false',
  'directMutationAuthority: false',
  'agentExecution: false',
  'toolExecution: false',
]) assert.ok(source.includes(marker), 'Missing Review Agent marker: ' + marker);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, 'Build 63 gained forbidden direct environment authority: ' + forbidden);

const authority = policy.reviewAgentAuthority;
assert.ok(authority);
assert.equal(authority.agentId, 'weizenbaum');
assert.equal(authority.agentName, 'Weizenbaum');
assert.equal(authority.agentRole, 'reviewer-critic');
assert.deepEqual(authority.targetKinds, ['coding','database','testing']);
assert.deepEqual(authority.categories, ['correctness','security','architecture','maintainability','testing']);
assert.deepEqual(authority.severities, ['info','warning','error','critical']);
assert.equal(authority.maxFindings, 256);
for (const field of [
  'namedAgentBinding','reviewAgent','reviewSpecialization','reviewAdvisoryOnly','sourceCanonicalRequired',
  'sourceReadOnlyPreserved','explicitFindingsOnly','sourceVerdictReadOnlyPreserved',
  'sourceCompletionEligibilityReadOnlyPreserved','deterministic','environmentNeutral',
]) assert.equal(authority[field], true, 'Review Agent authority drifted: ' + field);
for (const field of [
  'semanticInference','vetoAuthority','approvalAuthority','completionAuthority','validationAuthority','checkpointAuthority',
  'architectureEnforcementAuthority','capabilityGrantAuthority','scopeAuthority','directMutationAuthority',
  'codingAgentAuthority','databaseAgentAuthority','testingAgentAuthority','agentOrchestratorAuthority',
  'automaticAgentSelection','orchestration','agentExecution','toolExecution','execution','scheduling','jobCreation',
  'persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, 'Review Agent authority boundary drifted: ' + field);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build63-review-agent-static/1',
  build:63,
  agentId:authority.agentId,
  advisoryOnly:true,
  nextBuild:64,
},null,2));
