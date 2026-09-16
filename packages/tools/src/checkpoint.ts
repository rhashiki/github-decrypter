import {
  BUILD_ORCHESTRATOR_SCHEMA,
  type BuildOrchestratorRecord,
  type BuildStep,
} from '@github-decrypter/build';
import {
  SCOPE_LOCK_SCHEMA,
  assertCanonicalScopeLock,
  assertScopeLockAllowsMutation,
  type ScopeLockRecord,
  type ScopeMutationAccess,
} from '@github-decrypter/scope/lock';
import {
  TOOL_RUNTIME_CAPABILITIES,
  TOOL_RUNTIME_COMPLETION_SCHEMA,
  TOOL_RUNTIME_DIGEST_ALGORITHM,
  TOOL_RUNTIME_SCHEMA,
  type ToolCapability,
  type ToolInvocationRecord,
  type ToolValue,
} from './index.js';

export const CHECKPOINT_ENGINE_BUILD = 56 as const;
export const CHECKPOINT_ENGINE_SCHEMA = 'gd-checkpoint-engine/1' as const;
export const CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1' as const;
export const CHECKPOINT_ENGINE_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1' as const;
export const CHECKPOINT_ENGINE_SOURCE_SCOPE_LOCK_SCHEMA = 'gd-scope-lock/1' as const;
export const CHECKPOINT_ENGINE_MODE = 'BUILD' as const;
export const CHECKPOINT_ENGINE_DIGEST_ALGORITHM = 'sha256' as const;
export const CHECKPOINT_ENGINE_KIND = 'tool-invocation' as const;
export const CHECKPOINT_ENGINE_RECOVERY_BOUNDARY = 'after-invocation' as const;

export interface CheckpointEngineInput {
  readonly orchestration: BuildOrchestratorRecord;
  readonly invocation: ToolInvocationRecord;
  readonly scopeLock?: ScopeLockRecord;
}

