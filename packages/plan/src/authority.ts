import {
  REQUIREMENT_SPEC_SCHEMA,
  type PromptIntakeDigest,
  type RequirementItem,
  type RequirementSpec,
} from './index.js';
import {
  TASK_GRAPH_SCHEMA,
  type TaskGraph,
  type TaskGraphNode,
} from './task-graph.js';

export const PLAN_AUTHORITY_BUILD = 48 as const;
export const PLAN_AUTHORITY_SCHEMA = 'gd-plan-authority/1' as const;
export const PLAN_AUTHORITY_SOURCE_SPEC_SCHEMA = 'gd-requirement-spec/1' as const;
export const PLAN_AUTHORITY_SOURCE_GRAPH_SCHEMA = 'gd-task-graph/1' as const;
export const PLAN_MODE = 'PLAN' as const;
export const PLAN_AUTHORITY_MAX_TASKS = 4096 as const;
export const PLAN_AUTHORITY_DIGEST_ALGORITHM = 'sha256' as const;

export type PlanAuthorityStatus = 'draft' | 'approved';

export interface PlanAuthorityInput {
  readonly spec: RequirementSpec;
  readonly graph: TaskGraph;
}

export interface PlanTask {
  readonly id: string;
  readonly ordinal: number;
  readonly requirementId: string;
  readonly statement: string;
  readonly sourceStartLine: number;
  readonly sourceEndLine: number;
  readonly dependsOn: readonly string[];
}

export interface PlanAuthorityDigest {
  readonly algorithm: typeof PLAN_AUTHORITY_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface PlanAuthorityRecord {
  readonly schema: typeof PLAN_AUTHORITY_SCHEMA;
  readonly sourceSpecSchema: typeof PLAN_AUTHORITY_SOURCE_SPEC_SCHEMA;
  readonly sourceGraphSchema: typeof PLAN_AUTHORITY_SOURCE_GRAPH_SCHEMA;
  readonly sourceDigest: PromptIntakeDigest;
  readonly authorityDigest: PlanAuthorityDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof PLAN_MODE;
  readonly status: PlanAuthorityStatus;
  readonly approved: boolean;
  readonly readOnly: true;
  readonly runtimeReadOnlyRequired: true;
  readonly tasks: readonly PlanTask[];
  readonly taskOrder: readonly string[];
  readonly supportingRequirementIds: readonly string[];
  readonly requirementCompilation: true;
  readonly taskGraphCompilation: true;
  readonly planAuthority: true;
  readonly buildTransitionAuthorized: false;
  readonly decisionEngineApplied: false;
  readonly projectRulesApplied: false;
  readonly impactSimulationApplied: false;
  readonly buildOrchestration: false;
  readonly toolExecution: false;
  readonly scopeLock: false;
  readonly execution: false;
  readonly scheduling: false;
  readonly persistence: false;
}

export interface ApprovePlanInput {
  readonly plan: PlanAuthorityRecord;
}

const SHA256_K = Object.freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
] as const);

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function sha256Hex(text: string): string {
  const input = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const bitLength = input.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15]!;
      const y = words[index - 2]!;
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_K[index]! + words[index]!) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0,h1,h2,h3,h4,h5,h6,h7].map((value) => value.toString(16).padStart(8, '0')).join('');
}

