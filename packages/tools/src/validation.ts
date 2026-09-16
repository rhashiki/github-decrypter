import type { BuildOrchestratorRecord } from '@github-decrypter/build';
import type { ScopeLockRecord } from '@github-decrypter/scope/lock';
import { type ToolValue } from './index.js';
import {
  CHECKPOINT_ENGINE_SCHEMA,
  assertCanonicalCheckpoint,
  type CheckpointRecord,
} from './checkpoint.js';

export const VALIDATION_PIPELINE_BUILD = 57 as const;
export const VALIDATION_PIPELINE_SCHEMA = 'gd-validation-pipeline/1' as const;
export const VALIDATION_PIPELINE_SOURCE_CHECKPOINT_SCHEMA = 'gd-checkpoint-engine/1' as const;
export const VALIDATION_PIPELINE_MODE = 'BUILD' as const;
export const VALIDATION_PIPELINE_DIGEST_ALGORITHM = 'sha256' as const;
export const VALIDATION_PIPELINE_MAX_CRITERIA = 256 as const;
export const VALIDATION_PIPELINE_MAX_TEXT_CHARACTERS = 65536 as const;
export const VALIDATION_PIPELINE_EVIDENCE_KINDS = Object.freeze([
  'tool-result',
  'test',
  'diagnostic',
  'preview',
] as const);
export const VALIDATION_PIPELINE_OPERATORS = Object.freeze([
  'equals',
  'not-equals',
  'truthy',
  'falsy',
  'exists',
  'contains',
] as const);

export type ValidationEvidenceKind = (typeof VALIDATION_PIPELINE_EVIDENCE_KINDS)[number];
export type ValidationOperator = (typeof VALIDATION_PIPELINE_OPERATORS)[number];

export type ValidationExpectation =
  | { readonly operator: 'equals' | 'not-equals' | 'contains'; readonly expected: ToolValue }
  | { readonly operator: 'truthy' | 'falsy' | 'exists' };

export interface ValidationCriterionInput {
  readonly id: string;
  readonly statement: string;
  readonly expectation: ValidationExpectation;
}

export interface ValidationObservationInput {
  readonly criterionId: string;
  readonly kind: ValidationEvidenceKind;
  readonly sourceRef: string;
  readonly observed: ToolValue;
}

export interface ValidationPipelineInput {
  readonly orchestration: BuildOrchestratorRecord;
  readonly checkpoint: CheckpointRecord;
  readonly scopeLock?: ScopeLockRecord;
  readonly criteria: readonly ValidationCriterionInput[];
  readonly observations: readonly ValidationObservationInput[];
}

