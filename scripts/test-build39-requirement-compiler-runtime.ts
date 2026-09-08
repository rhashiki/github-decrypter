import assert from 'node:assert/strict';
import {
  REQUIREMENT_MAX_ITEMS,
  REQUIREMENT_SPEC_SCHEMA,
  compileRequirements,
  createPromptIntakeRecord,
} from '../packages/plan/src/index.js';

const intake = createPromptIntakeRecord({
  text: [
    '# Goal',
    'Create a safe local-first compiler.',
    '',
    '## Requirements',
    '- Preserve deterministic output.',
    '- Requirement: Keep the input digest bound to the result.',
    '',
    '## Constraints',
    '- No network access.',
    '',
    '## Acceptance Criteria',
    '1. Same input produces the same specification.',
    '',
    '## Non-goals',
    '- Do not compile the task graph.',
    '',
    '## Context',
    'This is Build 39.',
  ].join('\n'),
});

const spec = compileRequirements({ intake });
assert.equal(spec.schema, REQUIREMENT_SPEC_SCHEMA);
assert.equal(spec.sourceSchema, intake.schema);
assert.equal(spec.sourceDigest.hex, intake.digest.hex);
assert.equal(spec.requirementCompilation, true);
assert.equal(spec.syntaxDirected, true);
assert.equal(spec.deterministic, true);
assert.equal(spec.semanticInterpretation, false);
assert.equal(spec.taskGraphCompilation, false);
assert.equal(spec.contextCompilation, false);
assert.equal(spec.contextContinuation, false);
assert.equal(spec.tokenAbstraction, false);
assert.equal(spec.attachmentIngestion, false);
assert.equal(spec.mentionResolution, false);
assert.equal(spec.conversationHistory, false);
assert.equal(spec.aiExecution, false);
assert.equal(spec.persistence, false);
assert.equal(spec.counts.total, 7);
assert.equal(spec.counts.goal, 1);
assert.equal(spec.counts.requirement, 2);
assert.equal(spec.counts.constraint, 1);
assert.equal(spec.counts.acceptance, 1);
assert.equal(spec.counts['non-goal'], 1);
assert.equal(spec.counts.context, 1);
assert.deepEqual(spec.items.map((item) => item.kind), [
  'goal', 'requirement', 'requirement', 'constraint', 'acceptance', 'non-goal', 'context',
]);
assert.deepEqual(spec.items.map((item) => item.id), [
  'req-0001','req-0002','req-0003','req-0004','req-0005','req-0006','req-0007',
]);
assert.equal(Object.isFrozen(spec), true);
assert.equal(Object.isFrozen(spec.items), true);
assert.equal(Object.isFrozen(spec.counts), true);
assert.equal(Object.isFrozen(spec.sourceDigest), true);
assert.equal(spec.items.every((item) => Object.isFrozen(item)), true);

const same = compileRequirements({ intake });
assert.deepEqual(same, spec);

const explicit = compileRequirements({ intake: createPromptIntakeRecord({ text: 'Constraint: offline only' }) });
assert.equal(explicit.items[0]?.kind, 'constraint');
assert.equal(explicit.items[0]?.statement, 'offline only');

const fenced = compileRequirements({ intake: createPromptIntakeRecord({ text: 'Context:\n```md\n# Requirements\n- not a parsed requirement\n```' }) });
assert.equal(fenced.items.length, 1);
assert.equal(fenced.items[0]?.kind, 'context');
assert.match(fenced.items[0]?.statement ?? '', /# Requirements/);

assert.throws(
  () => compileRequirements({ intake, extra: true } as unknown as { intake: typeof intake }),
  /only the intake field/i,
);

const tampered = { ...intake, normalizedText: `${intake.normalizedText}!` };
assert.throws(
  () => compileRequirements({ intake: tampered as typeof intake }),
  /digest does not match|metadata is invalid/i,
);

const oversizedItems = Array.from({ length: REQUIREMENT_MAX_ITEMS + 1 }, (_, index) => `- item ${index + 1}`).join('\n');
assert.throws(
  () => compileRequirements({ intake: createPromptIntakeRecord({ text: oversizedItems }) }),
  /exceeds 4096 items/i,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build39-requirement-compiler-runtime/1',
  deterministic: true,
  digestBound: true,
  explicitSections: true,
  fencedCodeOpaque: true,
  exactInput: true,
  maxItems: REQUIREMENT_MAX_ITEMS,
  downstreamAuthoritiesDeferred: true,
}, null, 2));
