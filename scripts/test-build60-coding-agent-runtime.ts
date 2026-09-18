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
import { assertCanonicalCodingAgentExecution, executeCodingAgent } from '../packages/ai/src/coding-agent.js';

const intake = createPromptIntakeRecord({ text: '# Goal\nImplement a bounded source change\n\n# Requirements\n- Update a source file\n- Run bounded verification [depends: req-0002]\n\n# Constraint\nCoding execution must delegate to Tool Runtime and Scope Lock\n\n# Acceptance\nDatabase, Git, destructive and secrets capabilities remain outside Coding Agent authority' });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:coding-agent-alpha',
  rules: [
    { key: 'coding.tool-runtime', kind: 'require', statement: 'All Coding Agent execution delegates to Tool Runtime.' },
    { key: 'coding.no-database', kind: 'forbid', statement: 'Coding Agent cannot own database mutation.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Coding execution boundary',
    effect: 'positive',
    severity: 'critical',
    summary: 'Strachey can implement through existing capability and Scope Lock controls without duplicating Tool Runtime authority.',
    relatedRuleKeys: ['coding.tool-runtime','coding.no-database'],
    relatedTaskIds: ['task-0001','task-0002'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });
const scope = analyzeScope({
  orchestration,
  candidates: [
    { key: 'source.change', buildStepId: 'build-step-0001', resource: 'file:src/feature.ts', access: 'write', rationale: 'Bounded source mutation.' },
    { key: 'verification.command', buildStepId: 'build-step-0002', resource: 'command:typecheck', access: 'execute', rationale: 'Bounded verification.' },
  ],
});
const scopeLock = lockScope({ orchestration, scope, candidateIds: ['scope-candidate-0001','scope-candidate-0002'] });

let writeCalls = 0, executeCalls = 0, databaseCalls = 0, gitCalls = 0, unsafeCalls = 0;
const capabilityRequests: string[] = [];
const tools = [
  {
    descriptor: { id: 'tool:file.write', label: 'Write source file', requiredCapabilities: ['WRITE'] as const, mutating: true },
    handler: (context: any, input: any) => { writeCalls += 1; assert.equal(context.mutationAuthorized, true); return { wrote: true, input }; },
  },
  {
    descriptor: { id: 'tool:verify.execute', label: 'Run verification', requiredCapabilities: ['EXECUTE'] as const, mutating: true },
    handler: (context: any) => { executeCalls += 1; return { verified: context.mutationAuthorized }; },
  },
  {
    descriptor: { id: 'tool:project.read', label: 'Read project', requiredCapabilities: ['READ'] as const, mutating: false },
    handler: () => ({ read: true }),
  },
  {
    descriptor: { id: 'tool:database.write', label: 'Database write', requiredCapabilities: ['DATABASE_WRITE'] as const, mutating: true },
    handler: () => { databaseCalls += 1; return { database: true }; },
  },
  {
    descriptor: { id: 'tool:git.write', label: 'Git write', requiredCapabilities: ['GIT_WRITE'] as const, mutating: true },
    handler: () => { gitCalls += 1; return { git: true }; },
  },
  {
    descriptor: { id: 'tool:unsafe.write', label: 'Unsafe write', requiredCapabilities: ['WRITE'] as const, mutating: false },
    handler: () => { unsafeCalls += 1; return { unsafe: true }; },
  },
];

const toolRuntime = {
  orchestration,
  scopeLock,
  verifyCapability: (request: any) => { capabilityRequests.push(request.toolId + ':' + request.capability + ':' + request.stepId); return true; },
  tools,
};

const first = await executeCodingAgent({
  registry: AGENT_RUNTIME_REGISTRY,
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:file.write', input: { content: 'export const ready = true;' }, scopeCandidateId: 'scope-candidate-0001', mutationAccess: 'write' },
});
const second = await executeCodingAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:file.write', input: { content: 'export const ready = true;' }, scopeCandidateId: 'scope-candidate-0001', mutationAccess: 'write' },
});
assert.deepEqual(first, second);
assert.equal(writeCalls, 2);
assert.equal(first.schema, 'gd-coding-agent/1');
assert.equal(first.agentId, 'strachey');
assert.equal(first.agentName, 'Strachey');
assert.equal(first.agentRole, 'builder-programmer');
assert.equal(first.mutationAuthorized, true);
assert.equal(first.scopeLock, true);
assert.equal(first.sourceScopeLockId, scopeLock.id);
assert.deepEqual(first.requiredCapabilities, ['WRITE']);
assert.equal(first.id, 'coding-run-' + first.codingDigest.hex.slice(0, 16));
assert.doesNotThrow(() => assertCanonicalCodingAgentExecution(first));
assert.equal(Object.isFrozen(first), true);

const execution = await executeCodingAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0002', toolId: 'tool:verify.execute', input: null, scopeCandidateId: 'scope-candidate-0002', mutationAccess: 'execute' },
});
assert.equal(executeCalls, 1);
assert.deepEqual(execution.requiredCapabilities, ['EXECUTE']);

const read = await executeCodingAgent({ toolRuntime, invocation: { stepId: 'build-step-0001', toolId: 'tool:project.read', input: null } });
assert.equal(read.mutationAuthorized, false);
assert.deepEqual(read.requiredCapabilities, ['READ']);

await assert.rejects(executeCodingAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:database.write', input: null, scopeCandidateId: 'scope-candidate-0001', mutationAccess: 'write' },
}), /DATABASE_WRITE/i);
assert.equal(databaseCalls, 0);

await assert.rejects(executeCodingAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:git.write', input: null, scopeCandidateId: 'scope-candidate-0001', mutationAccess: 'write' },
}), /GIT_WRITE/i);
assert.equal(gitCalls, 0);

await assert.rejects(executeCodingAgent({
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:unsafe.write', input: null },
}), /declare mutation consistently/i);
assert.equal(unsafeCalls, 0);

await assert.rejects(executeCodingAgent({
  toolRuntime: { orchestration, verifyCapability: () => true, tools: [tools[0]!] },
  invocation: { stepId: 'build-step-0001', toolId: 'tool:file.write', input: null },
}), (error: unknown) => error instanceof ToolRuntimeMutationBlockedError);

assert.throws(() => assertCanonicalCodingAgentExecution({ ...first, directMutationAuthority: true } as never), /non-canonical/i);
assert.ok(capabilityRequests.includes('tool:file.write:WRITE:build-step-0001'));
assert.ok(capabilityRequests.includes('tool:verify.execute:EXECUTE:build-step-0002'));
assert.ok(capabilityRequests.includes('tool:project.read:READ:build-step-0001'));

console.log(JSON.stringify({ok:true,schema:'gd-build60-coding-agent-runtime/1',build:60,agentId:first.agentId,delegatedToolRuntime:true,scopeLockEnforced:true,databaseCapabilityBlocked:true,gitCapabilityBlocked:true},null,2));