export interface ValidationDigest {
  readonly algorithm: typeof VALIDATION_PIPELINE_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ValidationCriterionResult {
  readonly criterionId: string;
  readonly statement: string;
  readonly operator: ValidationOperator;
  readonly expected: ToolValue | null;
  readonly observed: ToolValue;
  readonly evidenceKind: ValidationEvidenceKind;
  readonly sourceRef: string;
  readonly passed: boolean;
}

export interface ValidationRecord {
  readonly schema: typeof VALIDATION_PIPELINE_SCHEMA;
  readonly sourceCheckpointSchema: typeof VALIDATION_PIPELINE_SOURCE_CHECKPOINT_SCHEMA;
  readonly sourceCheckpointId: string;
  readonly sourceCheckpointDigest: ValidationDigest;
  readonly sourceOrchestrationId: string;
  readonly sourceOrchestrationDigest: ValidationDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof VALIDATION_PIPELINE_MODE;
  readonly status: 'validated';
  readonly verdict: 'passed' | 'failed';
  readonly workspaceId: string;
  readonly stepId: string;
  readonly criteria: readonly ValidationCriterionResult[];
  readonly passedCount: number;
  readonly failedCount: number;
  readonly validationDigest: ValidationDigest;
  readonly immutable: true;
  readonly deterministic: true;
  readonly environmentNeutral: true;
  readonly workspaceScoped: true;
  readonly checkpointRequired: true;
  readonly checkpointReadOnlyPreserved: true;
  readonly acceptanceCriteriaRequired: true;
  readonly observedEvidenceRequired: true;
  readonly failClosed: true;
  readonly behavioralValidation: true;
  readonly validationPipeline: true;
  readonly completionEligible: boolean;
  readonly interactiveQAFoundation: true;
  readonly testingAgentBuild: 62;
  readonly testingAgentAuthority: false;
  readonly viktorCommunicationAuthority: false;
  readonly capabilityGrantAuthority: false;
  readonly mutationAuthorized: false;
  readonly toolExecution: false;
  readonly externalFlowExecution: false;
  readonly execution: false;
  readonly checkpoints: false;
  readonly restoreExecution: false;
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

function digest(hex: string): ValidationDigest {
  return Object.freeze({ algorithm: VALIDATION_PIPELINE_DIGEST_ALGORITHM, hex });
}

function canonicalValue(value: ToolValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Validation Pipeline values must contain only finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalValue(item)).join(',')}]`;
  if (typeof value === 'object') {
    const row = value as { readonly [key: string]: ToolValue };
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(row[key]!)}`).join(',')}}`;
  }
  throw new TypeError('Validation Pipeline requires JSON-compatible values.');
}

function immutableValue(value: ToolValue): ToolValue {
  const copy = JSON.parse(canonicalValue(value)) as ToolValue;
  const freeze = (item: ToolValue): ToolValue => {
    if (Array.isArray(item)) {
      for (const child of item) freeze(child);
      return Object.freeze(item);
    }
    if (item !== null && typeof item === 'object') {
      for (const child of Object.values(item)) freeze(child);
      return Object.freeze(item);
    }
    return item;
  };
  return freeze(copy);
}

function normalizeCriterion(value: ValidationCriterionInput, index: number): ValidationCriterionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Validation criterion ${index + 1} must be an object.`);
  const expectedId = `validation-criterion-${String(index + 1).padStart(4, '0')}`;
  if (value.id !== expectedId) throw new TypeError(`Validation criterion id must be ${expectedId}.`);
  const statement = typeof value.statement === 'string' ? value.statement.trim() : '';
  if (statement.length === 0 || statement.length > VALIDATION_PIPELINE_MAX_TEXT_CHARACTERS) throw new TypeError(`Validation criterion ${expectedId} statement is invalid.`);
  const expectation = value.expectation as ValidationExpectation;
  if (!expectation || typeof expectation !== 'object' || Array.isArray(expectation)
      || !VALIDATION_PIPELINE_OPERATORS.includes(expectation.operator as ValidationOperator)) {
    throw new TypeError(`Validation criterion ${expectedId} expectation is invalid.`);
  }
  const keys = Object.keys(expectation).sort();
  const requiresExpected = expectation.operator === 'equals' || expectation.operator === 'not-equals' || expectation.operator === 'contains';
  if (requiresExpected) {
    if (JSON.stringify(keys) !== JSON.stringify(['expected','operator'])) throw new TypeError(`Validation criterion ${expectedId} expectation shape is invalid.`);
    return Object.freeze({ id: expectedId, statement, expectation: Object.freeze({ operator: expectation.operator, expected: immutableValue(expectation.expected) }) });
  }
  if (JSON.stringify(keys) !== JSON.stringify(['operator'])) throw new TypeError(`Validation criterion ${expectedId} expectation shape is invalid.`);
  return Object.freeze({ id: expectedId, statement, expectation: Object.freeze({ operator: expectation.operator }) });
}