export interface CheckpointDigest {
  readonly algorithm: typeof CHECKPOINT_ENGINE_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface CheckpointRecord {
  readonly schema: typeof CHECKPOINT_ENGINE_SCHEMA;
  readonly sourceBuildSchema: typeof CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA;
  readonly sourceToolRuntimeSchema: typeof CHECKPOINT_ENGINE_SOURCE_TOOL_RUNTIME_SCHEMA;
  readonly sourceScopeLockSchema: typeof CHECKPOINT_ENGINE_SOURCE_SCOPE_LOCK_SCHEMA;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: CheckpointDigest;
  readonly sourceInvocationId: string;
  readonly sourceInvocationDigest: CheckpointDigest;
  readonly sourceCompletionDigest: CheckpointDigest;
  readonly sourceScopeLockId: string | null;
  readonly sourceScopeLockDigest: CheckpointDigest | null;
  readonly sourceInvocation: ToolInvocationRecord;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof CHECKPOINT_ENGINE_MODE;
  readonly status: 'checkpointed';
  readonly checkpointKind: typeof CHECKPOINT_ENGINE_KIND;
  readonly recoveryBoundary: typeof CHECKPOINT_ENGINE_RECOVERY_BOUNDARY;
  readonly workspaceId: string;
  readonly stepId: string;
  readonly toolId: string;
  readonly scopeCandidateId: string | null;
  readonly mutationAccess: ScopeMutationAccess | null;
  readonly sourceMutationAuthorized: boolean;
  readonly inputDigest: CheckpointDigest;
  readonly resultDigest: CheckpointDigest;
  readonly checkpointDigest: CheckpointDigest;
  readonly immutable: true;
  readonly deterministic: true;
  readonly environmentNeutral: true;
  readonly workspaceScoped: true;
  readonly completedInvocationRequired: true;
  readonly sourceInvocationReadOnlyPreserved: true;
  readonly sourceOrchestrationReadOnlyPreserved: true;
  readonly sourceScopeLockReadOnlyPreserved: true;
  readonly resultDigestBinding: true;
  readonly scopeLockConsumer: true;
  readonly scopeLockRequiredForMutation: true;
  readonly recoveryAnchor: true;
  readonly durableJobEngineSovereign: true;
  readonly capabilityGrantAuthority: false;
  readonly mutationAuthorized: false;
  readonly toolExecution: false;
  readonly execution: false;
  readonly checkpoints: true;
  readonly restoreExecution: false;
  readonly validationPipeline: false;
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

function digest(hex: string): CheckpointDigest {
  return Object.freeze({ algorithm: CHECKPOINT_ENGINE_DIGEST_ALGORITHM, hex });
}

function canonicalToolValue(value: ToolValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Checkpoint Engine values must contain only finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalToolValue(item)).join(',')}]`;
  if (typeof value === 'object') {
    const row = value as { readonly [key: string]: ToolValue };
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalToolValue(row[key]!)}`).join(',')}}`;
  }
  throw new TypeError('Checkpoint Engine requires JSON-compatible Tool Runtime values.');
}

function canonicalOrchestrationMaterial(orchestration: BuildOrchestratorRecord): string {
  return JSON.stringify({
    schema: BUILD_ORCHESTRATOR_SCHEMA,
    sourcePlanSchema: orchestration.sourcePlanSchema,
    sourceProjectRulesSchema: orchestration.sourceProjectRulesSchema,
    sourceImpactSimulationSchema: orchestration.sourceImpactSimulationSchema,
    sourcePlanId: orchestration.sourcePlanId,
    sourcePlanDigest: orchestration.sourcePlanDigest,
    sourcePlanStatus: orchestration.sourcePlanStatus,
    sourceProjectRulesId: orchestration.sourceProjectRulesId,
    sourceProjectRulesDigest: orchestration.sourceProjectRulesDigest,
    sourceImpactSimulationId: orchestration.sourceImpactSimulationId,
    sourceImpactSimulationDigest: orchestration.sourceImpactSimulationDigest,
    mode: orchestration.mode,
    transition: orchestration.transition,
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Checkpoint Engine requires a canonical Build Orchestrator record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== BUILD_ORCHESTRATOR_SCHEMA || row.sourcePlanSchema !== 'gd-plan-authority/1'
      || row.sourceProjectRulesSchema !== 'gd-project-rules/1' || row.sourceImpactSimulationSchema !== 'gd-impact-simulation/1'
      || row.sourcePlanStatus !== 'approved' || row.revision !== 1 || row.mode !== CHECKPOINT_ENGINE_MODE
      || row.status !== 'orchestrated' || row.transition !== 'PLAN_TO_BUILD' || typeof row.workspaceId !== 'string'
      || row.workspaceId.length === 0 || row.immutable !== true || row.sourcePlanReadOnlyPreserved !== true
      || row.projectRulesReadOnlyPreserved !== true || row.impactSimulationReadOnlyPreserved !== true
      || row.workspaceScoped !== true || row.explicitTransition !== true || row.buildTransitionAuthorized !== true
      || row.buildOrchestration !== true || row.capabilitiesRequired !== true || row.scopeLockRequired !== true
      || row.mutationAuthorized !== false || row.toolExecution !== false || row.scopeIntelligence !== false
      || row.scopeLock !== false || row.checkpoints !== false || row.validationPipeline !== false
      || row.execution !== false || row.scheduling !== false || row.jobCreation !== false || row.persistence !== false
      || !Array.isArray(row.steps) || !Array.isArray(row.buildOrder)) {
    throw new TypeError('Checkpoint Engine requires an unmodified canonical Build 52 orchestration boundary.');
  }
  const orchestration = value as BuildOrchestratorRecord;
  const stepIds = new Set<string>();
  orchestration.steps.forEach((step, index) => {
    const expectedId = `build-step-${String(index + 1).padStart(4, '0')}`;
    if (step.id !== expectedId || step.ordinal !== index + 1 || !/^task-\d{4}$/.test(step.sourceTaskId)
        || !/^req-\d{4}$/.test(step.requirementId) || step.statement.trim().length === 0
        || !Number.isInteger(step.sourceStartLine) || !Number.isInteger(step.sourceEndLine)
        || !Array.isArray(step.dependsOn)) throw new TypeError(`Checkpoint Engine Build step ${expectedId} is non-canonical.`);
    stepIds.add(step.id);
  });
  if (orchestration.buildOrder.length !== stepIds.size || new Set(orchestration.buildOrder).size !== orchestration.buildOrder.length
      || orchestration.buildOrder.some((id) => !stepIds.has(id))) throw new TypeError('Checkpoint Engine Build order is invalid.');
  const orderIndex = new Map(orchestration.buildOrder.map((id, index) => [id, index]));
  for (const step of orchestration.steps) for (const dependency of step.dependsOn) {
    if (!stepIds.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(step.id) ?? -1)) {
      throw new TypeError(`Checkpoint Engine Build step ${step.id} dependency order is invalid.`);
    }
  }
  if (orchestration.orchestrationDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM
      || !/^[0-9a-f]{64}$/.test(orchestration.orchestrationDigest.hex)) throw new TypeError('Checkpoint Engine orchestration digest is invalid.');
  const expectedDigest = sha256Hex(canonicalOrchestrationMaterial(orchestration));
  if (orchestration.orchestrationDigest.hex !== expectedDigest || orchestration.id !== `build-orchestration-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Checkpoint Engine orchestration digest does not match canonical Build material.');
  }
}

