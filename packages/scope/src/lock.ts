import type { BuildOrchestratorRecord } from '@github-decrypter/build';
import {
  SCOPE_INTELLIGENCE_DIGEST_ALGORITHM,
  SCOPE_INTELLIGENCE_SCHEMA,
  analyzeScope,
  type ScopeAccess,
  type ScopeCandidate,
  type ScopeIntelligenceRecord,
} from './index.js';

export const SCOPE_LOCK_BUILD = 55 as const;
export const SCOPE_LOCK_SCHEMA = 'gd-scope-lock/1' as const;
export const SCOPE_LOCK_SOURCE_SCOPE_SCHEMA = 'gd-scope-intelligence/1' as const;
export const SCOPE_LOCK_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1' as const;
export const SCOPE_LOCK_MODE = 'BUILD' as const;
export const SCOPE_LOCK_DIGEST_ALGORITHM = 'sha256' as const;
export const SCOPE_LOCK_MAX_CANDIDATES = 4096 as const;
export const SCOPE_LOCK_MUTATION_ACCESS = Object.freeze(['write', 'execute'] as const);

export type ScopeMutationAccess = (typeof SCOPE_LOCK_MUTATION_ACCESS)[number];

export interface ScopeLockInput {
  readonly orchestration: BuildOrchestratorRecord;
  readonly scope: ScopeIntelligenceRecord;
  readonly candidateIds: readonly string[];
}

export interface ScopeLockDigest {
  readonly algorithm: typeof SCOPE_LOCK_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ScopeLockRecord {
  readonly schema: typeof SCOPE_LOCK_SCHEMA;
  readonly sourceScopeSchema: typeof SCOPE_LOCK_SOURCE_SCOPE_SCHEMA;
  readonly sourceBuildSchema: typeof SCOPE_LOCK_SOURCE_BUILD_SCHEMA;
  readonly sourceScopeId: string;
  readonly sourceScopeDigest: ScopeLockDigest;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: ScopeLockDigest;
  readonly sourceScope: ScopeIntelligenceRecord;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof SCOPE_LOCK_MODE;
  readonly status: 'locked';
  readonly workspaceId: string;
  readonly lockedCandidateIds: readonly string[];
  readonly lockedBuildStepIds: readonly string[];
  readonly lockedWriteCandidateIds: readonly string[];
  readonly lockedExecuteCandidateIds: readonly string[];
  readonly lockDigest: ScopeLockDigest;
  readonly immutable: true;
  readonly sourceScopeReadOnlyPreserved: true;
  readonly sourceOrchestrationReadOnlyPreserved: true;
  readonly workspaceScoped: true;
  readonly explicitLock: true;
  readonly exactCandidateAllowlist: true;
  readonly automaticExpansion: false;
  readonly semanticInference: false;
  readonly scopeIntelligence: true;
  readonly scopeLockRequired: true;
  readonly scopeLock: true;
  readonly scopeLocked: true;
  readonly mutationBoundarySatisfied: true;
  readonly capabilitiesRequired: true;
  readonly capabilityVerifierRequired: true;
  readonly capabilityGrantAuthority: false;
  readonly mutationAuthorized: false;
  readonly toolRuntimeScopedMutationIntegration: true;
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

function candidateInput(candidate: ScopeCandidate) {
  return {
    key: candidate.key,
    buildStepId: candidate.buildStepId,
    resource: candidate.resource,
    access: candidate.access,
    rationale: candidate.rationale,
  } as const;
}

function assertCanonicalScopeIntelligence(
  value: unknown,
  orchestration: BuildOrchestratorRecord,
): asserts value is ScopeIntelligenceRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Scope Lock requires a canonical Scope Intelligence record.');
  }
  const row = value as Record<string, unknown>;
  if (row.schema !== SCOPE_INTELLIGENCE_SCHEMA || !Array.isArray(row.candidates)) {
    throw new TypeError('Scope Lock requires a canonical Scope Intelligence record.');
  }
  const supplied = value as ScopeIntelligenceRecord;
  const reconstructed = analyzeScope({
    orchestration,
    candidates: supplied.candidates.map(candidateInput),
  });
  const scalarFields = [
    'schema','sourceBuildSchema','sourceOrchestrationId','id','revision','mode','status','workspaceId',
    'immutable','sourceOrchestrationReadOnlyPreserved','workspaceScoped','advisoryOnly','explicitCandidatesOnly',
    'semanticInference','automaticDiscovery','scopeIntelligence','scopeLockRequired','scopeLock','scopeLocked',
    'mutationAuthorized','capabilityGrantAuthority','toolExecution','checkpoints','validationPipeline','execution',
    'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority',
    'studioTransport','localRuntimeTransport',
  ] as const;
  for (const field of scalarFields) {
    if (supplied[field] !== reconstructed[field]) {
      throw new TypeError(`Scope Lock source Scope Intelligence ${field} is non-canonical.`);
    }
  }
  for (const field of ['candidates','coveredBuildStepIds','uncoveredBuildStepIds','writeCandidateIds','executeCandidateIds'] as const) {
    if (JSON.stringify(supplied[field]) !== JSON.stringify(reconstructed[field])) {
      throw new TypeError(`Scope Lock source Scope Intelligence ${field} is non-canonical.`);
    }
  }
  if (supplied.sourceOrchestrationDigest.algorithm !== SCOPE_INTELLIGENCE_DIGEST_ALGORITHM
      || supplied.sourceOrchestrationDigest.hex !== reconstructed.sourceOrchestrationDigest.hex
      || supplied.scopeDigest.algorithm !== SCOPE_INTELLIGENCE_DIGEST_ALGORITHM
      || supplied.scopeDigest.hex !== reconstructed.scopeDigest.hex) {
    throw new TypeError('Scope Lock source Scope Intelligence digest does not match canonical material.');
  }
}