function normalizeObservation(value: ValidationObservationInput, criterionId: string): ValidationObservationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Validation observation for ${criterionId} must be an object.`);
  if (value.criterionId !== criterionId) throw new TypeError(`Validation observation must bind exactly to ${criterionId}.`);
  if (!VALIDATION_PIPELINE_EVIDENCE_KINDS.includes(value.kind as ValidationEvidenceKind)) throw new TypeError(`Validation observation ${criterionId} evidence kind is invalid.`);
  const sourceRef = typeof value.sourceRef === 'string' ? value.sourceRef.trim() : '';
  if (sourceRef.length === 0 || sourceRef.length > 1024) throw new TypeError(`Validation observation ${criterionId} sourceRef is invalid.`);
  return Object.freeze({ criterionId, kind: value.kind, sourceRef, observed: immutableValue(value.observed) });
}

function contains(observed: ToolValue, expected: ToolValue): boolean {
  if (typeof observed === 'string' && typeof expected === 'string') return observed.includes(expected);
  if (Array.isArray(observed)) return observed.some((item) => canonicalValue(item) === canonicalValue(expected));
  return false;
}

function evaluate(expectation: ValidationExpectation, observed: ToolValue): boolean {
  switch (expectation.operator) {
    case 'equals': return canonicalValue(observed) === canonicalValue(expectation.expected);
    case 'not-equals': return canonicalValue(observed) !== canonicalValue(expectation.expected);
    case 'truthy': return Boolean(observed);
    case 'falsy': return !observed;
    case 'exists': return observed !== null;
    case 'contains': return contains(observed, expectation.expected);
  }
}

function canonicalValidationMaterial(checkpoint: CheckpointRecord, criteria: readonly ValidationCriterionResult[]): string {
  return JSON.stringify({
    schema: VALIDATION_PIPELINE_SCHEMA,
    sourceCheckpointSchema: CHECKPOINT_ENGINE_SCHEMA,
    sourceCheckpointId: checkpoint.id,
    sourceCheckpointDigest: checkpoint.checkpointDigest,
    sourceOrchestrationId: checkpoint.sourceOrchestrationId,
    sourceOrchestrationDigest: checkpoint.sourceOrchestrationDigest,
    mode: VALIDATION_PIPELINE_MODE,
    workspaceId: checkpoint.workspaceId,
    stepId: checkpoint.stepId,
    criteria: criteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      statement: criterion.statement,
      operator: criterion.operator,
      expected: criterion.expected,
      observed: criterion.observed,
      evidenceKind: criterion.evidenceKind,
      sourceRef: criterion.sourceRef,
      passed: criterion.passed,
    })),
  });
}

export function createValidation(input: ValidationPipelineInput): ValidationRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Validation Pipeline input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  const baseKeys = ['checkpoint','criteria','observations','orchestration'];
  const scopedKeys = ['checkpoint','criteria','observations','orchestration','scopeLock'];
  if (JSON.stringify(keys) !== JSON.stringify(baseKeys) && JSON.stringify(keys) !== JSON.stringify(scopedKeys)) {
    throw new TypeError('Validation Pipeline input accepts only orchestration, checkpoint, optional scopeLock, criteria and observations.');
  }
  const scopeLock = row.scopeLock as ScopeLockRecord | undefined;
  assertCanonicalCheckpoint(row.checkpoint, row.orchestration as BuildOrchestratorRecord, scopeLock);
  const checkpoint = row.checkpoint;
  if (!Array.isArray(row.criteria) || row.criteria.length === 0 || row.criteria.length > VALIDATION_PIPELINE_MAX_CRITERIA) {
    throw new TypeError(`Validation Pipeline requires between 1 and ${VALIDATION_PIPELINE_MAX_CRITERIA} explicit acceptance criteria.`);
  }
  if (!Array.isArray(row.observations) || row.observations.length !== row.criteria.length) {
    throw new TypeError('Validation Pipeline requires exactly one observed evidence record per acceptance criterion.');
  }
  const criteria = (row.criteria as ValidationCriterionInput[]).map(normalizeCriterion);
  const observationRows = row.observations as ValidationObservationInput[];
  const observationById = new Map<string, ValidationObservationInput>();
  for (const observation of observationRows) {
    if (!observation || typeof observation !== 'object' || Array.isArray(observation) || typeof observation.criterionId !== 'string') {
      throw new TypeError('Validation Pipeline observation is invalid.');
    }
    if (observationById.has(observation.criterionId)) throw new TypeError(`Validation Pipeline received duplicate evidence for ${observation.criterionId}.`);
    observationById.set(observation.criterionId, observation);
  }
  const results: ValidationCriterionResult[] = criteria.map((criterion) => {
    const observation = observationById.get(criterion.id);
    if (!observation) throw new TypeError(`Validation Pipeline is missing observed evidence for ${criterion.id}.`);
    const normalized = normalizeObservation(observation, criterion.id);
    const expected = 'expected' in criterion.expectation ? criterion.expectation.expected : null;
    return Object.freeze({
      criterionId: criterion.id,
      statement: criterion.statement,
      operator: criterion.expectation.operator,
      expected,
      observed: normalized.observed,
      evidenceKind: normalized.kind,
      sourceRef: normalized.sourceRef,
      passed: evaluate(criterion.expectation, normalized.observed),
    });
  });
  if (observationById.size !== results.length) throw new TypeError('Validation Pipeline observations must map only to declared acceptance criteria.');
  const frozenResults = Object.freeze(results);
  const failedCount = results.filter((result) => !result.passed).length;
  const passedCount = results.length - failedCount;
  const verdict = failedCount === 0 ? 'passed' : 'failed';
  const digestHex = sha256Hex(canonicalValidationMaterial(checkpoint, frozenResults));
  return Object.freeze({
    schema: VALIDATION_PIPELINE_SCHEMA,
    sourceCheckpointSchema: VALIDATION_PIPELINE_SOURCE_CHECKPOINT_SCHEMA,
    sourceCheckpointId: checkpoint.id,
    sourceCheckpointDigest: digest(checkpoint.checkpointDigest.hex),
    sourceOrchestrationId: checkpoint.sourceOrchestrationId,
    sourceOrchestrationDigest: digest(checkpoint.sourceOrchestrationDigest.hex),
    id: `validation-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: VALIDATION_PIPELINE_MODE,
    status: 'validated',
    verdict,
    workspaceId: checkpoint.workspaceId,
    stepId: checkpoint.stepId,
    criteria: frozenResults,
    passedCount,
    failedCount,
    validationDigest: digest(digestHex),
    immutable: true,
    deterministic: true,
    environmentNeutral: true,
    workspaceScoped: true,
    checkpointRequired: true,
    checkpointReadOnlyPreserved: true,
    acceptanceCriteriaRequired: true,
    observedEvidenceRequired: true,
    failClosed: true,
    behavioralValidation: true,
    validationPipeline: true,
    completionEligible: verdict === 'passed',
    interactiveQAFoundation: true,
    testingAgentBuild: 62,
    testingAgentAuthority: false,
    viktorCommunicationAuthority: false,
    capabilityGrantAuthority: false,
    mutationAuthorized: false,
    toolExecution: false,
    externalFlowExecution: false,
    execution: false,
    checkpoints: false,
    restoreExecution: false,
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

