import type { PromptIntakeDigest } from '@github-decrypter/plan';
import type {
  HierarchicalContext,
  HierarchicalTaskContext,
} from './index.js';

export const CONTEXT_CONTINUATION_BUILD = 42 as const;
export const CONTEXT_CONTINUATION_SCHEMA = 'gd-context-continuation/1' as const;
export const CONTEXT_CONTINUATION_SOURCE_SCHEMA = 'gd-hierarchical-context/1' as const;
export const CONTEXT_CONTINUATION_ROOT_ID = 'ctx-root' as const;
export const CONTEXT_CONTINUATION_MAX_FRAMES = 4096 as const;
export const CONTEXT_CONTINUATION_MAX_LEVELS = 4096 as const;

export interface ContextContinuationInput {
  readonly context: HierarchicalContext;
}

export interface ContextContinuationFrame {
  readonly id: string;
  readonly ordinal: number;
  readonly taskContextId: string;
  readonly taskId: string;
  readonly requirementId: string;
  readonly level: number;
  readonly previousFrameId: string | null;
  readonly previousTaskContextId: string | null;
  readonly directDependencyContextIds: readonly string[];
  readonly inheritedDependencyContextIds: readonly string[];
  readonly carriedContextIds: readonly string[];
}

export interface ContextContinuationPlan {
  readonly schema: typeof CONTEXT_CONTINUATION_SCHEMA;
  readonly sourceSchema: typeof CONTEXT_CONTINUATION_SOURCE_SCHEMA;
  readonly sourceDigest: PromptIntakeDigest;
  readonly rootContextId: typeof CONTEXT_CONTINUATION_ROOT_ID;
  readonly frames: readonly ContextContinuationFrame[];
  readonly frameOrder: readonly string[];
  readonly requirementCompilation: true;
  readonly taskGraphCompilation: true;
  readonly contextCompilation: true;
  readonly contextContinuation: true;
  readonly deterministic: true;
  readonly sequentialHandoff: true;
  readonly dependencyContextCarry: true;
  readonly semanticExpansion: false;
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

const GLOBAL_KINDS = new Set(['goal', 'constraint', 'acceptance', 'non-goal', 'context']);

function assertDigest(value: unknown): asserts value is PromptIntakeDigest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Context Continuation source digest must be an object.');
  }
  const row = value as Record<string, unknown>;
  if (row.algorithm !== 'sha256' || typeof row.hex !== 'string' || !/^[0-9a-f]{64}$/.test(row.hex)) {
    throw new TypeError('Context Continuation source digest is invalid.');
  }
}

function assertRoot(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Context Continuation root context is invalid.');
  }
  const row = value as Record<string, unknown>;
  if (row.id !== CONTEXT_CONTINUATION_ROOT_ID || !Array.isArray(row.supportingItems)
      || !Array.isArray(row.supportingRequirementIds)) {
    throw new TypeError('Context Continuation requires the canonical hierarchical root context.');
  }

  const ids: string[] = [];
  for (const [index, item] of row.supportingItems.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`Context Continuation supporting item ${index + 1} is invalid.`);
    }
    const support = item as Record<string, unknown>;
    if (typeof support.requirementId !== 'string' || !/^req-\d{4}$/.test(support.requirementId)
        || !Number.isInteger(support.ordinal) || (support.ordinal as number) < 1
        || typeof support.kind !== 'string' || !GLOBAL_KINDS.has(support.kind)
        || typeof support.statement !== 'string' || support.statement.trim().length === 0
        || !Number.isInteger(support.startLine) || !Number.isInteger(support.endLine)
        || (support.startLine as number) < 1 || (support.endLine as number) < (support.startLine as number)) {
      throw new TypeError(`Context Continuation supporting item ${index + 1} is non-canonical.`);
    }
    ids.push(support.requirementId);
  }

  if (JSON.stringify(row.supportingRequirementIds) !== JSON.stringify(ids)) {
    throw new TypeError('Context Continuation supporting requirement identities are invalid.');
  }
}