function canonicalLockMaterial(
  scope: ScopeIntelligenceRecord,
  lockedCandidateIds: readonly string[],
  lockedBuildStepIds: readonly string[],
  lockedWriteCandidateIds: readonly string[],
  lockedExecuteCandidateIds: readonly string[],
): string {
  return JSON.stringify({
    schema: SCOPE_LOCK_SCHEMA,
    sourceScopeSchema: SCOPE_LOCK_SOURCE_SCOPE_SCHEMA,
    sourceBuildSchema: SCOPE_LOCK_SOURCE_BUILD_SCHEMA,
    sourceScopeId: scope.id,
    sourceScopeDigest: scope.scopeDigest,
    sourceOrchestrationId: scope.sourceOrchestrationId,
    sourceOrchestrationDigest: scope.sourceOrchestrationDigest,
    mode: SCOPE_LOCK_MODE,
    workspaceId: scope.workspaceId,
    lockedCandidateIds: [...lockedCandidateIds],
    lockedBuildStepIds: [...lockedBuildStepIds],
    lockedWriteCandidateIds: [...lockedWriteCandidateIds],
    lockedExecuteCandidateIds: [...lockedExecuteCandidateIds],
  });
}

function canonicalLockedSelection(
  scope: ScopeIntelligenceRecord,
  orchestration: BuildOrchestratorRecord,
  candidateIds: readonly string[],
) {
  if (!Array.isArray(candidateIds)) throw new TypeError('Scope Lock candidateIds must be an array.');
  if (candidateIds.length > SCOPE_LOCK_MAX_CANDIDATES) {
    throw new RangeError(`Scope Lock accepts at most ${SCOPE_LOCK_MAX_CANDIDATES} candidate ids.`);
  }
  const requested = new Set<string>();
  for (const id of candidateIds) {
    if (typeof id !== 'string' || !/^scope-candidate-\d{4}$/.test(id)) {
      throw new TypeError('Scope Lock candidate ids must be canonical Scope Intelligence candidate ids.');
    }
    if (requested.has(id)) throw new TypeError(`Scope Lock candidate id ${id} is duplicated.`);
    requested.add(id);
  }
  const candidateById = new Map(scope.candidates.map((candidate) => [candidate.id, candidate]));
  for (const id of requested) if (!candidateById.has(id)) {
    throw new TypeError(`Scope Lock candidate id ${id} is not present in the source Scope Intelligence record.`);
  }
  const lockedCandidates = scope.candidates.filter((candidate) => requested.has(candidate.id));
  const lockedCandidateIds = Object.freeze(lockedCandidates.map((candidate) => candidate.id));
  const lockedWriteCandidateIds = Object.freeze(lockedCandidates.filter((candidate) => candidate.access === 'write').map((candidate) => candidate.id));
  const lockedExecuteCandidateIds = Object.freeze(lockedCandidates.filter((candidate) => candidate.access === 'execute').map((candidate) => candidate.id));
  const lockedSteps = new Set(lockedCandidates.map((candidate) => candidate.buildStepId));
  const lockedBuildStepIds = Object.freeze(orchestration.buildOrder.filter((id) => lockedSteps.has(id)));
  return { lockedCandidates, lockedCandidateIds, lockedBuildStepIds, lockedWriteCandidateIds, lockedExecuteCandidateIds } as const;
}

