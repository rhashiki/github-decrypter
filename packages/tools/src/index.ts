import {
  BUILD_ORCHESTRATOR_SCHEMA,
  type BuildOrchestratorRecord,
  type BuildStep,
} from '@github-decrypter/build';
import {
  assertCanonicalScopeLock,
  assertScopeLockAllowsMutation,
  type ScopeLockRecord,
  type ScopeMutationAccess,
} from '@github-decrypter/scope/lock';

export const packageIdentity = '@github-decrypter/tools' as const;
export const TOOL_RUNTIME_BUILD = 53 as const;
export const TOOL_RUNTIME_SCOPE_LOCK_INTEGRATION_BUILD = 55 as const;
export const TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1' as const;
export const TOOL_RUNTIME_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1' as const;
export const TOOL_RUNTIME_MODE = 'BUILD' as const;
export const TOOL_RUNTIME_DIGEST_ALGORITHM = 'sha256' as const;
export const TOOL_RUNTIME_MAX_TOOLS = 256 as const;
export const TOOL_RUNTIME_CAPABILITIES = Object.freeze([
  'READ',
  'WRITE',
  'EXECUTE',
  'NETWORK',
  'DATABASE_WRITE',
  'GIT_WRITE',
  'DESTRUCTIVE',
  'SECRETS',
] as const);
const MUTATING_CAPABILITIES = new Set<ToolCapability>(['WRITE','EXECUTE','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE']);

export type ToolCapability = (typeof TOOL_RUNTIME_CAPABILITIES)[number];
export type ToolValue = null | boolean | number | string | readonly ToolValue[] | { readonly [key: string]: ToolValue };

export interface ToolDescriptor {
  readonly id: string;
  readonly label: string;
  readonly requiredCapabilities: readonly ToolCapability[];
  readonly mutating: boolean;
}

export interface CapabilityVerificationRequest {
  readonly schema: typeof TOOL_RUNTIME_SCHEMA;
  readonly workspaceId: string;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: string;
  readonly stepId: string;
  readonly toolId: string;
  readonly capability: ToolCapability;
}

export type CapabilityVerifier = (request: CapabilityVerificationRequest) => boolean | Promise<boolean>;

export interface ToolExecutionContext {
  readonly schema: typeof TOOL_RUNTIME_SCHEMA;
  readonly invocationId: string;
  readonly workspaceId: string;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: string;
  readonly sourceScopeLockId: string | null;
  readonly sourceScopeLockDigest: string | null;
  readonly scopeCandidateId: string | null;
  readonly mutationAccess: ScopeMutationAccess | null;
  readonly step: BuildStep;
  readonly tool: ToolDescriptor;
  readonly verifiedCapabilities: readonly ToolCapability[];
  readonly mutationAuthorized: boolean;
  readonly scopeLockRequired: true;
  readonly scopeLock: boolean;
}

export type ToolHandler = (context: ToolExecutionContext, input: ToolValue) => ToolValue | Promise<ToolValue>;

export interface ToolRegistration {
  readonly descriptor: ToolDescriptor;
  readonly handler: ToolHandler;
}

export interface ToolRuntimeInput {
  readonly orchestration: BuildOrchestratorRecord;
  readonly tools: readonly ToolRegistration[];
  readonly verifyCapability: CapabilityVerifier;
  readonly scopeLock?: ScopeLockRecord;
}

export interface ToolInvocationInput {
  readonly stepId: string;
  readonly toolId: string;
  readonly input: ToolValue;
  readonly scopeCandidateId?: string;
  readonly mutationAccess?: ScopeMutationAccess;
}

