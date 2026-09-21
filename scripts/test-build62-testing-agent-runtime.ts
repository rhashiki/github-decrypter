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
import {
  assertCanonicalTestingAgentExecution,
  executeTestingAgent,
  type TestingAgentExecutionInput,
} from '../packages/ai/src/testing-agent.js';

const intake = createPromptIntakeRecord({ text: '# Goal\nExercise a bounded supported behavior\n\n# Requirements\n- Inspect a supported QA state\n- Execute a bounded QA flow [depends: req-0002]\n\n# Constraint\nTesting must use Tool Runtime, Scope Lock, Checkpoint and Validation\n\n# Acceptance\nObserved behavior must be compared with explicit acceptance intent' });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:testing-agent-alpha',
  rules: [
    { key: 'testing.tool-runtime', kind: 'require', statement: 'Testing Agent operations delegate to Tool Runtime.' },
    { key: 'testing.validation', kind: 'require', statement: 'Testing Agent delegates verdicts to Validation Pipeline.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Interactive QA boundary',
    effect: 'positive',
    severity: 'critical',
    summary: 'Samuel can exercise bounded supported flows without becoming unrestricted automation.',
    relatedRuleKeys: ['testing.tool-runtime','testing.validation'],
    relatedTaskIds: ['task-0001','task-0002'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });
const scope = analyzeScope({
  orchestration,
  candidates: [
    { key: 'testing.read', buildStepId: 'build-step-0001', resource: 'qa:state', access: 'read', rationale: 'Read supported QA state.' },
    { key: 'testing.execute', buildStepId: 'build-step-0002', resource: 'qa:flow:smoke', access: 'execute', rationale: 'Execute bounded QA flow.' },
  ],
});
const scopeLock = lockScope({ orchestration, scope, candidateIds: ['scope-candidate-0002'] });

let readCalls = 0, executeCalls = 0, networkCalls = 0, writeCalls = 0, unsafeCalls = 0;
const capabilityRequests: string[] = [];
const tools = [
  {
    descriptor: { id: 'tool:qa.read', label: 'Read QA state', requiredCapabilities: ['READ'] as const, mutating: false },
    handler: () => { readCalls += 1; return 'ready'; },
  },
  {
    descriptor: { id: 'tool:qa.execute', label: 'Execute QA flow', requiredCapabilities: ['EXECUTE'] as const, mutating: true },
    handler: (context: any, input: any) => {
      executeCalls += 1;
      assert.equal(context.mutationAuthorized, true);
      assert.equal(context.scopeCandidateId, 'scope-candidate-0002');
      assert.equal(context.mutationAccess, 'execute');
      return input?.pass === true;
    },
  },
  {
    descriptor: { id: 'tool:qa.network', label: 'Network QA flow', requiredCapabilities: ['NETWORK'] as const, mutating: false },
    handler: () => { networkCalls += 1; return true; },
  },
  {
    descriptor: { id: 'tool:qa.write', label: 'Write during QA', requiredCapabilities: ['WRITE'] as const, mutating: true },
    handler: () => { writeCalls += 1; return true; },
  },
  {
    descriptor: { id: 'tool:qa.unsafe-execute', label: 'Unsafe execute declaration', requiredCapabilities: ['EXECUTE'] as const, mutating: false },
    handler: () => { unsafeCalls += 1; return true; },
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

const readInput: TestingAgentExecutionInput = {
  registry: AGENT_RUNTIME_REGISTRY,
  toolRuntime,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:qa.read', input: null },
  criterion: { id: 'validation-criterion-0001', statement: 'QA state is ready.', expectation: { operator: 'equals', expected: 'ready' } },
  evidenceKind: 'tool-result',
  sourceRef: 'tool:qa.read#result',
};
const readFirst = await executeTestingAgent(readInput);
const readSecond = await executeTestingAgent(readInput);
assert.deepEqual(readFirst, readSecond);
assert.equal(readCalls, 2);
assert.equal(readFirst.schema, 'gd-testing-agent/1');
assert.equal(readFirst.agentId, 'samuel');
assert.equal(readFirst.agentName, 'Samuel');
assert.equal(readFirst.agentRole, 'qa-testing');
assert.equal(readFirst.verdict, 'passed');
assert.equal(readFirst.completionEligible, true);
assert.equal(readFirst.validation.verdict, 'passed');
assert.equal(readFirst.validation.criteria[0]?.observed, 'ready');
assert.equal(readFirst.validation.criteria[0]?.sourceRef, 'tool:qa.read#result');
assert.equal(readFirst.checkpoint.sourceInvocationId, readFirst.toolInvocation.id);
assert.doesNotThrow(() => assertCanonicalTestingAgentExecution(readFirst, readInput));

const executeInput: TestingAgentExecutionInput = {
  toolRuntime,
  invocation: {
    stepId: 'build-step-0002',
    toolId: 'tool:qa.execute',
    input: { pass: true },
    scopeCandidateId: 'scope-candidate-0002',
    mutationAccess: 'execute',
  },
  criterion: { id: 'validation-criterion-0001', statement: 'Bounded QA flow succeeds.', expectation: { operator: 'truthy' } },
  evidenceKind: 'test',
  sourceRef: 'tool:qa.execute#result',
};
const executed = await executeTestingAgent(executeInput);
assert.equal(executeCalls, 1);
assert.equal(executed.verdict, 'passed');
assert.equal(executed.completionEligible, true);
assert.equal(executed.toolInvocation.mutationAuthorized, true);
assert.equal(executed.toolInvocation.mutationAccess, 'execute');
assert.equal(executed.sourceCheckpointId, executed.checkpoint.id);
assert.equal(executed.sourceValidationId, executed.validation.id);
assert.equal(executed.id, 'testing-run-' + executed.validation.validationDigest.hex.slice(0, 16));
assert.doesNotThrow(() => assertCanonicalTestingAgentExecution(executed, executeInput));

const failed = await executeTestingAgent({
  ...executeInput,
  invocation: { ...executeInput.invocation, input: { pass: false } },
});
assert.equal(executeCalls, 2);
assert.equal(failed.verdict, 'failed');
assert.equal(failed.completionEligible, false);
assert.equal(failed.validation.failedCount, 1);
assert.equal(failed.validation.criteria[0]?.observed, false);

const readsBeforeMalformed = readCalls;
await assert.rejects(executeTestingAgent({
  ...readInput,
  criterion: { ...readInput.criterion, id: 'criterion-wrong' },
} as never), /validation-criterion-0001/i);
assert.equal(readCalls, readsBeforeMalformed);

await assert.rejects(executeTestingAgent({
  ...readInput,
  evidenceKind: 'preview',
} as never), /evidence kind is unsupported/i);
assert.equal(readCalls, readsBeforeMalformed);

await assert.rejects(executeTestingAgent({
  ...readInput,
  invocation: { stepId: 'build-step-0001', toolId: 'tool:qa.network', input: null },
}), /blocks Tool Runtime capability NETWORK/i);
assert.equal(networkCalls, 0);

await assert.rejects(executeTestingAgent({
  ...executeInput,
  invocation: { ...executeInput.invocation, toolId: 'tool:qa.write' },
}), /blocks Tool Runtime capability WRITE/i);
assert.equal(writeCalls, 0);

await assert.rejects(executeTestingAgent({
  ...executeInput,
  invocation: { ...executeInput.invocation, toolId: 'tool:qa.unsafe-execute' },
}), /declare bounded execution as mutating/i);
assert.equal(unsafeCalls, 0);

await assert.rejects(executeTestingAgent({
  ...executeInput,
  toolRuntime: { orchestration, verifyCapability: () => true, tools: [tools[1]!] },
  invocation: { stepId: 'build-step-0002', toolId: 'tool:qa.execute', input: { pass: true }, scopeCandidateId: 'scope-candidate-0002', mutationAccess: 'execute' },
}), (error: unknown) => error instanceof ToolRuntimeMutationBlockedError);

assert.throws(() => assertCanonicalTestingAgentExecution({ ...executed, directMutationAuthority: true } as never, executeInput), /non-canonical/i);
assert.throws(() => assertCanonicalTestingAgentExecution({
  ...executed,
  validation: { ...executed.validation, completionEligible: false },
} as never, executeInput), /non-canonical/i);

assert.ok(capabilityRequests.includes('tool:qa.read:READ:build-step-0001'));
assert.ok(capabilityRequests.includes('tool:qa.execute:EXECUTE:build-step-0002'));

for (const field of [
  'namedAgentBinding','testingAgent','interactiveQA','behavioralFlowExecution','boundedFlowExecution',
  'singleFlowPerExecution','singleCriterionPerFlow','explicitAcceptanceRequired','observedResultBoundToToolResult',
  'toolRuntimeConsumer','toolRuntimeSovereign','checkpointEngineConsumer','validationPipelineConsumer',
  'scopeLockRequiredForExecute','capabilityVerifierRequired','mutationAuthorityOwnedByToolRuntime',
  'agentExecution','toolExecution','execution','deterministicBinding','environmentNeutral','immutable',
] as const) assert.equal(executed[field], true);
for (const field of [
  'semanticInference','evidenceFabricationAuthority','checkpointAuthority','validationAuthority','unrestrictedAutomation',
  'browserAutomationAuthority','previewAuthority','capabilityGrantAuthority','approvalAuthority','scopeAuthority',
  'directMutationAuthority','codingAgentAuthority','databaseAgentAuthority','reviewAgentAuthority',
  'agentOrchestratorAuthority','automaticAgentSelection','orchestration','scheduling','jobCreation','persistence',
  'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(executed[field], false);

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build62-testing-agent-runtime/1',
  build:62,
  agentId:executed.agentId,
  readFlowValidated:true,
  executeFlowValidated:true,
  failedBehaviorPreserved:true,
  scopeLockEnforced:true,
  networkBlocked:true,
  writeBlocked:true,
  unrestrictedAutomation:executed.unrestrictedAutomation,
},null,2));
