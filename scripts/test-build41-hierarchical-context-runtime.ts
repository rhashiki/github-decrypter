import assert from 'node:assert/strict';
import {
  compileRequirements,
  createPromptIntakeRecord,
} from '../packages/plan/src/index.js';
import { compileTaskGraph } from '../packages/plan/src/task-graph.js';
import {
  HIERARCHICAL_CONTEXT_SCHEMA,
  buildHierarchicalContext,
} from '../packages/context/src/index.js';

const intake = createPromptIntakeRecord({
  text: [
    '# Goal',
    'Ship deterministic hierarchical context.',
    '',
    '## Requirements',
    '- Load canonical source.',
    '- Build dependency context [depends: req-0002].',
    '- Validate hierarchical output [depends: req-0003].',
    '',
    '## Constraints',
    '- Stay offline.',
    '',
    '## Acceptance Criteria',
    '- Context levels remain stable.',
    '',
    '## Context',
    '- This is Build 41.',
    '',
    '## Non-goals',
    '- Do not persist context.',
  ].join('\n'),
});

const spec = compileRequirements({ intake });
const graph = compileTaskGraph({ spec });
const context = buildHierarchicalContext({ spec, graph });

assert.equal(context.schema, HIERARCHICAL_CONTEXT_SCHEMA);
assert.equal(context.sourceSpecSchema, spec.schema);
assert.equal(context.sourceGraphSchema, graph.schema);
assert.equal(context.sourceDigest.hex, spec.sourceDigest.hex);
assert.equal(context.requirementCompilation, true);
assert.equal(context.taskGraphCompilation, true);
assert.equal(context.contextCompilation, true);
assert.equal(context.hierarchical, true);
assert.equal(context.deterministic, true);
assert.equal(context.dependencyAware, true);
assert.equal(context.semanticExpansion, false);
assert.equal(context.contextContinuation, false);
assert.equal(context.tokenAbstraction, false);
assert.equal(context.projectMemory, false);
assert.equal(context.contextPackPersistence, false);
assert.equal(context.attachmentIngestion, false);
assert.equal(context.mentionResolution, false);
assert.equal(context.conversationHistory, false);
assert.equal(context.aiExecution, false);
assert.equal(context.execution, false);
assert.equal(context.persistence, false);

assert.equal(context.root.id, 'ctx-root');
assert.deepEqual(context.root.supportingRequirementIds, [
  'req-0001', 'req-0005', 'req-0006', 'req-0007', 'req-0008',
]);
assert.deepEqual(context.root.supportingItems.map((item) => item.kind), [
  'goal', 'constraint', 'acceptance', 'context', 'non-goal',
]);
assert.equal(context.root.supportingItems[0]?.statement, 'Ship deterministic hierarchical context.');

assert.deepEqual(context.tasks.map((task) => task.taskId), ['task-0001', 'task-0002', 'task-0003']);
assert.deepEqual(context.tasks.map((task) => task.requirementId), ['req-0002', 'req-0003', 'req-0004']);
assert.deepEqual(context.tasks.map((task) => task.id), ['ctx-task-0001', 'ctx-task-0002', 'ctx-task-0003']);
assert.deepEqual(context.tasks.map((task) => task.level), [0, 1, 2]);
assert.deepEqual(context.tasks[0]?.directDependencies, []);
assert.deepEqual(context.tasks[1]?.directDependencies, ['task-0001']);
assert.deepEqual(context.tasks[2]?.directDependencies, ['task-0002']);
assert.deepEqual(context.tasks[0]?.dependencyClosure, []);
assert.deepEqual(context.tasks[1]?.dependencyClosure, ['task-0001']);
assert.deepEqual(context.tasks[2]?.dependencyClosure, ['task-0001', 'task-0002']);
assert.deepEqual(context.levels.map((level) => level.depth), [0, 1, 2]);
assert.deepEqual(context.levels.map((level) => level.taskContextIds), [
  ['ctx-task-0001'], ['ctx-task-0002'], ['ctx-task-0003'],
]);
assert.deepEqual(context.taskContextOrder, ['ctx-task-0001', 'ctx-task-0002', 'ctx-task-0003']);

assert.equal(Object.isFrozen(context), true);
assert.equal(Object.isFrozen(context.root), true);
assert.equal(Object.isFrozen(context.root.supportingItems), true);
assert.equal(context.root.supportingItems.every((item) => Object.isFrozen(item)), true);
assert.equal(Object.isFrozen(context.levels), true);
assert.equal(context.levels.every((level) => Object.isFrozen(level) && Object.isFrozen(level.taskContextIds)), true);
assert.equal(Object.isFrozen(context.tasks), true);
assert.equal(context.tasks.every((task) => Object.isFrozen(task)
  && Object.isFrozen(task.directDependencies)
  && Object.isFrozen(task.dependencyClosure)), true);
assert.equal(Object.isFrozen(context.sourceDigest), true);

const same = buildHierarchicalContext({ spec, graph });
assert.deepEqual(same, context);

assert.throws(
  () => buildHierarchicalContext({ spec, graph, extra: true } as unknown as { spec: typeof spec; graph: typeof graph }),
  /only spec and graph fields/i,
);

const digestMismatchSpec = {
  ...spec,
  sourceDigest: { ...spec.sourceDigest, hex: '0'.repeat(64) },
};
assert.throws(
  () => buildHierarchicalContext({ spec: digestMismatchSpec as typeof spec, graph }),
  /source digests do not match/i,
);

const statementDriftGraph = {
  ...graph,
  nodes: graph.nodes.map((node, index) => index === 0 ? { ...node, statement: `${node.statement}!` } : node),
};
assert.throws(
  () => buildHierarchicalContext({ spec, graph: statementDriftGraph as typeof graph }),
  /not bound to its source requirement/i,
);

const badOrderGraph = {
  ...graph,
  topologicalOrder: [...graph.topologicalOrder].reverse(),
};
assert.throws(
  () => buildHierarchicalContext({ spec, graph: badOrderGraph as typeof graph }),
  /topological order violates a dependency/i,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build41-hierarchical-context-runtime/1',
  deterministic: true,
  hierarchyDepth: context.levels.length,
  taskContexts: context.tasks.length,
  supportingItems: context.root.supportingItems.length,
  digestBound: true,
  dependencyClosure: true,
  immutable: true,
  downstreamAuthoritiesDeferred: true,
}, null, 2));
