import {
  PLAN_AUTHORITY_SCHEMA,
  type PlanAuthorityDigest,
  type PlanAuthorityRecord,
  type PlanTask,
} from '@github-decrypter/plan/authority';
import {
  PROJECT_RULES_SCHEMA,
  type ProjectRule,
  type ProjectRulesDigest,
  type ProjectRulesRecord,
} from '@github-decrypter/plan/project-rules';
import {
  IMPACT_SIMULATION_SCHEMA,
  type ImpactObservation,
  type ImpactSimulationDigest,
  type ImpactSimulationRecord,
} from '@github-decrypter/plan/impact-simulation';

export const packageIdentity = '@github-decrypter/build' as const;
export const BUILD_ORCHESTRATOR_BUILD = 52 as const;
export const BUILD_ORCHESTRATOR_SCHEMA = 'gd-build-orchestrator/1' as const;
export const BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1' as const;
export const BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA = 'gd-project-rules/1' as const;
export const BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA = 'gd-impact-simulation/1' as const;
export const BUILD_ORCHESTRATOR_MODE = 'BUILD' as const;
export const BUILD_ORCHESTRATOR_TRANSITION = 'PLAN_TO_BUILD' as const;
export const BUILD_ORCHESTRATOR_DIGEST_ALGORITHM = 'sha256' as const;
export const BUILD_ORCHESTRATOR_MAX_STEPS = 4096 as const;

export interface BuildOrchestratorInput {
  readonly plan: PlanAuthorityRecord;
  readonly projectRules: ProjectRulesRecord;
  readonly impactSimulation: ImpactSimulationRecord;
}

export interface BuildStep {
  readonly id: string;
  readonly ordinal: number;
  readonly sourceTaskId: string;
  readonly requirementId: string;
  readonly statement: string;
  readonly sourceStartLine: number;
  readonly sourceEndLine: number;
  readonly dependsOn: readonly string[];
}

export interface BuildOrchestratorDigest {
  readonly algorithm: typeof BUILD_ORCHESTRATOR_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface BuildOrchestratorRecord {
  readonly schema: typeof BUILD_ORCHESTRATOR_SCHEMA;
  readonly sourcePlanSchema: typeof BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA;
  readonly sourceProjectRulesSchema: typeof BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA;
  readonly sourceImpactSimulationSchema: typeof BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA;
  readonly sourcePlanId: string;
  readonly sourcePlanDigest: PlanAuthorityDigest;
  readonly sourcePlanStatus: 'approved';
  readonly sourceProjectRulesId: string;
  readonly sourceProjectRulesDigest: ProjectRulesDigest;
  readonly sourceImpactSimulationId: string;
  readonly sourceImpactSimulationDigest: ImpactSimulationDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof BUILD_ORCHESTRATOR_MODE;
  readonly status: 'orchestrated';
  readonly transition: typeof BUILD_ORCHESTRATOR_TRANSITION;
  readonly workspaceId: string;
  readonly steps: readonly BuildStep[];
  readonly buildOrder: readonly string[];
  readonly orchestrationDigest: BuildOrchestratorDigest;
  readonly immutable: true;
  readonly sourcePlanReadOnlyPreserved: true;
  readonly projectRulesReadOnlyPreserved: true;
  readonly impactSimulationReadOnlyPreserved: true;
  readonly workspaceScoped: true;
  readonly explicitTransition: true;
  readonly buildTransitionAuthorized: true;
  readonly buildOrchestration: true;
  readonly capabilitiesRequired: true;
  readonly scopeLockRequired: true;
  readonly mutationAuthorized: false;
  readonly toolExecution: false;
  readonly scopeIntelligence: false;
  readonly scopeLock: false;
  readonly checkpoints: false;
  readonly validationPipeline: false;
  readonly execution: false;
  readonly scheduling: false;
  readonly jobCreation: false;
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

function assertCanonicalApprovedPlan(value: unknown): asserts value is PlanAuthorityRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Build Orchestrator requires a canonical approved Plan Authority record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PLAN_AUTHORITY_SCHEMA || row.sourceSpecSchema !== 'gd-requirement-spec/1'
      || row.sourceGraphSchema !== 'gd-task-graph/1' || row.revision !== 1 || row.mode !== 'PLAN'
      || row.status !== 'approved' || row.approved !== true || row.readOnly !== true
      || row.runtimeReadOnlyRequired !== true || row.planAuthority !== true || !Array.isArray(row.tasks)
      || !Array.isArray(row.taskOrder) || !Array.isArray(row.supportingRequirementIds)) {
    throw new TypeError('Build Orchestrator requires a canonical approved Plan Authority record.');
  }
  for (const [field, expected] of Object.entries({
    buildTransitionAuthorized: false, decisionEngineApplied: false, projectRulesApplied: false,
    impactSimulationApplied: false, buildOrchestration: false, toolExecution: false,
    scopeLock: false, execution: false, scheduling: false, persistence: false,
  })) if (row[field] !== expected) throw new TypeError(`Build Orchestrator source Plan ${field} boundary is invalid.`);

