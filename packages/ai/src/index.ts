export const packageIdentity = '@github-decrypter/ai' as const;

export const AI_PROVIDER_BUILD = 33 as const;
export const AI_PROVIDER_SCHEMA = 'gd-ai-provider/1' as const;
export const AI_PROVIDER_MODEL_SCHEMA = 'gd-ai-provider-model/1' as const;
export const AI_PROVIDER_REQUEST_SCHEMA = 'gd-ai-provider-request/1' as const;
export const AI_PROVIDER_RESPONSE_SCHEMA = 'gd-ai-provider-response/1' as const;

export const AI_PROVIDER_KINDS = ['local', 'external'] as const;
export type AIProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export const AI_PROVIDER_CREDENTIAL_MODES = ['none', 'runtime-vault'] as const;
export type AIProviderCredentialMode = (typeof AI_PROVIDER_CREDENTIAL_MODES)[number];

export const AI_PROVIDER_MESSAGE_ROLES = ['system', 'user', 'assistant'] as const;
export type AIProviderMessageRole = (typeof AI_PROVIDER_MESSAGE_ROLES)[number];

export const AI_PROVIDER_FINISH_REASONS = ['stop', 'length', 'other'] as const;
export type AIProviderFinishReason = (typeof AI_PROVIDER_FINISH_REASONS)[number];

export interface AIProviderDescriptor {
  readonly schema: typeof AI_PROVIDER_SCHEMA;
  readonly id: string;
  readonly displayName: string;
  readonly kind: AIProviderKind;
  readonly credentialMode: AIProviderCredentialMode;
}

export interface AIProviderModelDescriptor {
  readonly schema: typeof AI_PROVIDER_MODEL_SCHEMA;
  readonly providerId: string;
  readonly id: string;
  readonly displayName: string;
  readonly contextWindowTokens: number | null;
  readonly maxOutputTokens: number | null;
}

export interface AIProviderMessage {
  readonly role: AIProviderMessageRole;
  readonly content: string;
}

export interface AIProviderGenerateRequest {
  readonly schema: typeof AI_PROVIDER_REQUEST_SCHEMA;
  readonly providerId: string;
  readonly modelId: string;
  readonly messages: readonly AIProviderMessage[];
  readonly maxOutputTokens: number | null;
  readonly temperature: number | null;
}

export interface AIProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface AIProviderGenerateResult {
  readonly schema: typeof AI_PROVIDER_RESPONSE_SCHEMA;
  readonly providerId: string;
  readonly modelId: string;
  readonly text: string;
  readonly finishReason: AIProviderFinishReason;
  readonly usage: AIProviderUsage | null;
}

export interface AIProviderAdapter {
  readonly descriptor: AIProviderDescriptor;
  listModels(): Promise<readonly AIProviderModelDescriptor[]>;
  generate(request: AIProviderGenerateRequest): Promise<AIProviderGenerateResult>;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const PROVIDER_ID = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new TypeError(`${label} contains unsupported field ${key}.`);
  }
  for (const key of keys) {
    if (!(key in record)) throw new TypeError(`${label} is missing required field ${key}.`);
  }
}

function normalizeDisplayName(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 100 || CONTROL_CHARACTERS.test(normalized)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return normalized;
}

function positiveIntegerOrNull(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new TypeError(`${label} must be a positive safe integer or null.`);
  return Number(value);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new TypeError(`${label} must be a non-negative safe integer.`);
  return Number(value);
}

export function normalizeAIProviderId(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('AI provider id must be a string.');
  const normalized = value.trim().toLowerCase();
  if (!PROVIDER_ID.test(normalized)) throw new TypeError('AI provider id is invalid.');
  return normalized;
}

