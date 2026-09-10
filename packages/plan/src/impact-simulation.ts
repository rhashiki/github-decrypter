import {
  PLAN_AUTHORITY_SCHEMA,
  type PlanAuthorityDigest,
  type PlanAuthorityRecord,
  type PlanTask,
} from './authority.js';
import {
  PROJECT_RULES_SCHEMA,
  type ProjectRule,
  type ProjectRulesDigest,
  type ProjectRulesRecord,
} from './project-rules.js';

export const IMPACT_SIMULATION_BUILD = 51 as const;
export const IMPACT_SIMULATION_SCHEMA = 'gd-impact-simulation/1' as const;
export const IMPACT_SIMULATION_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1' as const;
export const IMPACT_SIMULATION_SOURCE_RULES_SCHEMA = 'gd-project-rules/1' as const;
export const IMPACT_SIMULATION_MODE = 'PLAN' as const;
export const IMPACT_SIMULATION_DIGEST_ALGORITHM = 'sha256' as const;
export const IMPACT_SIMULATION_MAX_IMPACTS = 256 as const;
export const IMPACT_SIMULATION_MAX_REFERENCES = 256 as const;
export const IMPACT_SIMULATION_MAX_TEXT = 65_536 as const;
export const IMPACT_SIMULATION_MAX_AREA = 256 as const;
export const IMPACT_EFFECTS = ['positive', 'neutral', 'negative'] as const;
export const IMPACT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export type ImpactEffect = (typeof IMPACT_EFFECTS)[number];
export type ImpactSeverity = (typeof IMPACT_SEVERITIES)[number];

export interface ImpactObservationInput {
  readonly area: string;
  readonly effect: ImpactEffect;
  readonly severity: ImpactSeverity;
  readonly summary: string;
  readonly relatedRuleKeys: readonly string[];
  readonly relatedTaskIds: readonly string[];
}

export interface ImpactSimulationInput {
  readonly plan: PlanAuthorityRecord;
  readonly projectRules: ProjectRulesRecord;
  readonly impacts: readonly ImpactObservationInput[];
}

export interface ImpactObservation {
  readonly id: string;
  readonly ordinal: number;
  readonly area: string;
  readonly effect: ImpactEffect;
  readonly severity: ImpactSeverity;
  readonly summary: string;
  readonly relatedRuleKeys: readonly string[];
  readonly relatedTaskIds: readonly string[];
}

