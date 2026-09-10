import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';
import { orchestrateBuild } from '../packages/build/src/index.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Transition an approved plan into deterministic BUILD orchestration

# Requirements
- Prepare the first build task
- Prepare the dependent build task [depends: req-0002]

# Constraint
Orchestration must not execute tools or mutate state

# Acceptance
BUILD order preserves the canonical Plan DAG` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const draftPlan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan: draftPlan,
  workspaceId: 'workspace:build-orchestrator-alpha',
  rules: [
    { key: 'build.scope-lock', kind: 'require', statement: 'Require Scope Lock before mutating BUILD execution.' },
    { key: 'build.no-direct-tools', kind: 'forbid', statement: 'Do not execute tools from the Build Orchestrator.' },
  ],
});
const impactSimulation = simulateImpact({
  plan: draftPlan,
  projectRules,
  impacts: [
    {
      area: 'Execution boundary',
      effect: 'positive',
      severity: 'high',
      summary: 'Separates BUILD orchestration from Tool Runtime execution.',
      relatedRuleKeys: ['build.scope-lock', 'build.no-direct-tools'],
      relatedTaskIds: ['task-0001', 'task-0002'],
    },
  ],
});
const plan = approvePlan({ plan: draftPlan });

assert.equal(plan.id, draftPlan.id);
assert.deepEqual(plan.authorityDigest, draftPlan.authorityDigest);
assert.equal(plan.status, 'approved');

const input = { plan, projectRules, impactSimulation } as const;
const orchestration = orchestrateBuild(input);

assert.equal(orchestration.schema, 'gd-build-orchestrator/1');
assert.equal(orchestration.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(orchestration.sourceProjectRulesSchema, 'gd-project-rules/1');
assert.equal(orchestration.sourceImpactSimulationSchema, 'gd-impact-simulation/1');
assert.equal(orchestration.sourcePlanId, plan.id);
assert.deepEqual(orchestration.sourcePlanDigest, plan.authorityDigest);
assert.equal(orchestration.sourcePlanStatus, 'approved');
assert.equal(orchestration.sourceProjectRulesId, projectRules.id);
assert.deepEqual(orchestration.sourceProjectRulesDigest, projectRules.rulesDigest);
assert.equal(orchestration.sourceImpactSimulationId, impactSimulation.id);
assert.deepEqual(orchestration.sourceImpactSimulationDigest, impactSimulation.impactDigest);
assert.equal(orchestration.workspaceId, projectRules.workspaceId);
assert.equal(orchestration.mode, 'BUILD');
assert.equal(orchestration.status, 'orchestrated');
assert.equal(orchestration.transition, 'PLAN_TO_BUILD');
assert.equal(orchestration.steps.length, 2);
assert.equal(orchestration.steps[0]?.id, 'build-step-0001');
assert.equal(orchestration.steps[0]?.sourceTaskId, 'task-0001');
assert.deepEqual(orchestration.steps[0]?.dependsOn, []);
assert.equal(orchestration.steps[1]?.id, 'build-step-0002');
assert.equal(orchestration.steps[1]?.sourceTaskId, 'task-0002');
assert.deepEqual(orchestration.steps[1]?.dependsOn, ['build-step-0001']);
assert.deepEqual(orchestration.buildOrder, ['build-step-0001', 'build-step-0002']);
assert.equal(orchestration.orchestrationDigest.algorithm, 'sha256');
assert.match(orchestration.orchestrationDigest.hex, /^[0-9a-f]{64}$/);
assert.equal(orchestration.id, `build-orchestration-${orchestration.orchestrationDigest.hex.slice(0, 16)}`);

const expectedMaterial = JSON.stringify({
  schema: 'gd-build-orchestrator/1',
  sourcePlanSchema: 'gd-plan-authority/1',
  sourceProjectRulesSchema: 'gd-project-rules/1',
  sourceImpactSimulationSchema: 'gd-impact-simulation/1',
  sourcePlanId: plan.id,
  sourcePlanDigest: plan.authorityDigest,
  sourcePlanStatus: 'approved',
  sourceProjectRulesId: projectRules.id,
  sourceProjectRulesDigest: projectRules.rulesDigest,
  sourceImpactSimulationId: impactSimulation.id,
  sourceImpactSimulationDigest: impactSimulation.impactDigest,
  mode: 'BUILD',
  transition: 'PLAN_TO_BUILD',
  workspaceId: projectRules.workspaceId,
  steps: [
    {
      id: 'build-step-0001', ordinal: 1, sourceTaskId: 'task-0001', requirementId: plan.tasks[0]!.requirementId,
      statement: plan.tasks[0]!.statement, sourceStartLine: plan.tasks[0]!.sourceStartLine,
      sourceEndLine: plan.tasks[0]!.sourceEndLine, dependsOn: [],
    },
    {
      id: 'build-step-0002', ordinal: 2, sourceTaskId: 'task-0002', requirementId: plan.tasks[1]!.requirementId,
      statement: plan.tasks[1]!.statement, sourceStartLine: plan.tasks[1]!.sourceStartLine,
      sourceEndLine: plan.tasks[1]!.sourceEndLine, dependsOn: ['build-step-0001'],
    },
  ],
  buildOrder: ['build-step-0001', 'build-step-0002'],
});
assert.equal(orchestration.orchestrationDigest.hex, createHash('sha256').update(expectedMaterial).digest('hex'));

for (const field of [
  'immutable','sourcePlanReadOnlyPreserved','projectRulesReadOnlyPreserved','impactSimulationReadOnlyPreserved',
  'workspaceScoped','explicitTransition','buildTransitionAuthorized','buildOrchestration','capabilitiesRequired','scopeLockRequired',
] as const) assert.equal(orchestration[field], true);
for (const field of [
  'mutationAuthorized','toolExecution','scopeIntelligence','scopeLock','checkpoints','validationPipeline',
  'execution','scheduling','jobCreation','persistence',
] as const) assert.equal(orchestration[field], false);

assert.equal(Object.isFrozen(orchestration), true);
assert.equal(Object.isFrozen(orchestration.sourcePlanDigest), true);
assert.equal(Object.isFrozen(orchestration.sourceProjectRulesDigest), true);
assert.equal(Object.isFrozen(orchestration.sourceImpactSimulationDigest), true);
assert.equal(Object.isFrozen(orchestration.orchestrationDigest), true);
assert.equal(Object.isFrozen(orchestration.steps), true);
assert.equal(Object.isFrozen(orchestration.steps[0]!), true);
assert.equal(Object.isFrozen(orchestration.steps[1]!.dependsOn), true);
assert.equal(Object.isFrozen(orchestration.buildOrder), true);
assert.deepEqual(orchestrateBuild(input), orchestration);

assert.throws(() => orchestrateBuild({ ...input, plan: draftPlan } as never), /canonical approved Plan/i);
assert.throws(() => orchestrateBuild({ ...input, extra: true } as never), /accepts only plan, projectRules and impactSimulation/i);
assert.throws(() => orchestrateBuild({
  ...input,
  plan: { ...plan, authorityDigest: { ...plan.authorityDigest, hex: '0'.repeat(64) } },
} as never), /authority digest does not match canonical Plan material/i);
assert.throws(() => orchestrateBuild({
  ...input,
  projectRules: { ...projectRules, sourcePlanId: 'plan-wrong' },
} as never), /bound to the approved Plan identity/i);
assert.throws(() => orchestrateBuild({
  ...input,
  impactSimulation: { ...impactSimulation, sourceProjectRulesId: 'project-rules-wrong' },
} as never), /bound to the approved Plan and Project Rules identities/i);
assert.throws(() => orchestrateBuild({
  ...input,
  impactSimulation: { ...impactSimulation, impactDigest: { ...impactSimulation.impactDigest, hex: '0'.repeat(64) } },
} as never), /digest does not match canonical Impact material/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build52-build-orchestrator-runtime/1',
  build: 52,
  deterministic: true,
  approvedPlanRequired: true,
  planIdentityPreservedAcrossApproval: true,
  canonicalDependencyMapping: true,
  sha256VerifiedWithNodeCrypto: true,
  buildTransitionAuthorized: true,
  buildOrchestration: true,
  capabilitiesRequired: true,
  scopeLockRequired: true,
  mutationAuthorized: false,
  toolExecution: false,
}, null, 2));
