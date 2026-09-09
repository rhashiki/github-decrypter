import {
  PLAN_AUTHORITY_SCHEMA,
  assertPlanAuthorityRecord,
  type PlanAuthorityDigest,
  type PlanAuthorityRecord,
} from './authority.js';

export const DECISION_ENGINE_BUILD = 49 as const;
export const DECISION_ENGINE_SCHEMA = 'gd-decision-engine/1' as const;
export const DECISION_ENGINE_SOURCE_PLAN_SCHEMA = 'gd-plan-authority/1' as const;
export const DECISION_ENGINE_MODE = 'PLAN' as const;
export const DECISION_ENGINE_DIGEST_ALGORITHM = 'sha256' as const;
export const DECISION_ENGINE_MIN_ALTERNATIVES = 2 as const;
export const DECISION_ENGINE_MAX_ALTERNATIVES = 32 as const;
export const DECISION_ENGINE_MAX_TRADEOFFS = 32 as const;
export const DECISION_ENGINE_MAX_TEXT = 65_536 as const;

export interface DecisionAlternativeInput {
  readonly label: string;
  readonly summary: string;
  readonly tradeoffs: readonly string[];
}

export interface DecisionEngineInput {
  readonly plan: PlanAuthorityRecord;
  readonly question: string;
  readonly alternatives: readonly DecisionAlternativeInput[];
  readonly selectedAlternativeOrdinal: number;
  readonly rationale: string;
}

export interface DecisionAlternative {
  readonly id: string;
  readonly ordinal: number;
  readonly label: string;
  readonly summary: string;
  readonly tradeoffs: readonly string[];
}

export interface DecisionDigest {
  readonly algorithm: typeof DECISION_ENGINE_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface DecisionRecord {
  readonly schema: typeof DECISION_ENGINE_SCHEMA;
  readonly sourcePlanSchema: typeof DECISION_ENGINE_SOURCE_PLAN_SCHEMA;
  readonly sourcePlanId: string;
  readonly sourcePlanDigest: PlanAuthorityDigest;
  readonly id: string;
  readonly revision: 1;
  readonly mode: typeof DECISION_ENGINE_MODE;
  readonly status: 'resolved';
  readonly question: string;
  readonly alternatives: readonly DecisionAlternative[];
  readonly selectedAlternativeId: string;
  readonly selectedAlternativeOrdinal: number;
  readonly rationale: string;
  readonly decisionDigest: DecisionDigest;
  readonly readOnly: true;
  readonly planReadOnlyPreserved: true;
  readonly explicitAlternativesOnly: true;
  readonly selectionDeclaredByCaller: true;
  readonly semanticInference: false;
  readonly automaticScoring: false;
  readonly decisionEngineApplied: true;
  readonly projectRulesApplied: false;
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
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map((value) => value.toString(16).padStart(8, '0')).join('');
}

function normalizeText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (normalized.length === 0) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > DECISION_ENGINE_MAX_TEXT) throw new RangeError(`${label} exceeds the Decision Engine text limit.`);
  return normalized;
}