function assertSourceDigest(value: unknown, label: string): asserts value is PromptIntakeDigest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} source digest is invalid.`);
  const row = value as Record<string, unknown>;
  if (row.algorithm !== PLAN_AUTHORITY_DIGEST_ALGORITHM || typeof row.hex !== 'string' || !/^[0-9a-f]{64}$/.test(row.hex)) {
    throw new TypeError(`${label} source digest is invalid.`);
  }
}

function assertRequirementItem(item: unknown, index: number): asserts item is RequirementItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`Plan Authority requirement ${index + 1} is invalid.`);
  const row = item as Record<string, unknown>;
  const expectedId = `req-${String(index + 1).padStart(4, '0')}`;
  if (row.id !== expectedId || row.ordinal !== index + 1 || typeof row.kind !== 'string'
      || typeof row.statement !== 'string' || row.statement.trim().length === 0
      || !Number.isInteger(row.startLine) || !Number.isInteger(row.endLine)
      || (row.startLine as number) < 1 || (row.endLine as number) < (row.startLine as number)) {
    throw new TypeError(`Plan Authority requirement ${expectedId} is non-canonical.`);
  }
}

function assertRequirementSpec(spec: unknown): asserts spec is RequirementSpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('Plan Authority spec must be a RequirementSpec.');
  const row = spec as Record<string, unknown>;
  if (row.schema !== REQUIREMENT_SPEC_SCHEMA || row.sourceSchema !== 'gd-prompt-intake/1') {
    throw new TypeError('Plan Authority requires canonical Requirement Compiler output.');
  }
  assertSourceDigest(row.sourceDigest, 'Plan Authority spec');
  if (!Array.isArray(row.items) || row.items.length > PLAN_AUTHORITY_MAX_TASKS) throw new RangeError(`Plan Authority accepts at most ${PLAN_AUTHORITY_MAX_TASKS} requirement items.`);
  row.items.forEach((item, index) => assertRequirementItem(item, index));
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
    if (row[field] !== expected) throw new TypeError(`Plan Authority spec ${field} boundary is invalid.`);
  }
}

function assertTaskGraph(graph: unknown, spec: RequirementSpec): asserts graph is TaskGraph {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) throw new TypeError('Plan Authority graph must be a TaskGraph.');
  const row = graph as Record<string, unknown>;
  if (row.schema !== TASK_GRAPH_SCHEMA || row.sourceSchema !== REQUIREMENT_SPEC_SCHEMA) {
    throw new TypeError('Plan Authority requires canonical Task Graph Compiler output.');
  }
  assertSourceDigest(row.sourceDigest, 'Plan Authority graph');
  if ((row.sourceDigest as PromptIntakeDigest).hex !== spec.sourceDigest.hex) {
    throw new TypeError('Plan Authority spec and graph source digests do not match.');
  }
  if (!Array.isArray(row.nodes) || row.nodes.length > PLAN_AUTHORITY_MAX_TASKS || !Array.isArray(row.edges)
      || !Array.isArray(row.topologicalOrder) || !Array.isArray(row.supportingRequirementIds)) {
    throw new TypeError('Plan Authority graph structure is invalid.');
  }

  const taskRequirements = spec.items.filter((item) => item.kind === 'requirement');
  if (row.nodes.length !== taskRequirements.length) throw new TypeError('Plan Authority graph task count does not match requirements.');
  const taskIds = new Set<string>();
  (row.nodes as unknown[]).forEach((node, index) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new TypeError(`Plan Authority task ${index + 1} is invalid.`);
    const task = node as Record<string, unknown>;
    const requirement = taskRequirements[index]!;
    const expectedId = `task-${String(index + 1).padStart(4, '0')}`;
    if (task.id !== expectedId || task.ordinal !== index + 1 || task.requirementId !== requirement.id
        || task.sourceKind !== 'requirement' || task.statement !== requirement.statement
        || task.sourceStartLine !== requirement.startLine || task.sourceEndLine !== requirement.endLine
        || !Array.isArray(task.dependsOn)) {
      throw new TypeError(`Plan Authority task ${expectedId} is non-canonical.`);
    }
    for (const dependency of task.dependsOn) {
      if (typeof dependency !== 'string' || !/^task-\d{4}$/.test(dependency)) throw new TypeError(`Plan Authority task ${expectedId} has an invalid dependency.`);
    }
    taskIds.add(expectedId);
  });

  const order = row.topologicalOrder as unknown[];
  if (order.length !== taskIds.size || new Set(order).size !== order.length || order.some((id) => typeof id !== 'string' || !taskIds.has(id))) {
    throw new TypeError('Plan Authority topological order is invalid.');
  }
  const orderIndex = new Map<string, number>((order as string[]).map((id, index) => [id, index]));
  for (const node of row.nodes as TaskGraphNode[]) {
    for (const dependency of node.dependsOn) {
      if (!taskIds.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(node.id) ?? -1)) {
        throw new TypeError(`Plan Authority task ${node.id} dependency order is invalid.`);
      }
    }
  }

  const supportingExpected = spec.items.filter((item) => item.kind !== 'requirement').map((item) => item.id);
  if (JSON.stringify(row.supportingRequirementIds) !== JSON.stringify(supportingExpected)) {
    throw new TypeError('Plan Authority supporting requirement identities are invalid.');
  }

  const expectedEdges = (row.nodes as TaskGraphNode[]).flatMap((node) => node.dependsOn.map((dependency) => `${dependency}>${node.id}>${node.requirementId}`));
  const actualEdges = (row.edges as unknown[]).map((edge, index) => {
    if (!edge || typeof edge !== 'object' || Array.isArray(edge)) throw new TypeError(`Plan Authority edge ${index + 1} is invalid.`);
    const item = edge as Record<string, unknown>;
    const expectedId = `edge-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.from !== 'string'
        || typeof item.to !== 'string' || typeof item.declaredByRequirementId !== 'string') {
      throw new TypeError(`Plan Authority edge ${expectedId} is non-canonical.`);
    }
    return `${item.from}>${item.to}>${item.declaredByRequirementId}`;
  });
  if (JSON.stringify(actualEdges) !== JSON.stringify(expectedEdges)) throw new TypeError('Plan Authority graph edges do not match task dependencies.');

  const requiredFlags: Readonly<Record<string, boolean>> = {
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
  for (const [field, expected] of Object.entries(requiredFlags)) {
    if (row[field] !== expected) throw new TypeError(`Plan Authority graph ${field} boundary is invalid.`);
  }
}

