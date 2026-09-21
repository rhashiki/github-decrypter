import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const aiPackage = json('packages/ai/package.json');
const source = read('packages/ai/src/coding-agent.ts');

assert.ok(policy.currentBuild >= 60);
assert.equal(policy.phaseGates?.codingAgentBuild, 60);
assert.ok(versionBuild(rootPackage.version) >= 60);
assert.equal(aiPackage.name, '@github-decrypter/ai');
assert.ok(versionBuild(aiPackage.version) >= 60);
const expectedExports = policy.currentBuild >= 62
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts', './testing-agent': './src/testing-agent.ts' }
    : policy.currentBuild >= 61
  ? {
    '.': './src/index.ts',
    './agent-runtime': './src/agent-runtime.ts',
    './planner-agent': './src/planner-agent.ts',
    './coding-agent': './src/coding-agent.ts',
    './database-agent': './src/database-agent.ts',
  }
  : {
    '.': './src/index.ts',
    './agent-runtime': './src/agent-runtime.ts',
    './planner-agent': './src/planner-agent.ts',
    './coding-agent': './src/coding-agent.ts',
  };
assert.deepEqual(aiPackage.exports, expectedExports);
assert.deepEqual(aiPackage.dependencies, {
  '@github-decrypter/plan': 'workspace:*',
  '@github-decrypter/tools': 'workspace:*',
});

for (const marker of [
  'CODING_AGENT_BUILD = 60',
  "CODING_AGENT_SCHEMA = 'gd-coding-agent/1'",
  "CODING_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
  "CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
  "CODING_AGENT_ID = 'strachey'",
  "CODING_AGENT_NAME = 'Strachey'",
  "CODING_AGENT_ROLE = 'builder-programmer'",
  'executeCodingAgent(',
  'assertCanonicalCodingAgentExecution(',
  'assertCanonicalAgentRuntime(',
  'getAgentRuntimeDescriptor(CODING_AGENT_ID)',
  'createToolRuntime(',
  'toolRuntimeDelegation: true',
  'toolRuntimeSovereign: true',
  'mutationAuthorityOwnedByToolRuntime: true',
  'directMutationAuthority: false',
  'databaseAgentAuthority: false',
  'testingAgentAuthority: false',
  'reviewAgentAuthority: false',
  'agentOrchestratorAuthority: false',
  'agentExecution: true',
  'toolExecution: true',
  'execution: true',
]) assert.ok(source.includes(marker), 'Missing Coding Agent marker: ' + marker);

const authority = policy.codingAgentAuthority;
assert.ok(authority);
assert.equal(authority.agentId, 'strachey');
assert.deepEqual(authority.allowedCapabilities, ['READ','WRITE','EXECUTE','NETWORK']);
assert.deepEqual(authority.blockedCapabilities, ['DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS']);
for (const field of ['agentExecution','toolExecution','execution','toolRuntimeDelegation','toolRuntimeSovereign']) assert.equal(authority[field], true);
for (const field of ['directMutationAuthority','capabilityGrantAuthority','databaseAgentAuthority','testingAgentAuthority','reviewAgentAuthority','agentOrchestratorAuthority','orchestration']) assert.equal(authority[field], false);

console.log(JSON.stringify({ok:true,schema:'gd-build60-coding-agent-static/1',build:60,agentId:authority.agentId,nextBuild:61},null,2));