export interface ImpactSimulationDigest {
  readonly algorithm: typeof IMPACT_SIMULATION_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ImpactSimulationRecord {
  readonly schema: typeof IMPACT_SIMULATION_SCHEMA;
  readonly sourcePlanSchema: typeof IMPACT_SIMULATION_SOURCE_PLAN_SCHEMA;
  readonly sourceProjectRulesSchema: typeof IMPACT_SIMULATION_SOURCE_RULES_SCHEMA;
  readonly sourcePlanId: string;
  readonly sourcePlanDigest: PlanAuthorityDigest;
  readonly sourceProjectRulesId: string;
  readonly sourceProjectRulesDigest: ProjectRulesDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof IMPACT_SIMULATION_MODE;
  readonly status: 'simulated';
  readonly workspaceId: string;
  readonly impacts: readonly ImpactObservation[];
  readonly impactDigest: ImpactSimulationDigest;
  readonly readOnly: true;
  readonly planReadOnlyPreserved: true;
  readonly projectRulesReadOnlyPreserved: true;
  readonly workspaceScoped: true;
  readonly explicitImpactsOnly: true;
  readonly semanticInference: false;
  readonly automaticEvaluation: false;
  readonly impactSimulationApplied: true;
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
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
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

function assertCanonicalPlan(value: unknown): asserts value is PlanAuthorityRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Impact Simulation requires a canonical Plan Authority record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PLAN_AUTHORITY_SCHEMA || row.sourceSpecSchema !== 'gd-requirement-spec/1'
      || row.sourceGraphSchema !== 'gd-task-graph/1' || row.revision !== 1 || row.mode !== 'PLAN'
      || row.status !== 'draft' || row.approved !== false || row.readOnly !== true
      || row.runtimeReadOnlyRequired !== true || row.planAuthority !== true
      || row.projectRulesApplied !== false || row.impactSimulationApplied !== false
      || row.buildTransitionAuthorized !== false || !Array.isArray(row.tasks)
      || !Array.isArray(row.taskOrder) || !Array.isArray(row.supportingRequirementIds)) {
    throw new TypeError('Impact Simulation requires a canonical draft Plan Authority record.');
  }
  if (!row.authorityDigest || typeof row.authorityDigest !== 'object' || Array.isArray(row.authorityDigest)
      || (row.authorityDigest as Record<string, unknown>).algorithm !== IMPACT_SIMULATION_DIGEST_ALGORITHM
      || typeof (row.authorityDigest as Record<string, unknown>).hex !== 'string'
      || !/^[0-9a-f]{64}$/.test((row.authorityDigest as Record<string, unknown>).hex as string)) {
    throw new TypeError('Impact Simulation source Plan authority digest is invalid.');
  }
  const tasks = row.tasks as unknown[];
  const ids = new Set<string>();
  tasks.forEach((task, index) => {
    if (!task || typeof task !== 'object' || Array.isArray(task)) throw new TypeError(`Impact Simulation source Plan task ${index + 1} is invalid.`);
    const item = task as Record<string, unknown>;
    const expectedId = `task-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.requirementId !== 'string'
        || !/^req-\d{4}$/.test(item.requirementId) || typeof item.statement !== 'string' || item.statement.trim().length === 0
        || !Number.isInteger(item.sourceStartLine) || !Number.isInteger(item.sourceEndLine)
        || !Array.isArray(item.dependsOn)) throw new TypeError(`Impact Simulation source Plan task ${expectedId} is non-canonical.`);
    for (const dependency of item.dependsOn) if (typeof dependency !== 'string' || !/^task-\d{4}$/.test(dependency)) {
      throw new TypeError(`Impact Simulation source Plan task ${expectedId} dependency is invalid.`);
    }
    ids.add(expectedId);
  });
  const order = row.taskOrder as unknown[];
  if (order.length !== ids.size || new Set(order).size !== order.length || order.some((id) => typeof id !== 'string' || !ids.has(id))) {
    throw new TypeError('Impact Simulation source Plan task order is invalid.');
  }
  const orderIndex = new Map<string, number>((order as string[]).map((id, index) => [id, index]));
  for (const task of tasks as PlanTask[]) for (const dependency of task.dependsOn) {
    if (!ids.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(task.id) ?? -1)) {
      throw new TypeError(`Impact Simulation source Plan task ${task.id} dependency order is invalid.`);
    }
  }
  const expectedDigest = sha256Hex(canonicalPlanMaterial(value));
  if ((row.authorityDigest as PlanAuthorityDigest).hex !== expectedDigest || row.id !== `plan-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Impact Simulation source Plan authority digest does not match canonical Plan material.');
  }
}

function canonicalRulesMaterial(rules: ProjectRulesRecord): string {
  return JSON.stringify({
    schema: PROJECT_RULES_SCHEMA,
    sourcePlanSchema: rules.sourcePlanSchema,
    sourcePlanId: rules.sourcePlanId,
    sourcePlanDigest: rules.sourcePlanDigest,
    workspaceId: rules.workspaceId,
    rules: rules.rules.map((rule) => ({
      id: rule.id,
      ordinal: rule.ordinal,
      key: rule.key,
      kind: rule.kind,
      statement: rule.statement,
    })),
  });
}

function assertCanonicalProjectRules(value: unknown, plan: PlanAuthorityRecord): asserts value is ProjectRulesRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Impact Simulation requires canonical Project Rules.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PROJECT_RULES_SCHEMA || row.sourcePlanSchema !== IMPACT_SIMULATION_SOURCE_PLAN_SCHEMA
      || row.sourcePlanId !== plan.id || row.revision !== 1 || row.mode !== 'PLAN' || row.status !== 'bound'
      || row.readOnly !== true || row.planReadOnlyPreserved !== true || row.workspaceScoped !== true
      || row.explicitRulesOnly !== true || row.semanticInference !== false || row.automaticEvaluation !== false
      || row.projectRulesApplied !== true || row.impactSimulationApplied !== false
      || row.buildTransitionAuthorized !== false || !Array.isArray(row.rules)) {
    throw new TypeError('Impact Simulation requires canonical Project Rules bound to the source Plan.');
  }
  const sourcePlanDigest = row.sourcePlanDigest as Record<string, unknown> | undefined;
  if (!sourcePlanDigest || sourcePlanDigest.algorithm !== IMPACT_SIMULATION_DIGEST_ALGORITHM
      || sourcePlanDigest.hex !== plan.authorityDigest.hex) {
    throw new TypeError('Impact Simulation Project Rules source Plan digest does not match the source Plan.');
  }
  const digest = row.rulesDigest as Record<string, unknown> | undefined;
  if (!digest || digest.algorithm !== IMPACT_SIMULATION_DIGEST_ALGORITHM || typeof digest.hex !== 'string'
      || !/^[0-9a-f]{64}$/.test(digest.hex)) throw new TypeError('Impact Simulation Project Rules digest is invalid.');
  const rules = row.rules as unknown[];
  const keys = new Set<string>();
  rules.forEach((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new TypeError(`Impact Simulation Project Rule ${index + 1} is invalid.`);
    const item = rule as Record<string, unknown>;
    const expectedId = `rule-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.key !== 'string'
        || !/^[a-z0-9][a-z0-9._-]*$/.test(item.key) || !['require','forbid','prefer'].includes(String(item.kind))
        || typeof item.statement !== 'string' || item.statement.trim().length === 0 || keys.has(item.key)) {
      throw new TypeError(`Impact Simulation Project Rule ${expectedId} is non-canonical.`);
    }
    keys.add(item.key);
  });
  const expectedDigest = sha256Hex(canonicalRulesMaterial(value as ProjectRulesRecord));
  if (digest.hex !== expectedDigest || row.id !== `project-rules-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Impact Simulation Project Rules digest does not match canonical Project Rules material.');
  }
}

