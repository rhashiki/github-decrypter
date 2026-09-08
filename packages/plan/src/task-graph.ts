import type {
  PromptIntakeDigest,
  RequirementItem,
  RequirementKind,
  RequirementSpec,
} from './index.js';

export const TASK_GRAPH_COMPILER_BUILD = 40 as const;
export const TASK_GRAPH_SCHEMA = 'gd-task-graph/1' as const;
export const TASK_GRAPH_SOURCE_SCHEMA = 'gd-requirement-spec/1' as const;
export const TASK_GRAPH_MAX_NODES = 4096 as const;
export const TASK_GRAPH_MAX_EDGES = 16384 as const;
export const TASK_GRAPH_TASK_KINDS = ['requirement'] as const;

export type TaskGraphTaskKind = (typeof TASK_GRAPH_TASK_KINDS)[number];

export interface TaskGraphCompilerInput {
  readonly spec: RequirementSpec;
}

export interface TaskGraphNode {
  readonly id: string;
  readonly ordinal: number;
  readonly requirementId: string;
  readonly sourceKind: TaskGraphTaskKind;
  readonly statement: string;
  readonly sourceStartLine: number;
  readonly sourceEndLine: number;
  readonly dependsOn: readonly string[];
}

export interface TaskGraphEdge {
  readonly id: string;
  readonly ordinal: number;
  readonly from: string;
  readonly to: string;
  readonly declaredByRequirementId: string;
}

export interface TaskGraph {
  readonly schema: typeof TASK_GRAPH_SCHEMA;
  readonly sourceSchema: typeof TASK_GRAPH_SOURCE_SCHEMA;
  readonly sourceDigest: PromptIntakeDigest;
  readonly nodes: readonly TaskGraphNode[];
  readonly edges: readonly TaskGraphEdge[];
  readonly topologicalOrder: readonly string[];
  readonly supportingRequirementIds: readonly string[];
  readonly requirementCompilation: true;
  readonly taskGraphCompilation: true;
  readonly deterministic: true;
  readonly syntaxDirected: true;
  readonly explicitDependenciesOnly: true;
  readonly dependencyInference: false;
  readonly dagValidated: true;
  readonly execution: false;
  readonly scheduling: false;
  readonly contextCompilation: false;
  readonly contextContinuation: false;
  readonly tokenAbstraction: false;
  readonly attachmentIngestion: false;
  readonly mentionResolution: false;
  readonly conversationHistory: false;
  readonly aiExecution: false;
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

function assertRequirementItem(item: unknown, index: number): asserts item is RequirementItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError(`Task Graph source item ${index + 1} must be an object.`);
  }
  const row = item as Record<string, unknown>;
  const ordinal = index + 1;
  const expectedId = `req-${String(ordinal).padStart(4, '0')}`;
  if (row.id !== expectedId || row.ordinal !== ordinal) {
    throw new TypeError(`Task Graph source item ${index + 1} has a non-canonical identity.`);
  }
  if (typeof row.kind !== 'string' || !REQUIREMENT_KINDS.has(row.kind as RequirementKind)) {
    throw new TypeError(`Task Graph source item ${expectedId} has an invalid kind.`);
  }
  if (typeof row.statement !== 'string' || row.statement.trim().length === 0) {
    throw new TypeError(`Task Graph source item ${expectedId} has an empty statement.`);
  }
  if (!Number.isInteger(row.startLine) || !Number.isInteger(row.endLine)
      || (row.startLine as number) < 1 || (row.endLine as number) < (row.startLine as number)) {
    throw new TypeError(`Task Graph source item ${expectedId} has an invalid source range.`);
  }
}

function assertRequirementSpec(value: unknown): asserts value is RequirementSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Task Graph Compiler spec must be a RequirementSpec.');
  }
  const row = value as Record<string, unknown>;
  const digest = row.sourceDigest as Record<string, unknown> | undefined;
  if (row.schema !== TASK_GRAPH_SOURCE_SCHEMA || row.sourceSchema !== 'gd-prompt-intake/1') {
    throw new TypeError('Task Graph Compiler requires canonical Requirement Compiler output.');
  }
  if (!digest || digest.algorithm !== 'sha256' || typeof digest.hex !== 'string' || !/^[0-9a-f]{64}$/.test(digest.hex)) {
    throw new TypeError('Task Graph Compiler source digest is invalid.');
  }
  if (!Number.isInteger(row.sourceCharacterCount) || (row.sourceCharacterCount as number) < 1
      || !Number.isInteger(row.sourceLineCount) || (row.sourceLineCount as number) < 1) {
    throw new TypeError('Task Graph Compiler source structural metadata is invalid.');
  }
  if (!Array.isArray(row.items) || row.items.length > TASK_GRAPH_MAX_NODES) {
    throw new RangeError(`Task Graph Compiler accepts at most ${TASK_GRAPH_MAX_NODES} requirement items.`);
  }
  row.items.forEach((item, index) => assertRequirementItem(item, index));

  if (!row.counts || typeof row.counts !== 'object' || Array.isArray(row.counts)) {
    throw new TypeError('Task Graph Compiler source counts are invalid.');
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
  if (counts.total !== row.items.length) throw new TypeError('Task Graph Compiler source total count is invalid.');
  for (const [kind, count] of Object.entries(expectedCounts)) {
    if (counts[kind] !== count) throw new TypeError(`Task Graph Compiler source ${kind} count is invalid.`);
  }

  const requiredFlags: Readonly<Record<string, boolean>> = {
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
  for (const [field, expected] of Object.entries(requiredFlags)) {
    if (row[field] !== expected) throw new TypeError(`Task Graph Compiler source ${field} boundary is invalid.`);
  }
}

function asTaskGraphCompilerInput(value: unknown): TaskGraphCompilerInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Task Graph Compiler input must be an object.');
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 1 || keys[0] !== 'spec') {
    throw new TypeError('Task Graph Compiler input accepts only the spec field.');
  }
  assertRequirementSpec(row.spec);
  return { spec: row.spec };
}

