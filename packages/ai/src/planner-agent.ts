import {
  PLAN_AUTHORITY_DIGEST_ALGORITHM,
  PLAN_AUTHORITY_SCHEMA,
  PLAN_MODE,
  type PlanAuthorityRecord,
  type PlanTask,
} from '@github-decrypter/plan/authority';
import {
  AGENT_RUNTIME_REGISTRY,
  AGENT_RUNTIME_SCHEMA,
  assertCanonicalAgentRuntime,
  getAgentRuntimeDescriptor,
  type AgentRuntimeRegistry,
} from './agent-runtime.js';

export const PLANNER_AGENT_BUILD = 59 as const;
export const PLANNER_AGENT_SCHEMA = 'gd-planner-agent/1' as const;
export const PLANNER_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1' as const;
export const PLANNER_AGENT_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1' as const;
export const PLANNER_AGENT_ID = 'leonardo' as const;
export const PLANNER_AGENT_NAME = 'Leonardo' as const;
export const PLANNER_AGENT_ROLE = 'architect' as const;
export const PLANNER_AGENT_MODE = 'PLAN' as const;
export const PLANNER_AGENT_DIGEST_ALGORITHM = 'sha256' as const;
export const PLANNER_AGENT_MAX_TASKS = 4096 as const;

export interface PlannerAgentInput {
  readonly registry?: AgentRuntimeRegistry;
  readonly plan: PlanAuthorityRecord;
}

export interface PlannerAgentDigest {
  readonly algorithm: typeof PLANNER_AGENT_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface PlannerTaskBrief {
  readonly id: string;
  readonly ordinal: number;
  readonly sourceTaskId: string;
  readonly requirementId: string;
  readonly statement: string;
  readonly dependsOn: readonly string[];
}

export interface PlannerAgentBrief {
  readonly schema: typeof PLANNER_AGENT_SCHEMA;
  readonly sourceAgentRuntimeSchema: typeof PLANNER_AGENT_SOURCE_RUNTIME_SCHEMA;
  readonly sourcePlanSchema: typeof PLANNER_AGENT_SOURCE_PLAN_SCHEMA;
  readonly sourcePlanId: string;
  readonly sourcePlanDigest: PlannerAgentDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof PLANNER_AGENT_MODE;
  readonly status: 'briefed';
  readonly agentId: typeof PLANNER_AGENT_ID;
  readonly agentName: typeof PLANNER_AGENT_NAME;
  readonly agentRole: typeof PLANNER_AGENT_ROLE;
  readonly taskCount: number;
  readonly tasks: readonly PlannerTaskBrief[];
  readonly plannerDigest: PlannerAgentDigest;
  readonly namedAgentBinding: true;
  readonly plannerAgent: true;
  readonly planningSpecialization: true;
  readonly planAuthorityConsumer: true;
  readonly draftPlanRequired: true;
  readonly planningAdvisoryOnly: true;
  readonly planReadOnlyPreserved: true;
  readonly semanticInference: false;
  readonly planApprovalAuthority: false;
  readonly decisionAuthority: false;
  readonly projectRulesAuthority: false;
  readonly impactSimulationAuthority: false;
  readonly buildTransitionAuthority: false;
  readonly automaticAgentSelection: false;
  readonly orchestration: false;
  readonly agentExecution: false;
  readonly toolExecution: false;
  readonly execution: false;
  readonly capabilityGrantAuthority: false;
  readonly approvalAuthority: false;
  readonly scopeAuthority: false;
  readonly mutationAuthorized: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly studioTransport: false;
  readonly localRuntimeTransport: false;
  readonly immutable: true;
  readonly deterministic: true;
  readonly environmentNeutral: true;
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

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
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

function digest(hex: string): PlannerAgentDigest {
  return Object.freeze({ algorithm: PLANNER_AGENT_DIGEST_ALGORITHM, hex });
}

function canonicalPlanMaterial(plan: PlanAuthorityRecord): string {
  return JSON.stringify({
    schema: PLAN_AUTHORITY_SCHEMA,
    sourceDigest: plan.sourceDigest,
    tasks: plan.tasks.map((task) => ({
      id: task.id,
      ordinal: task.ordinal,
      requirementId: task.requirementId,
      statement: task.statement,
      sourceStartLine: task.sourceStartLine,
      sourceEndLine: task.sourceEndLine,
      dependsOn: [...task.dependsOn],
    })),
    taskOrder: [...plan.taskOrder],
    supportingRequirementIds: [...plan.supportingRequirementIds],
  });
}

function assertCanonicalDraftPlan(value: unknown): asserts value is PlanAuthorityRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Planner Agent requires a canonical draft Plan Authority record.');
  const row = value as Record<string, unknown>;
  if (
    row.schema !== PLAN_AUTHORITY_SCHEMA
    || row.sourceSpecSchema !== 'gd-requirement-spec/1'
    || row.sourceGraphSchema !== 'gd-task-graph/1'
    || row.revision !== 1
    || row.mode !== PLAN_MODE
    || row.status !== 'draft'
    || row.approved !== false
    || row.readOnly !== true
    || row.runtimeReadOnlyRequired !== true
    || row.requirementCompilation !== true
    || row.taskGraphCompilation !== true
    || row.planAuthority !== true
    || row.buildTransitionAuthorized !== false
    || row.decisionEngineApplied !== false
    || row.projectRulesApplied !== false
    || row.impactSimulationApplied !== false
    || row.buildOrchestration !== false
    || row.toolExecution !== false
    || row.scopeLock !== false
    || row.execution !== false
    || row.scheduling !== false
    || row.persistence !== false
    || !Array.isArray(row.tasks)
    || !Array.isArray(row.taskOrder)
    || !Array.isArray(row.supportingRequirementIds)
  ) throw new TypeError('Planner Agent requires an unmodified canonical draft Plan Authority boundary.');

