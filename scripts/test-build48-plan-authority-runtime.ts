import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { assertPlanReadOnly, evaluatePlanReadOnly, PLAN_MUTATING_CAPABILITIES } from '../apps/local/src/plan-authority.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Create a safe planning contract

# Requirements
- Define the plan authority
- Enforce runtime read-only PLAN [depends: req-0002]

# Constraint
Do not execute Build actions from PLAN

# Acceptance
Approved plans remain read-only until later Build authority` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const plan = createPlanAuthority({ spec, graph });

assert.equal(plan.schema, 'gd-plan-authority/1');
assert.equal(plan.mode, 'PLAN');
assert.equal(plan.status, 'draft');
assert.equal(plan.approved, false);
assert.equal(plan.readOnly, true);
assert.equal(plan.runtimeReadOnlyRequired, true);
assert.equal(plan.tasks.length, 2);
assert.deepEqual(plan.taskOrder, ['task-0001', 'task-0002']);
assert.deepEqual(plan.tasks[1]?.dependsOn, ['task-0001']);
assert.equal(plan.authorityDigest.algorithm, 'sha256');
assert.match(plan.authorityDigest.hex, /^[0-9a-f]{64}$/);
assert.match(plan.id, /^plan-[0-9a-f]{16}$/);
assert.equal(plan.buildTransitionAuthorized, false);
assert.equal(plan.decisionEngineApplied, false);
assert.equal(plan.projectRulesApplied, false);
assert.equal(plan.impactSimulationApplied, false);
assert.equal(plan.buildOrchestration, false);
assert.equal(plan.toolExecution, false);
assert.equal(plan.scopeLock, false);
assert.equal(plan.execution, false);
assert.equal(plan.scheduling, false);
assert.equal(plan.persistence, false);
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.tasks), true);
assert.equal(Object.isFrozen(plan.tasks[0]!), true);
assert.equal(Object.isFrozen(plan.tasks[1]!.dependsOn), true);

const deterministic = createPlanAuthority({ spec, graph });
assert.deepEqual(deterministic, plan);

const approved = approvePlan({ plan });
assert.equal(approved.status, 'approved');
assert.equal(approved.approved, true);
assert.equal(approved.id, plan.id);
assert.deepEqual(approved.authorityDigest, plan.authorityDigest);
assert.equal(approved.readOnly, true);
assert.equal(approved.runtimeReadOnlyRequired, true);
assert.equal(approved.buildTransitionAuthorized, false);
assert.equal(approved.execution, false);
assert.equal(approvePlan({ plan: approved }), approved);

const readDecision = evaluatePlanReadOnly({
  plan: approved,
  requirements: [
    { capability: 'READ', resource: 'gd://workspace/project' },
    { capability: 'NETWORK', resource: 'gd://github/repository' },
    { capability: 'SECRETS', resource: 'gd://vault/github-app' },
  ],
});
assert.equal(readDecision.allowed, true);
assert.deepEqual(readDecision.blockedCapabilities, []);
assert.equal(readDecision.readOnly, true);
assert.equal(readDecision.buildTransitionAuthorized, false);
assert.equal(readDecision.toolExecutionAuthorized, false);
assert.equal(assertPlanReadOnly({ plan: approved, requirements: [{ capability: 'READ', resource: 'gd://workspace/project' }] }).allowed, true);

assert.deepEqual(PLAN_MUTATING_CAPABILITIES, ['WRITE', 'EXECUTE', 'DATABASE_WRITE', 'GIT_WRITE', 'DESTRUCTIVE']);
for (const capability of PLAN_MUTATING_CAPABILITIES) {
  const decision = evaluatePlanReadOnly({
    plan: approved,
    requirements: [{ capability, resource: 'gd://workspace/project' }],
  });
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.blockedCapabilities, [capability]);
  assert.throws(
    () => assertPlanReadOnly({ plan: approved, requirements: [{ capability, resource: 'gd://workspace/project' }] }),
    /PLAN is read-only/i,
  );
}

assert.throws(() => createPlanAuthority({ spec, graph, extra: true } as never), /only spec and graph/i);
assert.throws(() => approvePlan({ plan: { ...plan, id: 'plan-0000000000000000' } } as never), /authority digest/i);
assert.throws(
  () => createPlanAuthority({ spec, graph: { ...graph, sourceDigest: { ...graph.sourceDigest, hex: '0'.repeat(64) } } } as never),
  /source digests do not match/i,
);
assert.throws(
  () => evaluatePlanReadOnly({ plan: approved, requirements: [{ capability: 'WRITE', resource: 'not-gd' }] }),
  /capability requirement/i,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build48-plan-authority-runtime/1',
  build: 48,
  planSchema: plan.schema,
  planMode: plan.mode,
  deterministic: true,
  explicitApproval: true,
  runtimeEnforcedReadOnly: true,
  mutatingCapabilitiesBlocked: PLAN_MUTATING_CAPABILITIES,
  buildTransitionAuthorized: false,
  decisionEngineApplied: false,
  projectRulesApplied: false,
  impactSimulationApplied: false,
  buildOrchestration: false,
  toolExecution: false,
}, null, 2));