function declaredRequirementDependencies(statement: string): readonly string[] {
  const marker = /\[depends\s*:\s*([^\]]*)\]/gi;
  const dependencies: string[] = [];
  let match: RegExpExecArray | null;
  let markerCount = 0;
  while ((match = marker.exec(statement)) !== null) {
    markerCount += 1;
    const body = match[1]!.trim();
    if (!body) throw new TypeError('Task dependency annotation must list at least one requirement id.');
    for (const token of body.split(',')) {
      const id = token.trim();
      if (!/^req-\d{4}$/.test(id)) {
        throw new TypeError(`Task dependency annotation contains invalid requirement id: ${id || '<empty>'}.`);
      }
      if (!dependencies.includes(id)) dependencies.push(id);
    }
  }
  if (/\[depends\b/i.test(statement) && markerCount === 0) {
    throw new TypeError('Task dependency annotation is malformed.');
  }
  return Object.freeze(dependencies);
}

function topologicalOrder(nodes: readonly TaskGraphNode[], edges: readonly TaskGraphEdge[]): readonly string[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const indegree = new Map(nodes.map((node) => [node.id, 0] as const));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]] as const));

  for (const edge of edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }
  for (const targets of outgoing.values()) {
    targets.sort((left, right) => nodeById.get(left)!.ordinal - nodeById.get(right)!.ordinal);
  }

  const ready = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  ready.sort((left, right) => nodeById.get(left)!.ordinal - nodeById.get(right)!.ordinal);
  const ordered: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift()!;
    ordered.push(current);
    for (const target of outgoing.get(current)!) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        ready.push(target);
        ready.sort((left, right) => nodeById.get(left)!.ordinal - nodeById.get(right)!.ordinal);
      }
    }
  }

  if (ordered.length !== nodes.length) throw new TypeError('Task Graph contains a dependency cycle.');
  return Object.freeze(ordered);
}

export function compileTaskGraph(input: TaskGraphCompilerInput): TaskGraph {
  const { spec } = asTaskGraphCompilerInput(input);
  const taskItems = spec.items.filter((item) => item.kind === 'requirement');
  const supportingRequirementIds = spec.items.filter((item) => item.kind !== 'requirement').map((item) => item.id);
  const taskIdByRequirementId = new Map<string, string>();

  taskItems.forEach((item, index) => {
    taskIdByRequirementId.set(item.id, `task-${String(index + 1).padStart(4, '0')}`);
  });

  const pendingNodes = taskItems.map((item, index) => {
    const dependencies = declaredRequirementDependencies(item.statement);
    const dependsOn: string[] = [];
    for (const requirementId of dependencies) {
      if (requirementId === item.id) throw new TypeError(`Task ${item.id} cannot depend on itself.`);
      const target = spec.items.find((candidate) => candidate.id === requirementId);
      if (!target) throw new TypeError(`Task ${item.id} references unknown dependency ${requirementId}.`);
      if (target.kind !== 'requirement') {
        throw new TypeError(`Task ${item.id} dependency ${requirementId} does not produce a task node.`);
      }
      const taskId = taskIdByRequirementId.get(requirementId)!;
      if (!dependsOn.includes(taskId)) dependsOn.push(taskId);
    }
    return {
      id: `task-${String(index + 1).padStart(4, '0')}`,
      ordinal: index + 1,
      requirementId: item.id,
      sourceKind: 'requirement' as const,
      statement: item.statement,
      sourceStartLine: item.startLine,
      sourceEndLine: item.endLine,
      dependsOn,
    };
  });

  const edgesMutable: TaskGraphEdge[] = [];
  for (const node of pendingNodes) {
    for (const dependencyTaskId of node.dependsOn) {
      if (edgesMutable.length >= TASK_GRAPH_MAX_EDGES) {
        throw new RangeError(`Task Graph Compiler exceeds ${TASK_GRAPH_MAX_EDGES} dependency edges.`);
      }
      const ordinal = edgesMutable.length + 1;
      edgesMutable.push(Object.freeze({
        id: `edge-${String(ordinal).padStart(4, '0')}`,
        ordinal,
        from: dependencyTaskId,
        to: node.id,
        declaredByRequirementId: node.requirementId,
      }));
    }
  }

  const nodes = Object.freeze(pendingNodes.map((node) => Object.freeze({
    ...node,
    dependsOn: Object.freeze([...node.dependsOn]),
  })));
  const edges = Object.freeze(edgesMutable);
  const order = topologicalOrder(nodes, edges);
  const sourceDigest: PromptIntakeDigest = Object.freeze({
    algorithm: spec.sourceDigest.algorithm,
    hex: spec.sourceDigest.hex,
  });

  return Object.freeze({
    schema: TASK_GRAPH_SCHEMA,
    sourceSchema: TASK_GRAPH_SOURCE_SCHEMA,
    sourceDigest,
    nodes,
    edges,
    topologicalOrder: order,
    supportingRequirementIds: Object.freeze(supportingRequirementIds),
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
  });
}
