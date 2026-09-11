import {
  BUILD_ORCHESTRATOR_DIGEST_ALGORITHM,
  BUILD_ORCHESTRATOR_MODE,
  BUILD_ORCHESTRATOR_SCHEMA,
  BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA,
  BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA,
  BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA,
  BUILD_ORCHESTRATOR_TRANSITION,
  type BuildOrchestratorRecord,
  type BuildStep,
} from '@github-decrypter/build';

export const packageIdentity = '@github-decrypter/scope' as const;
export const SCOPE_INTELLIGENCE_BUILD = 54 as const;
export const SCOPE_INTELLIGENCE_SCHEMA = 'gd-scope-intelligence/1' as const;
export const SCOPE_INTELLIGENCE_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1' as const;
export const SCOPE_INTELLIGENCE_MODE = 'BUILD' as const;
export const SCOPE_INTELLIGENCE_DIGEST_ALGORITHM = 'sha256' as const;
export const SCOPE_INTELLIGENCE_MAX_CANDIDATES = 4096 as const;
export const SCOPE_INTELLIGENCE_MAX_TEXT = 65_536 as const;
export const SCOPE_INTELLIGENCE_MAX_KEY = 128 as const;
export const SCOPE_INTELLIGENCE_MAX_RESOURCE = 1024 as const;
export const SCOPE_ACCESS_KINDS = Object.freeze(['read', 'write', 'execute'] as const);

export type ScopeAccess = (typeof SCOPE_ACCESS_KINDS)[number];

export interface ScopeCandidateInput {
  readonly key: string;
  readonly buildStepId: string;
  readonly resource: string;
  readonly access: ScopeAccess;
  readonly rationale: string;
}

export interface ScopeIntelligenceInput {
  readonly orchestration: BuildOrchestratorRecord;
  readonly candidates: readonly ScopeCandidateInput[];
}

export interface ScopeCandidate {
  readonly id: string;
  readonly ordinal: number;
  readonly key: string;
  readonly buildStepId: string;
  readonly resource: string;
  readonly access: ScopeAccess;
  readonly rationale: string;
}

