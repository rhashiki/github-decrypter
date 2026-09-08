import type { PromptIntakeDigest } from '@github-decrypter/plan';
import type {
  ContextContinuationFrame,
  ContextContinuationPlan,
} from './continuation.js';

export const TOKEN_ABSTRACTION_BUILD = 43 as const;
export const TOKEN_ABSTRACTION_SCHEMA = 'gd-token-abstraction/1' as const;
export const TOKEN_ABSTRACTION_SOURCE_SCHEMA = 'gd-context-continuation/1' as const;
export const TOKEN_ABSTRACTION_ROOT_ID = 'ctx-root' as const;
export const TOKEN_ABSTRACTION_MAX_FRAMES = 4096 as const;
export const TOKEN_ABSTRACTION_ENVELOPE_PREFIX = 'ctxwin-' as const;

export interface ModelTokenWindow {
  readonly contextWindowTokens: number;
  readonly reservedOutputTokens: number;
}

export interface TokenAbstractionInput {
  readonly continuation: ContextContinuationPlan;
  readonly window: ModelTokenWindow;
}

export interface TokenWindowEnvelope {
  readonly id: string;
  readonly ordinal: number;
  readonly continuationFrameId: string;
  readonly taskContextId: string;
  readonly taskId: string;
  readonly requirementId: string;
  readonly carriedContextIds: readonly string[];
  readonly contextWindowTokens: number;
  readonly reservedOutputTokens: number;
  readonly usableInputTokens: number;
  readonly metering: 'unmeasured';
  readonly fitStatus: 'unknown';
  readonly overflowDecision: 'deferred';
}

export interface TokenAbstractionPlan {
  readonly schema: typeof TOKEN_ABSTRACTION_SCHEMA;
  readonly sourceSchema: typeof TOKEN_ABSTRACTION_SOURCE_SCHEMA;
  readonly sourceDigest: PromptIntakeDigest;
  readonly rootContextId: typeof TOKEN_ABSTRACTION_ROOT_ID;
  readonly modelWindow: Readonly<ModelTokenWindow & { usableInputTokens: number }>;
  readonly envelopes: readonly TokenWindowEnvelope[];
  readonly envelopeOrder: readonly string[];
  readonly requirementCompilation: true;
  readonly taskGraphCompilation: true;
  readonly contextCompilation: true;
  readonly contextContinuation: true;
  readonly tokenAbstraction: true;
  readonly deterministic: true;
  readonly finiteModelWindow: true;
  readonly userFacingRawTokenBudget: false;
  readonly infiniteContextClaim: false;
  readonly tokenizerExecution: false;
  readonly contentTokenEstimation: false;
  readonly silentTruncation: false;
  readonly semanticCompression: false;
  readonly orchestrationRequired: true;
  readonly attachmentIngestion: false;
  readonly mentionResolution: false;
  readonly conversationHistory: false;
  readonly projectMemory: false;
  readonly contextPackPersistence: false;
  readonly aiExecution: false;
  readonly execution: false;
  readonly persistence: false;
}

function assertDigest(value: unknown): asserts value is PromptIntakeDigest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Token Abstraction source digest must be an object.');
  }
  const row = value as Record<string, unknown>;
  if (row.algorithm !== 'sha256' || typeof row.hex !== 'string' || !/^[0-9a-f]{64}$/.test(row.hex)) {
    throw new TypeError('Token Abstraction source digest is invalid.');
  }
}

function assertCanonicalIds(value: unknown, pattern: RegExp, field: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !pattern.test(id))) {
    throw new TypeError(`Token Abstraction ${field} is invalid.`);
  }
  if (new Set(value).size !== value.length) {
    throw new TypeError(`Token Abstraction ${field} contains duplicate identities.`);
  }
}

