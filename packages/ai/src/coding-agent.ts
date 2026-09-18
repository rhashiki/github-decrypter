import {
  createToolRuntime,
  type ToolCapability,
  type ToolInvocationInput,
  type ToolInvocationRecord,
  type ToolRuntimeInput,
  type ToolValue,
} from '@github-decrypter/tools';
import {
  AGENT_RUNTIME_REGISTRY,
  AGENT_RUNTIME_SCHEMA,
  assertCanonicalAgentRuntime,
  getAgentRuntimeDescriptor,
  type AgentRuntimeRegistry,
} from './agent-runtime.js';

export const CODING_AGENT_BUILD = 60 as const;
export const CODING_AGENT_SCHEMA = 'gd-coding-agent/1' as const;
export const CODING_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1' as const;
export const CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1' as const;
export const CODING_AGENT_ID = 'strachey' as const;
export const CODING_AGENT_NAME = 'Strachey' as const;
export const CODING_AGENT_ROLE = 'builder-programmer' as const;
export const CODING_AGENT_MODE = 'BUILD' as const;
export const CODING_AGENT_DIGEST_ALGORITHM = 'sha256' as const;
export const CODING_AGENT_ALLOWED_CAPABILITIES = Object.freeze(['READ','WRITE','EXECUTE','NETWORK'] as const);
export const CODING_AGENT_BLOCKED_CAPABILITIES = Object.freeze(['DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS'] as const);

export interface CodingAgentExecutionInput {
  readonly registry?: AgentRuntimeRegistry;
  readonly toolRuntime: ToolRuntimeInput;
  readonly invocation: ToolInvocationInput;
}

