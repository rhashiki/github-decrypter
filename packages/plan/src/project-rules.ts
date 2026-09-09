import {
  PLAN_AUTHORITY_SCHEMA,
  type PlanAuthorityDigest,
  type PlanAuthorityRecord,
  type PlanTask,
} from './authority.js';

export const PROJECT_RULES_BUILD = 50 as const;
export const PROJECT_RULES_SCHEMA = 'gd-project-rules/1' as const;
export const PROJECT_RULES_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1' as const;
export const PROJECT_RULES_MODE = 'PLAN' as const;
export const PROJECT_RULES_DIGEST_ALGORITHM = 'sha256' as const;
export const PROJECT_RULES_MAX_RULES = 256 as const;
export const PROJECT_RULES_MAX_TEXT = 65_536 as const;
export const PROJECT_RULES_MAX_WORKSPACE_ID = 256 as const;
export const PROJECT_RULE_KINDS = ['require', 'forbid', 'prefer'] as const;

export type ProjectRuleKind = (typeof PROJECT_RULE_KINDS)[number];

export interface ProjectRuleInput {
  readonly key: string;
  readonly kind: ProjectRuleKind;
  readonly statement: string;
}

export interface ProjectRulesInput {
  readonly plan: PlanAuthorityRecord;
  readonly workspaceId: string;
  readonly rules: readonly ProjectRuleInput[];
}

export interface ProjectRule {
  readonly id: string;
  readonly ordinal: number;
  readonly key: string;
  readonly kind: ProjectRuleKind;
  readonly statement: string;
}

export interface ProjectRulesDigest {
  readonly algorithm: typeof PROJECT_RULES_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ProjectRulesRecord {
  readonly schema: typeof PROJECT_RULES_SCHEMA;
  readonly sourcePlanSchema: typeof PROJECT_RULES_SOURCE_PLAN_SCHEMA;
  readonly sourcePlanId: string;
  readonly sourcePlanDigest: PlanAuthorityDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof PROJECT_RULES_MODE;
  readonly status: 'bound';
  readonly workspaceId: string;
  readonly rules: readonly ProjectRule[];
  readonly rulesDigest: ProjectRulesDigest;
  readonly readOnly: true;
  readonly planReadOnlyPreserved: true;
  readonly workspaceScoped: true;
  readonly explicitRulesOnly: true;
  readonly semanticInference: false;
  readonly automaticEvaluation: false;
  readonly projectRulesApplied: true;
  readonly impactSimulationApplied: false;
  readonly buildTransitionAuthorized: false;
  readonly buildOrchestration: false;
  readonly toolExecution: false;
  readonly scopeIntelligence: false;
  readonly scopeLock: false;
  readonly checkpoints: false;
  readonly validationPipeline: false;
  readonly execution: false;
  readonly scheduling: false;
  readonly persistence: false;
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
      const temp2 = (sum0 + temp1) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp2 - temp1 + temp1) >>> 0;
      a = (sum0 + ((a - sum0) >>> 0)) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map((value) => value.toString(16).padStart(8, '0')).join('');
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

function assertCanonicalSourcePlan(value: unknown): asserts value is PlanAuthorityRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Project Rules requires a canonical Plan Authority record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PLAN_AUTHORITY_SCHEMA || row.sourceSpecSchema !== 'gd-requirement-spec/1'
      || row.sourceGraphSchema !== 'gd-task-graph/1' || row.revision !== 1 || row.mode !== 'PLAN'
      || row.readOnly !== true || row.runtimeReadOnlyRequired !== true || row.planAuthority !== true
      || !Array.isArray(row.tasks) || !Array.isArray(row.taskOrder) || !Array.isArray(row.supportingRequirementIds)) {
    throw new TypeError('Project Rules requires a canonical Plan Authority record.');
  }
  if (!row.sourceDigest || typeof row.sourceDigest !== 'object' || Array.isArray(row.sourceDigest)
      || (row.sourceDigest as Record<string, unknown>).algorithm !== PROJECT_RULES_DIGEST_ALGORITHM
      || typeof (row.sourceDigest as Record<string, unknown>).hex !== 'string'
      || !/^[0-9a-f]{64}$/.test((row.sourceDigest as Record<string, unknown>).hex as string)) {
    throw new TypeError('Project Rules source Plan digest is invalid.');
  }
  if (!row.authorityDigest || typeof row.authorityDigest !== 'object' || Array.isArray(row.authorityDigest)
      || (row.authorityDigest as Record<string, unknown>).algorithm !== PROJECT_RULES_DIGEST_ALGORITHM
      || typeof (row.authorityDigest as Record<string, unknown>).hex !== 'string'
      || !/^[0-9a-f]{64}$/.test((row.authorityDigest as Record<string, unknown>).hex as string)) {
    throw new TypeError('Project Rules source Plan authority digest is invalid.');
  }

  const tasks = row.tasks as unknown[];
  const taskIds = new Set<string>();
  tasks.forEach((task, index) => {
    if (!task || typeof task !== 'object' || Array.isArray(task)) throw new TypeError(`Project Rules source Plan task ${index + 1} is invalid.`);
    const item = task as Record<string, unknown>;
    const expectedId = `task-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.requirementId !== 'string'
        || !/^req-\d{4}$/.test(item.requirementId) || typeof item.statement !== 'string' || item.statement.trim().length === 0
        || !Number.isInteger(item.sourceStartLine) || !Number.isInteger(item.sourceEndLine)
        || (item.sourceStartLine as number) < 1 || (item.sourceEndLine as number) < (item.sourceStartLine as number)
        || !Array.isArray(item.dependsOn)) {
      throw new TypeError(`Project Rules source Plan task ${expectedId} is non-canonical.`);
    }
    for (const dependency of item.dependsOn) {
      if (typeof dependency !== 'string' || !/^task-\d{4}$/.test(dependency)) throw new TypeError(`Project Rules source Plan task ${expectedId} dependency is invalid.`);
    }
    taskIds.add(expectedId);
  });

  const order = row.taskOrder as unknown[];
  if (order.length !== taskIds.size || new Set(order).size !== order.length
      || order.some((id) => typeof id !== 'string' || !taskIds.has(id))) {
    throw new TypeError('Project Rules source Plan task order is invalid.');
  }
  const orderIndex = new Map<string, number>((order as string[]).map((id, index) => [id, index]));
  for (const task of tasks as PlanTask[]) {
    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(task.id) ?? -1)) {
        throw new TypeError(`Project Rules source Plan task ${task.id} dependency order is invalid.`);
      }
    }
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
    if (row[field] !== expected) throw new TypeError(`Project Rules source Plan ${field} boundary is invalid.`);
  }
  if (row.status !== 'draft' || row.approved !== false) {
    throw new TypeError('Project Rules binds workspace constitution only while the source Plan remains draft.');
  }

  const plan = value as PlanAuthorityRecord;
  const expectedDigest = sha256Hex(canonicalPlanMaterial(plan));
  if ((row.authorityDigest as PlanAuthorityDigest).hex !== expectedDigest || row.id !== `plan-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Project Rules source Plan authority digest does not match canonical Plan material.');
  }
}