export function assertCanonicalValidation(value: unknown, input: ValidationPipelineInput): asserts value is ValidationRecord {
  const canonical = createValidation(input);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Validation Pipeline requires a canonical validation record.');
  const row = value as ValidationRecord;
  if (row.schema !== canonical.schema || row.sourceCheckpointSchema !== canonical.sourceCheckpointSchema
      || row.sourceCheckpointId !== canonical.sourceCheckpointId || row.sourceCheckpointDigest?.hex !== canonical.sourceCheckpointDigest.hex
      || row.sourceOrchestrationId !== canonical.sourceOrchestrationId || row.sourceOrchestrationDigest?.hex !== canonical.sourceOrchestrationDigest.hex
      || row.id !== canonical.id || row.revision !== 1 || row.mode !== VALIDATION_PIPELINE_MODE || row.status !== 'validated'
      || row.verdict !== canonical.verdict || row.workspaceId !== canonical.workspaceId || row.stepId !== canonical.stepId
      || row.passedCount !== canonical.passedCount || row.failedCount !== canonical.failedCount
      || row.validationDigest?.algorithm !== VALIDATION_PIPELINE_DIGEST_ALGORITHM || row.validationDigest.hex !== canonical.validationDigest.hex
      || canonicalValue(row.criteria as unknown as ToolValue) !== canonicalValue(canonical.criteria as unknown as ToolValue)
      || row.immutable !== true || row.deterministic !== true || row.environmentNeutral !== true || row.workspaceScoped !== true
      || row.checkpointRequired !== true || row.checkpointReadOnlyPreserved !== true || row.acceptanceCriteriaRequired !== true
      || row.observedEvidenceRequired !== true || row.failClosed !== true || row.behavioralValidation !== true
      || row.validationPipeline !== true || row.completionEligible !== canonical.completionEligible || row.interactiveQAFoundation !== true
      || row.testingAgentBuild !== 62 || row.testingAgentAuthority !== false || row.viktorCommunicationAuthority !== false
      || row.capabilityGrantAuthority !== false || row.mutationAuthorized !== false || row.toolExecution !== false
      || row.externalFlowExecution !== false || row.execution !== false || row.checkpoints !== false || row.restoreExecution !== false
      || row.scheduling !== false || row.jobCreation !== false || row.persistence !== false || row.networkAuthority !== false
      || row.filesystemAuthority !== false || row.databaseAuthority !== false || row.studioTransport !== false || row.localRuntimeTransport !== false) {
    throw new TypeError('Validation Pipeline record is non-canonical.');
  }
}