  const digest = row.authorityDigest as Record<string, unknown> | undefined;
  if (!digest || digest.algorithm !== BUILD_ORCHESTRATOR_DIGEST_ALGORITHM || typeof digest.hex !== 'string'
      || !/^[0-9a-f]{64}$/.test(digest.hex)) throw new TypeError('Build Orchestrator source Plan authority digest is invalid.');
  const tasks = row.tasks as unknown[];
  if (tasks.length > BUILD_ORCHESTRATOR_MAX_STEPS) throw new RangeError(`Build Orchestrator accepts at most ${BUILD_ORCHESTRATOR_MAX_STEPS} Plan tasks.`);
  const taskIds = new Set<string>();
  tasks.forEach((task, index) => {
    if (!task || typeof task !== 'object' || Array.isArray(task)) throw new TypeError(`Build Orchestrator source Plan task ${index + 1} is invalid.`);
    const item = task as Record<string, unknown>;
    const expectedId = `task-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.requirementId !== 'string'
        || !/^req-\d{4}$/.test(item.requirementId) || typeof item.statement !== 'string' || item.statement.trim().length === 0
        || !Number.isInteger(item.sourceStartLine) || !Number.isInteger(item.sourceEndLine) || !Array.isArray(item.dependsOn)) {
      throw new TypeError(`Build Orchestrator source Plan task ${expectedId} is non-canonical.`);
    }
    for (const dependency of item.dependsOn) if (typeof dependency !== 'string' || !/^task-\d{4}$/.test(dependency)) {
      throw new TypeError(`Build Orchestrator source Plan task ${expectedId} dependency is invalid.`);
    }
    taskIds.add(expectedId);
  });
  const order = row.taskOrder as unknown[];
  if (order.length !== taskIds.size || new Set(order).size !== order.length || order.some((id) => typeof id !== 'string' || !taskIds.has(id))) {
    throw new TypeError('Build Orchestrator source Plan task order is invalid.');
  }
  const orderIndex = new Map<string, number>((order as string[]).map((id, index) => [id, index]));
  for (const task of tasks as PlanTask[]) for (const dependency of task.dependsOn) {
    if (!taskIds.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(task.id) ?? -1)) {
      throw new TypeError(`Build Orchestrator source Plan task ${task.id} dependency order is invalid.`);
    }
  }
  const expectedDigest = sha256Hex(canonicalPlanMaterial(value as PlanAuthorityRecord));
  if (digest.hex !== expectedDigest || row.id !== `plan-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Build Orchestrator source Plan authority digest does not match canonical Plan material.');
  }
}

function canonicalRulesMaterial(rules: ProjectRulesRecord): string {
  return JSON.stringify({
    schema: PROJECT_RULES_SCHEMA,
    sourcePlanSchema: rules.sourcePlanSchema,
    sourcePlanId: rules.sourcePlanId,
    sourcePlanDigest: rules.sourcePlanDigest,
    workspaceId: rules.workspaceId,
    rules: rules.rules.map((rule) => ({ id: rule.id, ordinal: rule.ordinal, key: rule.key, kind: rule.kind, statement: rule.statement })),
  });
}

function assertCanonicalProjectRules(value: unknown, plan: PlanAuthorityRecord): asserts value is ProjectRulesRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Build Orchestrator requires canonical Project Rules.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PROJECT_RULES_SCHEMA || row.sourcePlanSchema !== BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA
      || row.sourcePlanId !== plan.id || row.revision !== 1 || row.mode !== 'PLAN' || row.status !== 'bound'
      || row.readOnly !== true || row.planReadOnlyPreserved !== true || row.workspaceScoped !== true
      || row.explicitRulesOnly !== true || row.semanticInference !== false || row.automaticEvaluation !== false
      || row.projectRulesApplied !== true || row.impactSimulationApplied !== false
      || row.buildTransitionAuthorized !== false || row.buildOrchestration !== false || row.toolExecution !== false
      || row.scopeIntelligence !== false || row.scopeLock !== false || row.checkpoints !== false
      || row.validationPipeline !== false || row.execution !== false || row.scheduling !== false
      || row.persistence !== false || !Array.isArray(row.rules)) {
    throw new TypeError('Build Orchestrator requires canonical Project Rules bound to the approved Plan identity.');
  }
  const sourceDigest = row.sourcePlanDigest as Record<string, unknown> | undefined;
  if (!sourceDigest || sourceDigest.algorithm !== BUILD_ORCHESTRATOR_DIGEST_ALGORITHM || sourceDigest.hex !== plan.authorityDigest.hex) {
    throw new TypeError('Build Orchestrator Project Rules source Plan digest does not match the approved Plan.');
  }
  if (typeof row.workspaceId !== 'string' || row.workspaceId.length === 0) throw new TypeError('Build Orchestrator Project Rules workspace is invalid.');
  const rules = row.rules as unknown[];
  const keys = new Set<string>();
  rules.forEach((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new TypeError(`Build Orchestrator Project Rule ${index + 1} is invalid.`);
    const item = rule as Record<string, unknown>;
    const expectedId = `rule-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.key !== 'string'
        || !/^[a-z0-9][a-z0-9._-]*$/.test(item.key) || !['require','forbid','prefer'].includes(String(item.kind))
        || typeof item.statement !== 'string' || item.statement.trim().length === 0 || keys.has(item.key)) {
      throw new TypeError(`Build Orchestrator Project Rule ${expectedId} is non-canonical.`);
    }
    keys.add(item.key);
  });
  const digest = row.rulesDigest as Record<string, unknown> | undefined;
  const expectedDigest = sha256Hex(canonicalRulesMaterial(value as ProjectRulesRecord));
  if (!digest || digest.algorithm !== BUILD_ORCHESTRATOR_DIGEST_ALGORITHM || digest.hex !== expectedDigest
      || row.id !== `project-rules-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Build Orchestrator Project Rules digest does not match canonical Project Rules material.');
  }
}

