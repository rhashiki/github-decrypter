import assert from 'node:assert/strict';
import { createPromptIntakeRecord, compileRequirements } from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { approvePlan, createPlanAuthority } from '../packages/plan/src/authority.js';
import { resolveDecision } from '../packages/plan/src/decision.js';

const intake = createPromptIntakeRecord({ text: `# Goal
Choose a safe project architecture

# Requirements
- Define the service boundary
- Keep planning read-only [depends: req-0002]

# Constraint
Do not execute the architectural choice from PLAN

# Acceptance
The architectural decision is explicit before Plan approval` });
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const plan = createPlanAuthority({ spec, graph });

const input = {
  plan,
  question: 'Which boundary should own the feature?',
  alternatives: [
    {
      label: 'Reusable package',
      summary: 'Keep the contract environment-neutral in a reusable package.',
      tradeoffs: ['Requires an explicit adapter at runtime.', 'Preserves provider replacement.'],
    },
    {
      label: 'Local Runtime',
      summary: 'Place the contract directly inside the privileged runtime.',
      tradeoffs: ['Simpler initial wiring.', 'Couples the contract to one execution environment.'],
    },
  ],
  selectedAlternativeOrdinal: 1,
  rationale: 'The reusable package preserves the architecture boundary without granting execution authority.',
} as const;

const decision = resolveDecision(input);
assert.equal(decision.schema, 'gd-decision-engine/1');
assert.equal(decision.sourcePlanSchema, 'gd-plan-authority/1');
assert.equal(decision.sourcePlanId, plan.id);
assert.deepEqual(decision.sourcePlanDigest, plan.authorityDigest);
assert.equal(decision.mode, 'PLAN');
assert.equal(decision.status, 'resolved');
assert.equal(decision.question, input.question);
assert.equal(decision.alternatives.length, 2);
assert.equal(decision.alternatives[0]?.id, 'alternative-0001');
assert.equal(decision.alternatives[1]?.id, 'alternative-0002');
assert.deepEqual(decision.alternatives[0]?.tradeoffs, [...input.alternatives[0].tradeoffs]);
assert.equal(decision.selectedAlternativeId, 'alternative-0001');
assert.equal(decision.selectedAlternativeOrdinal, 1);
assert.equal(decision.rationale, input.rationale);
assert.equal(decision.decisionDigest.algorithm, 'sha256');
assert.match(decision.decisionDigest.hex, /^[0-9a-f]{64}$/);
assert.match(decision.id, /^decision-[0-9a-f]{16}$/);
assert.equal(decision.readOnly, true);
assert.equal(decision.planReadOnlyPreserved, true);
assert.equal(decision.explicitAlternativesOnly, true);
assert.equal(decision.selectionDeclaredByCaller, true);
assert.equal(decision.semanticInference, false);
assert.equal(decision.automaticScoring, false);
assert.equal(decision.decisionEngineApplied, true);
assert.equal(decision.projectRulesApplied, false);
assert.equal(decision.impactSimulationApplied, false);
assert.equal(decision.buildTransitionAuthorized, false);
assert.equal(decision.buildOrchestration, false);
assert.equal(decision.toolExecution, false);
assert.equal(decision.scopeIntelligence, false);
assert.equal(decision.scopeLock, false);
assert.equal(decision.checkpoints, false);
assert.equal(decision.validationPipeline, false);
assert.equal(decision.execution, false);
assert.equal(decision.scheduling, false);
assert.equal(decision.persistence, false);
assert.equal(Object.isFrozen(decision), true);
assert.equal(Object.isFrozen(decision.sourcePlanDigest), true);
assert.equal(Object.isFrozen(decision.decisionDigest), true);
assert.equal(Object.isFrozen(decision.alternatives), true);
assert.equal(Object.isFrozen(decision.alternatives[0]!), true);
assert.equal(Object.isFrozen(decision.alternatives[0]!.tradeoffs), true);

const deterministic = resolveDecision(input);
assert.deepEqual(deterministic, decision);

const normalized = resolveDecision({
  ...input,
  question: `  ${input.question}\r\n`,
  rationale: `  ${input.rationale}  `,
});
assert.equal(normalized.question, input.question);
assert.equal(normalized.rationale, input.rationale);
assert.deepEqual(normalized, decision);

const alternativeChoice = resolveDecision({ ...input, selectedAlternativeOrdinal: 2, rationale: 'The runtime boundary is selected for this comparison.' });
assert.equal(alternativeChoice.selectedAlternativeId, 'alternative-0002');
assert.notEqual(alternativeChoice.decisionDigest.hex, decision.decisionDigest.hex);

const approved = approvePlan({ plan });
assert.throws(() => resolveDecision({ ...input, plan: approved }), /source Plan remains draft/i);
assert.throws(() => resolveDecision({ ...input, alternatives: [input.alternatives[0]] } as never), /between 2 and 32 alternatives/i);
assert.throws(() => resolveDecision({ ...input, selectedAlternativeOrdinal: 3 }), /does not identify a declared alternative/i);
assert.throws(() => resolveDecision({ ...input, rationale: '   ' }), /must not be empty/i);
assert.throws(() => resolveDecision({ ...input, extra: true } as never), /accepts only plan, question, alternatives/i);
assert.throws(() => resolveDecision({
  ...input,
  alternatives: [input.alternatives[0], { ...input.alternatives[1], label: input.alternatives[0].label }],
}), /labels must be unique/i);
assert.throws(() => resolveDecision({
  ...input,
  plan: { ...plan, authorityDigest: { ...plan.authorityDigest, hex: '0'.repeat(64) } },
} as never), /authority digest does not match canonical Plan material/i);
assert.throws(() => resolveDecision({
  ...input,
  plan: { ...plan, decisionEngineApplied: true },
} as never), /decisionEngineApplied boundary is invalid/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build49-decision-engine-runtime/1',
  build: 49,
  decisionSchema: decision.schema,
  deterministic: true,
  sourcePlanDraftRequired: true,
  explicitAlternativesOnly: true,
  selectionDeclaredByCaller: true,
  semanticInference: false,
  automaticScoring: false,
  planReadOnlyPreserved: true,
  buildTransitionAuthorized: false,
  projectRulesApplied: false,
  impactSimulationApplied: false,
  toolExecution: false,
}, null, 2));
