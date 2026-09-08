import assert from 'node:assert/strict';
import { compileRequirements, createPromptIntakeRecord } from '../packages/plan/src/index.js';
import {
  TASK_GRAPH_SCHEMA,
  compileTaskGraph,
} from '../packages/plan/src/task-graph.js';

const spec = compileRequirements({
  intake: createPromptIntakeRecord({
    text: [
      '# Requirements',
      '- Create the foundation.',
      '- Add the second layer. [depends: req-0001]',
      '# Constraints',
      '- Remain offline.',
      '# Acceptance',
      '- The graph is deterministic.',
    ].join('\n'),
  }),
});

const graph = compileTaskGraph({ spec });
assert.equal(graph.schema, TASK_GRAPH_SCHEMA);
assert.equal(graph.sourceSchema, 'gd-requirement-spec/1');
assert.equal(graph.sourceDigest.hex, spec.sourceDigest.hex);
assert.equal(graph.nodes.length, 2);
assert.equal(graph.edges.length, 1);
assert.equal(graph.nodes[0]!.id, 'task-0001');
assert.equal(graph.nodes[0]!.requirementId, 'req-0001');
assert.deepEqual(graph.nodes[0]!.dependsOn, []);
assert.equal(graph.nodes[1]!.id, 'task-0002');
assert.equal(graph.nodes[1]!.requirementId, 'req-0002');
assert.deepEqual(graph.nodes[1]!.dependsOn, ['task-0001']);
assert.deepEqual(graph.edges[0], {
  id: 'edge-0001',
  ordinal: 1,
  from: 'task-0001',
  to: 'task-0002',
  declaredByRequirementId: 'req-0002',
});
assert.deepEqual(graph.topologicalOrder, ['task-0001', 'task-0002']);
assert.deepEqual(graph.supportingRequirementIds, ['req-0003', 'req-0004']);
assert.equal(graph.requirementCompilation, true);
assert.equal(graph.taskGraphCompilation, true);
assert.equal(graph.explicitDependenciesOnly, true);
assert.equal(graph.dependencyInference, false);
assert.equal(graph.dagValidated, true);
assert.equal(graph.execution, false);
assert.equal(graph.scheduling, false);
assert.equal(graph.contextCompilation, false);
assert.equal(graph.contextContinuation, false);
assert.equal(graph.tokenAbstraction, false);
assert.equal(graph.aiExecution, false);
assert.equal(graph.persistence, false);
assert.equal(Object.isFrozen(graph), true);
assert.equal(Object.isFrozen(graph.nodes), true);
assert.equal(Object.isFrozen(graph.nodes[0]), true);
assert.equal(Object.isFrozen(graph.nodes[1]!.dependsOn), true);
assert.equal(Object.isFrozen(graph.edges), true);
assert.equal(Object.isFrozen(graph.topologicalOrder), true);
assert.equal(Object.isFrozen(graph.supportingRequirementIds), true);
assert.deepEqual(compileTaskGraph({ spec }), graph);

const independent = compileTaskGraph({
  spec: compileRequirements({
    intake: createPromptIntakeRecord({ text: '- First\n- Second\n- Third' }),
  }),
});
assert.equal(independent.nodes.length, 3);
assert.equal(independent.edges.length, 0);
assert.deepEqual(independent.topologicalOrder, ['task-0001', 'task-0002', 'task-0003']);

const cycleSpec = compileRequirements({
  intake: createPromptIntakeRecord({
    text: '- First [depends: req-0002]\n- Second [depends: req-0001]',
  }),
});
assert.throws(() => compileTaskGraph({ spec: cycleSpec }), /dependency cycle/i);

const unknownSpec = compileRequirements({
  intake: createPromptIntakeRecord({ text: '- First [depends: req-9999]' }),
});
assert.throws(() => compileTaskGraph({ spec: unknownSpec }), /unknown dependency req-9999/i);

const selfSpec = compileRequirements({
  intake: createPromptIntakeRecord({ text: '- First [depends: req-0001]' }),
});
assert.throws(() => compileTaskGraph({ spec: selfSpec }), /cannot depend on itself/i);

const supportingDependency = compileRequirements({
  intake: createPromptIntakeRecord({
    text: [
      '# Requirements',
      '- First',
      '# Constraints',
      '- Offline only',
      '# Requirements',
      '- Second [depends: req-0002]',
    ].join('\n'),
  }),
});
assert.throws(() => compileTaskGraph({ spec: supportingDependency }), /does not produce a task node/i);

const malformed = compileRequirements({
  intake: createPromptIntakeRecord({ text: '- First [depends req-0001]' }),
});
assert.throws(() => compileTaskGraph({ spec: malformed }), /malformed/i);

assert.throws(
  () => compileTaskGraph({ spec, extra: true } as unknown as { spec: typeof spec }),
  /only the spec field/i,
);
assert.throws(
  () => compileTaskGraph({ spec: { ...spec, taskGraphCompilation: true } as unknown as typeof spec }),
  /taskGraphCompilation boundary is invalid/i,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build40-task-graph-runtime/1',
  deterministic: true,
  explicitDependenciesOnly: true,
  cycleRejection: true,
  unknownDependencyRejection: true,
  nonTaskDependencyRejection: true,
  malformedDependencyRejection: true,
  immutable: true,
}, null, 2));
