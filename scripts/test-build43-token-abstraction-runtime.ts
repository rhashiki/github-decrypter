import assert from 'node:assert/strict';
import {
  compileRequirements,
  createPromptIntakeRecord,
} from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { buildHierarchicalContext } from '../packages/context/src/index.js';
import { compileContextContinuation } from '../packages/context/src/continuation.js';
import {
  TOKEN_ABSTRACTION_SCHEMA,
  abstractTokenWindow,
} from '../packages/context/src/token-abstraction.js';

const intake = createPromptIntakeRecord({
  text: [
    '# Goal',
    'Keep finite context windows honest and internal.',
    '',
    '## Requirements',
    '- Prepare base.',
    '- Validate base [depends: req-0002].',
    '- Release safely [depends: req-0003].',
    '',
    '## Constraints',
    '- Do not promise infinite context.',
  ].join('\n'),
});
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const context = buildHierarchicalContext({ spec, graph });
const continuation = compileContextContinuation({ context });
const abstraction = abstractTokenWindow({
  continuation,
  window: {
    contextWindowTokens: 8192,
    reservedOutputTokens: 1024,
  },
});

assert.equal(abstraction.schema, TOKEN_ABSTRACTION_SCHEMA);
assert.equal(abstraction.sourceSchema, continuation.schema);
assert.equal(abstraction.sourceDigest.hex, continuation.sourceDigest.hex);
assert.equal(abstraction.rootContextId, 'ctx-root');
assert.deepEqual(abstraction.modelWindow, {
  contextWindowTokens: 8192,
  reservedOutputTokens: 1024,
  usableInputTokens: 7168,
});
assert.equal(abstraction.requirementCompilation, true);
assert.equal(abstraction.taskGraphCompilation, true);
assert.equal(abstraction.contextCompilation, true);
assert.equal(abstraction.contextContinuation, true);
assert.equal(abstraction.tokenAbstraction, true);
assert.equal(abstraction.deterministic, true);
assert.equal(abstraction.finiteModelWindow, true);
assert.equal(abstraction.userFacingRawTokenBudget, false);
assert.equal(abstraction.infiniteContextClaim, false);
assert.equal(abstraction.tokenizerExecution, false);
assert.equal(abstraction.contentTokenEstimation, false);
assert.equal(abstraction.silentTruncation, false);
assert.equal(abstraction.semanticCompression, false);
assert.equal(abstraction.orchestrationRequired, true);
assert.equal(abstraction.conversationHistory, false);
assert.equal(abstraction.projectMemory, false);
assert.equal(abstraction.aiExecution, false);
assert.equal(abstraction.execution, false);
assert.equal(abstraction.persistence, false);

assert.deepEqual(abstraction.envelopeOrder, ['ctxwin-0001', 'ctxwin-0002', 'ctxwin-0003']);
assert.equal(abstraction.envelopes.length, 3);
assert.deepEqual(abstraction.envelopes.map((envelope) => ({
  id: envelope.id,
  continuationFrameId: envelope.continuationFrameId,
  usableInputTokens: envelope.usableInputTokens,
  metering: envelope.metering,
  fitStatus: envelope.fitStatus,
  overflowDecision: envelope.overflowDecision,
})), [
  { id: 'ctxwin-0001', continuationFrameId: 'cont-0001', usableInputTokens: 7168, metering: 'unmeasured', fitStatus: 'unknown', overflowDecision: 'deferred' },
  { id: 'ctxwin-0002', continuationFrameId: 'cont-0002', usableInputTokens: 7168, metering: 'unmeasured', fitStatus: 'unknown', overflowDecision: 'deferred' },
  { id: 'ctxwin-0003', continuationFrameId: 'cont-0003', usableInputTokens: 7168, metering: 'unmeasured', fitStatus: 'unknown', overflowDecision: 'deferred' },
]);
assert.deepEqual(abstraction.envelopes[2]!.carriedContextIds, ['ctx-root', 'ctx-task-0001', 'ctx-task-0002']);

assert.equal(Object.isFrozen(abstraction), true);
assert.equal(Object.isFrozen(abstraction.sourceDigest), true);
assert.equal(Object.isFrozen(abstraction.modelWindow), true);
assert.equal(Object.isFrozen(abstraction.envelopes), true);
assert.equal(Object.isFrozen(abstraction.envelopeOrder), true);
assert.equal(abstraction.envelopes.every((envelope) => Object.isFrozen(envelope)
  && Object.isFrozen(envelope.carriedContextIds)), true);

const same = abstractTokenWindow({
  continuation,
  window: { contextWindowTokens: 8192, reservedOutputTokens: 1024 },
});
assert.deepEqual(same, abstraction);

const differentWindow = abstractTokenWindow({
  continuation,
  window: { contextWindowTokens: 16384, reservedOutputTokens: 2048 },
});
assert.equal(differentWindow.modelWindow.usableInputTokens, 14336);
assert.equal(differentWindow.envelopes.every((envelope) => envelope.usableInputTokens === 14336), true);
assert.equal(differentWindow.envelopes.every((envelope) => envelope.fitStatus === 'unknown'), true);

assert.throws(
  () => abstractTokenWindow({ continuation, window: { contextWindowTokens: 8192, reservedOutputTokens: 1024 }, extra: true } as unknown as Parameters<typeof abstractTokenWindow>[0]),
  /only continuation and window fields/i,
);
assert.throws(
  () => abstractTokenWindow({ continuation, window: { contextWindowTokens: 0, reservedOutputTokens: 0 } }),
  /positive safe integer/i,
);
assert.throws(
  () => abstractTokenWindow({ continuation, window: { contextWindowTokens: 8192, reservedOutputTokens: 8192 } }),
  /below the context window/i,
);
assert.throws(
  () => abstractTokenWindow({ continuation, window: { contextWindowTokens: Number.MAX_SAFE_INTEGER + 1, reservedOutputTokens: 0 } }),
  /positive safe integer/i,
);

const boundaryDrift = { ...continuation, tokenAbstraction: true };
assert.throws(
  () => abstractTokenWindow({ continuation: boundaryDrift as typeof continuation, window: { contextWindowTokens: 8192, reservedOutputTokens: 1024 } }),
  /source tokenAbstraction boundary is invalid/i,
);

const carriedDrift = {
  ...continuation,
  frames: continuation.frames.map((frame, index) => index === 2
    ? { ...frame, carriedContextIds: ['ctx-root', 'ctx-task-0002'] }
    : frame),
};
assert.throws(
  () => abstractTokenWindow({ continuation: carriedDrift as typeof continuation, window: { contextWindowTokens: 8192, reservedOutputTokens: 1024 } }),
  /carried context boundary is invalid/i,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build43-token-abstraction-runtime/1',
  envelopes: abstraction.envelopes.length,
  usableInputTokens: abstraction.modelWindow.usableInputTokens,
  deterministic: true,
  finiteModelWindow: true,
  unmeasuredUntilRealMetering: true,
  silentTruncation: false,
  infiniteContextClaim: false,
  immutable: true,
}, null, 2));