  const plan = value as PlanAuthorityRecord;
  if (
    plan.sourceDigest.algorithm !== PLAN_AUTHORITY_DIGEST_ALGORITHM
    || !/^[0-9a-f]{64}$/.test(plan.sourceDigest.hex)
    || plan.authorityDigest.algorithm !== PLAN_AUTHORITY_DIGEST_ALGORITHM
    || !/^[0-9a-f]{64}$/.test(plan.authorityDigest.hex)
    || plan.tasks.length > PLANNER_AGENT_MAX_TASKS
  ) throw new TypeError('Planner Agent Plan Authority digest or task count is invalid.');

  const ids = new Set<string>();
  plan.tasks.forEach((task: PlanTask, index: number) => {
    const id = `task-${String(index + 1).padStart(4, '0')}`;
    if (
      task.id !== id
      || task.ordinal !== index + 1
      || !/^req-\d{4}$/.test(task.requirementId)
      || task.statement.trim().length === 0
      || !Number.isInteger(task.sourceStartLine)
      || !Number.isInteger(task.sourceEndLine)
      || task.sourceStartLine < 1
      || task.sourceEndLine < task.sourceStartLine
      || !Array.isArray(task.dependsOn)
    ) throw new TypeError(`Planner Agent plan task ${id} is non-canonical.`);
    ids.add(task.id);
  });
  if (
    plan.taskOrder.length !== ids.size
    || new Set(plan.taskOrder).size !== plan.taskOrder.length
    || plan.taskOrder.some((id) => !ids.has(id))
  ) throw new TypeError('Planner Agent Plan Authority order is invalid.');
  const orderIndex = new Map(plan.taskOrder.map((id, index) => [id, index]));
  for (const task of plan.tasks) for (const dependency of task.dependsOn) {
    if (!ids.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(task.id) ?? -1)) {
      throw new TypeError(`Planner Agent task ${task.id} dependency order is invalid.`);
    }
  }
  if (plan.supportingRequirementIds.some((id) => !/^req-\d{4}$/.test(id))) {
    throw new TypeError('Planner Agent supporting requirement ids are invalid.');
  }

  const expected = sha256Hex(canonicalPlanMaterial(plan));
  if (plan.authorityDigest.hex !== expected || plan.id !== `plan-${expected.slice(0, 16)}`) {
    throw new TypeError('Planner Agent Plan Authority digest does not match canonical plan material.');
  }
}

