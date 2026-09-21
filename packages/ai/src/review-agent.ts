import {
  AGENT_RUNTIME_REGISTRY,
  AGENT_RUNTIME_SCHEMA,
  assertCanonicalAgentRuntime,
  getAgentRuntimeDescriptor,
  type AgentRuntimeRegistry,
} from './agent-runtime.js';
import {
  CODING_AGENT_SCHEMA,
  assertCanonicalCodingAgentExecution,
  type CodingAgentExecutionRecord,
} from './coding-agent.js';
import {
  DATABASE_AGENT_SCHEMA,
  assertCanonicalDatabaseAgentExecution,
  type DatabaseAgentExecutionRecord,
} from './database-agent.js';
import {
  TESTING_AGENT_SCHEMA,
  assertCanonicalTestingAgentExecution,
  type TestingAgentExecutionInput,
  type TestingAgentExecutionRecord,
} from './testing-agent.js';

export const REVIEW_AGENT_BUILD = 63 as const;
export const REVIEW_AGENT_SCHEMA = 'gd-review-agent/1' as const;
export const REVIEW_AGENT_SOURCE_RUNTIME_SCHEMA = 'gd-agent-runtime/1' as const;
export const REVIEW_AGENT_ID = 'weizenbaum' as const;
export const REVIEW_AGENT_NAME = 'Weizenbaum' as const;
export const REVIEW_AGENT_ROLE = 'reviewer-critic' as const;
export const REVIEW_AGENT_MODE = 'BUILD' as const;
export const REVIEW_AGENT_DIGEST_ALGORITHM = 'sha256' as const;
export const REVIEW_AGENT_MAX_FINDINGS = 256 as const;
export const REVIEW_AGENT_MAX_TEXT_CHARACTERS = 65536 as const;

export const REVIEW_AGENT_TARGET_KINDS = Object.freeze(['coding','database','testing'] as const);
export const REVIEW_AGENT_CATEGORIES = Object.freeze([
  'correctness','security','architecture','maintainability','testing',
] as const);
export const REVIEW_AGENT_SEVERITIES = Object.freeze([
  'info','warning','error','critical',
] as const);

export type ReviewAgentTargetKind = (typeof REVIEW_AGENT_TARGET_KINDS)[number];
export type ReviewAgentCategory = (typeof REVIEW_AGENT_CATEGORIES)[number];
export type ReviewAgentSeverity = (typeof REVIEW_AGENT_SEVERITIES)[number];

export type ReviewAgentTargetInput =
  | { readonly kind: 'coding'; readonly record: CodingAgentExecutionRecord }
  | { readonly kind: 'database'; readonly record: DatabaseAgentExecutionRecord }
  | { readonly kind: 'testing'; readonly record: TestingAgentExecutionRecord; readonly input: TestingAgentExecutionInput };

export interface ReviewAgentFindingInput {
  readonly id: string;
  readonly category: ReviewAgentCategory;
  readonly severity: ReviewAgentSeverity;
  readonly sourceRef: string;
  readonly statement: string;
}

export interface ReviewAgentInput {
  readonly registry?: AgentRuntimeRegistry;
  readonly target: ReviewAgentTargetInput;
  readonly findings: readonly ReviewAgentFindingInput[];
}

