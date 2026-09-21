import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { analyzeScope } from '../packages/scope/src/index.js';
import { lockScope } from '../packages/scope/src/lock.js';
import { ToolRuntimeMutationBlockedError } from '../packages/tools/src/index.js';
import { AGENT_RUNTIME_REGISTRY } from '../packages/ai/src/agent-runtime.js';
import { assertCanonicalDatabaseAgentExecution, executeDatabaseAgent } from '../packages/ai/src/database-agent.js';

const intake = createPromptIntakeRecord({ text: '# Goal\nApply a bounded database change\n\n# Requirements\n- Inspect database metadata\n- Apply a bounded database mutation [depends: req-0002]\n\n# Constraint\nDatabase work must delegate to Tool Runtime and Scope Lock\n\n# Acceptance\nNo direct database/provider authority is introduced' });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:database-agent-alpha',
  rules: [
    { key: 'database.tool-runtime', kind: 'require', statement: 'All Database Agent operations delegate to Tool Runtime.' },
    { key: 'database.no-direct-provider', kind: 'forbid', statement: 'Database Agent must not open a provider connection directly.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Database mutation boundary',
    effect: 'positive',
    severity: 'critical',
    summary: 'Pitts can request bounded database writes without bypassing capability verification or Scope Lock.',
    relatedRuleKeys: ['database.tool-runtime','database.no-direct-provider'],
    relatedTaskIds: ['task-0001','task-0002'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });
const scope = analyzeScope({
  orchestration,
  candidates: [
    { key: 'database.metadata', buildStepId: 'build-step-0001', resource: 'database:schema', access: 'read', rationale: 'Read bounded database metadata.' },
    { key: 'database.mutation', buildStepId: 'build-step-0002', resource: 'database:table:profiles', access: 'write', rationale: 'Bounded database mutation.' },
  ],
});
const scopeLock = lockScope({ orchestration, scope, candidateIds: ['scope-candidate-0002'] });

let readCalls = 0, databaseWriteCalls = 0, fileWriteCalls = 0, networkCalls = 0, unsafeCalls = 0;
const capabilityRequests: string[] = [];
const tools = [
  {
    descriptor: { id: 'tool:database.read', label: 'Read database metadata', requiredCapabilities: ['READ'] as const, mutating: false },
    handler: () => { readCalls += 1; return { tables: ['profiles'] }; },
  },
  {
    descriptor: { id: 'tool:database.write', label: 'Write database row', requiredCapabilities: ['DATABASE_WRITE'] as const, mutating: true },
    handler: (context: any, input: any) => {
      databaseWriteCalls += 1;
      assert.equal(context.mutationAuthorized, true);
      assert.equal(context.scopeCandidateId, 'scope-candidate-0002');
      assert.equal(context.mutationAccess, 'write');
      return { changed: 1, input };
    },
  },
  {
    descriptor: { id: 'tool:file.write', label: 'Write file', requiredCapabilities: ['WRITE'] as const, mutating: true },
    handler: () => { fileWriteCalls += 1; return { wrote: true }; },
  },
  {
    descriptor: { id: 'tool:network.read', label: 'Network call', requiredCapabilities: ['NETWORK'] as const, mutating: false },
    handler: () => { networkCalls += 1; return { network: true }; },
  },
  {
    descriptor: { id: 'tool:unsafe.database', label: 'Unsafe database declaration', requiredCapabilities: ['DATABASE_WRITE'] as const, mutating: false },
    handler: () => { unsafeCalls += 1; return { unsafe: true }; },
  },
];

const toolRuntime = {
  orchestration,
  scopeLock,
  verifyCapability: (request: any) => {
    capabilityRequests.push(request.toolId + ':' + request.capability + ':' + request.stepId);
    return true;
  },
  tools,
};

const read = await executeDatabaseAgent({
  registry: AGENT_RUNTIME_REGISTRY,
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:database.read', input: { schema: 'main' } },
});
assert.equal(readCalls, 1);
assert.equal(read.schema, 'gd-database-agent/1');
assert.equal(read.agentId, 'pitts');
assert.equal(read.agentName, 'Pitts');
assert.equal(read.agentRole, 'backend-computational-core');
assert.equal(read.mutationAuthorized, false);
assert.equal(read.scopeLock, true);
assert.deepEqual(read.requiredCapabilities, ['READ']);
assert.doesNotThrow(() => assertCanonicalDatabaseAgentExecution(read));

const first = await executeDatabaseAgent({
  toolRuntime,
  invocation: {
    stepId: 'build-step-0002',
    toolId: 'tool:database.write',
    input: { table: 'profiles', id: 'user-1', active: true },
    scopeCandidateId: 'scope-candidate-0002',
    mutationAccess: 'write',
  },
});
const second = await executeDatabaseAgent({
  toolRuntime,
  invocation: {
    stepId: 'build-step-0002',
    toolId: 'tool:database.write',
    input: { table: 'profiles', id: 'user-1', active: true },
    scopeCandidateId: 'scope-candidate-0002',
    mutationAccess: 'write',
  },
});
assert.deepEqual(first, second);
assert.equal(databaseWriteCalls, 2);
assert.equal(first.mutationAuthorized, true);
assert.equal(first.scopeLock, true);
assert.equal(first.sourceScopeLockId, scopeLock.id);
assert.deepEqual(first.requiredCapabilities, ['DATABASE_WRITE']);
assert.equal(first.id, 'database-run-' + first.databaseDigest.hex.slice(0, 16));
for (const field of [
  'namedAgentBinding','databaseAgent','databaseSpecialization','databaseWriteDelegated','toolRuntimeConsumer',
  'toolRuntimeDelegation','toolRuntimeSovereign','buildOrchestratorConsumer','scopeLockRequired',
  'capabilityVerifierRequired','mutationAuthorityOwnedByToolRuntime','agentExecution','toolExecution','execution',
  'deterministicBinding','environmentNeutral','immutable',
] as const) assert.equal(first[field], true);
for (const field of [
  'directDatabaseAuthority','productionDatabaseMutationAuthority','directMutationAuthority','capabilityGrantAuthority',
  'approvalAuthority','scopeAuthority','codingAgentAuthority','testingAgentAuthority','reviewAgentAuthority',
  'agentOrchestratorAuthority','backendProviderAuthority','secretsAuthority','automaticAgentSelection','orchestration',
  'checkpointAuthority','validationAuthority','scheduling','jobCreation','persistence','networkAuthority',
  'filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(first[field], false);
assert.doesNotThrow(() => assertCanonicalDatabaseAgentExecution(first));

await assert.rejects(executeDatabaseAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0002', toolId: 'tool:file.write', input: null, scopeCandidateId: 'scope-candidate-0002', mutationAccess: 'write' },
}), /blocks Tool Runtime capability WRITE/i);
assert.equal(fileWriteCalls, 0);

await assert.rejects(executeDatabaseAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:network.read', input: null },
}), /blocks Tool Runtime capability NETWORK/i);
assert.equal(networkCalls, 0);

