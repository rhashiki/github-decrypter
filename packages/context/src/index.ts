import type {
  PromptIntakeDigest,
  RequirementItem,
  RequirementKind,
  RequirementSpec,
} from '@github-decrypter/plan';
import type {
  TaskGraph,
  TaskGraphEdge,
  TaskGraphNode,
} from '@github-decrypter/plan/task-graph';

export const packageIdentity = '@github-decrypter/context' as const;
export const HIERARCHICAL_CONTEXT_BUILD = 41 as const;
export const HIERARCHICAL_CONTEXT_SCHEMA = 'gd-hierarchical-context/1' as const;
export const HIERARCHICAL_CONTEXT_SPEC_SCHEMA = 'gd-requirement-spec/1' as const;
export const HIERARCHICAL_CONTEXT_GRAPH_SCHEMA = 'gd-task-graph/1' as const;
export const HIERARCHICAL_CONTEXT_MAX_TASKS = 4096 as const;
export const HIERARCHICAL_CONTEXT_MAX_LEVELS = 4096 as const;
export const HIERARCHICAL_CONTEXT_GLOBAL_KINDS = [
  'goal',
  'constraint',
  'acceptance',
  'non-goal',
  'context',
] as const;

export type HierarchicalContextGlobalKind = (typeof HIERARCHICAL_CONTEXT_GLOBAL_KINDS)[number];

export interface HierarchicalContextInput {
  readonly spec: RequirementSpec;
  readonly graph: TaskGraph;
}