export interface ReviewAgentDigest {
  readonly algorithm: typeof REVIEW_AGENT_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface ReviewAgentFinding {
  readonly id: string;
  readonly ordinal: number;
  readonly category: ReviewAgentCategory;
  readonly severity: ReviewAgentSeverity;
  readonly sourceRef: string;
  readonly statement: string;
}

export interface ReviewAgentReport {
  readonly schema: typeof REVIEW_AGENT_SCHEMA;
  readonly sourceAgentRuntimeSchema: typeof REVIEW_AGENT_SOURCE_RUNTIME_SCHEMA;
  readonly sourceKind: ReviewAgentTargetKind;
  readonly sourceSchema: typeof CODING_AGENT_SCHEMA | typeof DATABASE_AGENT_SCHEMA | typeof TESTING_AGENT_SCHEMA;
  readonly sourceId: string;
  readonly sourceDigest: ReviewAgentDigest;
  readonly sourceWorkspaceId: string;
  readonly sourceStepId: string;
  readonly sourceVerdict: 'passed' | 'failed' | null;
  readonly sourceCompletionEligible: boolean | null;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof REVIEW_AGENT_MODE;
  readonly status: 'reviewed';
  readonly reviewState: 'clear' | 'findings-present';
  readonly agentId: typeof REVIEW_AGENT_ID;
  readonly agentName: typeof REVIEW_AGENT_NAME;
  readonly agentRole: typeof REVIEW_AGENT_ROLE;
  readonly findingCount: number;
  readonly infoCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly criticalCount: number;
  readonly findings: readonly ReviewAgentFinding[];
  readonly reviewDigest: ReviewAgentDigest;
  readonly namedAgentBinding: true;
  readonly reviewAgent: true;
  readonly reviewSpecialization: true;
  readonly reviewAdvisoryOnly: true;
  readonly sourceCanonicalRequired: true;
  readonly sourceReadOnlyPreserved: true;
  readonly explicitFindingsOnly: true;
  readonly semanticInference: false;
  readonly sourceVerdictReadOnlyPreserved: true;
  readonly sourceCompletionEligibilityReadOnlyPreserved: true;
  readonly vetoAuthority: false;
  readonly approvalAuthority: false;
  readonly completionAuthority: false;
  readonly validationAuthority: false;
  readonly checkpointAuthority: false;
  readonly architectureEnforcementAuthority: false;
  readonly capabilityGrantAuthority: false;
  readonly scopeAuthority: false;
  readonly directMutationAuthority: false;
  readonly codingAgentAuthority: false;
  readonly databaseAgentAuthority: false;
  readonly testingAgentAuthority: false;
  readonly agentOrchestratorAuthority: false;
  readonly automaticAgentSelection: false;
  readonly orchestration: false;
  readonly agentExecution: false;
  readonly toolExecution: false;
  readonly execution: false;
  readonly scheduling: false;
  readonly jobCreation: false;
  readonly persistence: false;
  readonly networkAuthority: false;
  readonly filesystemAuthority: false;
  readonly databaseAuthority: false;
  readonly studioTransport: false;
  readonly localRuntimeTransport: false;
  readonly deterministic: true;
  readonly environmentNeutral: true;
  readonly immutable: true;
}

interface ReviewSourceIdentity {
  readonly kind: ReviewAgentTargetKind;
  readonly schema: ReviewAgentReport['sourceSchema'];
  readonly id: string;
  readonly digest: string;
  readonly workspaceId: string;
  readonly stepId: string;
  readonly verdict: 'passed' | 'failed' | null;
  readonly completionEligible: boolean | null;
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

function digest(hex: string): ReviewAgentDigest {
  return Object.freeze({ algorithm: REVIEW_AGENT_DIGEST_ALGORITHM, hex });
}

function assertCanonicalSpecialist(registry: AgentRuntimeRegistry): void {
  assertCanonicalAgentRuntime(registry);
  const descriptor = getAgentRuntimeDescriptor(REVIEW_AGENT_ID);
  if (!descriptor || descriptor.id !== REVIEW_AGENT_ID || descriptor.name !== REVIEW_AGENT_NAME
      || descriptor.role !== REVIEW_AGENT_ROLE || descriptor.operational !== false || descriptor.capabilityPrincipal !== false) {
    throw new TypeError('Review Agent requires the canonical Weizenbaum reviewer-critic identity.');
  }
}

function normalizeText(value: unknown, label: string, max: number = REVIEW_AGENT_MAX_TEXT_CHARACTERS): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new TypeError(label + ' is invalid.');
  return normalized;
}

function normalizeTarget(target: ReviewAgentTargetInput): ReviewSourceIdentity {
  if (!target || typeof target !== 'object' || Array.isArray(target)) throw new TypeError('Review Agent target must be an object.');
  if (target.kind === 'coding') {
    if (JSON.stringify(Object.keys(target).sort()) !== JSON.stringify(['kind','record'])) throw new TypeError('Review Agent coding target shape is invalid.');
    assertCanonicalCodingAgentExecution(target.record);
    return Object.freeze({
      kind: 'coding',
      schema: target.record.schema,
      id: target.record.id,
      digest: target.record.codingDigest.hex,
      workspaceId: target.record.workspaceId,
      stepId: target.record.stepId,
      verdict: null,
      completionEligible: null,
    });
  }
  if (target.kind === 'database') {
    if (JSON.stringify(Object.keys(target).sort()) !== JSON.stringify(['kind','record'])) throw new TypeError('Review Agent database target shape is invalid.');
    assertCanonicalDatabaseAgentExecution(target.record);
    return Object.freeze({
      kind: 'database',
      schema: target.record.schema,
      id: target.record.id,
      digest: target.record.databaseDigest.hex,
      workspaceId: target.record.workspaceId,
      stepId: target.record.stepId,
      verdict: null,
      completionEligible: null,
    });
  }
  if (target.kind === 'testing') {
    if (JSON.stringify(Object.keys(target).sort()) !== JSON.stringify(['input','kind','record'])) throw new TypeError('Review Agent testing target shape is invalid.');
    assertCanonicalTestingAgentExecution(target.record, target.input);
    return Object.freeze({
      kind: 'testing',
      schema: target.record.schema,
      id: target.record.id,
      digest: target.record.sourceValidationDigest,
      workspaceId: target.record.workspaceId,
      stepId: target.record.stepId,
      verdict: target.record.verdict,
      completionEligible: target.record.completionEligible,
    });
  }
  throw new TypeError('Review Agent target kind is unsupported.');
}

function normalizeFindings(value: readonly ReviewAgentFindingInput[]): readonly ReviewAgentFinding[] {
  if (!Array.isArray(value) || value.length > REVIEW_AGENT_MAX_FINDINGS) {
    throw new TypeError('Review Agent findings must contain between 0 and ' + REVIEW_AGENT_MAX_FINDINGS + ' items.');
  }
  return Object.freeze(value.map((finding, index) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) throw new TypeError('Review Agent finding must be an object.');
    const expectedId = 'review-finding-' + String(index + 1).padStart(4, '0');
    if (finding.id !== expectedId) throw new TypeError('Review Agent finding id must be ' + expectedId + '.');
    if (!REVIEW_AGENT_CATEGORIES.includes(finding.category)) throw new TypeError('Review Agent finding category is invalid.');
    if (!REVIEW_AGENT_SEVERITIES.includes(finding.severity)) throw new TypeError('Review Agent finding severity is invalid.');
    return Object.freeze({
      id: expectedId,
      ordinal: index + 1,
      category: finding.category,
      severity: finding.severity,
      sourceRef: normalizeText(finding.sourceRef, 'Review Agent finding sourceRef', 1024),
      statement: normalizeText(finding.statement, 'Review Agent finding statement'),
    });
  }));
}