export interface CodingAgentDigest {
  readonly algorithm: typeof CODING_AGENT_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface CodingAgentExecutionRecord {
  readonly schema: typeof CODING_AGENT_SCHEMA;
  readonly sourceAgentRuntimeSchema: typeof CODING_AGENT_SOURCE_RUNTIME_SCHEMA;
  readonly sourceToolRuntimeSchema: typeof CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: string;
  readonly sourceScopeLockId: string | null;
  readonly sourceScopeLockDigest: string | null;
  readonly sourceInvocationId: string;
  readonly sourceInvocationDigest: CodingAgentDigest;
  readonly sourceCompletionDigest: CodingAgentDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof CODING_AGENT_MODE;
  readonly status: 'completed';
  readonly agentId: typeof CODING_AGENT_ID;
  readonly agentName: typeof CODING_AGENT_NAME;
  readonly agentRole: typeof CODING_AGENT_ROLE;
  readonly workspaceId: string;
  readonly stepId: string;
  readonly toolId: string;
  readonly requiredCapabilities: readonly ToolCapability[];
  readonly mutationAuthorized: boolean;
  readonly scopeLock: boolean;
  readonly toolInvocation: ToolInvocationRecord;
  readonly codingDigest: CodingAgentDigest;
  readonly namedAgentBinding: true;
  readonly codingAgent: true;
  readonly implementationSpecialization: true;
  readonly toolRuntimeConsumer: true;
  readonly toolRuntimeDelegation: true;
  readonly toolRuntimeSovereign: true;
  readonly buildOrchestratorConsumer: true;
  readonly scopeLockRequired: true;
  readonly capabilityVerifierRequired: true;
  readonly mutationAuthorityOwnedByToolRuntime: true;
  readonly directMutationAuthority: false;
  readonly capabilityGrantAuthority: false;
  readonly approvalAuthority: false;
  readonly scopeAuthority: false;
  readonly databaseAgentAuthority: false;
  readonly testingAgentAuthority: false;
  readonly reviewAgentAuthority: false;
  readonly agentOrchestratorAuthority: false;
  readonly automaticAgentSelection: false;
  readonly orchestration: false;
  readonly agentExecution: true;
  readonly toolExecution: true;
  readonly execution: true;
  readonly checkpointAuthority: false;
  readonly validationAuthority: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly studioTransport: false;
  readonly localRuntimeTransport: false;
  readonly deterministicBinding: true;
  readonly environmentNeutral: true;
  readonly immutable: true;
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

function digest(hex: string): CodingAgentDigest {
  return Object.freeze({ algorithm: CODING_AGENT_DIGEST_ALGORITHM, hex });
}

function canonicalToolValue(value: ToolValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Coding Agent values must contain only finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map((item) => canonicalToolValue(item)).join(',') + ']';
  if (typeof value === 'object') {
    const row = value as { readonly [key: string]: ToolValue };
    return '{' + Object.keys(row).sort().map((key) => JSON.stringify(key) + ':' + canonicalToolValue(row[key]!)).join(',') + '}';
  }
  throw new TypeError('Coding Agent requires JSON-compatible Tool Runtime values.');
}

function assertAllowedCapabilities(capabilities: readonly ToolCapability[]): void {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new TypeError('Coding Agent requires explicit Tool Runtime capabilities.');
  }
  for (const capability of capabilities) {
    if (!(CODING_AGENT_ALLOWED_CAPABILITIES as readonly string[]).includes(capability)) {
      throw new TypeError('Coding Agent blocks Tool Runtime capability ' + capability + '.');
    }
  }
}

function canonicalCodingMaterial(invocation: ToolInvocationRecord): string {
  return JSON.stringify({
    schema: CODING_AGENT_SCHEMA,
    sourceAgentRuntimeSchema: CODING_AGENT_SOURCE_RUNTIME_SCHEMA,
    sourceToolRuntimeSchema: CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA,
    agentId: CODING_AGENT_ID,
    agentName: CODING_AGENT_NAME,
    agentRole: CODING_AGENT_ROLE,
    mode: CODING_AGENT_MODE,
    sourceOrchestrationId: invocation.sourceOrchestrationId,
    sourceOrchestrationDigest: invocation.sourceOrchestrationDigest,
    sourceScopeLockId: invocation.sourceScopeLockId,
    sourceScopeLockDigest: invocation.sourceScopeLockDigest,
    sourceInvocationId: invocation.id,
    sourceInvocationDigest: invocation.invocationDigest,
    sourceCompletionDigest: invocation.completionDigest,
    workspaceId: invocation.workspaceId,
    stepId: invocation.stepId,
    toolId: invocation.toolId,
    requiredCapabilities: [...invocation.requiredCapabilities],
    input: JSON.parse(canonicalToolValue(invocation.input)),
    result: JSON.parse(canonicalToolValue(invocation.result)),
    mutationAuthorized: invocation.mutationAuthorized,
    scopeLock: invocation.scopeLock,
  });
}

function assertToolInvocationBoundary(invocation: ToolInvocationRecord): void {
  if (!invocation || typeof invocation !== 'object' || Array.isArray(invocation)) {
    throw new TypeError('Coding Agent requires a completed canonical Tool Runtime invocation.');
  }
  if (
    invocation.schema !== CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA
    || invocation.sourceBuildSchema !== 'gd-build-orchestrator/1'
    || invocation.revision !== 1
    || invocation.mode !== CODING_AGENT_MODE
    || invocation.status !== 'completed'
    || invocation.immutable !== true
    || invocation.denyByDefault !== true
    || invocation.capabilityVerifierRequired !== true
    || invocation.capabilityGrantAuthority !== false
    || invocation.toolExecution !== true
    || invocation.execution !== true
    || invocation.scopeLockRequired !== true
    || invocation.scopeIntelligence !== false
    || invocation.checkpoints !== false
    || invocation.validationPipeline !== false
    || invocation.scheduling !== false
    || invocation.jobCreation !== false
    || invocation.persistence !== false
  ) throw new TypeError('Coding Agent source Tool Runtime invocation is non-canonical.');
  if (!/^[0-9a-f]{64}$/.test(invocation.invocationDigest.hex)
      || !/^[0-9a-f]{64}$/.test(invocation.completionDigest.hex)
      || invocation.invocationDigest.algorithm !== CODING_AGENT_DIGEST_ALGORITHM
      || invocation.completionDigest.algorithm !== CODING_AGENT_DIGEST_ALGORITHM
      || invocation.id !== 'tool-invocation-' + invocation.invocationDigest.hex.slice(0, 16)) {
    throw new TypeError('Coding Agent source Tool Runtime digest is invalid.');
  }
  assertAllowedCapabilities(invocation.requiredCapabilities);
  const mutating = invocation.requiredCapabilities.includes('WRITE') || invocation.requiredCapabilities.includes('EXECUTE');
  if (mutating) {
    if (invocation.mutationAuthorized !== true || invocation.scopeLock !== true
        || invocation.sourceScopeLockId === null || invocation.sourceScopeLockDigest === null
        || invocation.scopeCandidateId === null || invocation.mutationAccess === null) {
      throw new TypeError('Coding Agent mutating execution requires Tool Runtime Scope Lock authorization.');
    }
  } else if (invocation.mutationAuthorized !== false || invocation.scopeCandidateId !== null || invocation.mutationAccess !== null) {
    throw new TypeError('Coding Agent non-mutating execution cannot carry mutation authorization.');
  }
}

function assertCanonicalSpecialist(registry: AgentRuntimeRegistry): void {
  assertCanonicalAgentRuntime(registry);
  const descriptor = getAgentRuntimeDescriptor(CODING_AGENT_ID);
  if (!descriptor || descriptor.id !== CODING_AGENT_ID || descriptor.name !== CODING_AGENT_NAME
      || descriptor.role !== CODING_AGENT_ROLE || descriptor.operational !== false || descriptor.capabilityPrincipal !== false) {
    throw new TypeError('Coding Agent requires the canonical Strachey builder-programmer identity.');
  }
}

export async function executeCodingAgent(input: CodingAgentExecutionInput): Promise<CodingAgentExecutionRecord> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Coding Agent input must be an object.');
  const keys = Object.keys(input as unknown as Record<string, unknown>).sort();
  const withoutRegistry = ['invocation','toolRuntime'];
  const withRegistry = ['invocation','registry','toolRuntime'];
  if (JSON.stringify(keys) !== JSON.stringify(withoutRegistry) && JSON.stringify(keys) !== JSON.stringify(withRegistry)) {
    throw new TypeError('Coding Agent input accepts only optional registry, toolRuntime and invocation.');
  }