export interface HierarchicalContextSupportingItem {
  readonly requirementId: string;
  readonly ordinal: number;
  readonly kind: HierarchicalContextGlobalKind;
  readonly statement: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface HierarchicalTaskContext {
  readonly id: string;
  readonly ordinal: number;
  readonly taskId: string;
  readonly requirementId: string;
  readonly level: number;
  readonly statement: string;
  readonly sourceStartLine: number;
  readonly sourceEndLine: number;
  readonly directDependencies: readonly string[];
  readonly dependencyClosure: readonly string[];
}

export interface HierarchicalContextLevel {
  readonly id: string;
  readonly depth: number;
  readonly taskContextIds: readonly string[];
}

export interface HierarchicalContextRoot {
  readonly id: 'ctx-root';
  readonly supportingItems: readonly HierarchicalContextSupportingItem[];
  readonly supportingRequirementIds: readonly string[];
}

export interface HierarchicalContext {
  readonly schema: typeof HIERARCHICAL_CONTEXT_SCHEMA;
  readonly sourceSpecSchema: typeof HIERARCHICAL_CONTEXT_SPEC_SCHEMA;
  readonly sourceGraphSchema: typeof HIERARCHICAL_CONTEXT_GRAPH_SCHEMA;
  readonly sourceDigest: PromptIntakeDigest;
  readonly root: HierarchicalContextRoot;
  readonly levels: readonly HierarchicalContextLevel[];
  readonly tasks: readonly HierarchicalTaskContext[];
  readonly taskContextOrder: readonly string[];
  readonly requirementCompilation: true;
  readonly taskGraphCompilation: true;
  readonly contextCompilation: true;
  readonly hierarchical: true;
  readonly deterministic: true;
  readonly dependencyAware: true;
  readonly semanticExpansion: false;
  readonly contextContinuation: false;
  readonly tokenAbstraction: false;
  readonly projectMemory: false;
  readonly contextPackPersistence: false;
  readonly attachmentIngestion: false;
  readonly mentionResolution: false;
  readonly conversationHistory: false;
  readonly aiExecution: false;
  readonly execution: false;
  readonly persistence: false;
}

const REQUIREMENT_KINDS = new Set<RequirementKind>([
  'goal',
  'requirement',
  'constraint',
  'acceptance',
  'non-goal',
  'context',
]);
const GLOBAL_KINDS = new Set<HierarchicalContextGlobalKind>(HIERARCHICAL_CONTEXT_GLOBAL_KINDS);

function assertDigest(value: unknown, label: string): asserts value is PromptIntakeDigest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} digest must be an object.`);
  }
  const row = value as Record<string, unknown>;
  if (row.algorithm !== 'sha256' || typeof row.hex !== 'string' || !/^[0-9a-f]{64}$/.test(row.hex)) {
    throw new TypeError(`${label} digest is invalid.`);
  }
}

function assertRequirementItem(item: unknown, index: number): asserts item is RequirementItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError(`Hierarchical Context source item ${index + 1} must be an object.`);
  }
  const row = item as Record<string, unknown>;
  const ordinal = index + 1;
  const expectedId = `req-${String(ordinal).padStart(4, '0')}`;
  if (row.id !== expectedId || row.ordinal !== ordinal) {
    throw new TypeError(`Hierarchical Context source item ${index + 1} has a non-canonical identity.`);
  }
  if (typeof row.kind !== 'string' || !REQUIREMENT_KINDS.has(row.kind as RequirementKind)) {
    throw new TypeError(`Hierarchical Context source item ${expectedId} has an invalid kind.`);
  }
  if (typeof row.statement !== 'string' || row.statement.trim().length === 0) {
    throw new TypeError(`Hierarchical Context source item ${expectedId} has an empty statement.`);
  }
  if (!Number.isInteger(row.startLine) || !Number.isInteger(row.endLine)
      || (row.startLine as number) < 1 || (row.endLine as number) < (row.startLine as number)) {
    throw new TypeError(`Hierarchical Context source item ${expectedId} has an invalid source range.`);
  }
}

function assertRequirementSpec(value: unknown): asserts value is RequirementSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Hierarchical Context spec must be a RequirementSpec.');
  }
  const row = value as Record<string, unknown>;
  if (row.schema !== HIERARCHICAL_CONTEXT_SPEC_SCHEMA || row.sourceSchema !== 'gd-prompt-intake/1') {
    throw new TypeError('Hierarchical Context requires canonical Requirement Compiler output.');
  }
  assertDigest(row.sourceDigest, 'Requirement Spec');
  if (!Array.isArray(row.items) || row.items.length > HIERARCHICAL_CONTEXT_MAX_TASKS) {
    throw new RangeError(`Hierarchical Context accepts at most ${HIERARCHICAL_CONTEXT_MAX_TASKS} requirement items.`);
  }
  row.items.forEach((item, index) => assertRequirementItem(item, index));
  if (!row.counts || typeof row.counts !== 'object' || Array.isArray(row.counts)) {
    throw new TypeError('Hierarchical Context source counts are invalid.');
  }
  const counts = row.counts as Record<string, unknown>;
  const expectedCounts: Record<RequirementKind, number> = {
    goal: 0,
    requirement: 0,
    constraint: 0,
    acceptance: 0,
    'non-goal': 0,
    context: 0,
  };
  for (const item of row.items as RequirementItem[]) expectedCounts[item.kind] += 1;
  if (counts.total !== row.items.length) throw new TypeError('Hierarchical Context source total count is invalid.');
  for (const [kind, count] of Object.entries(expectedCounts)) {
    if (counts[kind] !== count) throw new TypeError(`Hierarchical Context source ${kind} count is invalid.`);
  }
  const flags: Readonly<Record<string, boolean>> = {
    requirementCompilation: true,
    syntaxDirected: true,
    deterministic: true,
    semanticInterpretation: false,
    taskGraphCompilation: false,
    contextCompilation: false,
    contextContinuation: false,
    tokenAbstraction: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    persistence: false,
  };
  for (const [field, expected] of Object.entries(flags)) {
    if (row[field] !== expected) throw new TypeError(`Hierarchical Context spec ${field} boundary is invalid.`);
  }
}

function assertTaskGraphNode(value: unknown, index: number, spec: RequirementSpec): asserts value is TaskGraphNode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Hierarchical Context graph node ${index + 1} must be an object.`);
  }
  const row = value as Record<string, unknown>;
  const expectedTaskId = `task-${String(index + 1).padStart(4, '0')}`;
  if (row.id !== expectedTaskId || row.ordinal !== index + 1 || row.sourceKind !== 'requirement') {
    throw new TypeError(`Hierarchical Context graph node ${index + 1} has a non-canonical identity.`);
  }
  const requirements = spec.items.filter((item) => item.kind === 'requirement');
  const requirement = requirements[index];
  if (!requirement || row.requirementId !== requirement.id || row.statement !== requirement.statement
      || row.sourceStartLine !== requirement.startLine || row.sourceEndLine !== requirement.endLine) {
    throw new TypeError(`Hierarchical Context graph node ${expectedTaskId} is not bound to its source requirement.`);
  }
  if (!Array.isArray(row.dependsOn) || row.dependsOn.some((id) => typeof id !== 'string')) {
    throw new TypeError(`Hierarchical Context graph node ${expectedTaskId} dependencies are invalid.`);
  }
}

