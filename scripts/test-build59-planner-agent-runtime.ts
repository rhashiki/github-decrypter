import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { AGENT_RUNTIME_REGISTRY } from '../packages/ai/src/agent-runtime.js';
import { assertCanonicalPlannerAgentBrief, createPlannerAgentBrief } from '../packages/ai/src/planner-agent.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Plan a safe implementation

# Requirements
- Add a deterministic feature
- Preserve existing architecture

# Constraint
No execution or approval from the Planner Agent

# Acceptance
The planning brief must preserve the exact draft plan tasks and dependencies` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const plan = createPlanAuthority({ spec, graph });

const first = createPlannerAgentBrief({ plan });
const second = createPlannerAgentBrief({ registry: AGENT_RUNTIME_REGISTRY, plan });
assert.deepEqual(first, second);
assert.equal(first.schema, 'gd-planner-agent/1');
assert.equal(first.sourceAgentRuntimeSchema, 'gd-agent-runtime/1');
assert.equal(first.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(first.sourcePlanId, plan.id);
assert.equal(first.sourcePlanDigest.hex, plan.authorityDigest.hex);
assert.equal(first.agentId, 'leonardo');
assert.equal(first.agentName, 'Leonardo');
assert.equal(first.agentRole, 'architect');
assert.equal(first.mode, 'PLAN');
assert.equal(first.status, 'briefed');
assert.equal(first.taskCount, plan.tasks.length);
assert.deepEqual(first.tasks.map((item) => item.sourceTaskId), plan.tasks.map((task) => task.id));
assert.deepEqual(first.tasks.map((item) => item.dependsOn), plan.tasks.map((task) => task.dependsOn));
for (const field of [
  'namedAgentBinding','plannerAgent','planningSpecialization','planAuthorityConsumer','draftPlanRequired',
  'planningAdvisoryOnly','planReadOnlyPreserved','immutable','deterministic','environmentNeutral',
] as const) assert.equal(first[field], true);
for (const field of [
  'semanticInference','planApprovalAuthority','decisionAuthority','projectRulesAuthority','impactSimulationAuthority',
  'buildTransitionAuthority','automaticAgentSelection','orchestration','agentExecution','toolExecution','execution',
  'capabilityGrantAuthority','approvalAuthority','scopeAuthority','mutationAuthorized','scheduling','jobCreation',
  'persistence','networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
] as const) assert.equal(first[field], false);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.tasks), true);
assert.equal(first.tasks.every((item) => Object.isFrozen(item) && Object.isFrozen(item.dependsOn)), true);
assert.doesNotThrow(() => assertCanonicalPlannerAgentBrief(first, { plan }));

const approved = approvePlan({ plan });
assert.throws(() => createPlannerAgentBrief({ plan: approved }), /draft Plan Authority/i);
assert.throws(() => createPlannerAgentBrief({ plan: { ...plan, authorityDigest: { ...plan.authorityDigest, hex: '0'.repeat(64) } } as never }), /digest/i);
assert.throws(() => createPlannerAgentBrief({ plan: { ...plan, status: 'approved', approved: true } as never }), /draft Plan Authority/i);
assert.throws(() => assertCanonicalPlannerAgentBrief({ ...first, planApprovalAuthority: true } as never, { plan }), /non-canonical/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build59-planner-agent-runtime/1',
  build: 59,
  agentId: first.agentId,
  taskCount: first.taskCount,
  draftPlanRequired: first.draftPlanRequired,
  planApprovalAuthority: first.planApprovalAuthority,
}, null, 2));
