import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import {
  createToolRuntime,
  ToolRuntimeCapabilityError,
  ToolRuntimeMutationBlockedError,
} from '../packages/tools/src/index.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Execute a capability-gated read tool from BUILD

# Requirements
- Inspect project metadata
- Report the inspected metadata [depends: req-0002]

# Constraint
Mutation remains blocked until Scope Lock exists

# Acceptance
Tool dispatch requires explicit capability verification` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:tool-runtime-alpha',
  rules: [
    { key: 'tools.capability-gate', kind: 'require', statement: 'Verify required capabilities before every tool handler dispatch.' },
    { key: 'tools.no-mutation', kind: 'forbid', statement: 'Do not mutate before Scope Lock authority exists.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [
    {
      area: 'Tool execution boundary',
      effect: 'positive',
      severity: 'high',
      summary: 'Separates capability-gated non-mutating handler execution from future mutation authority.',
      relatedRuleKeys: ['tools.capability-gate', 'tools.no-mutation'],
      relatedTaskIds: ['task-0001', 'task-0002'],
    },
  ],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });

const verificationRequests: string[] = [];
let readHandlerCalls = 0;
let deniedHandlerCalls = 0;
let mutatingHandlerCalls = 0;
const runtime = createToolRuntime({
  orchestration,
  verifyCapability: async (request) => {
    verificationRequests.push(`${request.toolId}:${request.capability}:${request.stepId}`);
    return request.capability === 'READ';
  },
  tools: [
    {
      descriptor: {
        id: 'tool:project.read',
        label: 'Read project metadata',
        requiredCapabilities: ['READ'],
        mutating: false,
      },
      handler: (context, input) => {
        readHandlerCalls += 1;
        assert.equal(Object.isFrozen(context), true);
        assert.equal(Object.isFrozen(context.step), true);
        assert.equal(Object.isFrozen(context.tool), true);
        assert.equal(Object.isFrozen(context.verifiedCapabilities), true);
        assert.equal(context.mutationAuthorized, false);
        assert.equal(context.scopeLockRequired, true);
        assert.equal(context.scopeLock, false);
        assert.equal(Object.isFrozen(input as object), true);
        return { inspected: true, source: input, step: context.step.id };
      },
    },
    {
      descriptor: {
        id: 'tool:remote.read',
        label: 'Read remote metadata',
        requiredCapabilities: ['READ', 'NETWORK'],
        mutating: false,
      },
      handler: () => {
        deniedHandlerCalls += 1;
        return { unreachable: true };
      },
    },
    {
      descriptor: {
        id: 'tool:file.write',
        label: 'Write workspace file',
        requiredCapabilities: ['WRITE'],
        mutating: true,
      },
      handler: () => {
        mutatingHandlerCalls += 1;
        return { unreachable: true };
      },
    },
  ],
});

assert.equal(runtime.schema, 'gd-tool-runtime/1');
assert.equal(runtime.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(runtime.sourceOrchestrationId, orchestration.id);
assert.equal(runtime.sourceOrchestrationDigest, orchestration.orchestrationDigest.hex);
assert.equal(runtime.workspaceId, orchestration.workspaceId);
assert.equal(runtime.mode, 'BUILD');
assert.equal(runtime.status, 'ready');
assert.deepEqual(runtime.tools.map((tool) => tool.id), ['tool:file.write', 'tool:project.read', 'tool:remote.read']);
for (const field of ['immutable','environmentNeutral','denyByDefault','capabilityVerifierRequired','toolExecution','execution','scopeLockRequired'] as const) {
  assert.equal(runtime[field], true);
}
for (const field of [
  'capabilityGrantAuthority','mutationAuthorized','scopeIntelligence','scopeLock','checkpoints','validationPipeline',
  'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(runtime[field], false);
assert.equal(Object.isFrozen(runtime), true);
assert.equal(Object.isFrozen(runtime.tools), true);
assert.equal(Object.isFrozen(runtime.tools[0]!), true);
assert.equal(Object.isFrozen(runtime.tools[0]!.requiredCapabilities), true);

const invocationInput = { stepId: 'build-step-0001', toolId: 'tool:project.read', input: { path: 'package.json', nested: { mode: 'metadata' } } } as const;
const first = await runtime.invoke(invocationInput);
const second = await runtime.invoke(invocationInput);
assert.equal(readHandlerCalls, 2);
assert.equal(first.id, second.id);
assert.deepEqual(first, second);
assert.equal(first.schema, 'gd-tool-runtime/1');
assert.equal(first.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(first.sourceOrchestrationId, orchestration.id);
assert.equal(first.sourceOrchestrationDigest, orchestration.orchestrationDigest.hex);
assert.equal(first.workspaceId, orchestration.workspaceId);
assert.equal(first.stepId, 'build-step-0001');
assert.equal(first.toolId, 'tool:project.read');
assert.deepEqual(first.requiredCapabilities, ['READ']);
assert.equal(first.status, 'completed');
assert.equal(first.invocationDigest.algorithm, 'sha256');
assert.match(first.invocationDigest.hex, /^[0-9a-f]{64}$/);
assert.equal(first.id, `tool-invocation-${first.invocationDigest.hex.slice(0, 16)}`);
assert.equal(first.toolExecution, true);
assert.equal(first.execution, true);
assert.equal(first.mutationAuthorized, false);
assert.equal(first.scopeLockRequired, true);
assert.equal(first.scopeLock, false);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.input as object), true);
assert.equal(Object.isFrozen((first.input as { nested: object }).nested), true);
assert.equal(Object.isFrozen(first.result as object), true);
assert.equal(Object.isFrozen(first.invocationDigest), true);
assert.deepEqual(verificationRequests.slice(0, 2), [
  'tool:project.read:READ:build-step-0001',
  'tool:project.read:READ:build-step-0001',
]);

await assert.rejects(
  runtime.invoke({ stepId: 'build-step-0001', toolId: 'tool:remote.read', input: null }),
  (error: unknown) => error instanceof ToolRuntimeCapabilityError && error.capability === 'NETWORK',
);
assert.equal(deniedHandlerCalls, 0);
assert.deepEqual(verificationRequests.slice(-2), [
  'tool:remote.read:READ:build-step-0001',
  'tool:remote.read:NETWORK:build-step-0001',
]);

const requestsBeforeMutation = verificationRequests.length;
await assert.rejects(
  runtime.invoke({ stepId: 'build-step-0001', toolId: 'tool:file.write', input: { content: 'blocked' } }),
  (error: unknown) => error instanceof ToolRuntimeMutationBlockedError,
);
assert.equal(mutatingHandlerCalls, 0);
assert.equal(verificationRequests.length, requestsBeforeMutation);

await assert.rejects(runtime.invoke({ stepId: 'build-step-9999', toolId: 'tool:project.read', input: null }), /unknown Build step/i);
await assert.rejects(runtime.invoke({ stepId: 'build-step-0001', toolId: 'tool:missing', input: null }), /unknown tool/i);
assert.throws(() => createToolRuntime({
  orchestration: { ...orchestration, orchestrationDigest: { ...orchestration.orchestrationDigest, hex: '0'.repeat(64) } },
  verifyCapability: () => true,
  tools: [{ descriptor: { id: 'tool:test', label: 'Test', requiredCapabilities: ['READ'], mutating: false }, handler: () => null }],
} as never), /digest does not match canonical Build material/i);
assert.throws(() => createToolRuntime({
  orchestration,
  verifyCapability: () => true,
  tools: [
    { descriptor: { id: 'tool:dup', label: 'First', requiredCapabilities: ['READ'], mutating: false }, handler: () => null },
    { descriptor: { id: 'tool:dup', label: 'Second', requiredCapabilities: ['READ'], mutating: false }, handler: () => null },
  ],
}), /registered more than once/i);
assert.throws(() => createToolRuntime({
  orchestration,
  verifyCapability: () => true,
  tools: [{ descriptor: { id: 'tool:no-cap', label: 'No capability', requiredCapabilities: [], mutating: false }, handler: () => null }],
}), /between 1 and 8 explicit capabilities/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build53-tool-runtime-runtime/1',
  build: 53,
  canonicalBuildBinding: true,
  deterministicInvocationIdentity: true,
  denyByDefault: true,
  injectedCapabilityVerifier: true,
  nonMutatingDispatch: true,
  mutationBlockedUntilScopeLock: true,
  toolExecution: true,
  execution: true,
  mutationAuthorized: false,
}, null, 2));