export interface ScopeIntelligenceDigest {
  readonly algorithm: typeof SCOPE_INTELLIGENCE_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ScopeIntelligenceRecord {
  readonly schema: typeof SCOPE_INTELLIGENCE_SCHEMA;
  readonly sourceBuildSchema: typeof SCOPE_INTELLIGENCE_SOURCE_BUILD_SCHEMA;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: ScopeIntelligenceDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof SCOPE_INTELLIGENCE_MODE;
  readonly status: 'analyzed';
  readonly workspaceId: string;
  readonly candidates: readonly ScopeCandidate[];
  readonly coveredBuildStepIds: readonly string[];
  readonly uncoveredBuildStepIds: readonly string[];
  readonly writeCandidateIds: readonly string[];
  readonly executeCandidateIds: readonly string[];
  readonly scopeDigest: ScopeIntelligenceDigest;
  readonly immutable: true;
  readonly sourceOrchestrationReadOnlyPreserved: true;
  readonly workspaceScoped: true;
  readonly advisoryOnly: true;
  readonly explicitCandidatesOnly: true;
  readonly semanticInference: false;
  readonly automaticDiscovery: false;
  readonly scopeIntelligence: true;
  readonly scopeLockRequired: true;
  readonly scopeLock: false;
  readonly scopeLocked: false;
  readonly mutationAuthorized: false;
  readonly capabilityGrantAuthority: false;
  readonly toolExecution: false;
  readonly checkpoints: false;
  readonly validationPipeline: false;
  readonly execution: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly studioTransport: false;
  readonly localRuntimeTransport: false;
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

function canonicalOrchestrationMaterial(orchestration: BuildOrchestratorRecord): string {
  return JSON.stringify({
    schema: BUILD_ORCHESTRATOR_SCHEMA,
    sourcePlanSchema: BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA,
    sourceProjectRulesSchema: BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA,
    sourceImpactSimulationSchema: BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA,
    sourcePlanId: orchestration.sourcePlanId,
    sourcePlanDigest: orchestration.sourcePlanDigest,
    sourcePlanStatus: 'approved',
    sourceProjectRulesId: orchestration.sourceProjectRulesId,
    sourceProjectRulesDigest: orchestration.sourceProjectRulesDigest,
    sourceImpactSimulationId: orchestration.sourceImpactSimulationId,
    sourceImpactSimulationDigest: orchestration.sourceImpactSimulationDigest,
    mode: BUILD_ORCHESTRATOR_MODE,
    transition: BUILD_ORCHESTRATOR_TRANSITION,
    workspaceId: orchestration.workspaceId,
    steps: orchestration.steps.map((step) => ({
      id: step.id,
      ordinal: step.ordinal,
      sourceTaskId: step.sourceTaskId,
      requirementId: step.requirementId,
      statement: step.statement,
      sourceStartLine: step.sourceStartLine,
      sourceEndLine: step.sourceEndLine,
      dependsOn: [...step.dependsOn],
    })),
    buildOrder: [...orchestration.buildOrder],
  });
}

function assertCanonicalOrchestration(value: unknown): asserts value is BuildOrchestratorRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Scope Intelligence requires a canonical Build Orchestrator record.');
  }
  const row = value as Record<string, unknown>;
  if (row.schema !== BUILD_ORCHESTRATOR_SCHEMA
      || row.sourcePlanSchema !== BUILD_ORCHESTRATOR_SOURCE_PLAN_SCHEMA
      || row.sourceProjectRulesSchema !== BUILD_ORCHESTRATOR_SOURCE_RULES_SCHEMA
      || row.sourceImpactSimulationSchema !== BUILD_ORCHESTRATOR_SOURCE_IMPACT_SCHEMA
      || row.sourcePlanStatus !== 'approved'
      || row.revision !== 1
      || row.mode !== BUILD_ORCHESTRATOR_MODE
      || row.status !== 'orchestrated'
      || row.transition !== BUILD_ORCHESTRATOR_TRANSITION
      || typeof row.workspaceId !== 'string' || row.workspaceId.length === 0
      || !Array.isArray(row.steps) || !Array.isArray(row.buildOrder)
      || row.immutable !== true || row.sourcePlanReadOnlyPreserved !== true
      || row.projectRulesReadOnlyPreserved !== true || row.impactSimulationReadOnlyPreserved !== true
      || row.workspaceScoped !== true || row.explicitTransition !== true
      || row.buildTransitionAuthorized !== true || row.buildOrchestration !== true
      || row.capabilitiesRequired !== true || row.scopeLockRequired !== true
      || row.mutationAuthorized !== false || row.toolExecution !== false
      || row.scopeIntelligence !== false || row.scopeLock !== false || row.checkpoints !== false
      || row.validationPipeline !== false || row.execution !== false || row.scheduling !== false
      || row.jobCreation !== false || row.persistence !== false) {
    throw new TypeError('Scope Intelligence requires a canonical pre-scope Build Orchestrator record.');
  }

  const steps = row.steps as unknown[];
  const stepIds = new Set<string>();
  steps.forEach((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new TypeError(`Scope Intelligence source build step ${index + 1} is invalid.`);
    }
    const item = step as Record<string, unknown>;
    const expectedId = `build-step-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1
        || item.sourceTaskId !== `task-${String(index + 1).padStart(4, '0')}`
        || typeof item.requirementId !== 'string' || !/^req-\d{4}$/.test(item.requirementId)
        || typeof item.statement !== 'string' || item.statement.trim().length === 0
        || !Number.isInteger(item.sourceStartLine) || !Number.isInteger(item.sourceEndLine)
        || !Array.isArray(item.dependsOn)) {
      throw new TypeError(`Scope Intelligence source build step ${expectedId} is non-canonical.`);
    }
    for (const dependency of item.dependsOn) {
      if (typeof dependency !== 'string' || !/^build-step-\d{4}$/.test(dependency)) {
        throw new TypeError(`Scope Intelligence source build step ${expectedId} dependency is invalid.`);
      }
    }
    stepIds.add(expectedId);
  });

  const order = row.buildOrder as unknown[];
  if (order.length !== stepIds.size || new Set(order).size !== order.length
      || order.some((id) => typeof id !== 'string' || !stepIds.has(id))) {
    throw new TypeError('Scope Intelligence source build order is invalid.');
  }
  const orderIndex = new Map<string, number>((order as string[]).map((id, index) => [id, index]));
  for (const step of steps as BuildStep[]) {
    for (const dependency of step.dependsOn) {
      if (!stepIds.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(step.id) ?? -1)) {
        throw new TypeError(`Scope Intelligence source build step ${step.id} dependency order is invalid.`);
      }
    }
  }

  const digest = row.orchestrationDigest as Record<string, unknown> | undefined;
  const orchestration = value as BuildOrchestratorRecord;
  const expectedDigest = sha256Hex(canonicalOrchestrationMaterial(orchestration));
  if (!digest || digest.algorithm !== BUILD_ORCHESTRATOR_DIGEST_ALGORITHM || digest.hex !== expectedDigest
      || row.id !== `build-orchestration-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Scope Intelligence source orchestration digest does not match canonical material.');
  }
}