function assertContinuationFrame(value: unknown, index: number): asserts value is ContextContinuationFrame {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Token Abstraction continuation frame ${index + 1} must be an object.`);
  }
  const row = value as Record<string, unknown>;
  const expectedId = `cont-${String(index + 1).padStart(4, '0')}`;
  const expectedPreviousFrameId = index === 0 ? null : `cont-${String(index).padStart(4, '0')}`;
  if (
    row.id !== expectedId || row.ordinal !== index + 1
    || typeof row.taskContextId !== 'string' || !/^ctx-task-\d{4}$/.test(row.taskContextId)
    || typeof row.taskId !== 'string' || !/^task-\d{4}$/.test(row.taskId)
    || row.taskContextId !== `ctx-${row.taskId}`
    || typeof row.requirementId !== 'string' || !/^req-\d{4}$/.test(row.requirementId)
    || !Number.isInteger(row.level) || (row.level as number) < 0
    || row.previousFrameId !== expectedPreviousFrameId
    || (index === 0 ? row.previousTaskContextId !== null
      : typeof row.previousTaskContextId !== 'string' || !/^ctx-task-\d{4}$/.test(row.previousTaskContextId))
  ) {
    throw new TypeError(`Token Abstraction continuation frame ${index + 1} is non-canonical.`);
  }

  assertCanonicalIds(row.directDependencyContextIds, /^ctx-task-\d{4}$/, `frame ${expectedId} direct dependency contexts`);
  assertCanonicalIds(row.inheritedDependencyContextIds, /^ctx-task-\d{4}$/, `frame ${expectedId} inherited dependency contexts`);
  assertCanonicalIds(row.carriedContextIds, /^(?:ctx-root|ctx-task-\d{4})$/, `frame ${expectedId} carried contexts`);

  const direct = row.directDependencyContextIds as readonly string[];
  const inherited = row.inheritedDependencyContextIds as readonly string[];
  const carried = row.carriedContextIds as readonly string[];
  if (direct.some((id) => !inherited.includes(id))) {
    throw new TypeError(`Token Abstraction continuation frame ${expectedId} lost a direct dependency.`);
  }
  if (JSON.stringify(carried) !== JSON.stringify([TOKEN_ABSTRACTION_ROOT_ID, ...inherited])) {
    throw new TypeError(`Token Abstraction continuation frame ${expectedId} carried context boundary is invalid.`);
  }
}

function assertContinuation(value: unknown): asserts value is ContextContinuationPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Token Abstraction continuation input must be a ContextContinuationPlan.');
  }
  const row = value as Record<string, unknown>;
  if (row.schema !== TOKEN_ABSTRACTION_SOURCE_SCHEMA || row.sourceSchema !== 'gd-hierarchical-context/1'
      || row.rootContextId !== TOKEN_ABSTRACTION_ROOT_ID) {
    throw new TypeError('Token Abstraction requires canonical Context Continuation output.');
  }
  assertDigest(row.sourceDigest);
  if (!Array.isArray(row.frames) || row.frames.length > TOKEN_ABSTRACTION_MAX_FRAMES) {
    throw new RangeError(`Token Abstraction accepts at most ${TOKEN_ABSTRACTION_MAX_FRAMES} continuation frames.`);
  }
  row.frames.forEach((frame, index) => assertContinuationFrame(frame, index));
  const frames = row.frames as ContextContinuationFrame[];
  if (!Array.isArray(row.frameOrder)
      || JSON.stringify(row.frameOrder) !== JSON.stringify(frames.map((frame) => frame.id))) {
    throw new TypeError('Token Abstraction continuation frame order is invalid.');
  }
  for (const [index, frame] of frames.entries()) {
    if (index > 0 && frame.previousTaskContextId !== frames[index - 1]!.taskContextId) {
      throw new TypeError(`Token Abstraction continuation frame ${frame.id} previous task context is invalid.`);
    }
  }

  const flags: Readonly<Record<string, boolean>> = {
    requirementCompilation: true,
    taskGraphCompilation: true,
    contextCompilation: true,
    contextContinuation: true,
    deterministic: true,
    sequentialHandoff: true,
    dependencyContextCarry: true,
    semanticExpansion: false,
    tokenAbstraction: false,
    projectMemory: false,
    contextPackPersistence: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    execution: false,
    persistence: false,
  };
  for (const [field, expected] of Object.entries(flags)) {
    if (row[field] !== expected) {
      throw new TypeError(`Token Abstraction source ${field} boundary is invalid.`);
    }
  }
}

function assertModelWindow(value: unknown): asserts value is ModelTokenWindow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Token Abstraction model window must be an object.');
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['contextWindowTokens', 'reservedOutputTokens'])) {
    throw new TypeError('Token Abstraction model window accepts only contextWindowTokens and reservedOutputTokens.');
  }
  if (!Number.isSafeInteger(row.contextWindowTokens) || (row.contextWindowTokens as number) <= 0) {
    throw new RangeError('Token Abstraction contextWindowTokens must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(row.reservedOutputTokens) || (row.reservedOutputTokens as number) < 0
      || (row.reservedOutputTokens as number) >= (row.contextWindowTokens as number)) {
    throw new RangeError('Token Abstraction reservedOutputTokens must be a non-negative safe integer below total context capacity.');
  }
}

function asTokenAbstractionInput(value: unknown): TokenAbstractionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Token Abstraction input must be an object.');
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['continuation', 'window'])) {
    throw new TypeError('Token Abstraction input accepts only continuation and window fields.');
  }
  assertContinuation(row.continuation);
  assertModelWindow(row.window);
  return { continuation: row.continuation, window: row.window };
}

export function abstractTokenWindow(input: TokenAbstractionInput): TokenAbstractionPlan {
  const { continuation, window: modelWindowInput } = asTokenAbstractionInput(input);
  const usableInputTokens = modelWindowInput.contextWindowTokens - modelWindowInput.reservedOutputTokens;
  const modelWindow = Object.freeze({
    contextWindowTokens: modelWindowInput.contextWindowTokens,
    reservedOutputTokens: modelWindowInput.reservedOutputTokens,
    usableInputTokens,
  });
  const envelopes = Object.freeze(continuation.frames.map((frame, index) => Object.freeze({
    id: `${TOKEN_ABSTRACTION_ENVELOPE_PREFIX}${String(index + 1).padStart(4, '0')}`,
    ordinal: index + 1,
    continuationFrameId: frame.id,
    taskContextId: frame.taskContextId,
    taskId: frame.taskId,
    requirementId: frame.requirementId,
    carriedContextIds: Object.freeze([...frame.carriedContextIds]),
    contextWindowTokens: modelWindow.contextWindowTokens,
    reservedOutputTokens: modelWindow.reservedOutputTokens,
    usableInputTokens: modelWindow.usableInputTokens,
    metering: 'unmeasured' as const,
    fitStatus: 'unknown' as const,
    overflowDecision: 'deferred' as const,
  }))));
  const sourceDigest: PromptIntakeDigest = Object.freeze({
    algorithm: continuation.sourceDigest.algorithm,
    hex: continuation.sourceDigest.hex,
  });

  return Object.freeze({
    schema: TOKEN_ABSTRACTION_SCHEMA,
    sourceSchema: TOKEN_ABSTRACTION_SOURCE_SCHEMA,
    sourceDigest,
    rootContextId: TOKEN_ABSTRACTION_ROOT_ID,
    modelWindow,
    envelopes,
    envelopeOrder: Object.freeze(envelopes.map((envelope) => envelope.id)),
    requirementCompilation: true,
    taskGraphCompilation: true,
    contextCompilation: true,
    contextContinuation: true,
    tokenAbstraction: true,
    deterministic: true,
    finiteModelWindow: true,
    userFacingRawTokenBudget: false,
    infiniteContextClaim: false,
    tokenizerExecution: false,
    contentTokenEstimation: false,
    silentTruncation: false,
    semanticCompression: false,
    orchestrationRequired: true,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    projectMemory: false,
    contextPackPersistence: false,
    aiExecution: false,
    execution: false,
    persistence: false,
  });
}