function canonicalPlannerMaterial(plan: PlanAuthorityRecord, tasks: readonly PlannerTaskBrief[]): string {
  return JSON.stringify({
    schema: PLANNER_AGENT_SCHEMA,
    sourceAgentRuntimeSchema: AGENT_RUNTIME_SCHEMA,
    sourcePlanSchema: PLAN_AUTHORITY_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: plan.authorityDigest,
    mode: PLANNER_AGENT_MODE,
    agentId: PLANNER_AGENT_ID,
    agentName: PLANNER_AGENT_NAME,
    agentRole: PLANNER_AGENT_ROLE,
    tasks: tasks.map((task) => ({
      id: task.id,
      ordinal: task.ordinal,
      sourceTaskId: task.sourceTaskId,
      requirementId: task.requirementId,
      statement: task.statement,
      dependsOn: [...task.dependsOn],
    })),
  });
}

export function createPlannerAgentBrief(input: PlannerAgentInput): PlannerAgentBrief {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Planner Agent input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(['plan'])
    && JSON.stringify(keys) !== JSON.stringify(['plan','registry'])
  ) throw new TypeError('Planner Agent input accepts only plan and optional registry.');

  const registry = (row.registry ?? AGENT_RUNTIME_REGISTRY) as AgentRuntimeRegistry;
  assertCanonicalAgentRuntime(registry);
  const descriptor = getAgentRuntimeDescriptor(PLANNER_AGENT_ID);
  if (!descriptor || descriptor.name !== PLANNER_AGENT_NAME || descriptor.role !== PLANNER_AGENT_ROLE) {
    throw new TypeError('Planner Agent requires the canonical Leonardo architect identity.');
  }
  assertCanonicalDraftPlan(row.plan);
  const plan = row.plan;

  const tasks = Object.freeze(plan.tasks.map((task, index) => Object.freeze({
    id: `planner-item-${String(index + 1).padStart(4, '0')}`,
    ordinal: index + 1,
    sourceTaskId: task.id,
    requirementId: task.requirementId,
    statement: task.statement,
    dependsOn: Object.freeze([...task.dependsOn]),
  })));
  const hex = sha256Hex(canonicalPlannerMaterial(plan, tasks));

  return Object.freeze({
    schema: PLANNER_AGENT_SCHEMA,
    sourceAgentRuntimeSchema: PLANNER_AGENT_SOURCE_RUNTIME_SCHEMA,
    sourcePlanSchema: PLANNER_AGENT_SOURCE_PLAN_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: digest(plan.authorityDigest.hex),
    id: `planner-brief-${hex.slice(0, 16)}`,
    revision: 1,
    mode: PLANNER_AGENT_MODE,
    status: 'briefed',
    agentId: PLANNER_AGENT_ID,
    agentName: PLANNER_AGENT_NAME,
    agentRole: PLANNER_AGENT_ROLE,
    taskCount: tasks.length,
    tasks,
    plannerDigest: digest(hex),
    namedAgentBinding: true,
    plannerAgent: true,
    planningSpecialization: true,
    planAuthorityConsumer: true,
    draftPlanRequired: true,
    planningAdvisoryOnly: true,
    planReadOnlyPreserved: true,
    semanticInference: false,
    planApprovalAuthority: false,
    decisionAuthority: false,
    projectRulesAuthority: false,
    impactSimulationAuthority: false,
    buildTransitionAuthority: false,
    automaticAgentSelection: false,
    orchestration: false,
    agentExecution: false,
    toolExecution: false,
    execution: false,
    capabilityGrantAuthority: false,
    approvalAuthority: false,
    scopeAuthority: false,
    mutationAuthorized: false,
    scheduling: false,
    jobCreation: false,
    persistence: false,
    networkAuthority: false,
    filesystemAuthority: false,
    databaseAuthority: false,
    studioTransport: false,
    localRuntimeTransport: false,
    immutable: true,
    deterministic: true,
    environmentNeutral: true,
  });
}

export function assertCanonicalPlannerAgentBrief(value: unknown, input: PlannerAgentInput): asserts value is PlannerAgentBrief {
  const canonical = createPlannerAgentBrief(input);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Planner Agent brief must be an object.');
  if (JSON.stringify(value) !== JSON.stringify(canonical)) throw new TypeError('Planner Agent brief is non-canonical.');
}