  assertCanonicalSpecialist(input.registry ?? AGENT_RUNTIME_REGISTRY);
  const runtime = createToolRuntime(input.toolRuntime);
  const descriptor = runtime.tools.find((tool) => tool.id === input.invocation.toolId);
  if (!descriptor) throw new TypeError('Coding Agent invocation references an unknown Tool Runtime tool.');
  assertAllowedCapabilities(descriptor.requiredCapabilities);
  const hasMutationCapability = descriptor.requiredCapabilities.includes('WRITE') || descriptor.requiredCapabilities.includes('EXECUTE');
  if (hasMutationCapability !== descriptor.mutating) {
    throw new TypeError('Coding Agent requires WRITE/EXECUTE tools to declare mutation consistently.');
  }

  const invocation = await runtime.invoke(input.invocation);
  assertToolInvocationBoundary(invocation);
  const digestHex = sha256Hex(canonicalCodingMaterial(invocation));
  return Object.freeze({
    schema: CODING_AGENT_SCHEMA,
    sourceAgentRuntimeSchema: AGENT_RUNTIME_SCHEMA,
    sourceToolRuntimeSchema: CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA,
    sourceOrchestrationId: invocation.sourceOrchestrationId,
    sourceOrchestrationDigest: invocation.sourceOrchestrationDigest,
    sourceScopeLockId: invocation.sourceScopeLockId,
    sourceScopeLockDigest: invocation.sourceScopeLockDigest,
    sourceInvocationId: invocation.id,
    sourceInvocationDigest: digest(invocation.invocationDigest.hex),
    sourceCompletionDigest: digest(invocation.completionDigest.hex),
    id: 'coding-run-' + digestHex.slice(0, 16),
    revision: 1,
    mode: CODING_AGENT_MODE,
    status: 'completed',
    agentId: CODING_AGENT_ID,
    agentName: CODING_AGENT_NAME,
    agentRole: CODING_AGENT_ROLE,
    workspaceId: invocation.workspaceId,
    stepId: invocation.stepId,
    toolId: invocation.toolId,
    requiredCapabilities: invocation.requiredCapabilities,
    mutationAuthorized: invocation.mutationAuthorized,
    scopeLock: invocation.scopeLock,
    toolInvocation: invocation,
    codingDigest: digest(digestHex),
    namedAgentBinding: true,
    codingAgent: true,
    implementationSpecialization: true,
    toolRuntimeConsumer: true,
    toolRuntimeDelegation: true,
    toolRuntimeSovereign: true,
    buildOrchestratorConsumer: true,
    scopeLockRequired: true,
    capabilityVerifierRequired: true,
    mutationAuthorityOwnedByToolRuntime: true,
    directMutationAuthority: false,
    capabilityGrantAuthority: false,
    approvalAuthority: false,
    scopeAuthority: false,
    databaseAgentAuthority: false,
    testingAgentAuthority: false,
    reviewAgentAuthority: false,
    agentOrchestratorAuthority: false,
    automaticAgentSelection: false,
    orchestration: false,
    agentExecution: true,
    toolExecution: true,
    execution: true,
    checkpointAuthority: false,
    validationAuthority: false,
    scheduling: false,
    jobCreation: false,
    persistence: false,
    networkAuthority: false,
    filesystemAuthority: false,
    databaseAuthority: false,
    studioTransport: false,
    localRuntimeTransport: false,
    deterministicBinding: true,
    environmentNeutral: true,
    immutable: true,
  });
}