function canonicalImpactMaterial(simulation: ImpactSimulationRecord): string {
  return JSON.stringify({
    schema: IMPACT_SIMULATION_SCHEMA,
    sourcePlanSchema: simulation.sourcePlanSchema,
    sourceProjectRulesSchema: simulation.sourceProjectRulesSchema,
    sourcePlanId: simulation.sourcePlanId,
    sourcePlanDigest: simulation.sourcePlanDigest,
    sourceProjectRulesId: simulation.sourceProjectRulesId,
    sourceProjectRulesDigest: simulation.sourceProjectRulesDigest,
    workspaceId: simulation.workspaceId,
    impacts: simulation.impacts.map((impact) => ({
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

function assertCanonicalImpactSimulation(
  value: unknown,
  plan: PlanAuthorityRecord,
  projectRules: ProjectRulesRecord,
): asserts value is ImpactSimulationRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Build Orchestrator requires canonical Impact Simulation.');
  const row = value as Record<string, unknown>;
  if (row.schema !== IMPACT_SIMULATION_SCHEMA || row.sourcePlanSchema !== BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA
      || row.sourceProjectRulesSchema !== BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA || row.sourcePlanId !== plan.id
      || row.sourceProjectRulesId !== projectRules.id || row.revision !== 1 || row.mode !== 'PLAN' || row.status !== 'simulated'
      || row.workspaceId !== projectRules.workspaceId || row.readOnly !== true || row.planReadOnlyPreserved !== true
      || row.projectRulesReadOnlyPreserved !== true || row.workspaceScoped !== true || row.explicitImpactsOnly !== true
      || row.semanticInference !== false || row.automaticEvaluation !== false || row.impactSimulationApplied !== true
      || row.buildTransitionAuthorized !== false || row.buildOrchestration !== false || row.toolExecution !== false
      || row.scopeIntelligence !== false || row.scopeLock !== false || row.checkpoints !== false
      || row.validationPipeline !== false || row.execution !== false || row.scheduling !== false
      || row.persistence !== false || !Array.isArray(row.impacts)) {
    throw new TypeError('Build Orchestrator requires canonical Impact Simulation bound to the approved Plan and Project Rules identities.');
  }
  const planDigest = row.sourcePlanDigest as Record<string, unknown> | undefined;
  const rulesDigest = row.sourceProjectRulesDigest as Record<string, unknown> | undefined;
  if (!planDigest || planDigest.algorithm !== BUILD_ORCHESTRATOR_DIGEST_ALGORITHM || planDigest.hex !== plan.authorityDigest.hex
      || !rulesDigest || rulesDigest.algorithm !== BUILD_ORCHESTRATOR_DIGEST_ALGORITHM || rulesDigest.hex !== projectRules.rulesDigest.hex) {
    throw new TypeError('Build Orchestrator Impact Simulation source digests do not match the approved Plan and Project Rules.');
  }
  const taskIds = new Set(plan.taskOrder);
  const ruleKeys = new Set((projectRules.rules as readonly ProjectRule[]).map((rule) => rule.key));
  (row.impacts as unknown[]).forEach((impact, index) => {
    if (!impact || typeof impact !== 'object' || Array.isArray(impact)) throw new TypeError(`Build Orchestrator Impact ${index + 1} is invalid.`);
    const item = impact as Record<string, unknown>;
    const expectedId = `impact-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.area !== 'string' || item.area.length === 0
        || !['positive','neutral','negative'].includes(String(item.effect)) || !['low','medium','high','critical'].includes(String(item.severity))
        || typeof item.summary !== 'string' || item.summary.length === 0 || !Array.isArray(item.relatedRuleKeys) || !Array.isArray(item.relatedTaskIds)) {
      throw new TypeError(`Build Orchestrator Impact ${expectedId} is non-canonical.`);
    }
    const relatedRuleKeys = item.relatedRuleKeys as unknown[];
    const relatedTaskIds = item.relatedTaskIds as unknown[];
    if (new Set(relatedRuleKeys).size !== relatedRuleKeys.length || relatedRuleKeys.some((key) => typeof key !== 'string' || !ruleKeys.has(key))) {
      throw new TypeError(`Build Orchestrator Impact ${expectedId} has invalid Project Rule references.`);
    }
    if (new Set(relatedTaskIds).size !== relatedTaskIds.length || relatedTaskIds.some((id) => typeof id !== 'string' || !taskIds.has(id))) {
      throw new TypeError(`Build Orchestrator Impact ${expectedId} has invalid Plan task references.`);
    }
  });
  const digest = row.impactDigest as Record<string, unknown> | undefined;
  const expectedDigest = sha256Hex(canonicalImpactMaterial(value as ImpactSimulationRecord));
  if (!digest || digest.algorithm !== BUILD_ORCHESTRATOR_DIGEST_ALGORITHM || digest.hex !== expectedDigest
      || row.id !== `impact-simulation-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Build Orchestrator Impact Simulation digest does not match canonical Impact material.');
  }
}

function buildStepFromTask(task: PlanTask, taskToStep: ReadonlyMap<string, string>): BuildStep {
  return Object.freeze({
    id: taskToStep.get(task.id)!,
    ordinal: task.ordinal,
    sourceTaskId: task.id,
    requirementId: task.requirementId,
    statement: task.statement,
    sourceStartLine: task.sourceStartLine,
    sourceEndLine: task.sourceEndLine,
    dependsOn: Object.freeze(task.dependsOn.map((dependency) => taskToStep.get(dependency)!)),
  });
}

function canonicalOrchestrationMaterial(
  plan: PlanAuthorityRecord,
  projectRules: ProjectRulesRecord,
  impactSimulation: ImpactSimulationRecord,
  steps: readonly BuildStep[],
  buildOrder: readonly string[],
): string {
  return JSON.stringify({
    schema: BUILD_ORCHESTRATOR_SCHEMA,
    sourcePlanSchema: BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA,
    sourceProjectRulesSchema: BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA,
    sourceImpactSimulationSchema: BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: plan.authorityDigest,
    sourcePlanStatus: 'approved',
    sourceProjectRulesId: projectRules.id,
    sourceProjectRulesDigest: projectRules.rulesDigest,
    sourceImpactSimulationId: impactSimulation.id,
    sourceImpactSimulationDigest: impactSimulation.impactDigest,
    mode: BUILD_ORCHESTRATOR_MODE,
    transition: BUILD_ORCHESTRATOR_TRANSITION,
    workspaceId: projectRules.workspaceId,
    steps: steps.map((step) => ({
      id: step.id,
      ordinal: step.ordinal,
      sourceTaskId: step.sourceTaskId,
      requirementId: step.requirementId,
      statement: step.statement,
      sourceStartLine: step.sourceStartLine,
      sourceEndLine: step.sourceEndLine,
      dependsOn: [...step.dependsOn],
    })),
    buildOrder: [...buildOrder],
  });
}

export function orchestrateBuild(input: BuildOrchestratorInput): BuildOrchestratorRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Build Orchestrator input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['impactSimulation','plan','projectRules'])) {
    throw new TypeError('Build Orchestrator input accepts only plan, projectRules and impactSimulation.');
  }
  assertCanonicalApprovedPlan(row.plan);
  const plan = row.plan;
  assertCanonicalProjectRules(row.projectRules, plan);
  const projectRules = row.projectRules;
  assertCanonicalImpactSimulation(row.impactSimulation, plan, projectRules);
  const impactSimulation = row.impactSimulation;

  const taskToStep = new Map<string, string>(plan.tasks.map((task) => [task.id, `build-step-${String(task.ordinal).padStart(4, '0')}`]));
  const steps = Object.freeze(plan.tasks.map((task) => buildStepFromTask(task, taskToStep)));
  const buildOrder = Object.freeze(plan.taskOrder.map((taskId) => taskToStep.get(taskId)!));
  const digestHex = sha256Hex(canonicalOrchestrationMaterial(plan, projectRules, impactSimulation, steps, buildOrder));
  const orchestrationDigest = Object.freeze({ algorithm: BUILD_ORCHESTRATOR_DIGEST_ALGORITHM, hex: digestHex });

  return Object.freeze({
    schema: BUILD_ORCHESTRATOR_SCHEMA,
    sourcePlanSchema: BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA,
    sourceProjectRulesSchema: BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA,
    sourceImpactSimulationSchema: BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: Object.freeze({ algorithm: plan.authorityDigest.algorithm, hex: plan.authorityDigest.hex }),
    sourcePlanStatus: 'approved',
    sourceProjectRulesId: projectRules.id,
    sourceProjectRulesDigest: Object.freeze({ algorithm: projectRules.rulesDigest.algorithm, hex: projectRules.rulesDigest.hex }),
    sourceImpactSimulationId: impactSimulation.id,
    sourceImpactSimulationDigest: Object.freeze({ algorithm: impactSimulation.impactDigest.algorithm, hex: impactSimulation.impactDigest.hex }),
    id: `build-orchestration-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: BUILD_ORCHESTRATOR_MODE,
    status: 'orchestrated',
    transition: BUILD_ORCHESTRATOR_TRANSITION,
    workspaceId: projectRules.workspaceId,
    steps,
    buildOrder,
    orchestrationDigest,
    immutable: true,
    sourcePlanReadOnlyPreserved: true,
    projectRulesReadOnlyPreserved: true,
    impactSimulationReadOnlyPreserved: true,
    workspaceScoped: true,
    explicitTransition: true,
    buildTransitionAuthorized: true,
    buildOrchestration: true,
    capabilitiesRequired: true,
    scopeLockRequired: true,
    mutationAuthorized: false,
    toolExecution: false,
    scopeIntelligence: false,
    scopeLock: false,
    checkpoints: false,
    validationPipeline: false,
    execution: false,
    scheduling: false,
    jobCreation: false,
    persistence: false,
  });
}