await assert.rejects(executeDatabaseAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0002', toolId: 'tool:unsafe.database', input: null },
}), /declare mutation consistently/i);
assert.equal(unsafeCalls, 0);

await assert.rejects(executeDatabaseAgent({
  toolRuntime: { orchestration, verifyCapability: () => true, tools: [tools[1]!] },
  invocation: { stepId: 'build-step-0002', toolId: 'tool:database.write', input: null },
}), (error: unknown) => error instanceof ToolRuntimeMutationBlockedError);

assert.throws(() => assertCanonicalDatabaseAgentExecution({ ...first, directDatabaseAuthority: true } as never), /non-canonical/i);
assert.throws(() => assertCanonicalDatabaseAgentExecution({ ...first, databaseDigest: { ...first.databaseDigest, hex: '0'.repeat(64) } } as never), /non-canonical/i);
assert.ok(capabilityRequests.includes('tool:database.read:READ:build-step-0001'));
assert.ok(capabilityRequests.includes('tool:database.write:DATABASE_WRITE:build-step-0002'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build61-database-agent-runtime/1',
  build:61,
  agentId:first.agentId,
  delegatedDatabaseWrite:true,
  scopeLockEnforced:true,
  fileWriteBlocked:true,
  networkBlocked:true,
  directDatabaseAuthority:first.directDatabaseAuthority,
},null,2));