function canonicalReviewMaterial(source: ReviewSourceIdentity, findings: readonly ReviewAgentFinding[]): string {
  return JSON.stringify({
    schema: REVIEW_AGENT_SCHEMA,
    sourceAgentRuntimeSchema: REVIEW_AGENT_SOURCE_RUNTIME_SCHEMA,
    sourceKind: source.kind,
    sourceSchema: source.schema,
    sourceId: source.id,
    sourceDigest: { algorithm: REVIEW_AGENT_DIGEST_ALGORITHM, hex: source.digest },
    sourceWorkspaceId: source.workspaceId,
    sourceStepId: source.stepId,
    sourceVerdict: source.verdict,
    sourceCompletionEligible: source.completionEligible,
    mode: REVIEW_AGENT_MODE,
    agentId: REVIEW_AGENT_ID,
    agentName: REVIEW_AGENT_NAME,
    agentRole: REVIEW_AGENT_ROLE,
    findings: findings.map((finding) => ({
      id: finding.id,
      ordinal: finding.ordinal,
      category: finding.category,
      severity: finding.severity,
      sourceRef: finding.sourceRef,
      statement: finding.statement,
    })),
  });
}

export function createReviewAgentReport(input: ReviewAgentInput): ReviewAgentReport {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Review Agent input must be an object.');
  const keys = Object.keys(input as unknown as Record<string, unknown>).sort();
  const withoutRegistry = ['findings','target'];
  const withRegistry = ['findings','registry','target'];
  if (JSON.stringify(keys) !== JSON.stringify(withoutRegistry) && JSON.stringify(keys) !== JSON.stringify(withRegistry)) {
    throw new TypeError('Review Agent input accepts only optional registry, target and findings.');
  }

  assertCanonicalSpecialist(input.registry ?? AGENT_RUNTIME_REGISTRY);
  const source = normalizeTarget(input.target);
  if (!/^[0-9a-f]{64}$/.test(source.digest)) throw new TypeError('Review Agent source digest is invalid.');
  const findings = normalizeFindings(input.findings);
  const digestHex = sha256Hex(canonicalReviewMaterial(source, findings));
  const count = (severity: ReviewAgentSeverity) => findings.filter((finding) => finding.severity === severity).length;

  return Object.freeze({
    schema: REVIEW_AGENT_SCHEMA,
    sourceAgentRuntimeSchema: AGENT_RUNTIME_SCHEMA,
    sourceKind: source.kind,
    sourceSchema: source.schema,
    sourceId: source.id,
    sourceDigest: digest(source.digest),
    sourceWorkspaceId: source.workspaceId,
    sourceStepId: source.stepId,
    sourceVerdict: source.verdict,
    sourceCompletionEligible: source.completionEligible,
    id: 'review-report-' + digestHex.slice(0, 16),
    revision: 1,
    mode: REVIEW_AGENT_MODE,
    status: 'reviewed',
    reviewState: findings.length === 0 ? 'clear' : 'findings-present',
    agentId: REVIEW_AGENT_ID,
    agentName: REVIEW_AGENT_NAME,
    agentRole: REVIEW_AGENT_ROLE,
    findingCount: findings.length,
    infoCount: count('info'),
    warningCount: count('warning'),
    errorCount: count('error'),
    criticalCount: count('critical'),
    findings,
    reviewDigest: digest(digestHex),
    namedAgentBinding: true,
    reviewAgent: true,
    reviewSpecialization: true,
    reviewAdvisoryOnly: true,
    sourceCanonicalRequired: true,
    sourceReadOnlyPreserved: true,
    explicitFindingsOnly: true,
    semanticInference: false,
    sourceVerdictReadOnlyPreserved: true,
    sourceCompletionEligibilityReadOnlyPreserved: true,
    vetoAuthority: false,
    approvalAuthority: false,
    completionAuthority: false,
    validationAuthority: false,
    checkpointAuthority: false,
    architectureEnforcementAuthority: false,
    capabilityGrantAuthority: false,
    scopeAuthority: false,
    directMutationAuthority: false,
    codingAgentAuthority: false,
    databaseAgentAuthority: false,
    testingAgentAuthority: false,
    agentOrchestratorAuthority: false,
    automaticAgentSelection: false,
    orchestration: false,
    agentExecution: false,
    toolExecution: false,
    execution: false,
    scheduling: false,
    jobCreation: false,
    persistence: false,
    networkAuthority: false,
    filesystemAuthority: false,
    databaseAuthority: false,
    studioTransport: false,
    localRuntimeTransport: false,
    deterministic: true,
    environmentNeutral: true,
    immutable: true,
  });
}

export function assertCanonicalReviewAgentReport(value: unknown, input: ReviewAgentInput): asserts value is ReviewAgentReport {
  const canonical = createReviewAgentReport(input);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Review Agent report must be an object.');
  if (JSON.stringify(value) !== JSON.stringify(canonical)) throw new TypeError('Review Agent report is non-canonical.');
}