function normalizeText(value: unknown, label: string, max: number = SCOPE_INTELLIGENCE_MAX_TEXT): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > max) throw new RangeError(`${label} exceeds ${max} characters.`);
  return normalized;
}

function normalizeKey(value: unknown): string {
  const key = normalizeText(value, 'Scope candidate key', SCOPE_INTELLIGENCE_MAX_KEY).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(key)) {
    throw new TypeError('Scope candidate key must be an opaque lowercase identifier.');
  }
  return key;
}

function normalizeAccess(value: unknown): ScopeAccess {
  if (typeof value !== 'string') throw new TypeError('Scope candidate access must be a string.');
  const access = value.trim().toLowerCase();
  if (!(SCOPE_ACCESS_KINDS as readonly string[]).includes(access)) {
    throw new TypeError(`Scope candidate access must be one of: ${SCOPE_ACCESS_KINDS.join(', ')}.`);
  }
  return access as ScopeAccess;
}

function normalizeCandidate(
  value: unknown,
  index: number,
  buildStepIds: ReadonlySet<string>,
): ScopeCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Scope candidate ${index + 1} must be an object.`);
  }
  const row = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['access','buildStepId','key','rationale','resource'])) {
    throw new TypeError(`Scope candidate ${index + 1} accepts only key, buildStepId, resource, access and rationale.`);
  }
  const buildStepId = normalizeText(row.buildStepId, `Scope candidate ${index + 1} buildStepId`, 64);
  if (!buildStepIds.has(buildStepId)) {
    throw new TypeError(`Scope candidate ${index + 1} references an unknown build step.`);
  }
  return Object.freeze({
    id: `scope-candidate-${String(index + 1).padStart(4, '0')}`,
    ordinal: index + 1,
    key: normalizeKey(row.key),
    buildStepId,
    resource: normalizeText(row.resource, `Scope candidate ${index + 1} resource`, SCOPE_INTELLIGENCE_MAX_RESOURCE),
    access: normalizeAccess(row.access),
    rationale: normalizeText(row.rationale, `Scope candidate ${index + 1} rationale`),
  });
}

function canonicalScopeMaterial(
  orchestration: BuildOrchestratorRecord,
  candidates: readonly ScopeCandidate[],
  coveredBuildStepIds: readonly string[],
  uncoveredBuildStepIds: readonly string[],
  writeCandidateIds: readonly string[],
  executeCandidateIds: readonly string[],
): string {
  return JSON.stringify({
    schema: SCOPE_INTELLIGENCE_SCHEMA,
    sourceBuildSchema: SCOPE_INTELLIGENCE_SOURCE_BUILD_SCHEMA,
    sourceOrchestrationId: orchestration.id,
    sourceOrchestrationDigest: orchestration.orchestrationDigest,
    mode: SCOPE_INTELLIGENCE_MODE,
    workspaceId: orchestration.workspaceId,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      ordinal: candidate.ordinal,
      key: candidate.key,
      buildStepId: candidate.buildStepId,
      resource: candidate.resource,
      access: candidate.access,
      rationale: candidate.rationale,
    })),
    coveredBuildStepIds: [...coveredBuildStepIds],
    uncoveredBuildStepIds: [...uncoveredBuildStepIds],
    writeCandidateIds: [...writeCandidateIds],
    executeCandidateIds: [...executeCandidateIds],
  });
}

export function analyzeScope(input: ScopeIntelligenceInput): ScopeIntelligenceRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Scope Intelligence input must be an object.');
  }
  const row = input as unknown as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['candidates','orchestration'])) {
    throw new TypeError('Scope Intelligence input accepts only orchestration and candidates.');
  }
  assertCanonicalOrchestration(row.orchestration);
  const orchestration = row.orchestration;
  if (!Array.isArray(row.candidates)) throw new TypeError('Scope Intelligence candidates must be an array.');
  if (row.candidates.length > SCOPE_INTELLIGENCE_MAX_CANDIDATES) {
    throw new RangeError(`Scope Intelligence accepts at most ${SCOPE_INTELLIGENCE_MAX_CANDIDATES} candidates.`);
  }

  const buildStepIds = new Set(orchestration.buildOrder);
  const candidates = Object.freeze(row.candidates.map((candidate, index) => normalizeCandidate(candidate, index, buildStepIds)));
  const keys = new Set<string>();
  for (const candidate of candidates) {
    if (keys.has(candidate.key)) throw new TypeError(`Duplicate Scope candidate key: ${candidate.key}`);
    keys.add(candidate.key);
  }

  const coveredSet = new Set(candidates.map((candidate) => candidate.buildStepId));
  const coveredBuildStepIds = Object.freeze(orchestration.buildOrder.filter((id) => coveredSet.has(id)));
  const uncoveredBuildStepIds = Object.freeze(orchestration.buildOrder.filter((id) => !coveredSet.has(id)));
  const writeCandidateIds = Object.freeze(candidates.filter((candidate) => candidate.access === 'write').map((candidate) => candidate.id));
  const executeCandidateIds = Object.freeze(candidates.filter((candidate) => candidate.access === 'execute').map((candidate) => candidate.id));
  const digestHex = sha256Hex(canonicalScopeMaterial(
    orchestration,
    candidates,
    coveredBuildStepIds,
    uncoveredBuildStepIds,
    writeCandidateIds,
    executeCandidateIds,
  ));
  const scopeDigest = Object.freeze({ algorithm: SCOPE_INTELLIGENCE_DIGEST_ALGORITHM, hex: digestHex });

  return Object.freeze({
    schema: SCOPE_INTELLIGENCE_SCHEMA,
    sourceBuildSchema: SCOPE_INTELLIGENCE_SOURCE_BUILD_SCHEMA,
    sourceOrchestrationId: orchestration.id,
    sourceOrchestrationDigest: Object.freeze({
      algorithm: orchestration.orchestrationDigest.algorithm,
      hex: orchestration.orchestrationDigest.hex,
    }),
    id: `scope-intelligence-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: SCOPE_INTELLIGENCE_MODE,
    status: 'analyzed',
    workspaceId: orchestration.workspaceId,
    candidates,
    coveredBuildStepIds,
    uncoveredBuildStepIds,
    writeCandidateIds,
    executeCandidateIds,
    scopeDigest,
    immutable: true,
    sourceOrchestrationReadOnlyPreserved: true,
    workspaceScoped: true,
    advisoryOnly: true,
    explicitCandidatesOnly: true,
    semanticInference: false,
    automaticDiscovery: false,
    scopeIntelligence: true,
    scopeLockRequired: true,
    scopeLock: false,
    scopeLocked: false,
    mutationAuthorized: false,
    capabilityGrantAuthority: false,
    toolExecution: false,
    checkpoints: false,
    validationPipeline: false,
    execution: false,
    scheduling: false,
    jobCreation: false,
    persistence: false,
    networkAuthority: false,
    filesystemAuthority: false,
    databaseAuthority: false,
    studioTransport: false,
    localRuntimeTransport: false,
  });
}
