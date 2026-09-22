import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const versionBuild = (value) => Number(/^0\.0\.(\d+)$/.exec(value)?.[1] ?? NaN);

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const aiPackage = json('packages/ai/package.json');
const source = read('packages/ai/src/agent-runtime.ts');

assert.ok(policy.currentBuild >= 58);
assert.equal(policy.phaseGates?.agentRuntimeBuild, 58);
assert.ok(versionBuild(rootPackage.version) >= 58);
assert.equal(aiPackage.name, '@github-decrypter/ai');
assert.ok(versionBuild(aiPackage.version) >= 58);
const expectedExports = policy.currentBuild >= 64
  ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts', './testing-agent': './src/testing-agent.ts', './review-agent': './src/review-agent.ts', './architecture-contract': './src/architecture-contract.ts', './architecture-ledger': './src/architecture-ledger.ts', './heimdall': './src/heimdall.ts', './agent-orchestrator': './src/agent-orchestrator.ts' }
  : policy.currentBuild >= 63
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts', './testing-agent': './src/testing-agent.ts', './review-agent': './src/review-agent.ts' }
    : policy.currentBuild >= 62
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts', './testing-agent': './src/testing-agent.ts' }
    : policy.currentBuild >= 61
  ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts', './database-agent': './src/database-agent.ts' }
  : policy.currentBuild >= 60
    ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts', './coding-agent': './src/coding-agent.ts' }
    : policy.currentBuild >= 59
      ? { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts', './planner-agent': './src/planner-agent.ts' }
      : { '.': './src/index.ts', './agent-runtime': './src/agent-runtime.ts' };
const expectedDependencies = policy.currentBuild >= 60
  ? { '@github-decrypter/plan': 'workspace:*', '@github-decrypter/tools': 'workspace:*' }
  : policy.currentBuild >= 59 ? { '@github-decrypter/plan': 'workspace:*' } : {};
assert.deepEqual(aiPackage.exports, expectedExports);
assert.deepEqual(aiPackage.dependencies ?? {}, expectedDependencies);

const migrated = policy.currentBuild >= 64;
const runtimeMarkers = [
  'AGENT_RUNTIME_BUILD = 58',
  "AGENT_RUNTIME_SCHEMA = 'gd-agent-runtime/1'",
  "AGENT_RUNTIME_TEAM_ID = 'vortex-ars-ai'",
  ...(migrated
    ? ['AGENT_RUNTIME_REVISION = 2','AGENT_RUNTIME_COUNT = 10','AGENT_RUNTIME_MIGRATION_BUILD = 64','AGENT_RUNTIME_REVISION_ONE_COUNT = 9']
    : ['AGENT_RUNTIME_REVISION = 1','AGENT_RUNTIME_COUNT = 9']),
  'createAgentRuntimeRegistry(',
  'assertCanonicalAgentRuntime(',
  'listAgentRuntimeDescriptors(',
  'getAgentRuntimeDescriptor(',
  'viktorIsAgent: false',
  'automaticSelection: false',
  'orchestration: false',
  'agentExecution: false',
  'toolExecution: false',
  'capabilityGrantAuthority: false',
  'mutationAuthorized: false',
];
for (const marker of runtimeMarkers) assert.ok(source.includes(marker), `Missing Agent Runtime marker: ${marker}`);

for (const name of (migrated ? ['Ramon','Leonardo','Strachey','Licklider','Pitts','Weizenbaum','Samuel','Seymour','Fukushima','Heimdall'] : ['Ramon','Leonardo','Strachey','Licklider','Pitts','Weizenbaum','Samuel','Seymour','Fukushima'])) {
  assert.ok(source.includes(`name: '${name}'`), `Missing canonical agent name: ${name}`);
}
assert.equal(source.includes("name: 'Viktor'"), false, 'Viktor must not be registered as an agent.');

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Build 58 gained forbidden environment authority: ${forbidden}`);

const authority = policy.agentRuntimeAuthority;
assert.ok(authority, 'Agent Runtime authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/ai');
assert.equal(authority.ownerSource, 'packages/ai/src/agent-runtime.ts');
assert.equal(authority.minimumBuild, 58);
assert.equal(authority.schema, 'gd-agent-runtime/1');
assert.equal(authority.agentCount, migrated ? 10 : 9);
if (migrated) {
  assert.equal(authority.runtimeRevision, 2);
  assert.equal(authority.migrationBuild, 64);
  assert.equal(authority.historicalRevisionOneCount, 9);
  assert.equal(authority.heimdallBuild, 64);
}
assert.equal(authority.viktorIsAgent, false);
for (const field of [
  'namedAgentSystem','identityRegistry','roleMetadata','specialtyMetadata',
  'responsibilityMetadata','authorityLimitsExplicit','coordinatedTeamFoundation',
  'deterministic','environmentNeutral',
]) assert.equal(authority[field], true, `Agent Runtime authority drifted: ${field}`);
for (const field of [
  'automaticSelection','orchestration','agentExecution','toolExecution','execution',
  'capabilityGrantAuthority','approvalAuthority','scopeAuthority','mutationAuthorized',
  'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
  'databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Agent Runtime authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build58-agent-runtime-static/1',
  build: 58,
  agentCount: authority.agentCount,
  historicalRevisionOneCount: migrated ? 9 : null,
  viktorIsAgent: false,
  nextBuild: 59,
}, null, 2));