function assertTaskGraphEdge(value: unknown, index: number, nodes: readonly TaskGraphNode[]): asserts value is TaskGraphEdge {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Hierarchical Context graph edge ${index + 1} must be an object.`);
  }
  const row = value as Record<string, unknown>;
  const expectedEdgeId = `edge-${String(index + 1).padStart(4, '0')}`;
  if (row.id !== expectedEdgeId || row.ordinal !== index + 1 || typeof row.from !== 'string' || typeof row.to !== 'string') {
    throw new TypeError(`Hierarchical Context graph edge ${index + 1} has a non-canonical identity.`);
  }
  const from = nodes.find((node) => node.id === row.from);
  const to = nodes.find((node) => node.id === row.to);
  if (!from || !to || row.declaredByRequirementId !== to.requirementId || !to.dependsOn.includes(from.id)) {
    throw new TypeError(`Hierarchical Context graph edge ${expectedEdgeId} is inconsistent with task dependencies.`);
  }
}

function assertTaskGraph(value: unknown, spec: RequirementSpec): asserts value is TaskGraph {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Hierarchical Context graph must be a TaskGraph.');
  }
  const row = value as Record<string, unknown>;
  if (row.schema !== HIERARCHICAL_CONTEXT_GRAPH_SCHEMA || row.sourceSchema !== HIERARCHICAL_CONTEXT_SPEC_SCHEMA) {
    throw new TypeError('Hierarchical Context requires canonical Task Graph Compiler output.');
  }
  assertDigest(row.sourceDigest, 'Task Graph');
  if ((row.sourceDigest as PromptIntakeDigest).hex !== spec.sourceDigest.hex) {
    throw new TypeError('Hierarchical Context spec and graph source digests do not match.');
  }
  if (!Array.isArray(row.nodes) || row.nodes.length > HIERARCHICAL_CONTEXT_MAX_TASKS) {
    throw new RangeError(`Hierarchical Context accepts at most ${HIERARCHICAL_CONTEXT_MAX_TASKS} task nodes.`);
  }
  row.nodes.forEach((node, index) => assertTaskGraphNode(node, index, spec));
  const nodes = row.nodes as TaskGraphNode[];
  if (!Array.isArray(row.edges)) throw new TypeError('Hierarchical Context graph edges are invalid.');
  row.edges.forEach((edge, index) => assertTaskGraphEdge(edge, index, nodes));

  const edgePairs = new Set((row.edges as TaskGraphEdge[]).map((edge) => `${edge.from}>${edge.to}`));
  for (const node of nodes) {
    for (const dependency of node.dependsOn) {
      if (!nodes.some((candidate) => candidate.id === dependency) || !edgePairs.has(`${dependency}>${node.id}`)) {
        throw new TypeError(`Hierarchical Context graph dependency ${dependency}>${node.id} is missing its canonical edge.`);
      }
    }
  }

  if (!Array.isArray(row.topologicalOrder) || row.topologicalOrder.length !== nodes.length) {
    throw new TypeError('Hierarchical Context graph topological order is invalid.');
  }
  const order = row.topologicalOrder as string[];
  if (new Set(order).size !== nodes.length || order.some((id) => !nodes.some((node) => node.id === id))) {
    throw new TypeError('Hierarchical Context graph topological order is not a canonical permutation.');
  }
  const position = new Map(order.map((id, index) => [id, index] as const));
  for (const node of nodes) {
    for (const dependency of node.dependsOn) {
      if ((position.get(dependency) ?? Number.MAX_SAFE_INTEGER) >= (position.get(node.id) ?? -1)) {
        throw new TypeError('Hierarchical Context graph topological order violates a dependency.');
      }
    }
  }

  const expectedSupporting = spec.items.filter((item) => item.kind !== 'requirement').map((item) => item.id);
  if (!Array.isArray(row.supportingRequirementIds)
      || JSON.stringify(row.supportingRequirementIds) !== JSON.stringify(expectedSupporting)) {
    throw new TypeError('Hierarchical Context graph supporting requirement identities are invalid.');
  }

  const flags: Readonly<Record<string, boolean>> = {
    requirementCompilation: true,
    taskGraphCompilation: true,
    deterministic: true,
    syntaxDirected: true,
    explicitDependenciesOnly: true,
    dependencyInference: false,
    dagValidated: true,
    execution: false,
    scheduling: false,
    contextCompilation: false,
    contextContinuation: false,
    tokenAbstraction: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    persistence: false,
  };
  for (const [field, expected] of Object.entries(flags)) {
    if (row[field] !== expected) throw new TypeError(`Hierarchical Context graph ${field} boundary is invalid.`);
  }
}

function asHierarchicalContextInput(value: unknown): HierarchicalContextInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Hierarchical Context input must be an object.');
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (keys.length !== 2 || keys[0] !== 'graph' || keys[1] !== 'spec') {
    throw new TypeError('Hierarchical Context input accepts only spec and graph fields.');
  }
  assertRequirementSpec(row.spec);
  assertTaskGraph(row.graph, row.spec);
  return { spec: row.spec, graph: row.graph };
}

function dependencyClosureFor(
  node: TaskGraphNode,
  byId: ReadonlyMap<string, TaskGraphNode>,
  topologicalPosition: ReadonlyMap<string, number>,
  memo: Map<string, readonly string[]>,
): readonly string[] {
  const cached = memo.get(node.id);
  if (cached) return cached;
  const collected = new Set<string>();
  for (const dependencyId of node.dependsOn) {
    const dependency = byId.get(dependencyId)!;
    for (const ancestor of dependencyClosureFor(dependency, byId, topologicalPosition, memo)) collected.add(ancestor);
    collected.add(dependencyId);
  }
  const ordered = [...collected].sort(
    (left, right) => (topologicalPosition.get(left) ?? 0) - (topologicalPosition.get(right) ?? 0),
  );
  const frozen = Object.freeze(ordered);
  memo.set(node.id, frozen);
  return frozen;
}

export function buildHierarchicalContext(input: HierarchicalContextInput): HierarchicalContext {
  const { spec, graph } = asHierarchicalContextInput(input);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const topologicalPosition = new Map(graph.topologicalOrder.map((id, index) => [id, index] as const));
  const closureMemo = new Map<string, readonly string[]>();
  const levelByTaskId = new Map<string, number>();
  const tasksMutable: HierarchicalTaskContext[] = [];

  for (const taskId of graph.topologicalOrder) {
    const node = nodeById.get(taskId)!;
    const dependencyLevels = node.dependsOn.map((dependencyId) => levelByTaskId.get(dependencyId) ?? 0);
    const level = dependencyLevels.length === 0 ? 0 : Math.max(...dependencyLevels) + 1;
    if (level >= HIERARCHICAL_CONTEXT_MAX_LEVELS) {
      throw new RangeError(`Hierarchical Context exceeds ${HIERARCHICAL_CONTEXT_MAX_LEVELS} hierarchy levels.`);
    }
    levelByTaskId.set(taskId, level);
    tasksMutable.push(Object.freeze({
      id: `ctx-${node.id}`,
      ordinal: tasksMutable.length + 1,
      taskId: node.id,
      requirementId: node.requirementId,
      level,
      statement: node.statement,
      sourceStartLine: node.sourceStartLine,
      sourceEndLine: node.sourceEndLine,
      directDependencies: Object.freeze([...node.dependsOn]),
      dependencyClosure: dependencyClosureFor(node, nodeById, topologicalPosition, closureMemo),
    }));
  }

  const maxLevel = tasksMutable.reduce((maximum, task) => Math.max(maximum, task.level), -1);
  const levelsMutable: HierarchicalContextLevel[] = [];
  for (let depth = 0; depth <= maxLevel; depth += 1) {
    const taskContextIds = tasksMutable.filter((task) => task.level === depth).map((task) => task.id);
    levelsMutable.push(Object.freeze({
      id: `ctx-level-${String(depth).padStart(4, '0')}`,
      depth,
      taskContextIds: Object.freeze(taskContextIds),
    }));
  }

  const supportingItems = spec.items
    .filter((item): item is RequirementItem & { kind: HierarchicalContextGlobalKind } => GLOBAL_KINDS.has(item.kind as HierarchicalContextGlobalKind))
    .map((item) => Object.freeze({
      requirementId: item.id,
      ordinal: item.ordinal,
      kind: item.kind,
      statement: item.statement,
      startLine: item.startLine,
      endLine: item.endLine,
    }));
  const root: HierarchicalContextRoot = Object.freeze({
    id: 'ctx-root',
    supportingItems: Object.freeze(supportingItems),
    supportingRequirementIds: Object.freeze(supportingItems.map((item) => item.requirementId)),
  });
  const sourceDigest: PromptIntakeDigest = Object.freeze({
    algorithm: spec.sourceDigest.algorithm,
    hex: spec.sourceDigest.hex,
  });
  const tasks = Object.freeze(tasksMutable);

  return Object.freeze({
    schema: HIERARCHICAL_CONTEXT_SCHEMA,
    sourceSpecSchema: HIERARCHICAL_CONTEXT_SPEC_SCHEMA,
    sourceGraphSchema: HIERARCHICAL_CONTEXT_GRAPH_SCHEMA,
    sourceDigest,
    root,
    levels: Object.freeze(levelsMutable),
    tasks,
    taskContextOrder: Object.freeze(tasks.map((task) => task.id)),
    requirementCompilation: true,
    taskGraphCompilation: true,
    contextCompilation: true,
    hierarchical: true,
    deterministic: true,
    dependencyAware: true,
    semanticExpansion: false,
    contextContinuation: false,
    tokenAbstraction: false,
    projectMemory: false,
    contextPackPersistence: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    execution: false,
    persistence: false,
  });
}