function asPlanAuthorityInput(value: unknown): PlanAuthorityInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Plan Authority input must be an object.');
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 2 || keys[0] !== 'spec' || keys[1] !== 'graph') throw new TypeError('Plan Authority input accepts only spec and graph fields in canonical order.');
  assertRequirementSpec(row.spec);
  assertTaskGraph(row.graph, row.spec);
  return { spec: row.spec, graph: row.graph };
}

function canonicalPlanMaterial(sourceDigest: PromptIntakeDigest, tasks: readonly PlanTask[], taskOrder: readonly string[], supportingRequirementIds: readonly string[]): string {
  return JSON.stringify({
    schema: PLAN_AUTHORITY_SCHEMA,
    sourceDigest,
    tasks: tasks.map((task) => ({
      id: task.id,
      ordinal: task.ordinal,
      requirementId: task.requirementId,
      statement: task.statement,
      sourceStartLine: task.sourceStartLine,
      sourceEndLine: task.sourceEndLine,
      dependsOn: [...task.dependsOn],
    })),
    taskOrder: [...taskOrder],
    supportingRequirementIds: [...supportingRequirementIds],
  });
}

function authorityDigest(sourceDigest: PromptIntakeDigest, tasks: readonly PlanTask[], taskOrder: readonly string[], supportingRequirementIds: readonly string[]): PlanAuthorityDigest {
  return Object.freeze({
    algorithm: PLAN_AUTHORITY_DIGEST_ALGORITHM,
    hex: sha256Hex(canonicalPlanMaterial(sourceDigest, tasks, taskOrder, supportingRequirementIds)),
  });
}

function buildRecord(
  sourceDigest: PromptIntakeDigest,
  tasks: readonly PlanTask[],
  taskOrder: readonly string[],
  supportingRequirementIds: readonly string[],
  status: PlanAuthorityStatus,
): PlanAuthorityRecord {
  const digest = authorityDigest(sourceDigest, tasks, taskOrder, supportingRequirementIds);
  return Object.freeze({
    schema: PLAN_AUTHORITY_SCHEMA,
    sourceSpecSchema: PLAN_AUTHORITY_SOURCE_SPEC_SCHEMA,
    sourceGraphSchema: PLAN_AUTHORITY_SOURCE_GRAPH_SCHEMA,
    sourceDigest: Object.freeze({ algorithm: sourceDigest.algorithm, hex: sourceDigest.hex }),
    authorityDigest: digest,
    id: `plan-${digest.hex.slice(0, 16)}`,
    revision: 1,
    mode: PLAN_MODE,
    status,
    approved: status === 'approved',
    readOnly: true,
    runtimeReadOnlyRequired: true,
    tasks,
    taskOrder,
    supportingRequirementIds,
    requirementCompilation: true,
    taskGraphCompilation: true,
    planAuthority: true,
    buildTransitionAuthorized: false,
    decisionEngineApplied: false,
    projectRulesApplied: false,
    impactSimulationApplied: false,
    buildOrchestration: false,
    toolExecution: false,
    scopeLock: false,
    execution: false,
    scheduling: false,
    persistence: false,
  });
}