export interface ToolInvocationDigest {
  readonly algorithm: typeof TOOL_RUNTIME_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ToolInvocationRecord {
  readonly schema: typeof TOOL_RUNTIME_SCHEMA;
  readonly sourceBuildSchema: typeof TOOL_RUNTIME_SOURCE_BUILD_SCHEMA;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: string;
  readonly sourceScopeLockId: string | null;
  readonly sourceScopeLockDigest: string | null;
  readonly scopeCandidateId: string | null;
  readonly mutationAccess: ScopeMutationAccess | null;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof TOOL_RUNTIME_MODE;
  readonly status: 'completed';
  readonly workspaceId: string;
  readonly stepId: string;
  readonly toolId: string;
  readonly requiredCapabilities: readonly ToolCapability[];
  readonly input: ToolValue;
  readonly result: ToolValue;
  readonly invocationDigest: ToolInvocationDigest;
  readonly immutable: true;
  readonly denyByDefault: true;
  readonly capabilityVerifierRequired: true;
  readonly capabilityGrantAuthority: false;
  readonly toolExecution: true;
  readonly execution: true;
  readonly mutationAuthorized: boolean;
  readonly scopeIntelligence: false;
  readonly scopeLockRequired: true;
  readonly scopeLock: boolean;
  readonly checkpoints: false;
  readonly validationPipeline: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
}

export interface ToolRuntime {
  readonly schema: typeof TOOL_RUNTIME_SCHEMA;
  readonly sourceBuildSchema: typeof TOOL_RUNTIME_SOURCE_BUILD_SCHEMA;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: string;
  readonly sourceScopeLockId: string | null;
  readonly sourceScopeLockDigest: string | null;
  readonly revision: 1;
  readonly mode: typeof TOOL_RUNTIME_MODE;
  readonly status: 'ready';
  readonly workspaceId: string;
  readonly tools: readonly ToolDescriptor[];
  readonly immutable: true;
  readonly environmentNeutral: true;
  readonly denyByDefault: true;
  readonly capabilityVerifierRequired: true;
  readonly capabilityGrantAuthority: false;
  readonly toolExecution: true;
  readonly execution: true;
  readonly mutationAuthorized: false;
  readonly scopeIntelligence: false;
  readonly scopeLockRequired: true;
  readonly scopeLock: boolean;
  readonly checkpoints: false;
  readonly validationPipeline: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly studioTransport: false;
  readonly localRuntimeTransport: false;
  invoke(input: ToolInvocationInput): Promise<ToolInvocationRecord>;
}

export class ToolRuntimeCapabilityError extends Error {
  readonly code = 'TOOL_RUNTIME_CAPABILITY_DENIED' as const;
  constructor(readonly toolId: string, readonly capability: ToolCapability) {
    super(`Tool ${toolId} requires capability ${capability}.`);
    this.name = 'ToolRuntimeCapabilityError';
  }
}

export class ToolRuntimeMutationBlockedError extends Error {
  readonly code = 'TOOL_RUNTIME_MUTATION_BLOCKED' as const;
  constructor(readonly toolId: string) {
    super(`Tool ${toolId} is mutating and remains blocked until a canonical Scope Lock covers the exact candidate, Build step and mutation access.`);
    this.name = 'ToolRuntimeMutationBlockedError';
  }
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

function canonicalToolValue(value: ToolValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Tool Runtime values must contain only finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalToolValue(item)).join(',')}]`;
  if (typeof value === 'object') {
    const row = value as { readonly [key: string]: ToolValue };
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalToolValue(row[key]!)}`).join(',')}}`;
  }
  throw new TypeError('Tool Runtime values must be JSON-compatible.');
}

function immutableToolValue(value: ToolValue): ToolValue {
  return deepFreezeToolValue(JSON.parse(canonicalToolValue(value)) as ToolValue);
}

function deepFreezeToolValue(value: ToolValue): ToolValue {
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeToolValue(item);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) deepFreezeToolValue(item);
    return Object.freeze(value);
  }
  return value;
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Tool Runtime requires a canonical Build Orchestrator record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== BUILD_ORCHESTRATOR_SCHEMA || row.sourcePlanSchema !== 'gd-plan-authority/1'
      || row.sourceProjectRulesSchema !== 'gd-project-rules/1' || row.sourceImpactSimulationSchema !== 'gd-impact-simulation/1'
      || row.sourcePlanStatus !== 'approved' || row.revision !== 1 || row.mode !== TOOL_RUNTIME_MODE
      || row.status !== 'orchestrated' || row.transition !== 'PLAN_TO_BUILD' || typeof row.workspaceId !== 'string'
      || row.workspaceId.length === 0 || row.immutable !== true || row.sourcePlanReadOnlyPreserved !== true
      || row.projectRulesReadOnlyPreserved !== true || row.impactSimulationReadOnlyPreserved !== true
      || row.workspaceScoped !== true || row.explicitTransition !== true || row.buildTransitionAuthorized !== true
      || row.buildOrchestration !== true || row.capabilitiesRequired !== true || row.scopeLockRequired !== true
      || row.mutationAuthorized !== false || row.toolExecution !== false || row.scopeIntelligence !== false
      || row.scopeLock !== false || row.checkpoints !== false || row.validationPipeline !== false
      || row.execution !== false || row.scheduling !== false || row.jobCreation !== false || row.persistence !== false
      || !Array.isArray(row.steps) || !Array.isArray(row.buildOrder)) {
    throw new TypeError('Tool Runtime requires an unmodified canonical Build 52 orchestration boundary.');
  }
  for (const field of ['sourcePlanId','sourceProjectRulesId','sourceImpactSimulationId']) {
    if (typeof row[field] !== 'string' || (row[field] as string).length === 0) throw new TypeError(`Tool Runtime source orchestration ${field} is invalid.`);
  }
  for (const field of ['sourcePlanDigest','sourceProjectRulesDigest','sourceImpactSimulationDigest','orchestrationDigest']) {
    const digest = row[field] as Record<string, unknown> | undefined;
    if (!digest || digest.algorithm !== TOOL_RUNTIME_DIGEST_ALGORITHM || typeof digest.hex !== 'string' || !/^[0-9a-f]{64}$/.test(digest.hex)) {
      throw new TypeError(`Tool Runtime source orchestration ${field} is invalid.`);
    }
  }
  const steps = row.steps as unknown[];
  if (steps.length > 4096) throw new RangeError('Tool Runtime accepts at most 4096 Build steps.');
  const stepIds = new Set<string>();
  steps.forEach((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw new TypeError(`Tool Runtime Build step ${index + 1} is invalid.`);
    const item = step as Record<string, unknown>;
    const expectedId = `build-step-${String(index + 1).padStart(4, '0')}`;
    if (item.id !== expectedId || item.ordinal !== index + 1 || typeof item.sourceTaskId !== 'string'
        || !/^task-\d{4}$/.test(item.sourceTaskId) || typeof item.requirementId !== 'string'
        || !/^req-\d{4}$/.test(item.requirementId) || typeof item.statement !== 'string' || item.statement.trim().length === 0
        || !Number.isInteger(item.sourceStartLine) || !Number.isInteger(item.sourceEndLine) || !Array.isArray(item.dependsOn)) {
      throw new TypeError(`Tool Runtime Build step ${expectedId} is non-canonical.`);
    }
    stepIds.add(expectedId);
  });
  const order = row.buildOrder as unknown[];
  if (order.length !== stepIds.size || new Set(order).size !== order.length || order.some((id) => typeof id !== 'string' || !stepIds.has(id))) {
    throw new TypeError('Tool Runtime Build order is invalid.');
  }
  const orderIndex = new Map<string, number>((order as string[]).map((id, index) => [id, index]));
  for (const step of steps as BuildStep[]) {
    for (const dependency of step.dependsOn) {
      if (!stepIds.has(dependency) || (orderIndex.get(dependency) ?? -1) >= (orderIndex.get(step.id) ?? -1)) {
        throw new TypeError(`Tool Runtime Build step ${step.id} dependency order is invalid.`);
      }
    }
  }
  const orchestration = value as BuildOrchestratorRecord;
  const expectedDigest = sha256Hex(canonicalOrchestrationMaterial(orchestration));
  if (orchestration.orchestrationDigest.hex !== expectedDigest || orchestration.id !== `build-orchestration-${expectedDigest.slice(0, 16)}`) {
    throw new TypeError('Tool Runtime source orchestration digest does not match canonical Build material.');
  }
}

function normalizeCapabilities(value: readonly ToolCapability[]): readonly ToolCapability[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > TOOL_RUNTIME_CAPABILITIES.length) {
    throw new TypeError('Tool Runtime tools require between 1 and 8 explicit capabilities.');
  }
  const allowed = new Set<string>(TOOL_RUNTIME_CAPABILITIES);
  const seen = new Set<ToolCapability>();
  for (const capability of value) {
    if (!allowed.has(capability) || seen.has(capability)) throw new TypeError('Tool Runtime tool capabilities must be unique canonical capability names.');
    seen.add(capability);
  }
  return Object.freeze(TOOL_RUNTIME_CAPABILITIES.filter((capability) => seen.has(capability)));
}

function normalizeDescriptor(value: ToolDescriptor): ToolDescriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Tool Runtime descriptor must be an object.');
  if (!/^tool:[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value.id)) throw new TypeError('Tool Runtime tool id is invalid.');
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (label.length === 0 || label.length > 128) throw new TypeError('Tool Runtime tool label is invalid.');
  if (typeof value.mutating !== 'boolean') throw new TypeError('Tool Runtime tool mutation declaration must be explicit.');
  const requiredCapabilities = normalizeCapabilities(value.requiredCapabilities);
  if (value.mutating && !requiredCapabilities.some((capability) => MUTATING_CAPABILITIES.has(capability))) {
    throw new TypeError('Tool Runtime mutating tools require at least one mutating capability.');
  }
  return Object.freeze({ id: value.id, label, requiredCapabilities, mutating: value.mutating });
}

function canonicalInvocationMaterial(
  orchestration: BuildOrchestratorRecord,
  step: BuildStep,
  descriptor: ToolDescriptor,
  input: ToolValue,
  lock: ScopeLockRecord | undefined,
  scopeCandidateId: string | null,
  mutationAccess: ScopeMutationAccess | null,
): string {
  const base = {
    schema: TOOL_RUNTIME_SCHEMA,
    sourceBuildSchema: TOOL_RUNTIME_SOURCE_BUILD_SCHEMA,
    sourceOrchestrationId: orchestration.id,
    sourceOrchestrationDigest: orchestration.orchestrationDigest.hex,
    workspaceId: orchestration.workspaceId,
    stepId: step.id,
    toolId: descriptor.id,
    requiredCapabilities: [...descriptor.requiredCapabilities],
    mutating: descriptor.mutating,
    input: JSON.parse(canonicalToolValue(input)),
  };
  if (!descriptor.mutating) return JSON.stringify(base);
  return JSON.stringify({
    ...base,
    sourceScopeLockId: lock!.id,
    sourceScopeLockDigest: lock!.lockDigest.hex,
    scopeCandidateId,
    mutationAccess,
  });
}

export function createToolRuntime(input: ToolRuntimeInput): ToolRuntime {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Tool Runtime input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  const inputKeys = Object.keys(row).sort();
  const baseKeys = ['orchestration','tools','verifyCapability'];
  const scopedKeys = ['orchestration','scopeLock','tools','verifyCapability'];
  if (JSON.stringify(inputKeys) !== JSON.stringify(baseKeys) && JSON.stringify(inputKeys) !== JSON.stringify(scopedKeys)) {
    throw new TypeError('Tool Runtime input accepts only orchestration, tools, verifyCapability and optional scopeLock.');
  }
  assertCanonicalOrchestration(row.orchestration);
  const orchestration = row.orchestration;
  const scopeLock = row.scopeLock as ScopeLockRecord | undefined;
  if (scopeLock !== undefined) assertCanonicalScopeLock(scopeLock, orchestration);
  if (!Array.isArray(row.tools) || row.tools.length === 0 || row.tools.length > TOOL_RUNTIME_MAX_TOOLS) {
    throw new TypeError(`Tool Runtime requires between 1 and ${TOOL_RUNTIME_MAX_TOOLS} registered tools.`);
  }
  if (typeof row.verifyCapability !== 'function') throw new TypeError('Tool Runtime requires an injected capability verifier.');
  const verifyCapability = row.verifyCapability as CapabilityVerifier;

  const registrations = new Map<string, { readonly descriptor: ToolDescriptor; readonly handler: ToolHandler }>();
  for (const registration of row.tools as unknown[]) {
    if (!registration || typeof registration !== 'object' || Array.isArray(registration)) throw new TypeError('Tool Runtime registration must be an object.');
    const item = registration as Record<string, unknown>;
    if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(['descriptor','handler']) || typeof item.handler !== 'function') {
      throw new TypeError('Tool Runtime registration accepts only descriptor and handler.');
    }
    const descriptor = normalizeDescriptor(item.descriptor as ToolDescriptor);
    if (registrations.has(descriptor.id)) throw new TypeError(`Tool Runtime tool ${descriptor.id} is registered more than once.`);
    registrations.set(descriptor.id, Object.freeze({ descriptor, handler: item.handler as ToolHandler }));
  }
  const descriptors = Object.freeze([...registrations.values()].map((registration) => registration.descriptor).sort((a, b) => a.id.localeCompare(b.id)));
  const stepById = new Map(orchestration.steps.map((step) => [step.id, step]));

  async function invoke(invocation: ToolInvocationInput): Promise<ToolInvocationRecord> {
    if (!invocation || typeof invocation !== 'object' || Array.isArray(invocation)) throw new TypeError('Tool Runtime invocation must be an object.');
    const invocationRow = invocation as unknown as Record<string, unknown>;
    const step = typeof invocation.stepId === 'string' ? stepById.get(invocation.stepId) : undefined;
    if (!step) throw new TypeError('Tool Runtime invocation references an unknown Build step.');
    const registration = typeof invocation.toolId === 'string' ? registrations.get(invocation.toolId) : undefined;
    if (!registration) throw new TypeError('Tool Runtime invocation references an unknown tool.');

    let scopeCandidateId: string | null = null;
    let mutationAccess: ScopeMutationAccess | null = null;
    let mutationAuthorized = false;
    if (registration.descriptor.mutating) {
      if (!scopeLock) throw new ToolRuntimeMutationBlockedError(registration.descriptor.id);
      if (JSON.stringify(Object.keys(invocationRow).sort()) !== JSON.stringify(['input','mutationAccess','scopeCandidateId','stepId','toolId'])) {
        throw new TypeError('Mutating Tool Runtime invocation requires exactly stepId, toolId, input, scopeCandidateId and mutationAccess.');
      }
      if (typeof invocation.scopeCandidateId !== 'string' || (invocation.mutationAccess !== 'write' && invocation.mutationAccess !== 'execute')) {
        throw new TypeError('Mutating Tool Runtime invocation requires a canonical scope candidate and mutation access.');
      }
      assertScopeLockAllowsMutation(scopeLock, orchestration, invocation.scopeCandidateId, step.id, invocation.mutationAccess);
      scopeCandidateId = invocation.scopeCandidateId;
      mutationAccess = invocation.mutationAccess;
      mutationAuthorized = true;
    } else if (JSON.stringify(Object.keys(invocationRow).sort()) !== JSON.stringify(['input','stepId','toolId'])) {
      throw new TypeError('Non-mutating Tool Runtime invocation accepts only stepId, toolId and input.');
    }

    const immutableInput = immutableToolValue(invocation.input);
    const invocationDigestHex = sha256Hex(canonicalInvocationMaterial(
      orchestration,
      step,
      registration.descriptor,
      immutableInput,
      scopeLock,
      scopeCandidateId,
      mutationAccess,
    ));
    const invocationId = `tool-invocation-${invocationDigestHex.slice(0, 16)}`;
    const verifiedCapabilities: ToolCapability[] = [];
    for (const capability of registration.descriptor.requiredCapabilities) {
      const request = Object.freeze({
        schema: TOOL_RUNTIME_SCHEMA,
        workspaceId: orchestration.workspaceId,
        sourceOrchestrationId: orchestration.id,
        sourceOrchestrationDigest: orchestration.orchestrationDigest.hex,
        stepId: step.id,
        toolId: registration.descriptor.id,
        capability,
      });
      if (await verifyCapability(request) !== true) throw new ToolRuntimeCapabilityError(registration.descriptor.id, capability);
      verifiedCapabilities.push(capability);
    }
    const context: ToolExecutionContext = Object.freeze({
      schema: TOOL_RUNTIME_SCHEMA,
      invocationId,
      workspaceId: orchestration.workspaceId,
      sourceOrchestrationId: orchestration.id,
      sourceOrchestrationDigest: orchestration.orchestrationDigest.hex,
      sourceScopeLockId: scopeLock?.id ?? null,
      sourceScopeLockDigest: scopeLock?.lockDigest.hex ?? null,
      scopeCandidateId,
      mutationAccess,
      step,
      tool: registration.descriptor,
      verifiedCapabilities: Object.freeze(verifiedCapabilities),
      mutationAuthorized,
      scopeLockRequired: true,
      scopeLock: scopeLock !== undefined,
    });
    const result = immutableToolValue(await registration.handler(context, immutableInput));
    const invocationDigest = Object.freeze({ algorithm: TOOL_RUNTIME_DIGEST_ALGORITHM, hex: invocationDigestHex });
    return Object.freeze({
      schema: TOOL_RUNTIME_SCHEMA,
      sourceBuildSchema: TOOL_RUNTIME_SOURCE_BUILD_SCHEMA,
      sourceOrchestrationId: orchestration.id,
      sourceOrchestrationDigest: orchestration.orchestrationDigest.hex,
      sourceScopeLockId: scopeLock?.id ?? null,
      sourceScopeLockDigest: scopeLock?.lockDigest.hex ?? null,
      scopeCandidateId,
      mutationAccess,
      id: invocationId,
      revision: 1,
      mode: TOOL_RUNTIME_MODE,
      status: 'completed',
      workspaceId: orchestration.workspaceId,
      stepId: step.id,
      toolId: registration.descriptor.id,
      requiredCapabilities: registration.descriptor.requiredCapabilities,
      input: immutableInput,
      result,
      invocationDigest,
      immutable: true,
      denyByDefault: true,
      capabilityVerifierRequired: true,
      capabilityGrantAuthority: false,
      toolExecution: true,
      execution: true,
      mutationAuthorized,
      scopeIntelligence: false,
      scopeLockRequired: true,
      scopeLock: scopeLock !== undefined,
      checkpoints: false,
      validationPipeline: false,
      scheduling: false,
      jobCreation: false,
      persistence: false,
    });
  }

  return Object.freeze({
    schema: TOOL_RUNTIME_SCHEMA,
    sourceBuildSchema: TOOL_RUNTIME_SOURCE_BUILD_SCHEMA,
    sourceOrchestrationId: orchestration.id,
    sourceOrchestrationDigest: orchestration.orchestrationDigest.hex,
    sourceScopeLockId: scopeLock?.id ?? null,
    sourceScopeLockDigest: scopeLock?.lockDigest.hex ?? null,
    revision: 1,
    mode: TOOL_RUNTIME_MODE,
    status: 'ready',
    workspaceId: orchestration.workspaceId,
    tools: descriptors,
    immutable: true,
    environmentNeutral: true,
    denyByDefault: true,
    capabilityVerifierRequired: true,
    capabilityGrantAuthority: false,
    toolExecution: true,
    execution: true,
    mutationAuthorized: false,
    scopeIntelligence: false,
    scopeLockRequired: true,
    scopeLock: scopeLock !== undefined,
    checkpoints: false,
    validationPipeline: false,
    scheduling: false,
    jobCreation: false,
    persistence: false,
    networkAuthority: false,
    filesystemAuthority: false,
    databaseAuthority: false,
    studioTransport: false,
    localRuntimeTransport: false,
    invoke,
  });
}