function canonicalInvocationMaterial(orchestration: BuildOrchestratorRecord, step: BuildStep, invocation: ToolInvocationRecord): string {
  const base = {
    schema: TOOL_RUNTIME_SCHEMA,
    sourceBuildSchema: invocation.sourceBuildSchema,
    sourceOrchestrationId: orchestration.id,
    sourceOrchestrationDigest: orchestration.orchestrationDigest.hex,
    workspaceId: orchestration.workspaceId,
    stepId: step.id,
    toolId: invocation.toolId,
    requiredCapabilities: [...invocation.requiredCapabilities],
    mutating: invocation.mutationAuthorized,
    input: JSON.parse(canonicalToolValue(invocation.input)),
  };
  if (!invocation.mutationAuthorized) return JSON.stringify(base);
  return JSON.stringify({ ...base, sourceScopeLockId: invocation.sourceScopeLockId, sourceScopeLockDigest: invocation.sourceScopeLockDigest,
    scopeCandidateId: invocation.scopeCandidateId, mutationAccess: invocation.mutationAccess });
}

function canonicalCompletionMaterial(invocation: ToolInvocationRecord): string {
  return JSON.stringify({
    schema: TOOL_RUNTIME_COMPLETION_SCHEMA,
    invocationDigest: invocation.invocationDigest,
    result: JSON.parse(canonicalToolValue(invocation.result)),
  });
}

function assertCapabilities(value: readonly ToolCapability[]): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > TOOL_RUNTIME_CAPABILITIES.length) throw new TypeError('Checkpoint Engine requires canonical Tool Runtime capabilities.');
  const allowed = new Set<string>(TOOL_RUNTIME_CAPABILITIES);
  const seen = new Set<string>();
  for (const capability of value) {
    if (!allowed.has(capability) || seen.has(capability)) throw new TypeError('Checkpoint Engine Tool Runtime capabilities are invalid.');
    seen.add(capability);
  }
  const canonical = TOOL_RUNTIME_CAPABILITIES.filter((capability) => seen.has(capability));
  if (JSON.stringify(value) !== JSON.stringify(canonical)) throw new TypeError('Checkpoint Engine Tool Runtime capabilities are not canonical.');
}

