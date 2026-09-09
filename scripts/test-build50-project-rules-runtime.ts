import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { bindProjectRules } from '../packages/plan/src/project-rules.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Respect the workspace constitution during planning

# Requirements
- Define a workspace-scoped rule set
- Keep PLAN read-only [depends: req-0002]

# Constraint
Do not simulate or execute the rules in Build 50

# Acceptance
Rules are explicit and deterministically bound to the Plan and workspace` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const plan = createPlanAuthority({ spec, graph });

const input = {
  plan,
  workspaceId: 'workspace:alpha',
  rules: [
    { key: 'Architecture.Layering', kind: 'require', statement: 'Keep reusable contracts environment-neutral.' },
    { key: 'security.no-secrets', kind: 'forbid', statement: 'Do not place secrets in ordinary frontend state.' },
    { key: 'testing.depth', kind: 'prefer', statement: 'Prefer deterministic tests at authority boundaries.' },
  ],
} as const;

const rules = bindProjectRules(input);
assert.equal(rules.schema, 'gd-project-rules/1');
assert.equal(rules.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(rules.sourcePlanId, plan.id);
assert.deepEqual(rules.sourcePlanDigest, plan.authorityDigest);
assert.equal(rules.mode, 'PLAN');
assert.equal(rules.status, 'bound');
assert.equal(rules.workspaceId, 'workspace:alpha');
assert.equal(rules.rules.length, 3);
assert.equal(rules.rules[0]?.id, 'rule-0001');
assert.equal(rules.rules[0]?.ordinal, 1);
assert.equal(rules.rules[0]?.key, 'architecture.layering');
assert.equal(rules.rules[0]?.kind, 'require');
assert.equal(rules.rules[1]?.kind, 'forbid');
assert.equal(rules.rules[2]?.kind, 'prefer');
assert.equal(rules.rulesDigest.algorithm, 'sha256');
assert.match(rules.rulesDigest.hex, /^[0-9a-f]{64}$/);
assert.equal(rules.id, `project-rules-${rules.rulesDigest.hex.slice(0, 16)}`);

const expectedMaterial = JSON.stringify({
  schema: 'gd-project-rules/1',
  sourcePlanSchema: 'gd-plan-authority/1',
  sourcePlanId: plan.id,
  sourcePlanDigest: plan.authorityDigest,
  workspaceId: 'workspace:alpha',
  rules: [
    { id: 'rule-0001', ordinal: 1, key: 'architecture.layering', kind: 'require', statement: 'Keep reusable contracts environment-neutral.' },
    { id: 'rule-0002', ordinal: 2, key: 'security.no-secrets', kind: 'forbid', statement: 'Do not place secrets in ordinary frontend state.' },
    { id: 'rule-0003', ordinal: 3, key: 'testing.depth', kind: 'prefer', statement: 'Prefer deterministic tests at authority boundaries.' },
  ],
});
assert.equal(rules.rulesDigest.hex, createHash('sha256').update(expectedMaterial).digest('hex'));

assert.equal(rules.readOnly, true);
assert.equal(rules.planReadOnlyPreserved, true);
assert.equal(rules.workspaceScoped, true);
assert.equal(rules.explicitRulesOnly, true);
assert.equal(rules.semanticInference, false);
assert.equal(rules.automaticEvaluation, false);
assert.equal(rules.projectRulesApplied, true);
assert.equal(rules.impactSimulationApplied, false);
assert.equal(rules.buildTransitionAuthorized, false);
assert.equal(rules.buildOrchestration, false);
assert.equal(rules.toolExecution, false);
assert.equal(rules.scopeIntelligence, false);
assert.equal(rules.scopeLock, false);
assert.equal(rules.checkpoints, false);
assert.equal(rules.validationPipeline, false);
assert.equal(rules.execution, false);
assert.equal(rules.scheduling, false);
assert.equal(rules.persistence, false);
assert.equal(Object.isFrozen(rules), true);
assert.equal(Object.isFrozen(rules.sourcePlanDigest), true);
assert.equal(Object.isFrozen(rules.rulesDigest), true);
assert.equal(Object.isFrozen(rules.rules), true);
assert.equal(Object.isFrozen(rules.rules[0]!), true);

const deterministic = bindProjectRules(input);
assert.deepEqual(deterministic, rules);

const normalized = bindProjectRules({
  ...input,
  workspaceId: '  workspace:alpha  ',
  rules: [
    { ...input.rules[0], key: '  ARCHITECTURE.LAYERING  ', statement: `  ${input.rules[0].statement}\r\n` },
    input.rules[1],
    input.rules[2],
  ],
});
assert.deepEqual(normalized, rules);

const otherWorkspace = bindProjectRules({ ...input, workspaceId: 'workspace:beta' });
assert.notEqual(otherWorkspace.rulesDigest.hex, rules.rulesDigest.hex);

const empty = bindProjectRules({ plan, workspaceId: 'workspace:empty', rules: [] });
assert.equal(empty.rules.length, 0);
assert.match(empty.rulesDigest.hex, /^[0-9a-f]{64}$/);

const approved = approvePlan({ plan });
assert.throws(() => bindProjectRules({ ...input, plan: approved }), /source Plan remains draft/i);
assert.throws(() => bindProjectRules({ ...input, workspaceId: '../workspace' }), /explicit opaque workspace identifier/i);
assert.throws(() => bindProjectRules({ ...input, workspaceId: '   ' }), /must not be empty/i);
assert.throws(() => bindProjectRules({ ...input, rules: [input.rules[0], { ...input.rules[1], key: 'ARCHITECTURE.LAYERING' }] }), /keys must be unique/i);
assert.throws(() => bindProjectRules({ ...input, rules: [{ ...input.rules[0], kind: 'execute' as never }] }), /kind is invalid/i);
assert.throws(() => bindProjectRules({ ...input, extra: true } as never), /accepts only plan, workspaceId and rules/i);
assert.throws(() => bindProjectRules({
  ...input,
  rules: Array.from({ length: 257 }, (_, index) => ({ key: `rule-${index}`, kind: 'require' as const, statement: `Rule ${index}` })),
}), /at most 256 explicit rules/i);
assert.throws(() => bindProjectRules({
  ...input,
  plan: { ...plan, authorityDigest: { ...plan.authorityDigest, hex: '0'.repeat(64) } },
} as never), /authority digest does not match canonical Plan material/i);
assert.throws(() => bindProjectRules({
  ...input,
  plan: { ...plan, projectRulesApplied: true },
} as never), /projectRulesApplied boundary is invalid/i);
assert.throws(() => bindProjectRules({
  ...input,
  plan: { ...plan, supportingRequirementIds: ['bad-id'] },
} as never), /supporting requirement identities are invalid/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build50-project-rules-runtime/1',
  build: 50,
  projectRulesSchema: rules.schema,
  deterministic: true,
  sourcePlanDraftRequired: true,
  workspaceScoped: true,
  explicitRulesOnly: true,
  semanticInference: false,
  automaticEvaluation: false,
  planReadOnlyPreserved: true,
  impactSimulationApplied: false,
  buildTransitionAuthorized: false,
  toolExecution: false,
}, null, 2));