function normalizeText(value: unknown, label: string, max = PROJECT_RULES_MAX_TEXT): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (normalized.length === 0) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > max) throw new RangeError(`${label} exceeds the Project Rules text limit.`);
  return normalized;
}

function normalizeWorkspaceId(value: unknown): string {
  const normalized = normalizeText(value, 'Project Rules workspaceId', PROJECT_RULES_MAX_WORKSPACE_ID);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)) {
    throw new TypeError('Project Rules workspaceId must be an explicit opaque workspace identifier.');
  }
  return normalized;
}

function canonicalRule(value: unknown, index: number): ProjectRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Project rule ${index + 1} must be an object.`);
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['key','kind','statement'])) {
    throw new TypeError(`Project rule ${index + 1} accepts only key, kind and statement.`);
  }
  const key = normalizeText(row.key, `Project rule ${index + 1} key`, 128).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(key)) throw new TypeError(`Project rule ${index + 1} key is invalid.`);
  if (typeof row.kind !== 'string' || !PROJECT_RULE_KINDS.includes(row.kind as ProjectRuleKind)) {
    throw new TypeError(`Project rule ${index + 1} kind is invalid.`);
  }
  return Object.freeze({
    id: `rule-${String(index + 1).padStart(4, '0')}`,
    ordinal: index + 1,
    key,
    kind: row.kind as ProjectRuleKind,
    statement: normalizeText(row.statement, `Project rule ${index + 1} statement`),
  });
}

function canonicalMaterial(plan: PlanAuthorityRecord, workspaceId: string, rules: readonly ProjectRule[]): string {
  return JSON.stringify({
    schema: PROJECT_RULES_SCHEMA,
    sourcePlanSchema: PROJECT_RULES_SOURCE_PLAN_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: plan.authorityDigest,
    workspaceId,
    rules: rules.map((rule) => ({
      id: rule.id,
      ordinal: rule.ordinal,
      key: rule.key,
      kind: rule.kind,
      statement: rule.statement,
    })),
  });
}

export function bindProjectRules(input: ProjectRulesInput): ProjectRulesRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project Rules input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['plan','rules','workspaceId'])) {
    throw new TypeError('Project Rules input accepts only plan, workspaceId and rules.');
  }

  assertCanonicalSourcePlan(row.plan);
  const plan = row.plan;
  const workspaceId = normalizeWorkspaceId(row.workspaceId);
  if (!Array.isArray(row.rules) || row.rules.length > PROJECT_RULES_MAX_RULES) {
    throw new RangeError(`Project Rules accepts at most ${PROJECT_RULES_MAX_RULES} explicit rules.`);
  }
  const rules = Object.freeze(row.rules.map((rule, index) => canonicalRule(rule, index)));
  if (new Set(rules.map((rule) => rule.key)).size !== rules.length) {
    throw new TypeError('Project Rules keys must be unique within a workspace constitution.');
  }

  const digestHex = sha256Hex(canonicalMaterial(plan, workspaceId, rules));
  const rulesDigest = Object.freeze({ algorithm: PROJECT_RULES_DIGEST_ALGORITHM, hex: digestHex });

  return Object.freeze({
    schema: PROJECT_RULES_SCHEMA,
    sourcePlanSchema: PROJECT_RULES_SOURCE_PLAN_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: Object.freeze({ algorithm: plan.authorityDigest.algorithm, hex: plan.authorityDigest.hex }),
    id: `project-rules-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: PROJECT_RULES_MODE,
    status: 'bound',
    workspaceId,
    rules,
    rulesDigest,
    readOnly: true,
    planReadOnlyPreserved: true,
    workspaceScoped: true,
    explicitRulesOnly: true,
    semanticInference: false,
    automaticEvaluation: false,
    projectRulesApplied: true,
    impactSimulationApplied: false,
    buildTransitionAuthorized: false,
    buildOrchestration: false,
    toolExecution: false,
    scopeIntelligence: false,
    scopeLock: false,
    checkpoints: false,
    validationPipeline: false,
    execution: false,
    scheduling: false,
    persistence: false,
  });
}