function assertCanonicalInvocation(value: unknown, orchestration: BuildOrchestratorRecord, scopeLock: ScopeLockRecord | undefined): asserts value is ToolInvocationRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Checkpoint Engine requires a completed Tool Runtime invocation.');
  const row = value as Record<string, unknown>;
  if (row.schema !== TOOL_RUNTIME_SCHEMA || row.sourceBuildSchema !== CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA || row.revision !== 1
      || row.mode !== CHECKPOINT_ENGINE_MODE || row.status !== 'completed' || row.sourceOrchestrationId !== orchestration.id
      || row.sourceOrchestrationDigest !== orchestration.orchestrationDigest.hex || row.workspaceId !== orchestration.workspaceId
      || typeof row.stepId !== 'string' || typeof row.toolId !== 'string' || !/^tool:[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(row.toolId)
      || row.immutable !== true || row.denyByDefault !== true || row.capabilityVerifierRequired !== true
      || row.capabilityGrantAuthority !== false || row.toolExecution !== true || row.execution !== true
      || typeof row.mutationAuthorized !== 'boolean' || row.scopeIntelligence !== false || row.scopeLockRequired !== true
      || row.checkpoints !== false || row.validationPipeline !== false || row.scheduling !== false || row.jobCreation !== false
      || row.persistence !== false || !Array.isArray(row.requiredCapabilities)) {
    throw new TypeError('Checkpoint Engine requires a canonical immutable completed Tool Runtime invocation.');
  }
  const invocation = value as ToolInvocationRecord;
  assertCapabilities(invocation.requiredCapabilities);
  canonicalToolValue(invocation.input);
  canonicalToolValue(invocation.result);
  const step = orchestration.steps.find((item) => item.id === invocation.stepId);
  if (!step) throw new TypeError('Checkpoint Engine Tool Runtime invocation references an unknown Build step.');
  const hasLockIdentity = invocation.sourceScopeLockId !== null || invocation.sourceScopeLockDigest !== null || invocation.scopeLock;
  if (hasLockIdentity) {
    if (!scopeLock) throw new TypeError('Checkpoint Engine requires the canonical Scope Lock referenced by the Tool Runtime invocation.');
    assertCanonicalScopeLock(scopeLock, orchestration);
    if (invocation.sourceScopeLockId !== scopeLock.id || invocation.sourceScopeLockDigest !== scopeLock.lockDigest.hex || invocation.scopeLock !== true) {
      throw new TypeError('Checkpoint Engine Tool Runtime invocation Scope Lock binding does not match canonical Scope Lock.');
    }
  } else if (scopeLock !== undefined) throw new TypeError('Checkpoint Engine received a Scope Lock that is not referenced by the Tool Runtime invocation.');
  if (invocation.mutationAuthorized) {
    if (!scopeLock || invocation.scopeCandidateId === null || (invocation.mutationAccess !== 'write' && invocation.mutationAccess !== 'execute')) {
      throw new TypeError('Checkpoint Engine mutating invocation is missing its canonical Scope Lock mutation binding.');
    }
    assertScopeLockAllowsMutation(scopeLock, orchestration, invocation.scopeCandidateId, invocation.stepId, invocation.mutationAccess);
  } else if (invocation.scopeCandidateId !== null || invocation.mutationAccess !== null) {
    throw new TypeError('Checkpoint Engine non-mutating invocation cannot carry mutation candidate or access authority.');
  }
  if (invocation.invocationDigest.algorithm !== TOOL_RUNTIME_DIGEST_ALGORITHM || !/^[0-9a-f]{64}$/.test(invocation.invocationDigest.hex)) {
    throw new TypeError('Checkpoint Engine Tool Runtime invocation digest is invalid.');
  }
  const expectedInvocationDigest = sha256Hex(canonicalInvocationMaterial(orchestration, step, invocation));
  if (invocation.invocationDigest.hex !== expectedInvocationDigest || invocation.id !== `tool-invocation-${expectedInvocationDigest.slice(0, 16)}`) {
    throw new TypeError('Checkpoint Engine Tool Runtime invocation digest does not match canonical invocation material.');
  }
  if (invocation.completionDigest.algorithm !== TOOL_RUNTIME_DIGEST_ALGORITHM || !/^[0-9a-f]{64}$/.test(invocation.completionDigest.hex)
      || invocation.completionDigest.hex !== sha256Hex(canonicalCompletionMaterial(invocation))) {
    throw new TypeError('Checkpoint Engine Tool Runtime completion digest does not match completed result material.');
  }
}

function canonicalCheckpointMaterial(orchestration: BuildOrchestratorRecord, invocation: ToolInvocationRecord, inputDigest: CheckpointDigest, resultDigest: CheckpointDigest): string {
  return JSON.stringify({
    schema: CHECKPOINT_ENGINE_SCHEMA,
    sourceBuildSchema: CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA,
    sourceToolRuntimeSchema: CHECKPOINT_ENGINE_SOURCE_TOOL_RUNTIME_SCHEMA,
    sourceScopeLockSchema: CHECKPOINT_ENGINE_SOURCE_SCOPE_LOCK_SCHEMA,
    sourceOrchestrationId: orchestration.id,
    sourceOrchestrationDigest: orchestration.orchestrationDigest,
    sourceInvocationId: invocation.id,
    sourceInvocationDigest: invocation.invocationDigest,
    sourceCompletionDigest: invocation.completionDigest,
    sourceScopeLockId: invocation.sourceScopeLockId,
    sourceScopeLockDigest: invocation.sourceScopeLockDigest === null ? null : digest(invocation.sourceScopeLockDigest),
    mode: CHECKPOINT_ENGINE_MODE,
    checkpointKind: CHECKPOINT_ENGINE_KIND,
    recoveryBoundary: CHECKPOINT_ENGINE_RECOVERY_BOUNDARY,
    workspaceId: orchestration.workspaceId,
    stepId: invocation.stepId,
    toolId: invocation.toolId,
    scopeCandidateId: invocation.scopeCandidateId,
    mutationAccess: invocation.mutationAccess,
    sourceMutationAuthorized: invocation.mutationAuthorized,
    inputDigest,
    resultDigest,
  });
}