export function normalizeAIModelId(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('AI model id must be a string.');
  const normalized = value.trim();
  if (
    !normalized || normalized.length > 160 || CONTROL_CHARACTERS.test(normalized) || /\s/.test(normalized)
    || /[?#\\]/.test(normalized) || normalized.startsWith('/') || normalized.endsWith('/')
  ) throw new TypeError('AI model id is invalid.');
  return normalized;
}

export function assertAIProviderDescriptor(value: unknown): asserts value is AIProviderDescriptor {
  const row = asRecord(value, 'AI provider descriptor');
  assertExactKeys(row, ['schema', 'id', 'displayName', 'kind', 'credentialMode'], 'AI provider descriptor');
  if (row.schema !== AI_PROVIDER_SCHEMA) throw new TypeError('AI provider descriptor schema is invalid.');
  if (normalizeAIProviderId(row.id) !== row.id) throw new TypeError('AI provider descriptor id must be canonical.');
  if (normalizeDisplayName(row.displayName, 'AI provider display name') !== row.displayName) throw new TypeError('AI provider display name must be canonical.');
  if (!AI_PROVIDER_KINDS.includes(row.kind as AIProviderKind)) throw new TypeError('AI provider kind is invalid.');
  if (!AI_PROVIDER_CREDENTIAL_MODES.includes(row.credentialMode as AIProviderCredentialMode)) throw new TypeError('AI provider credential mode is invalid.');
  if (row.kind === 'local' && row.credentialMode !== 'none') {
    throw new TypeError('Local AI providers cannot require transported credentials.');
  }
}

export function createAIProviderDescriptor(
  input: Omit<AIProviderDescriptor, 'schema' | 'id' | 'displayName'> & { readonly id: string; readonly displayName: string },
): AIProviderDescriptor {
  const descriptor = Object.freeze({
    schema: AI_PROVIDER_SCHEMA,
    id: normalizeAIProviderId(input.id),
    displayName: normalizeDisplayName(input.displayName, 'AI provider display name'),
    kind: input.kind,
    credentialMode: input.credentialMode,
  });
  assertAIProviderDescriptor(descriptor);
  return descriptor;
}

export function assertAIProviderModelDescriptor(value: unknown): asserts value is AIProviderModelDescriptor {
  const row = asRecord(value, 'AI provider model descriptor');
  assertExactKeys(row, ['schema', 'providerId', 'id', 'displayName', 'contextWindowTokens', 'maxOutputTokens'], 'AI provider model descriptor');
  if (row.schema !== AI_PROVIDER_MODEL_SCHEMA) throw new TypeError('AI provider model descriptor schema is invalid.');
  if (normalizeAIProviderId(row.providerId) !== row.providerId) throw new TypeError('AI provider model providerId must be canonical.');
  if (normalizeAIModelId(row.id) !== row.id) throw new TypeError('AI provider model id must be canonical.');
  if (normalizeDisplayName(row.displayName, 'AI model display name') !== row.displayName) throw new TypeError('AI model display name must be canonical.');
  positiveIntegerOrNull(row.contextWindowTokens, 'AI model contextWindowTokens');
  positiveIntegerOrNull(row.maxOutputTokens, 'AI model maxOutputTokens');
}

export function createAIProviderModelDescriptor(
  input: Omit<AIProviderModelDescriptor, 'schema' | 'providerId' | 'id' | 'displayName'> & {
    readonly providerId: string;
    readonly id: string;
    readonly displayName: string;
  },
): AIProviderModelDescriptor {
  const descriptor = Object.freeze({
    schema: AI_PROVIDER_MODEL_SCHEMA,
    providerId: normalizeAIProviderId(input.providerId),
    id: normalizeAIModelId(input.id),
    displayName: normalizeDisplayName(input.displayName, 'AI model display name'),
    contextWindowTokens: positiveIntegerOrNull(input.contextWindowTokens, 'AI model contextWindowTokens'),
    maxOutputTokens: positiveIntegerOrNull(input.maxOutputTokens, 'AI model maxOutputTokens'),
  });
  assertAIProviderModelDescriptor(descriptor);
  return descriptor;
}

function assertAIProviderMessage(value: unknown): asserts value is AIProviderMessage {
  const row = asRecord(value, 'AI provider message');
  assertExactKeys(row, ['role', 'content'], 'AI provider message');
  if (!AI_PROVIDER_MESSAGE_ROLES.includes(row.role as AIProviderMessageRole)) throw new TypeError('AI provider message role is invalid.');
  if (typeof row.content !== 'string' || !row.content.trim() || CONTROL_CHARACTERS.test(row.content.replace(/[\n\r\t]/g, ''))) {
    throw new TypeError('AI provider message content is invalid.');
  }
}

export function assertAIProviderGenerateRequest(value: unknown): asserts value is AIProviderGenerateRequest {
  const row = asRecord(value, 'AI provider request');
  assertExactKeys(row, ['schema', 'providerId', 'modelId', 'messages', 'maxOutputTokens', 'temperature'], 'AI provider request');
  if (row.schema !== AI_PROVIDER_REQUEST_SCHEMA) throw new TypeError('AI provider request schema is invalid.');
  if (normalizeAIProviderId(row.providerId) !== row.providerId) throw new TypeError('AI provider request providerId must be canonical.');
  if (normalizeAIModelId(row.modelId) !== row.modelId) throw new TypeError('AI provider request modelId must be canonical.');
  if (!Array.isArray(row.messages) || row.messages.length < 1 || row.messages.length > 256) {
    throw new TypeError('AI provider request messages must contain between 1 and 256 items.');
  }
  for (const message of row.messages) assertAIProviderMessage(message);
  positiveIntegerOrNull(row.maxOutputTokens, 'AI provider request maxOutputTokens');
  if (row.temperature !== null && (typeof row.temperature !== 'number' || !Number.isFinite(row.temperature) || row.temperature < 0 || row.temperature > 2)) {
    throw new TypeError('AI provider request temperature must be between 0 and 2 or null.');
  }
}

export function createAIProviderGenerateRequest(input: Omit<AIProviderGenerateRequest, 'schema'>): AIProviderGenerateRequest {
  const request = Object.freeze({
    schema: AI_PROVIDER_REQUEST_SCHEMA,
    providerId: normalizeAIProviderId(input.providerId),
    modelId: normalizeAIModelId(input.modelId),
    messages: Object.freeze(input.messages.map((message) => Object.freeze({ role: message.role, content: message.content }))),
    maxOutputTokens: input.maxOutputTokens,
    temperature: input.temperature,
  });
  assertAIProviderGenerateRequest(request);
  return request;
}

export function assertAIProviderGenerateResult(value: unknown): asserts value is AIProviderGenerateResult {
  const row = asRecord(value, 'AI provider response');
  assertExactKeys(row, ['schema', 'providerId', 'modelId', 'text', 'finishReason', 'usage'], 'AI provider response');
  if (row.schema !== AI_PROVIDER_RESPONSE_SCHEMA) throw new TypeError('AI provider response schema is invalid.');
  if (normalizeAIProviderId(row.providerId) !== row.providerId) throw new TypeError('AI provider response providerId must be canonical.');
  if (normalizeAIModelId(row.modelId) !== row.modelId) throw new TypeError('AI provider response modelId must be canonical.');
  if (typeof row.text !== 'string' || CONTROL_CHARACTERS.test(row.text.replace(/[\n\r\t]/g, ''))) throw new TypeError('AI provider response text is invalid.');
  if (!AI_PROVIDER_FINISH_REASONS.includes(row.finishReason as AIProviderFinishReason)) throw new TypeError('AI provider response finishReason is invalid.');
  if (row.usage !== null) {
    const usage = asRecord(row.usage, 'AI provider usage');
    assertExactKeys(usage, ['inputTokens', 'outputTokens', 'totalTokens'], 'AI provider usage');
    const inputTokens = nonNegativeInteger(usage.inputTokens, 'AI provider usage inputTokens');
    const outputTokens = nonNegativeInteger(usage.outputTokens, 'AI provider usage outputTokens');
    const totalTokens = nonNegativeInteger(usage.totalTokens, 'AI provider usage totalTokens');
    if (totalTokens < inputTokens + outputTokens) throw new TypeError('AI provider usage totalTokens is inconsistent.');
  }
}

export function validateAIProviderModelList(providerId: string, value: unknown): readonly AIProviderModelDescriptor[] {
  const normalizedProviderId = normalizeAIProviderId(providerId);
  if (!Array.isArray(value)) throw new TypeError('AI provider model list must be an array.');
  const seen = new Set<string>();
  const models = value.map((candidate) => {
    assertAIProviderModelDescriptor(candidate);
    if (candidate.providerId !== normalizedProviderId) throw new TypeError('AI provider model belongs to a different provider.');
    if (seen.has(candidate.id)) throw new TypeError(`AI provider model id is duplicated: ${candidate.id}.`);
    seen.add(candidate.id);
    return candidate;
  });
  return Object.freeze([...models]);
}

export function assertAIProviderGenerateResultForRequest(
  result: unknown,
  request: AIProviderGenerateRequest,
): asserts result is AIProviderGenerateResult {
  assertAIProviderGenerateRequest(request);
  assertAIProviderGenerateResult(result);
  if (result.providerId !== request.providerId || result.modelId !== request.modelId) {
    throw new TypeError('AI provider response does not match the requested provider/model identity.');
  }
}

export function assertAIProviderAdapter(value: unknown): asserts value is AIProviderAdapter {
  const row = asRecord(value, 'AI provider adapter');
  assertAIProviderDescriptor(row.descriptor);
  if (typeof row.listModels !== 'function' || typeof row.generate !== 'function') {
    throw new TypeError('AI provider adapter must implement listModels() and generate().');
  }
}
