import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const aiPackage = json('packages/ai/package.json');
const source = read('packages/ai/src/testing-agent.ts');

assert.ok(policy.currentBuild >= 62);
assert.equal(policy.phaseGates?.testingAgentBuild, 62);
assert.ok(versionBuild(rootPackage.version) >= 62);
assert.equal(aiPackage.name, '@github-decrypter/ai');
assert.ok(versionBuild(aiPackage.version) >= 62);
const expectedExports = policy.currentBuild >= 64
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts', './testing-agent': './src/testing-agent.ts', './review-agent': './src/review-agent.ts', './architecture-contract': './src/architecture-contract.ts', './architecture-ledger': './src/architecture-ledger.ts', './heimdall': './src/heimdall.ts', './agent-orchestrator': './src/agent-orchestrator.ts' }
    : policy.currentBuild >= 63
  ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts', './testing-agent': './src/testing-agent.ts', './review-agent': './src/review-agent.ts' }
  : {
    '.': './src/index.ts',
    './agent-runtime': './src/agent-runtime.ts',
    './planner-agent': './src/planner-agent.ts',
    './coding-agent': './src/coding-agent.ts',
    './database-agent': './src/database-agent.ts',
    './testing-agent': './src/testing-agent.ts',
  };
assert.deepEqual(aiPackage.exports, expectedExports);
assert.deepEqual(aiPackage.dependencies, {
  '@github-decrypter/plan': 'workspace:*',
  '@github-decrypter/tools': 'workspace:*',
});

for (const marker of [
  'TESTING_AGENT_BUILD = 62',
  "TESTING_AGENT_SCHEMA = 'gd-testing-agent/1'",
  "TESTING_AGENT_ID = 'samuel'",
  "TESTING_AGENT_NAME = 'Samuel'",
  "TESTING_AGENT_ROLE = 'qa-testing'",
  'executeTestingAgent(',
  'assertCanonicalTestingAgentExecution(',
  'createToolRuntime(',
  'createCheckpoint(',
  'createValidation(',
  'observed: invocation.result',
  'interactiveQA: true',
  'boundedFlowExecution: true',
  'unrestrictedAutomation: false',
  'browserAutomationAuthority: false',
  'validationAuthority: false',
  'completionEligible: validation.completionEligible',
]) assert.ok(source.includes(marker), 'Missing Testing Agent marker: ' + marker);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, 'Build 62 gained forbidden direct environment authority: ' + forbidden);

const authority = policy.testingAgentAuthority;
assert.ok(authority);
assert.equal(authority.agentId, 'samuel');
assert.equal(authority.agentName, 'Samuel');
assert.equal(authority.agentRole, 'qa-testing');
assert.deepEqual(authority.allowedCapabilities, ['READ','EXECUTE']);
assert.deepEqual(authority.blockedCapabilities, ['WRITE','NETWORK','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS']);
assert.deepEqual(authority.evidenceKinds, ['tool-result','test']);
for (const field of [
  'namedAgentBinding','testingAgent','interactiveQA','behavioralFlowExecution','boundedFlowExecution',
  'singleFlowPerExecution','singleCriterionPerFlow','explicitAcceptanceRequired','observedResultBoundToToolResult',
  'toolRuntimeConsumer','toolRuntimeSovereign','checkpointEngineConsumer','checkpointEngineSovereign',
  'validationPipelineConsumer','validationPipelineSovereign','completionEligibilityOwnedByValidation',
  'scopeLockRequiredForExecute','capabilityVerifierRequired','mutationAuthorityOwnedByToolRuntime',
  'agentExecution','toolExecution','execution','deterministicBinding','environmentNeutral',
]) assert.equal(authority[field], true, 'Testing Agent authority drifted: ' + field);
for (const field of [
  'semanticInference','evidenceFabricationAuthority','checkpointAuthority','validationAuthority','unrestrictedAutomation',
  'browserAutomationAuthority','previewAuthority','capabilityGrantAuthority','approvalAuthority','scopeAuthority',
  'directMutationAuthority','codingAgentAuthority','databaseAgentAuthority','reviewAgentAuthority',
  'agentOrchestratorAuthority','automaticAgentSelection','orchestration','scheduling','jobCreation','persistence',
  'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, 'Testing Agent authority boundary drifted: ' + field);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build62-testing-agent-static/1',
  build:62,
  agentId:authority.agentId,
  interactiveQA:true,
  nextBuild:63,
},null,2));