export function createCheckpoint(input: CheckpointEngineInput): CheckpointRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Checkpoint Engine input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['invocation','orchestration']) && JSON.stringify(keys) !== JSON.stringify(['invocation','orchestration','scopeLock'])) {
    throw new TypeError('Checkpoint Engine input accepts only orchestration, invocation and optional scopeLock.');
  }
  assertCanonicalOrchestration(row.orchestration);
  const orchestration = row.orchestration;
  const scopeLock = row.scopeLock as ScopeLockRecord | undefined;
  assertCanonicalInvocation(row.invocation, orchestration, scopeLock);
  const invocation = row.invocation;
  const inputDigest = digest(sha256Hex(canonicalToolValue(invocation.input)));
  const resultDigest = digest(sha256Hex(canonicalToolValue(invocation.result)));
  const digestHex = sha256Hex(canonicalCheckpointMaterial(orchestration, invocation, inputDigest, resultDigest));
  return Object.freeze({
    schema: CHECKPOINT_ENGINE_SCHEMA,
    sourceBuildSchema: CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA,
    sourceToolRuntimeSchema: CHECKPOINT_ENGINE_SOURCE_TOOL_RUNTIME_SCHEMA,
    sourceScopeLockSchema: CHECKPOINT_ENGINE_SOURCE_SCOPE_LOCK_SCHEMA,
    sourceOrchestrationId: orchestration.id,
    sourceOrchestrationDigest: digest(orchestration.orchestrationDigest.hex),
    sourceInvocationId: invocation.id,
    sourceInvocationDigest: digest(invocation.invocationDigest.hex),
    sourceCompletionDigest: digest(invocation.completionDigest.hex),
    sourceScopeLockId: invocation.sourceScopeLockId,
    sourceScopeLockDigest: invocation.sourceScopeLockDigest === null ? null : digest(invocation.sourceScopeLockDigest),
    sourceInvocation: invocation,
    id: `checkpoint-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: CHECKPOINT_ENGINE_MODE,
    status: 'checkpointed',
    checkpointKind: CHECKPOINT_ENGINE_KIND,
    recoveryBoundary: CHECKPOINT_ENGINE_RECOVERY_BOUNDARY,
    workspaceId: orchestration.workspaceId,
    stepId: invocation.stepId,
    toolId: invocation.toolId,
    scopeCandidateId: invocation.scopeCandidateId,
    mutationAccess: invocation.mutationAccess,
    sourceMutationAuthorized: invocation.mutationAuthorized,
    inputDigest,
    resultDigest,
    checkpointDigest: digest(digestHex),
    immutable: true,
    deterministic: true,
    environmentNeutral: true,
    workspaceScoped: true,
    completedInvocationRequired: true,
    sourceInvocationReadOnlyPreserved: true,
    sourceOrchestrationReadOnlyPreserved: true,
    sourceScopeLockReadOnlyPreserved: true,
    resultDigestBinding: true,
    scopeLockConsumer: true,
    scopeLockRequiredForMutation: true,
    recoveryAnchor: true,
    durableJobEngineSovereign: true,
    capabilityGrantAuthority: false,
    mutationAuthorized: false,
    toolExecution: false,
    execution: false,
    checkpoints: true,
    restoreExecution: false,
    validationPipeline: false,
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

export function assertCanonicalCheckpoint(value: unknown, orchestration: BuildOrchestratorRecord, scopeLock?: ScopeLockRecord): asserts value is CheckpointRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Checkpoint Engine requires a canonical checkpoint record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== CHECKPOINT_ENGINE_SCHEMA || row.sourceBuildSchema !== CHECKPOINT_ENGINE_SOURCE_BUILD_SCHEMA
      || row.sourceToolRuntimeSchema !== CHECKPOINT_ENGINE_SOURCE_TOOL_RUNTIME_SCHEMA || row.sourceScopeLockSchema !== CHECKPOINT_ENGINE_SOURCE_SCOPE_LOCK_SCHEMA
      || row.revision !== 1 || row.mode !== CHECKPOINT_ENGINE_MODE || row.status !== 'checkpointed' || row.checkpointKind !== CHECKPOINT_ENGINE_KIND
      || row.recoveryBoundary !== CHECKPOINT_ENGINE_RECOVERY_BOUNDARY || row.workspaceId !== orchestration.workspaceId || row.immutable !== true
      || row.deterministic !== true || row.environmentNeutral !== true || row.workspaceScoped !== true || row.completedInvocationRequired !== true
      || row.sourceInvocationReadOnlyPreserved !== true || row.sourceOrchestrationReadOnlyPreserved !== true
      || row.sourceScopeLockReadOnlyPreserved !== true || row.resultDigestBinding !== true || row.scopeLockConsumer !== true
      || row.scopeLockRequiredForMutation !== true || row.recoveryAnchor !== true || row.durableJobEngineSovereign !== true
      || row.capabilityGrantAuthority !== false || row.mutationAuthorized !== false || row.toolExecution !== false || row.execution !== false
      || row.checkpoints !== true || row.restoreExecution !== false || row.validationPipeline !== false || row.scheduling !== false
      || row.jobCreation !== false || row.persistence !== false || row.networkAuthority !== false || row.filesystemAuthority !== false
      || row.databaseAuthority !== false || row.studioTransport !== false || row.localRuntimeTransport !== false) {
    throw new TypeError('Checkpoint Engine checkpoint boundary is non-canonical.');
  }
  assertCanonicalOrchestration(orchestration);
  assertCanonicalInvocation(row.sourceInvocation, orchestration, scopeLock);
  const invocation = row.sourceInvocation;
  if (row.sourceOrchestrationId !== orchestration.id || row.sourceInvocationId !== invocation.id || row.stepId !== invocation.stepId
      || row.toolId !== invocation.toolId || row.scopeCandidateId !== invocation.scopeCandidateId || row.mutationAccess !== invocation.mutationAccess
      || row.sourceMutationAuthorized !== invocation.mutationAuthorized || row.sourceScopeLockId !== invocation.sourceScopeLockId) {
    throw new TypeError('Checkpoint Engine checkpoint source identities do not match canonical sources.');
  }
  const orchestrationDigest = row.sourceOrchestrationDigest as Record<string, unknown> | undefined;
  const invocationDigest = row.sourceInvocationDigest as Record<string, unknown> | undefined;
  const completionDigest = row.sourceCompletionDigest as Record<string, unknown> | undefined;
  const sourceLockDigest = row.sourceScopeLockDigest as Record<string, unknown> | null;
  const inputDigest = row.inputDigest as Record<string, unknown> | undefined;
  const resultDigest = row.resultDigest as Record<string, unknown> | undefined;
  const checkpointDigest = row.checkpointDigest as Record<string, unknown> | undefined;
  if (!orchestrationDigest || orchestrationDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM || orchestrationDigest.hex !== orchestration.orchestrationDigest.hex
      || !invocationDigest || invocationDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM || invocationDigest.hex !== invocation.invocationDigest.hex
      || !completionDigest || completionDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM || completionDigest.hex !== invocation.completionDigest.hex
      || (invocation.sourceScopeLockDigest === null ? sourceLockDigest !== null
        : !sourceLockDigest || sourceLockDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM || sourceLockDigest.hex !== invocation.sourceScopeLockDigest)) {
    throw new TypeError('Checkpoint Engine checkpoint source digests do not match canonical sources.');
  }
  const expectedInputHex = sha256Hex(canonicalToolValue(invocation.input));
  const expectedResultHex = sha256Hex(canonicalToolValue(invocation.result));
  if (!inputDigest || inputDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM || inputDigest.hex !== expectedInputHex
      || !resultDigest || resultDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM || resultDigest.hex !== expectedResultHex) {
    throw new TypeError('Checkpoint Engine input/result digest binding does not match completed invocation material.');
  }
  const expectedHex = sha256Hex(canonicalCheckpointMaterial(orchestration, invocation, digest(expectedInputHex), digest(expectedResultHex)));
  if (!checkpointDigest || checkpointDigest.algorithm !== CHECKPOINT_ENGINE_DIGEST_ALGORITHM || checkpointDigest.hex !== expectedHex
      || row.id !== `checkpoint-${expectedHex.slice(0, 16)}`) throw new TypeError('Checkpoint Engine checkpoint digest does not match canonical checkpoint material.');
}