export function lockScope(input: ScopeLockInput): ScopeLockRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Scope Lock input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['candidateIds','orchestration','scope'])) {
    throw new TypeError('Scope Lock input accepts only orchestration, scope and candidateIds.');
  }
  const orchestration = row.orchestration as BuildOrchestratorRecord;
  assertCanonicalScopeIntelligence(row.scope, orchestration);
  const scope = row.scope;
  const selection = canonicalLockedSelection(scope, orchestration, row.candidateIds as readonly string[]);
  const digestHex = sha256Hex(canonicalLockMaterial(
    scope,
    selection.lockedCandidateIds,
    selection.lockedBuildStepIds,
    selection.lockedWriteCandidateIds,
    selection.lockedExecuteCandidateIds,
  ));
  const lockDigest = Object.freeze({ algorithm: SCOPE_LOCK_DIGEST_ALGORITHM, hex: digestHex });

  return Object.freeze({
    schema: SCOPE_LOCK_SCHEMA,
    sourceScopeSchema: SCOPE_LOCK_SOURCE_SCOPE_SCHEMA,
    sourceBuildSchema: SCOPE_LOCK_SOURCE_BUILD_SCHEMA,
    sourceScopeId: scope.id,
    sourceScopeDigest: Object.freeze({ algorithm: scope.scopeDigest.algorithm, hex: scope.scopeDigest.hex }),
    sourceOrchestrationId: scope.sourceOrchestrationId,
    sourceOrchestrationDigest: Object.freeze({ algorithm: scope.sourceOrchestrationDigest.algorithm, hex: scope.sourceOrchestrationDigest.hex }),
    sourceScope: scope,
    id: `scope-lock-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: SCOPE_LOCK_MODE,
    status: 'locked',
    workspaceId: scope.workspaceId,
    lockedCandidateIds: selection.lockedCandidateIds,
    lockedBuildStepIds: selection.lockedBuildStepIds,
    lockedWriteCandidateIds: selection.lockedWriteCandidateIds,
    lockedExecuteCandidateIds: selection.lockedExecuteCandidateIds,
    lockDigest,
    immutable: true,
    sourceScopeReadOnlyPreserved: true,
    sourceOrchestrationReadOnlyPreserved: true,
    workspaceScoped: true,
    explicitLock: true,
    exactCandidateAllowlist: true,
    automaticExpansion: false,
    semanticInference: false,
    scopeIntelligence: true,
    scopeLockRequired: true,
    scopeLock: true,
    scopeLocked: true,
    mutationBoundarySatisfied: true,
    capabilitiesRequired: true,
    capabilityVerifierRequired: true,
    capabilityGrantAuthority: false,
    mutationAuthorized: false,
    toolRuntimeScopedMutationIntegration: true,
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

export function assertCanonicalScopeLock(
  value: unknown,
  orchestration: BuildOrchestratorRecord,
): asserts value is ScopeLockRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Tool Runtime requires a canonical Scope Lock record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== SCOPE_LOCK_SCHEMA || row.sourceScopeSchema !== SCOPE_LOCK_SOURCE_SCOPE_SCHEMA
      || row.sourceBuildSchema !== SCOPE_LOCK_SOURCE_BUILD_SCHEMA || row.revision !== 1 || row.mode !== SCOPE_LOCK_MODE
      || row.status !== 'locked' || row.workspaceId !== orchestration.workspaceId || row.immutable !== true
      || row.sourceScopeReadOnlyPreserved !== true || row.sourceOrchestrationReadOnlyPreserved !== true
      || row.workspaceScoped !== true || row.explicitLock !== true || row.exactCandidateAllowlist !== true
      || row.automaticExpansion !== false || row.semanticInference !== false || row.scopeIntelligence !== true
      || row.scopeLockRequired !== true || row.scopeLock !== true || row.scopeLocked !== true
      || row.mutationBoundarySatisfied !== true || row.capabilitiesRequired !== true || row.capabilityVerifierRequired !== true
      || row.capabilityGrantAuthority !== false || row.mutationAuthorized !== false
      || row.toolRuntimeScopedMutationIntegration !== true || row.toolExecution !== false || row.checkpoints !== false
      || row.validationPipeline !== false || row.execution !== false || row.scheduling !== false
      || row.jobCreation !== false || row.persistence !== false || row.networkAuthority !== false
      || row.filesystemAuthority !== false || row.databaseAuthority !== false || row.studioTransport !== false
      || row.localRuntimeTransport !== false || !Array.isArray(row.lockedCandidateIds)
      || !Array.isArray(row.lockedBuildStepIds) || !Array.isArray(row.lockedWriteCandidateIds)
      || !Array.isArray(row.lockedExecuteCandidateIds)) {
    throw new TypeError('Tool Runtime requires a canonical immutable Scope Lock boundary.');
  }
  assertCanonicalScopeIntelligence(row.sourceScope, orchestration);
  const sourceScope = row.sourceScope;
  const selection = canonicalLockedSelection(sourceScope, orchestration, row.lockedCandidateIds as readonly string[]);
  if (row.sourceScopeId !== sourceScope.id || row.sourceOrchestrationId !== orchestration.id
      || row.sourceScopeDigest == null || row.sourceOrchestrationDigest == null) {
    throw new TypeError('Scope Lock source identities do not match canonical sources.');
  }
  const scopeDigest = row.sourceScopeDigest as Record<string, unknown>;
  const orchestrationDigest = row.sourceOrchestrationDigest as Record<string, unknown>;
  if (scopeDigest.algorithm !== SCOPE_LOCK_DIGEST_ALGORITHM || scopeDigest.hex !== sourceScope.scopeDigest.hex
      || orchestrationDigest.algorithm !== SCOPE_LOCK_DIGEST_ALGORITHM || orchestrationDigest.hex !== orchestration.orchestrationDigest.hex) {
    throw new TypeError('Scope Lock source digests do not match canonical sources.');
  }
  for (const [field, expected] of Object.entries({
    lockedCandidateIds: selection.lockedCandidateIds,
    lockedBuildStepIds: selection.lockedBuildStepIds,
    lockedWriteCandidateIds: selection.lockedWriteCandidateIds,
    lockedExecuteCandidateIds: selection.lockedExecuteCandidateIds,
  })) {
    if (JSON.stringify(row[field]) !== JSON.stringify(expected)) throw new TypeError(`Scope Lock ${field} is non-canonical.`);
  }
  const expectedHex = sha256Hex(canonicalLockMaterial(
    sourceScope,
    selection.lockedCandidateIds,
    selection.lockedBuildStepIds,
    selection.lockedWriteCandidateIds,
    selection.lockedExecuteCandidateIds,
  ));
  const digest = row.lockDigest as Record<string, unknown> | undefined;
  if (!digest || digest.algorithm !== SCOPE_LOCK_DIGEST_ALGORITHM || digest.hex !== expectedHex
      || row.id !== `scope-lock-${expectedHex.slice(0, 16)}`) {
    throw new TypeError('Scope Lock digest does not match canonical lock material.');
  }
}

export function assertScopeLockAllowsMutation(
  lock: ScopeLockRecord,
  orchestration: BuildOrchestratorRecord,
  candidateId: string,
  buildStepId: string,
  access: ScopeMutationAccess,
): ScopeCandidate {
  assertCanonicalScopeLock(lock, orchestration);
  if (!(SCOPE_LOCK_MUTATION_ACCESS as readonly string[]).includes(access)) throw new TypeError('Scope Lock mutation access is invalid.');
  const candidate = lock.sourceScope.candidates.find((item) => item.id === candidateId);
  if (!candidate || !lock.lockedCandidateIds.includes(candidateId)) {
    throw new TypeError('Scope Lock does not allow the requested candidate.');
  }
  if (candidate.buildStepId !== buildStepId) throw new TypeError('Scope Lock candidate does not belong to the requested Build step.');
  if (candidate.access !== access) throw new TypeError('Scope Lock candidate access does not match the requested mutation access.');
  return candidate;
}

export function isMutationScopeAccess(value: ScopeAccess): value is ScopeMutationAccess {
  return (SCOPE_LOCK_MUTATION_ACCESS as readonly string[]).includes(value);
}
