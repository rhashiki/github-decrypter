import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';
import { simulateImpact } from '../packages/plan/src/impact-simulation.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Assess explicit impact before any build transition

# Requirements
- Bind workspace rules to the plan
- Simulate declared architecture impact [depends: req-0001]

# Constraint
Do not execute or mutate anything during simulation

# Acceptance
Every impact references canonical tasks and rules` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const plan = createPlanAuthority({ spec, graph });
const projectRules = bindProjectRules({
  plan,
  workspaceId: 'workspace:impact-alpha',
  rules: [
    { key: 'architecture.layering', kind: 'require', statement: 'Keep reusable contracts environment-neutral.' },
    { key: 'security.no-mutation', kind: 'forbid', statement: 'Do not mutate external state while planning.' },
  ],
});

const input = {
  plan,
  projectRules,
  impacts: [
    {
      area: 'Architecture',
      effect: 'positive',
      severity: 'medium',
      summary: 'Adds an explicit read-only impact record before orchestration.',
      relatedRuleKeys: ['ARCHITECTURE.LAYERING'],
      relatedTaskIds: ['task-0002'],
    },
    {
      area: 'Security',
      effect: 'neutral',
      severity: 'high',
      summary: 'Preserves the no-mutation boundary while recording declared risk.',
      relatedRuleKeys: ['security.no-mutation'],
      relatedTaskIds: ['task-0001', 'task-0002'],
    },
  ],
} as const;

const simulation = simulateImpact(input);
assert.equal(simulation.schema, 'gd-impact-simulation/1');
assert.equal(simulation.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(simulation.sourceProjectRulesSchema, 'gd-project-rules/1');
assert.equal(simulation.sourcePlanId, plan.id);
assert.deepEqual(simulation.sourcePlanDigest, plan.authorityDigest);
assert.equal(simulation.sourceProjectRulesId, projectRules.id);
assert.deepEqual(simulation.sourceProjectRulesDigest, projectRules.rulesDigest);
assert.equal(simulation.workspaceId, projectRules.workspaceId);
assert.equal(simulation.mode, 'PLAN');
assert.equal(simulation.status, 'simulated');
assert.equal(simulation.impacts.length, 2);
assert.equal(simulation.impacts[0]?.id, 'impact-0001');
assert.equal(simulation.impacts[0]?.ordinal, 1);
assert.equal(simulation.impacts[0]?.area, 'Architecture');
assert.equal(simulation.impacts[0]?.effect, 'positive');
assert.equal(simulation.impacts[0]?.severity, 'medium');
assert.deepEqual(simulation.impacts[0]?.relatedRuleKeys, ['architecture.layering']);
assert.deepEqual(simulation.impacts[0]?.relatedTaskIds, ['task-0002']);
assert.equal(simulation.impactDigest.algorithm, 'sha256');
assert.match(simulation.impactDigest.hex, /^[0-9a-f]{64}$/);
assert.equal(simulation.id, `impact-simulation-${simulation.impactDigest.hex.slice(0, 16)}`);

const expectedMaterial = JSON.stringify({
  schema: 'gd-impact-simulation/1',
  sourcePlanSchema: 'gd-plan-authority/1',
  sourceProjectRulesSchema: 'gd-project-rules/1',
  sourcePlanId: plan.id,
  sourcePlanDigest: plan.authorityDigest,
  sourceProjectRulesId: projectRules.id,
  sourceProjectRulesDigest: projectRules.rulesDigest,
  workspaceId: projectRules.workspaceId,
  impacts: [
    {
      id: 'impact-0001', ordinal: 1, area: 'Architecture', effect: 'positive', severity: 'medium',
      summary: 'Adds an explicit read-only impact record before orchestration.',
      relatedRuleKeys: ['architecture.layering'], relatedTaskIds: ['task-0002'],
    },
    {
      id: 'impact-0002', ordinal: 2, area: 'Security', effect: 'neutral', severity: 'high',
      summary: 'Preserves the no-mutation boundary while recording declared risk.',
      relatedRuleKeys: ['security.no-mutation'], relatedTaskIds: ['task-0001', 'task-0002'],
    },
  ],
});
assert.equal(simulation.impactDigest.hex, createHash('sha256').update(expectedMaterial).digest('hex'));

for (const field of ['readOnly','planReadOnlyPreserved','projectRulesReadOnlyPreserved','workspaceScoped','explicitImpactsOnly','impactSimulationApplied'] as const) {
  assert.equal(simulation[field], true);
}
for (const field of ['semanticInference','automaticEvaluation','buildTransitionAuthorized','buildOrchestration','toolExecution','scopeIntelligence','scopeLock','checkpoints','validationPipeline','execution','scheduling','persistence'] as const) {
  assert.equal(simulation[field], false);
}
assert.equal(Object.isFrozen(simulation), true);
assert.equal(Object.isFrozen(simulation.sourcePlanDigest), true);
assert.equal(Object.isFrozen(simulation.sourceProjectRulesDigest), true);
assert.equal(Object.isFrozen(simulation.impactDigest), true);
assert.equal(Object.isFrozen(simulation.impacts), true);
assert.equal(Object.isFrozen(simulation.impacts[0]!), true);
assert.equal(Object.isFrozen(simulation.impacts[0]!.relatedRuleKeys), true);
assert.equal(Object.isFrozen(simulation.impacts[0]!.relatedTaskIds), true);
assert.deepEqual(simulateImpact(input), simulation);

const empty = simulateImpact({ plan, projectRules, impacts: [] });
assert.equal(empty.impacts.length, 0);
assert.match(empty.impactDigest.hex, /^[0-9a-f]{64}$/);

assert.throws(() => simulateImpact({ ...input, impacts: [{ ...input.impacts[0], relatedRuleKeys: ['unknown.rule'] }] }), /unknown identity/i);
assert.throws(() => simulateImpact({ ...input, impacts: [{ ...input.impacts[0], relatedTaskIds: ['task-9999'] }] }), /unknown identity/i);
assert.throws(() => simulateImpact({ ...input, impacts: [{ ...input.impacts[0], effect: 'dangerous' as never }] }), /effect is invalid/i);
assert.throws(() => simulateImpact({ ...input, impacts: [{ ...input.impacts[0], severity: 'extreme' as never }] }), /severity is invalid/i);
assert.throws(() => simulateImpact({ ...input, impacts: [{ ...input.impacts[0], relatedTaskIds: ['task-0002', 'task-0002'] }] }), /references must be unique/i);
assert.throws(() => simulateImpact({ ...input, extra: true } as never), /accepts only plan, projectRules and impacts/i);
assert.throws(() => simulateImpact({ ...input, impacts: Array.from({ length: 257 }, (_, index) => ({
  area: `Area ${index}`, effect: 'neutral' as const, severity: 'low' as const, summary: `Impact ${index}`,
  relatedRuleKeys: [] as const, relatedTaskIds: [] as const,
})) }), /at most 256 explicit impacts/i);
assert.throws(() => simulateImpact({ ...input, plan: approvePlan({ plan }) } as never), /canonical draft Plan/i);
assert.throws(() => simulateImpact({
  ...input,
  plan: { ...plan, authorityDigest: { ...plan.authorityDigest, hex: '0'.repeat(64) } },
} as never), /authority digest does not match canonical Plan material/i);
assert.throws(() => simulateImpact({
  ...input,
  projectRules: { ...projectRules, rulesDigest: { ...projectRules.rulesDigest, hex: '0'.repeat(64) } },
} as never), /digest does not match canonical Project Rules material/i);
assert.throws(() => simulateImpact({
  ...input,
  projectRules: { ...projectRules, sourcePlanId: 'plan-wrong' },
} as never), /bound to the source Plan/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build51-impact-simulation-runtime/1',
  build: 51,
  deterministic: true,
  explicitImpactsOnly: true,
  canonicalTaskReferences: true,
  canonicalRuleReferences: true,
  sha256VerifiedWithNodeCrypto: true,
  planReadOnlyPreserved: true,
  projectRulesReadOnlyPreserved: true,
  buildTransitionAuthorized: false,
  execution: false,
}, null, 2));
