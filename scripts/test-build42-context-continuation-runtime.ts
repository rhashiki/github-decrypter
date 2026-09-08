import assert from 'node:assert/strict';
import {
  compileRequirements,
  createPromptIntakeRecord,
} from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import { buildHierarchicalContext } from '../packages/context/src/index.js';
import {
  CONTEXT_CONTINUATION_SCHEMA,
  compileContextContinuation,
} from '../packages/context/src/continuation.js';

const intake = createPromptIntakeRecord({
  text: [
    '# Goal',
    'Carry only canonical context between tasks.',
    '',
    '## Requirements',
    '- Prepare base.',
    '- Validate base [depends: req-0002].',
    '- Release safely [depends: req-0003].',
    '',
    '## Constraints',
    '- Stay deterministic.',
  ].join('\n'),
});
const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const context = buildHierarchicalContext({ spec, graph });
const continuation = compileContextContinuation({ context });

assert.equal(continuation.schema, CONTEXT_CONTINUATION_SCHEMA);
assert.equal(continuation.sourceSchema, context.schema);
assert.equal(continuation.sourceDigest.hex, context.sourceDigest.hex);
assert.equal(continuation.rootContextId, 'ctx-root');
assert.equal(continuation.requirementCompilation, true);
assert.equal(continuation.taskGraphCompilation, true);
assert.equal(continuation.contextCompilation, true);
assert.equal(continuation.contextContinuation, true);
assert.equal(continuation.deterministic, true);
assert.equal(continuation.sequentialHandoff, true);
assert.equal(continuation.dependencyContextCarry, true);
assert.equal(continuation.semanticExpansion, false);
assert.equal(continuation.tokenAbstraction, false);
assert.equal(continuation.projectMemory, false);
assert.equal(continuation.contextPackPersistence, false);
assert.equal(continuation.attachmentIngestion, false);
assert.equal(continuation.mentionResolution, false);
assert.equal(continuation.conversationHistory, false);
assert.equal(continuation.aiExecution, false);
assert.equal(continuation.execution, false);
assert.equal(continuation.persistence, false);

assert.deepEqual(continuation.frameOrder, ['cont-0001', 'cont-0002', 'cont-0003']);
assert.equal(continuation.frames.length, 3);

const [first, second, third] = continuation.frames;
assert.ok(first && second && third);
assert.deepEqual(first, {
  id: 'cont-0001',
  ordinal: 1,
  taskContextId: 'ctx-task-0001',
  taskId: 'task-0001',
  requirementId: 'req-0002',
  level: 0,
  previousFrameId: null,
  previousTaskContextId: null,
  directDependencyContextIds: [],
  inheritedDependencyContextIds: [],
  carriedContextIds: ['ctx-root'],
});
assert.equal(second.previousFrameId, 'cont-0001');
assert.equal(second.previousTaskContextId, 'ctx-task-0001');
assert.deepEqual(second.directDependencyContextIds, ['ctx-task-0001']);
assert.deepEqual(second.inheritedDependencyContextIds, ['ctx-task-0001']);
assert.deepEqual(second.carriedContextIds, ['ctx-root', 'ctx-task-0001']);
assert.equal(third.previousFrameId, 'cont-0002');
assert.equal(third.previousTaskContextId, 'ctx-task-0002');
assert.deepEqual(third.directDependencyContextIds, ['ctx-task-0002']);
assert.deepEqual(third.inheritedDependencyContextIds, ['ctx-task-0001', 'ctx-task-0002']);
assert.deepEqual(third.carriedContextIds, ['ctx-root', 'ctx-task-0001', 'ctx-task-0002']);

assert.equal(Object.isFrozen(continuation), true);
assert.equal(Object.isFrozen(continuation.frames), true);
assert.equal(Object.isFrozen(continuation.frameOrder), true);
assert.equal(Object.isFrozen(continuation.sourceDigest), true);
assert.equal(continuation.frames.every((frame) => Object.isFrozen(frame)
  && Object.isFrozen(frame.directDependencyContextIds)
  && Object.isFrozen(frame.inheritedDependencyContextIds)
  && Object.isFrozen(frame.carriedContextIds)), true);

const same = compileContextContinuation({ context });
assert.deepEqual(same, continuation);

assert.throws(
  () => compileContextContinuation({ context, extra: true } as unknown as { context: typeof context }),
  /only the context field/i,
);

const boundaryDrift = { ...context, contextContinuation: true };
assert.throws(
  () => compileContextContinuation({ context: boundaryDrift as typeof context }),
  /contextContinuation boundary is invalid/i,
);

const orderDrift = {
  ...context,
  taskContextOrder: [...context.taskContextOrder].reverse(),
};
assert.throws(
  () => compileContextContinuation({ context: orderDrift as typeof context }),
  /task context order is invalid/i,
);

const closureDrift = {
  ...context,
  tasks: context.tasks.map((task, index) => index === 2
    ? { ...task, dependencyClosure: ['task-0002', 'task-0001'] }
    : task),
};
assert.throws(
  () => compileContextContinuation({ context: closureDrift as typeof context }),
  /dependency closure is invalid/i,
);

const missingDirect = {
  ...context,
  tasks: context.tasks.map((task, index) => index === 1
    ? { ...task, dependencyClosure: [] }
    : task),
};
assert.throws(
  () => compileContextContinuation({ context: missingDirect as typeof context }),
  /invalid direct dependency/i,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build42-context-continuation-runtime/1',
  frames: continuation.frames.length,
  deterministic: true,
  sequentialHandoff: true,
  dependencyContextCarry: true,
  immutable: true,
  sourceDigestBound: true,
  downstreamAuthoritiesDeferred: true,
}, null, 2));
