import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const aiPackage = json('packages/ai/package.json');
const source = read('packages/ai/src/database-agent.ts');

assert.ok(policy.currentBuild >= 61);
assert.equal(policy.phaseGates?.databaseAgentBuild, 61);
assert.ok(versionBuild(rootPackage.version) >= 61);
assert.equal(aiPackage.name, '@github-decrypter/ai');
assert.ok(versionBuild(aiPackage.version) >= 61);
assert.deepEqual(aiPackage.exports, {
  '.': './src/index.ts',
  './agent-runtime': './src/agent-runtime.ts',
  './planner-agent': './src/planner-agent.ts',
  './coding-agent': './src/coding-agent.ts',
  './database-agent': './src/database-agent.ts',
});
assert.deepEqual(aiPackage.dependencies, {
  '@github-decrypter/plan': 'workspace:*',
  '@github-decrypter/tools': 'workspace:*',
});

for (const marker of [
  'DATABASE_AGENT_BUILD = 61',
  "DATABASE_AGENT_SCHEMA = 'gd-database-agent/1'",
  "DATABASE_AGENT_ID = 'pitts'",
  "DATABASE_AGENT_NAME = 'Pitts'",
  "DATABASE_AGENT_ROLE = 'backend-computational-core'",
  'executeDatabaseAgent(',
  'assertCanonicalDatabaseAgentExecution(',
  'createToolRuntime(',
  'databaseWriteDelegated: true',
  'directDatabaseAuthority: false',
  'productionDatabaseMutationAuthority: false',
  'databaseAuthority: false',
  'agentExecution: true',
  'toolExecution: true',
]) assert.ok(source.includes(marker), 'Missing Database Agent marker: ' + marker);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, 'Build 61 gained forbidden direct environment authority: ' + forbidden);

const authority = policy.databaseAgentAuthority;
assert.ok(authority);
assert.equal(authority.agentId, 'pitts');
assert.equal(authority.agentName, 'Pitts');
assert.equal(authority.agentRole, 'backend-computational-core');
assert.deepEqual(authority.allowedCapabilities, ['READ','DATABASE_WRITE']);
assert.deepEqual(authority.blockedCapabilities, ['WRITE','EXECUTE','NETWORK','GIT_WRITE','DESTRUCTIVE','SECRETS']);
for (const field of [
  'namedAgentBinding','databaseAgent','databaseSpecialization','databaseWriteDelegated','toolRuntimeConsumer',
  'toolRuntimeDelegation','toolRuntimeSovereign','scopeLockRequiredForDatabaseWrite','capabilityVerifierRequired',
  'mutationAuthorityOwnedByToolRuntime','agentExecution','toolExecution','execution','deterministicBinding','environmentNeutral',
]) assert.equal(authority[field], true, 'Database Agent authority drifted: ' + field);
for (const field of [
  'directDatabaseAuthority','productionDatabaseMutationAuthority','directMutationAuthority','capabilityGrantAuthority',
  'codingAgentAuthority','testingAgentAuthority','reviewAgentAuthority','agentOrchestratorAuthority','backendProviderAuthority',
  'secretsAuthority','automaticAgentSelection','orchestration','checkpointAuthority','validationAuthority','networkAuthority',
  'filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, 'Database Agent authority boundary drifted: ' + field);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build61-database-agent-static/1',
  build:61,
  agentId:authority.agentId,
  delegatedDatabaseWrite:true,
  nextBuild:62,
},null,2));