function normalizeText(value: unknown, label: string, max: number = IMPACT_SIMULATION_MAX_TEXT): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (normalized.length === 0) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > max) throw new RangeError(`${label} exceeds the Impact Simulation text limit.`);
  return normalized;
}

function canonicalReferences(value: unknown, label: string, available: ReadonlySet<string>, normalizeCase: boolean): readonly string[] {
  if (!Array.isArray(value) || value.length > IMPACT_SIMULATION_MAX_REFERENCES) {
    throw new RangeError(`${label} accepts at most ${IMPACT_SIMULATION_MAX_REFERENCES} references.`);
  }
  const references = value.map((item, index) => {
    const normalized = normalizeText(item, `${label} reference ${index + 1}`, 256);
    const canonical = normalizeCase ? normalized.toLowerCase() : normalized;
    if (!available.has(canonical)) throw new TypeError(`${label} references unknown identity: ${canonical}.`);
    return canonical;
  });
  if (new Set(references).size !== references.length) throw new TypeError(`${label} references must be unique.`);
  return Object.freeze(references);
}

function canonicalImpact(
  value: unknown,
  index: number,
  ruleKeys: ReadonlySet<string>,
  taskIds: ReadonlySet<string>,
): ImpactObservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Impact ${index + 1} must be an object.`);
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['area','effect','relatedRuleKeys','relatedTaskIds','severity','summary'])) {
    throw new TypeError(`Impact ${index + 1} accepts only area, effect, severity, summary, relatedRuleKeys and relatedTaskIds.`);
  }
  if (typeof row.effect !== 'string' || !IMPACT_EFFECTS.includes(row.effect as ImpactEffect)) {
    throw new TypeError(`Impact ${index + 1} effect is invalid.`);
  }
  if (typeof row.severity !== 'string' || !IMPACT_SEVERITIES.includes(row.severity as ImpactSeverity)) {
    throw new TypeError(`Impact ${index + 1} severity is invalid.`);
  }
  return Object.freeze({
    id: `impact-${String(index + 1).padStart(4, '0')}`,
    ordinal: index + 1,
    area: normalizeText(row.area, `Impact ${index + 1} area`, IMPACT_SIMULATION_MAX_AREA),
    effect: row.effect as ImpactEffect,
    severity: row.severity as ImpactSeverity,
    summary: normalizeText(row.summary, `Impact ${index + 1} summary`),
    relatedRuleKeys: canonicalReferences(row.relatedRuleKeys, `Impact ${index + 1} rule`, ruleKeys, true),
    relatedTaskIds: canonicalReferences(row.relatedTaskIds, `Impact ${index + 1} task`, taskIds, false),
  });
}

function canonicalImpactMaterial(
  plan: PlanAuthorityRecord,
  projectRules: ProjectRulesRecord,
  impacts: readonly ImpactObservation[],
): string {
  return JSON.stringify({
    schema: IMPACT_SIMULATION_SCHEMA,
    sourcePlanSchema: IMPACT_SIMULATION_SOURCE_PLAN_SCHEMA,
    sourceProjectRulesSchema: IMPACT_SIMULATION_SOURCE_RULES_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: plan.authorityDigest,
    sourceProjectRulesId: projectRules.id,
    sourceProjectRulesDigest: projectRules.rulesDigest,
    workspaceId: projectRules.workspaceId,
    impacts: impacts.map((impact) => ({
      id: impact.id,
      ordinal: impact.ordinal,
      area: impact.area,
      effect: impact.effect,
      severity: impact.severity,
      summary: impact.summary,
      relatedRuleKeys: [...impact.relatedRuleKeys],
      relatedTaskIds: [...impact.relatedTaskIds],
    })),
  });
}

export function simulateImpact(input: ImpactSimulationInput): ImpactSimulationRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Impact Simulation input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['impacts','plan','projectRules'])) {
    throw new TypeError('Impact Simulation input accepts only plan, projectRules and impacts.');
  }
  assertCanonicalPlan(row.plan);
  const plan = row.plan;
  assertCanonicalProjectRules(row.projectRules, plan);
  const projectRules = row.projectRules;
  if (!Array.isArray(row.impacts) || row.impacts.length > IMPACT_SIMULATION_MAX_IMPACTS) {
    throw new RangeError(`Impact Simulation accepts at most ${IMPACT_SIMULATION_MAX_IMPACTS} explicit impacts.`);
  }
  const ruleKeys = new Set<string>((projectRules.rules as readonly ProjectRule[]).map((rule) => rule.key));
  const taskIds = new Set<string>(plan.taskOrder);
  const impacts = Object.freeze(row.impacts.map((impact, index) => canonicalImpact(impact, index, ruleKeys, taskIds)));
  const digestHex = sha256Hex(canonicalImpactMaterial(plan, projectRules, impacts));
  const impactDigest = Object.freeze({ algorithm: IMPACT_SIMULATION_DIGEST_ALGORITHM, hex: digestHex });

  return Object.freeze({
    schema: IMPACT_SIMULATION_SCHEMA,
    sourcePlanSchema: IMPACT_SIMULATION_SOURCE_PLAN_SCHEMA,
    sourceProjectRulesSchema: IMPACT_SIMULATION_SOURCE_RULES_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: Object.freeze({ algorithm: plan.authorityDigest.algorithm, hex: plan.authorityDigest.hex }),
    sourceProjectRulesId: projectRules.id,
    sourceProjectRulesDigest: Object.freeze({ algorithm: projectRules.rulesDigest.algorithm, hex: projectRules.rulesDigest.hex }),
    id: `impact-simulation-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: IMPACT_SIMULATION_MODE,
    status: 'simulated',
    workspaceId: projectRules.workspaceId,
    impacts,
    impactDigest,
    readOnly: true,
    planReadOnlyPreserved: true,
    projectRulesReadOnlyPreserved: true,
    workspaceScoped: true,
    explicitImpactsOnly: true,
    semanticInference: false,
    automaticEvaluation: false,
    impactSimulationApplied: true,
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