function assertTaskContext(value: unknown, index: number): asserts value is HierarchicalTaskContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Context Continuation task context ${index + 1} must be an object.`);
  }
  const row = value as Record<string, unknown>;
  if (row.ordinal !== index + 1 || typeof row.taskId !== 'string' || !/^task-\d{4}$/.test(row.taskId)
      || row.id !== `ctx-${row.taskId}` || typeof row.requirementId !== 'string' || !/^req-\d{4}$/.test(row.requirementId)
      || !Number.isInteger(row.level) || (row.level as number) < 0 || (row.level as number) >= CONTEXT_CONTINUATION_MAX_LEVELS
      || typeof row.statement !== 'string' || row.statement.trim().length === 0
      || !Number.isInteger(row.sourceStartLine) || !Number.isInteger(row.sourceEndLine)
      || (row.sourceStartLine as number) < 1 || (row.sourceEndLine as number) < (row.sourceStartLine as number)
      || !Array.isArray(row.directDependencies) || !Array.isArray(row.dependencyClosure)) {
    throw new TypeError(`Context Continuation task context ${index + 1} is non-canonical.`);
  }
  if ((row.directDependencies as unknown[]).some((id) => typeof id !== 'string' || !/^task-\d{4}$/.test(id))) {
    throw new TypeError(`Context Continuation task context ${row.id} direct dependencies are invalid.`);
  }
  if ((row.dependencyClosure as unknown[]).some((id) => typeof id !== 'string' || !/^task-\d{4}$/.test(id))) {
    throw new TypeError(`Context Continuation task context ${row.id} dependency closure is invalid.`);
  }
}

function assertHierarchicalContext(value: unknown): asserts value is HierarchicalContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Context Continuation input context must be a HierarchicalContext.');
  }
  const row = value as Record<string, unknown>;
  if (row.schema !== CONTEXT_CONTINUATION_SOURCE_SCHEMA
      || row.sourceSpecSchema !== 'gd-requirement-spec/1'
      || row.sourceGraphSchema !== 'gd-task-graph/1') {
    throw new TypeError('Context Continuation requires canonical Hierarchical Context output.');
  }
  assertDigest(row.sourceDigest);
  assertRoot(row.root);

  if (!Array.isArray(row.tasks) || row.tasks.length > CONTEXT_CONTINUATION_MAX_FRAMES) {
    throw new RangeError(`Context Continuation accepts at most ${CONTEXT_CONTINUATION_MAX_FRAMES} task contexts.`);
  }
  row.tasks.forEach((task, index) => assertTaskContext(task, index));
  const tasks = row.tasks as HierarchicalTaskContext[];
  const taskById = new Map(tasks.map((task) => [task.taskId, task] as const));
  const position = new Map(tasks.map((task, index) => [task.taskId, index] as const));

  if (!Array.isArray(row.taskContextOrder)
      || JSON.stringify(row.taskContextOrder) !== JSON.stringify(tasks.map((task) => task.id))) {
    throw new TypeError('Context Continuation task context order is invalid.');
  }

  for (const task of tasks) {
    const direct = task.directDependencies;
    const closure = task.dependencyClosure;
    if (new Set(direct).size !== direct.length || new Set(closure).size !== closure.length) {
      throw new TypeError(`Context Continuation task context ${task.id} contains duplicate dependencies.`);
    }
    for (const dependency of direct) {
      if (!taskById.has(dependency) || dependency === task.taskId
          || (position.get(dependency) ?? Number.MAX_SAFE_INTEGER) >= (position.get(task.taskId) ?? -1)
          || !closure.includes(dependency)) {
        throw new TypeError(`Context Continuation task context ${task.id} has an invalid direct dependency.`);
      }
    }
    let previousPosition = -1;
    for (const dependency of closure) {
      const dependencyPosition = position.get(dependency);
      if (dependencyPosition === undefined || dependency === task.taskId
          || dependencyPosition >= (position.get(task.taskId) ?? -1) || dependencyPosition <= previousPosition) {
        throw new TypeError(`Context Continuation task context ${task.id} has an invalid dependency closure.`);
      }
      previousPosition = dependencyPosition;
    }
  }

  if (!Array.isArray(row.levels) || row.levels.length > CONTEXT_CONTINUATION_MAX_LEVELS) {
    throw new RangeError(`Context Continuation accepts at most ${CONTEXT_CONTINUATION_MAX_LEVELS} hierarchy levels.`);
  }
  const levels = row.levels as unknown[];
  levels.forEach((level, index) => {
    if (!level || typeof level !== 'object' || Array.isArray(level)) {
      throw new TypeError(`Context Continuation hierarchy level ${index} is invalid.`);
    }
    const levelRow = level as Record<string, unknown>;
    const expectedTaskIds = tasks.filter((task) => task.level === index).map((task) => task.id);
    if (levelRow.id !== `ctx-level-${String(index).padStart(4, '0')}` || levelRow.depth !== index
        || !Array.isArray(levelRow.taskContextIds)
        || JSON.stringify(levelRow.taskContextIds) !== JSON.stringify(expectedTaskIds)) {
      throw new TypeError(`Context Continuation hierarchy level ${index} is non-canonical.`);
    }
  });
  if (tasks.length === 0 && levels.length !== 0) {
    throw new TypeError('Context Continuation empty task context must not contain hierarchy levels.');
  }
  if (tasks.length > 0) {
    const maxLevel = Math.max(...tasks.map((task) => task.level));
    if (levels.length !== maxLevel + 1) {
      throw new TypeError('Context Continuation hierarchy levels do not cover all task depths.');
    }
  }

  const flags: Readonly<Record<string, boolean>> = {
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
  };
  for (const [field, expected] of Object.entries(flags)) {
    if (row[field] !== expected) {
      throw new TypeError(`Context Continuation source ${field} boundary is invalid.`);
    }
  }
}

function asContextContinuationInput(value: unknown): ContextContinuationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Context Continuation input must be an object.');
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 1 || keys[0] !== 'context') {
    throw new TypeError('Context Continuation input accepts only the context field.');
  }
  assertHierarchicalContext(row.context);
  return { context: row.context };
}

const contextIdForTask = (taskId: string): string => `ctx-${taskId}`;

export function compileContextContinuation(input: ContextContinuationInput): ContextContinuationPlan {
  const { context } = asContextContinuationInput(input);
  const taskByContextId = new Map(context.tasks.map((task) => [task.id, task] as const));
  const frames = Object.freeze(context.taskContextOrder.map((taskContextId, index) => {
    const task = taskByContextId.get(taskContextId)!;
    const directDependencyContextIds = Object.freeze(task.directDependencies.map(contextIdForTask));
    const inheritedDependencyContextIds = Object.freeze(task.dependencyClosure.map(contextIdForTask));
    const carriedContextIds = Object.freeze([
      CONTEXT_CONTINUATION_ROOT_ID,
      ...inheritedDependencyContextIds,
    ]);
    const previousFrameId = index === 0 ? null : `cont-${String(index).padStart(4, '0')}`;
    const previousTaskContextId = index === 0 ? null : context.taskContextOrder[index - 1]!;

    return Object.freeze({
      id: `cont-${String(index + 1).padStart(4, '0')}`,
      ordinal: index + 1,
      taskContextId,
      taskId: task.taskId,
      requirementId: task.requirementId,
      level: task.level,
      previousFrameId,
      previousTaskContextId,
      directDependencyContextIds,
      inheritedDependencyContextIds,
      carriedContextIds,
    });
  }));
  const sourceDigest: PromptIntakeDigest = Object.freeze({
    algorithm: context.sourceDigest.algorithm,
    hex: context.sourceDigest.hex,
  });

  return Object.freeze({
    schema: CONTEXT_CONTINUATION_SCHEMA,
    sourceSchema: CONTEXT_CONTINUATION_SOURCE_SCHEMA,
    sourceDigest,
    rootContextId: CONTEXT_CONTINUATION_ROOT_ID,
    frames,
    frameOrder: Object.freeze(frames.map((frame) => frame.id)),
    requirementCompilation: true,
    taskGraphCompilation: true,
    contextCompilation: true,
    contextContinuation: true,
    deterministic: true,
    sequentialHandoff: true,
    dependencyContextCarry: true,
    semanticExpansion: false,
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