function canonicalAlternative(value: unknown, index: number): DecisionAlternative {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Decision alternative ${index + 1} must be an object.`);
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['label','summary','tradeoffs'])) {
    throw new TypeError(`Decision alternative ${index + 1} accepts only label, summary and tradeoffs.`);
  }
  if (!Array.isArray(row.tradeoffs) || row.tradeoffs.length < 1 || row.tradeoffs.length > DECISION_ENGINE_MAX_TRADEOFFS) {
    throw new RangeError(`Decision alternative ${index + 1} must declare between 1 and ${DECISION_ENGINE_MAX_TRADEOFFS} tradeoffs.`);
  }
  const tradeoffs = Object.freeze(row.tradeoffs.map((item, tradeoffIndex) => normalizeText(item, `Decision alternative ${index + 1} tradeoff ${tradeoffIndex + 1}`)));
  return Object.freeze({
    id: `alternative-${String(index + 1).padStart(4, '0')}`,
    ordinal: index + 1,
    label: normalizeText(row.label, `Decision alternative ${index + 1} label`),
    summary: normalizeText(row.summary, `Decision alternative ${index + 1} summary`),
    tradeoffs,
  });
}

function canonicalMaterial(
  plan: PlanAuthorityRecord,
  question: string,
  alternatives: readonly DecisionAlternative[],
  selectedAlternativeOrdinal: number,
  rationale: string,
): string {
  return JSON.stringify({
    schema: DECISION_ENGINE_SCHEMA,
    sourcePlanSchema: PLAN_AUTHORITY_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: plan.authorityDigest,
    question,
    alternatives: alternatives.map((alternative) => ({
      id: alternative.id,
      ordinal: alternative.ordinal,
      label: alternative.label,
      summary: alternative.summary,
      tradeoffs: [...alternative.tradeoffs],
    })),
    selectedAlternativeOrdinal,
    rationale,
  });
}

export function resolveDecision(input: DecisionEngineInput): DecisionRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Decision Engine input must be an object.');
  const row = input as unknown as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['alternatives','plan','question','rationale','selectedAlternativeOrdinal'])) {
    throw new TypeError('Decision Engine input accepts only plan, question, alternatives, selectedAlternativeOrdinal and rationale.');
  }

  assertPlanAuthorityRecord(row.plan);
  const plan = row.plan;
  if (plan.status !== 'draft' || plan.approved !== false) {
    throw new TypeError('Decision Engine resolves architectural alternatives only while the source Plan remains draft.');
  }
  if (!Array.isArray(row.alternatives) || row.alternatives.length < DECISION_ENGINE_MIN_ALTERNATIVES
      || row.alternatives.length > DECISION_ENGINE_MAX_ALTERNATIVES) {
    throw new RangeError(`Decision Engine requires between ${DECISION_ENGINE_MIN_ALTERNATIVES} and ${DECISION_ENGINE_MAX_ALTERNATIVES} alternatives.`);
  }

  const question = normalizeText(row.question, 'Decision question');
  const alternatives = Object.freeze(row.alternatives.map((alternative, index) => canonicalAlternative(alternative, index)));
  if (new Set(alternatives.map((alternative) => alternative.label)).size !== alternatives.length) {
    throw new TypeError('Decision Engine alternative labels must be unique.');
  }
  if (!Number.isInteger(row.selectedAlternativeOrdinal)
      || (row.selectedAlternativeOrdinal as number) < 1
      || (row.selectedAlternativeOrdinal as number) > alternatives.length) {
    throw new RangeError('Decision Engine selectedAlternativeOrdinal does not identify a declared alternative.');
  }
  const selectedAlternativeOrdinal = row.selectedAlternativeOrdinal as number;
  const selected = alternatives[selectedAlternativeOrdinal - 1]!;
  const rationale = normalizeText(row.rationale, 'Decision rationale');
  const digestHex = sha256Hex(canonicalMaterial(plan, question, alternatives, selectedAlternativeOrdinal, rationale));
  const decisionDigest = Object.freeze({ algorithm: DECISION_ENGINE_DIGEST_ALGORITHM, hex: digestHex });

  return Object.freeze({
    schema: DECISION_ENGINE_SCHEMA,
    sourcePlanSchema: DECISION_ENGINE_SOURCE_PLAN_SCHEMA,
    sourcePlanId: plan.id,
    sourcePlanDigest: Object.freeze({ algorithm: plan.authorityDigest.algorithm, hex: plan.authorityDigest.hex }),
    id: `decision-${digestHex.slice(0, 16)}`,
    revision: 1,
    mode: DECISION_ENGINE_MODE,
    status: 'resolved',
    question,
    alternatives,
    selectedAlternativeId: selected.id,
    selectedAlternativeOrdinal,
    rationale,
    decisionDigest,
    readOnly: true,
    planReadOnlyPreserved: true,
    explicitAlternativesOnly: true,
    selectionDeclaredByCaller: true,
    semanticInference: false,
    automaticScoring: false,
    decisionEngineApplied: true,
    projectRulesApplied: false,
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