export function createPlanAuthority(input: PlanAuthorityInput): PlanAuthorityRecord {
  const { spec, graph } = asPlanAuthorityInput(input);
  const tasks = Object.freeze(graph.nodes.map((node) => Object.freeze({
    id: node.id,
    ordinal: node.ordinal,
    requirementId: node.requirementId,
    statement: node.statement,
    sourceStartLine: node.sourceStartLine,
    sourceEndLine: node.sourceEndLine,
    dependsOn: Object.freeze([...node.dependsOn]),
  })));
  const taskOrder = Object.freeze([...graph.topologicalOrder]);
  const supportingRequirementIds = Object.freeze([...graph.supportingRequirementIds]);
  return buildRecord(spec.sourceDigest, tasks, taskOrder, supportingRequirementIds, 'draft');
}

function assertCanonicalPlan(value: unknown): asserts value is PlanAuthorityRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Plan approval requires a canonical Plan Authority record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PLAN_AUTHORITY_SCHEMA || row.sourceSpecSchema !== PLAN_AUTHORITY_SOURCE_SPEC_SCHEMA
      || row.sourceGraphSchema !== PLAN_AUTHORITY_SOURCE_GRAPH_SCHEMA || row.revision !== 1 || row.mode !== PLAN_MODE
      || row.readOnly !== true || row.runtimeReadOnlyRequired !== true || row.planAuthority !== true
      || !Array.isArray(row.tasks) || !Array.isArray(row.taskOrder) || !Array.isArray(row.supportingRequirementIds)) {
    throw new TypeError('Plan approval requires a canonical Plan Authority record.');
  }
  assertSourceDigest(row.sourceDigest, 'Plan approval');
  const tasks = row.tasks as PlanTask[];
  tasks.forEach((task, index) => {
    if (!task || typeof task !== 'object' || task.id !== `task-${String(index + 1).padStart(4, '0')}` || task.ordinal !== index + 1
        || typeof task.requirementId !== 'string' || typeof task.statement !== 'string' || !Array.isArray(task.dependsOn)) {
      throw new TypeError(`Plan approval task ${index + 1} is invalid.`);
    }
  });
  const digest = authorityDigest(row.sourceDigest as PromptIntakeDigest, tasks, row.taskOrder as string[], row.supportingRequirementIds as string[]);
  if (!row.authorityDigest || typeof row.authorityDigest !== 'object' || Array.isArray(row.authorityDigest)
      || (row.authorityDigest as Record<string, unknown>).algorithm !== PLAN_AUTHORITY_DIGEST_ALGORITHM
      || (row.authorityDigest as Record<string, unknown>).hex !== digest.hex || row.id !== `plan-${digest.hex.slice(0, 16)}`) {
    throw new TypeError('Plan approval authority digest is invalid.');
  }
  for (const [field, expected] of Object.entries({
    requirementCompilation: true,
    taskGraphCompilation: true,
    planAuthority: true,
    buildTransitionAuthorized: false,
    decisionEngineApplied: false,
    projectRulesApplied: false,
    impactSimulationApplied: false,
    buildOrchestration: false,
    toolExecution: false,
    scopeLock: false,
    execution: false,
    scheduling: false,
    persistence: false,
  })) {
    if (row[field] !== expected) throw new TypeError(`Plan approval ${field} boundary is invalid.`);
  }
  if ((row.status !== 'draft' && row.status !== 'approved') || row.approved !== (row.status === 'approved')) {
    throw new TypeError('Plan approval status is invalid.');
  }
}

export function approvePlan(input: ApprovePlanInput): PlanAuthorityRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Plan approval input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 1 || keys[0] !== 'plan') throw new TypeError('Plan approval input accepts only the plan field.');
  assertCanonicalPlan(row.plan);
  const plan = row.plan;
  if (plan.status === 'approved') return plan;
  return buildRecord(plan.sourceDigest, plan.tasks, plan.taskOrder, plan.supportingRequirementIds, 'approved');
}
