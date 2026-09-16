import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';
import { createToolRuntime } from '../packages/tools/src/index.js';
import { createCheckpoint } from '../packages/tools/src/checkpoint.js';
import { assertCanonicalValidation, createValidation } from '../packages/tools/src/validation.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Validate a completed outcome behaviorally

# Requirements
- Inspect a deterministic result

# Constraint
Validation must fail closed and never grant execution authority

# Acceptance
Observed evidence must satisfy explicit acceptance criteria before completion is eligible` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:validation-alpha',
  rules: [
    { key: 'validation.explicit', kind: 'require', statement: 'Validation must use explicit criteria and evidence.' },
    { key: 'validation.no-execution', kind: 'forbid', statement: 'Validation must not dispatch tools or flows.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [{
    area: 'Validation boundary',
    effect: 'positive',
    severity: 'critical',
    summary: 'Completed Build outcomes gain deterministic acceptance proof without new mutation authority.',
    relatedRuleKeys: ['validation.explicit','validation.no-execution'],
    relatedTaskIds: ['task-0001'],
  }],
});
const plan = approvePlan({ plan: draftPlan });
const orchestration = orchestrateBuild({ plan, projectRules, impactSimulation });
const runtime = createToolRuntime({
  orchestration,
  verifyCapability: () => true,
  tools: [{
    descriptor: { id: 'tool:validation.fixture', label: 'Validation fixture', requiredCapabilities: ['READ'], mutating: false },
    handler: () => ({ ok: true, message: 'ready', items: ['alpha','beta'], count: 2 }),
  }],
});
const invocation = await runtime.invoke({ stepId: 'build-step-0001', toolId: 'tool:validation.fixture', input: null });
const checkpoint = createCheckpoint({ orchestration, invocation });

const criteria = [
  { id: 'validation-criterion-0001', statement: 'The observed operation reports success.', expectation: { operator: 'equals', expected: true } },
  { id: 'validation-criterion-0002', statement: 'The observed message contains the expected readiness marker.', expectation: { operator: 'contains', expected: 'ready' } },
  { id: 'validation-criterion-0003', statement: 'A non-null count is observed.', expectation: { operator: 'exists' } },
] as const;
const observations = [
  { criterionId: 'validation-criterion-0001', kind: 'tool-result', sourceRef: `${checkpoint.id}#result.ok`, observed: true },
  { criterionId: 'validation-criterion-0002', kind: 'test', sourceRef: 'test:readiness', observed: 'system ready for validation' },
  { criterionId: 'validation-criterion-0003', kind: 'diagnostic', sourceRef: 'diagnostic:item-count', observed: 2 },
] as const;

const first = createValidation({ orchestration, checkpoint, criteria, observations });
const second = createValidation({ orchestration, checkpoint, criteria, observations });
assert.deepEqual(first, second);
assert.equal(first.schema, 'gd-validation-pipeline/1');
assert.equal(first.sourceCheckpointSchema, 'gd-checkpoint-engine/1');
assert.equal(first.sourceCheckpointId, checkpoint.id);
assert.equal(first.sourceCheckpointDigest.hex, checkpoint.checkpointDigest.hex);
assert.equal(first.sourceOrchestrationId, orchestration.id);
assert.equal(first.workspaceId, orchestration.workspaceId);
assert.equal(first.stepId, checkpoint.stepId);
assert.equal(first.status, 'validated');
assert.equal(first.verdict, 'passed');
assert.equal(first.passedCount, 3);
assert.equal(first.failedCount, 0);
assert.equal(first.completionEligible, true);
assert.equal(first.criteria.every((criterion) => criterion.passed), true);
for (const field of [
  'immutable','deterministic','environmentNeutral','workspaceScoped','checkpointRequired','checkpointReadOnlyPreserved',
  'acceptanceCriteriaRequired','observedEvidenceRequired','failClosed','behavioralValidation','validationPipeline','interactiveQAFoundation',
] as const) assert.equal(first[field], true);
for (const field of [
  'testingAgentAuthority','viktorCommunicationAuthority','capabilityGrantAuthority','mutationAuthorized','toolExecution',
  'externalFlowExecution','execution','checkpoints','restoreExecution','scheduling','jobCreation','persistence',
  'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(first[field], false);
assert.equal(first.testingAgentBuild, 62);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.criteria), true);
assert.doesNotThrow(() => assertCanonicalValidation(first, { orchestration, checkpoint, criteria, observations }));

const failed = createValidation({
  orchestration,
  checkpoint,
  criteria: [{ id: 'validation-criterion-0001', statement: 'Preview reports the requested title.', expectation: { operator: 'equals', expected: 'Expected title' } }],
  observations: [{ criterionId: 'validation-criterion-0001', kind: 'preview', sourceRef: 'preview:title', observed: 'Wrong title' }],
});
assert.equal(failed.verdict, 'failed');
assert.equal(failed.passedCount, 0);
assert.equal(failed.failedCount, 1);
assert.equal(failed.completionEligible, false);

assert.throws(() => createValidation({ orchestration, checkpoint, criteria: [], observations: [] }), /requires between 1 and 256/i);
assert.throws(() => createValidation({ orchestration, checkpoint, criteria, observations: observations.slice(0, 2) }), /exactly one observed evidence/i);
assert.throws(() => createValidation({
  orchestration,
  checkpoint,
  criteria: [{ id: 'wrong-id', statement: 'Invalid id.', expectation: { operator: 'truthy' } }],
  observations: [{ criterionId: 'wrong-id', kind: 'test', sourceRef: 'test:invalid', observed: true }],
}), /criterion id must be/i);
assert.throws(() => createValidation({
  orchestration,
  checkpoint,
  criteria: [{ id: 'validation-criterion-0001', statement: 'Evidence is required.', expectation: { operator: 'truthy' } }],
  observations: [{ criterionId: 'validation-criterion-9999', kind: 'test', sourceRef: 'test:wrong', observed: true }],
}), /missing observed evidence|bind exactly/i);
assert.throws(() => assertCanonicalValidation({ ...first, completionEligible: false } as never, { orchestration, checkpoint, criteria, observations }), /non-canonical/i);
assert.throws(() => assertCanonicalValidation({ ...first, mutationAuthorized: true } as never, { orchestration, checkpoint, criteria, observations }), /non-canonical/i);
assert.throws(() => assertCanonicalValidation({ ...first, validationDigest: { ...first.validationDigest, hex: '0'.repeat(64) } } as never, { orchestration, checkpoint, criteria, observations }), /non-canonical/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build57-validation-pipeline-runtime/1',
  build: 57,
  deterministicValidationIdentity: true,
  checkpointRequired: true,
  failClosed: true,
  behavioralValidation: true,
  passVerdict: first.verdict,
  failedVerdict: failed.verdict,
  completionEligibleOnlyOnPass: true,
  testingAgentAuthority: false,
}, null, 2));