export function assertCanonicalCodingAgentExecution(value: unknown): asserts value is CodingAgentExecutionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Coding Agent execution record must be an object.');
  const row = value as CodingAgentExecutionRecord;
  assertToolInvocationBoundary(row.toolInvocation);
  const invocation = row.toolInvocation;
  const expectedHex = sha256Hex(canonicalCodingMaterial(invocation));
  if (
    row.schema !== CODING_AGENT_SCHEMA
    || row.sourceAgentRuntimeSchema !== CODING_AGENT_SOURCE_RUNTIME_SCHEMA
    || row.sourceToolRuntimeSchema !== CODING_AGENT_SOURCE_TOOL_RUNTIME_SCHEMA
    || row.sourceOrchestrationId !== invocation.sourceOrchestrationId
    || row.sourceOrchestrationDigest !== invocation.sourceOrchestrationDigest
    || row.sourceScopeLockId !== invocation.sourceScopeLockId
    || row.sourceScopeLockDigest !== invocation.sourceScopeLockDigest
    || row.sourceInvocationId !== invocation.id
    || row.sourceInvocationDigest?.hex !== invocation.invocationDigest.hex
    || row.sourceCompletionDigest?.hex !== invocation.completionDigest.hex
    || row.sourceInvocationDigest?.algorithm !== CODING_AGENT_DIGEST_ALGORITHM
    || row.sourceCompletionDigest?.algorithm !== CODING_AGENT_DIGEST_ALGORITHM
    || row.id !== 'coding-run-' + expectedHex.slice(0, 16)
    || row.revision !== 1 || row.mode !== CODING_AGENT_MODE || row.status !== 'completed'
    || row.agentId !== CODING_AGENT_ID || row.agentName !== CODING_AGENT_NAME || row.agentRole !== CODING_AGENT_ROLE
    || row.workspaceId !== invocation.workspaceId || row.stepId !== invocation.stepId || row.toolId !== invocation.toolId
    || JSON.stringify(row.requiredCapabilities) !== JSON.stringify(invocation.requiredCapabilities)
    || row.mutationAuthorized !== invocation.mutationAuthorized || row.scopeLock !== invocation.scopeLock
    || row.codingDigest?.algorithm !== CODING_AGENT_DIGEST_ALGORITHM || row.codingDigest.hex !== expectedHex
    || row.namedAgentBinding !== true || row.codingAgent !== true || row.implementationSpecialization !== true
    || row.toolRuntimeConsumer !== true || row.toolRuntimeDelegation !== true || row.toolRuntimeSovereign !== true
    || row.buildOrchestratorConsumer !== true || row.scopeLockRequired !== true || row.capabilityVerifierRequired !== true
    || row.mutationAuthorityOwnedByToolRuntime !== true || row.directMutationAuthority !== false
    || row.capabilityGrantAuthority !== false || row.approvalAuthority !== false || row.scopeAuthority !== false
    || row.databaseAgentAuthority !== false || row.testingAgentAuthority !== false || row.reviewAgentAuthority !== false
    || row.agentOrchestratorAuthority !== false || row.automaticAgentSelection !== false || row.orchestration !== false
    || row.agentExecution !== true || row.toolExecution !== true || row.execution !== true
    || row.checkpointAuthority !== false || row.validationAuthority !== false || row.scheduling !== false
    || row.jobCreation !== false || row.persistence !== false || row.networkAuthority !== false
    || row.filesystemAuthority !== false || row.databaseAuthority !== false || row.studioTransport !== false
    || row.localRuntimeTransport !== false || row.deterministicBinding !== true || row.environmentNeutral !== true
    || row.immutable !== true
  ) throw new TypeError('Coding Agent execution record is non-canonical.');
}
