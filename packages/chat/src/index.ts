import {
  createAIProviderGenerateRequest,
  normalizeAIModelId,
  normalizeAIProviderId,
  type AIProviderGenerateRequest,
} from '@github-decrypter/ai';
import {
  TOKEN_ABSTRACTION_SCHEMA,
  type TokenAbstractionPlan,
  type TokenWindowEnvelope,
} from '@github-decrypter/context/token-abstraction';
import { asWorkspaceId, type WorkspaceId } from '@github-decrypter/workspace';

export const packageIdentity = '@github-decrypter/chat' as const;
export const CONVERSATION_BUILD = 44 as const;
export const CONVERSATION_SCHEMA = 'gd-conversation/1' as const;
export const CONVERSATION_MESSAGE_SCHEMA = 'gd-conversation-message/1' as const;
export const CONVERSATION_DISPATCH_SCHEMA = 'gd-conversation-dispatch/1' as const;
export const CONVERSATION_SOURCE_CONTEXT_SCHEMA = 'gd-token-abstraction/1' as const;
export const CONVERSATION_MAX_MESSAGES = 256 as const;
export const CONVERSATION_MAX_TITLE_CHARACTERS = 160 as const;
export const CONVERSATION_MAX_MESSAGE_CHARACTERS = 262144 as const;

export const CONVERSATION_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type ConversationMessageRole = (typeof CONVERSATION_MESSAGE_ROLES)[number];

declare const conversationIdBrand: unique symbol;
export type ConversationId = string & { readonly [conversationIdBrand]: 'conversation-id' };

declare const conversationMessageIdBrand: unique symbol;
export type ConversationMessageId = string & { readonly [conversationMessageIdBrand]: 'conversation-message-id' };

export interface ConversationMessage {
  readonly schema: typeof CONVERSATION_MESSAGE_SCHEMA;
  readonly id: ConversationMessageId;
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly createdAt: string;
}

export interface ConversationRecord {
  readonly schema: typeof CONVERSATION_SCHEMA;
  readonly id: ConversationId;
  readonly workspaceId: WorkspaceId;
  readonly title: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly ConversationMessage[];
}

export interface CreateConversationInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly createdAt: string;
}

export interface AppendConversationMessageInput {
  readonly conversation: ConversationRecord;
  readonly message: ConversationMessage;
}

export interface ConversationDispatchInput {
  readonly conversation: ConversationRecord;
  readonly abstraction: TokenAbstractionPlan;
  readonly envelopeId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly temperature: number | null;
}

export interface ConversationDispatchPlan {
  readonly schema: typeof CONVERSATION_DISPATCH_SCHEMA;
  readonly conversationSchema: typeof CONVERSATION_SCHEMA;
  readonly tokenAbstractionSchema: typeof TOKEN_ABSTRACTION_SCHEMA;
  readonly conversationId: ConversationId;
  readonly workspaceId: WorkspaceId;
  readonly conversationRevision: number;
  readonly contextEnvelopeId: string;
  readonly carriedContextIds: readonly string[];
  readonly providerRequest: AIProviderGenerateRequest;
  readonly conversationHistory: true;
  readonly persistentConversation: true;
  readonly jobLifecycleIndependent: true;
  readonly tokenAbstraction: true;
  readonly finiteModelWindow: true;
  readonly fullHistoryOrReject: true;
  readonly silentTruncation: false;
  readonly attachmentIngestion: false;
  readonly mentionResolution: false;
  readonly voiceContextShared: true;
  readonly voiceTransport: false;
  readonly providerExecution: false;
  readonly persistenceMutation: false;
  readonly projectMemory: false;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const CONVERSATION_ID = /^gd_conv_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_ID = /^gd_msg_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = [...keys].sort();
  const actual = Object.keys(record).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} fields are not canonical.`);
  }
}

function canonicalTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical ISO timestamp.`);
  }
  return value;
}

function canonicalTitle(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Conversation title must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > CONVERSATION_MAX_TITLE_CHARACTERS || CONTROL_CHARACTERS.test(normalized)) {
    throw new TypeError('Conversation title is invalid.');
  }
  return normalized;
}

function canonicalContent(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Conversation message content must be a string.');
  if (!value.trim() || value.length > CONVERSATION_MAX_MESSAGE_CHARACTERS
      || CONTROL_CHARACTERS.test(value.replace(/[\n\r\t]/g, ''))) {
    throw new TypeError('Conversation message content is invalid.');
  }
  return value;
}

export function asConversationId(value: string): ConversationId {
  if (!CONVERSATION_ID.test(value)) {
    throw new TypeError('Conversation IDs must use the gd_conv_<uuid> format.');
  }
  return value.toLowerCase() as ConversationId;
}

export function asConversationMessageId(value: string): ConversationMessageId {
  if (!MESSAGE_ID.test(value)) {
    throw new TypeError('Conversation message IDs must use the gd_msg_<uuid> format.');
  }
  return value.toLowerCase() as ConversationMessageId;
}

export function createConversationMessage(input: Omit<ConversationMessage, 'schema' | 'id'> & { readonly id: string }): ConversationMessage {
  const message = Object.freeze({
    schema: CONVERSATION_MESSAGE_SCHEMA,
    id: asConversationMessageId(input.id),
    role: input.role,
    content: canonicalContent(input.content),
    createdAt: canonicalTimestamp(input.createdAt, 'Conversation message createdAt'),
  });
  assertConversationMessage(message);
  return message;
}

export function assertConversationMessage(value: unknown): asserts value is ConversationMessage {
  const row = asRecord(value, 'Conversation message');
  assertExactKeys(row, ['schema', 'id', 'role', 'content', 'createdAt'], 'Conversation message');
  if (row.schema !== CONVERSATION_MESSAGE_SCHEMA) throw new TypeError('Conversation message schema is invalid.');
  if (typeof row.id !== 'string' || asConversationMessageId(row.id) !== row.id) {
    throw new TypeError('Conversation message id must be canonical.');
  }
  if (!CONVERSATION_MESSAGE_ROLES.includes(row.role as ConversationMessageRole)) {
    throw new TypeError('Conversation message role is invalid.');
  }
  if (canonicalContent(row.content) !== row.content) throw new TypeError('Conversation message content must be canonical.');
  canonicalTimestamp(row.createdAt, 'Conversation message createdAt');
}

export function createConversation(input: CreateConversationInput): ConversationRecord {
  const row = asRecord(input, 'Create conversation input');
  assertExactKeys(row, ['id', 'workspaceId', 'title', 'createdAt'], 'Create conversation input');
  const createdAt = canonicalTimestamp(input.createdAt, 'Conversation createdAt');
  const conversation = Object.freeze({
    schema: CONVERSATION_SCHEMA,
    id: asConversationId(input.id),
    workspaceId: asWorkspaceId(input.workspaceId),
    title: canonicalTitle(input.title),
    revision: 0,
    createdAt,
    updatedAt: createdAt,
    messages: Object.freeze([]) as readonly ConversationMessage[],
  });
  assertConversationRecord(conversation);
  return conversation;
}

export function assertConversationRecord(value: unknown): asserts value is ConversationRecord {
  const row = asRecord(value, 'Conversation');
  assertExactKeys(
    row,
    ['schema', 'id', 'workspaceId', 'title', 'revision', 'createdAt', 'updatedAt', 'messages'],
    'Conversation',
  );
  if (row.schema !== CONVERSATION_SCHEMA) throw new TypeError('Conversation schema is invalid.');
  if (typeof row.id !== 'string' || asConversationId(row.id) !== row.id) throw new TypeError('Conversation id must be canonical.');
  if (typeof row.workspaceId !== 'string' || asWorkspaceId(row.workspaceId) !== row.workspaceId) {
    throw new TypeError('Conversation workspace id must be canonical.');
  }
  if (canonicalTitle(row.title) !== row.title) throw new TypeError('Conversation title must be canonical.');
  if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 0) {
    throw new TypeError('Conversation revision must be a non-negative safe integer.');
  }
  const createdAt = canonicalTimestamp(row.createdAt, 'Conversation createdAt');
  const updatedAt = canonicalTimestamp(row.updatedAt, 'Conversation updatedAt');
  if (updatedAt < createdAt) throw new TypeError('Conversation updatedAt cannot precede createdAt.');
  if (!Array.isArray(row.messages) || row.messages.length > CONVERSATION_MAX_MESSAGES) {
    throw new RangeError(`Conversation accepts at most ${CONVERSATION_MAX_MESSAGES} messages.`);
  }
  if (row.revision !== row.messages.length) {
    throw new TypeError('Conversation revision must equal the committed message count.');
  }
  const ids = new Set<string>();
  let previousTimestamp = createdAt;
  for (const candidate of row.messages) {
    assertConversationMessage(candidate);
    if (ids.has(candidate.id)) throw new TypeError(`Conversation message id is duplicated: ${candidate.id}.`);
    ids.add(candidate.id);
    if (candidate.createdAt < previousTimestamp) {
      throw new TypeError('Conversation message timestamps must be monotonic.');
    }
    previousTimestamp = candidate.createdAt;
  }
  if (row.messages.length > 0 && updatedAt !== row.messages[row.messages.length - 1]!.createdAt) {
    throw new TypeError('Conversation updatedAt must match the latest committed message.');
  }
}

export function appendConversationMessage(input: AppendConversationMessageInput): ConversationRecord {
  const row = asRecord(input, 'Append conversation message input');
  assertExactKeys(row, ['conversation', 'message'], 'Append conversation message input');
  assertConversationRecord(input.conversation);
  assertConversationMessage(input.message);
  if (input.conversation.messages.length >= CONVERSATION_MAX_MESSAGES) {
    throw new RangeError(`Conversation accepts at most ${CONVERSATION_MAX_MESSAGES} messages.`);
  }
  if (input.conversation.messages.some((message) => message.id === input.message.id)) {
    throw new TypeError(`Conversation message id is duplicated: ${input.message.id}.`);
  }
  if (input.message.createdAt < input.conversation.updatedAt) {
    throw new TypeError('Conversation message timestamp cannot precede the current conversation state.');
  }

  const next = Object.freeze({
    schema: CONVERSATION_SCHEMA,
    id: input.conversation.id,
    workspaceId: input.conversation.workspaceId,
    title: input.conversation.title,
    revision: input.conversation.revision + 1,
    createdAt: input.conversation.createdAt,
    updatedAt: input.message.createdAt,
    messages: Object.freeze([...input.conversation.messages, input.message]),
  });
  assertConversationRecord(next);
  return next;
}

function assertTokenAbstraction(value: unknown): asserts value is TokenAbstractionPlan {
  const row = asRecord(value, 'Conversation token abstraction');
  if (row.schema !== CONVERSATION_SOURCE_CONTEXT_SCHEMA || row.tokenAbstraction !== true
      || row.finiteModelWindow !== true || row.userFacingRawTokenBudget !== false
      || row.infiniteContextClaim !== false || row.tokenizerExecution !== false
      || row.contentTokenEstimation !== false || row.silentTruncation !== false
      || row.semanticCompression !== false || row.orchestrationRequired !== true
      || row.aiExecution !== false || row.execution !== false || row.persistence !== false) {
    throw new TypeError('Conversation requires canonical Build 43 Token Abstraction output.');
  }
  const modelWindow = asRecord(row.modelWindow, 'Conversation model window');
  if (!Number.isSafeInteger(modelWindow.contextWindowTokens) || Number(modelWindow.contextWindowTokens) <= 0
      || !Number.isSafeInteger(modelWindow.reservedOutputTokens) || Number(modelWindow.reservedOutputTokens) < 0
      || !Number.isSafeInteger(modelWindow.usableInputTokens) || Number(modelWindow.usableInputTokens) <= 0
      || Number(modelWindow.contextWindowTokens) - Number(modelWindow.reservedOutputTokens) !== Number(modelWindow.usableInputTokens)) {
    throw new TypeError('Conversation model window is invalid.');
  }
  if (!Array.isArray(row.envelopes) || !Array.isArray(row.envelopeOrder)
      || row.envelopes.length !== row.envelopeOrder.length) {
    throw new TypeError('Conversation token abstraction envelope set is invalid.');
  }
}

function findEnvelope(abstraction: TokenAbstractionPlan, envelopeId: string): TokenWindowEnvelope {
  if (!/^ctxwin-\d{4}$/.test(envelopeId)) throw new TypeError('Conversation context envelope id is invalid.');
  const envelope = abstraction.envelopes.find((candidate) => candidate.id === envelopeId);
  if (!envelope || !abstraction.envelopeOrder.includes(envelopeId)) {
    throw new TypeError('Conversation context envelope does not exist in the supplied abstraction.');
  }
  if (envelope.metering !== 'unmeasured' || envelope.fitStatus !== 'unknown' || envelope.overflowDecision !== 'deferred') {
    throw new TypeError('Conversation context envelope metering boundary is invalid.');
  }
  return envelope;
}

export function compileConversationDispatch(input: ConversationDispatchInput): ConversationDispatchPlan {
  const row = asRecord(input, 'Conversation dispatch input');
  assertExactKeys(
    row,
    ['conversation', 'abstraction', 'envelopeId', 'providerId', 'modelId', 'temperature'],
    'Conversation dispatch input',
  );
  assertConversationRecord(input.conversation);
  assertTokenAbstraction(input.abstraction);
  if (input.conversation.messages.length === 0) {
    throw new TypeError('Conversation dispatch requires at least one committed message.');
  }
  if (input.conversation.messages[input.conversation.messages.length - 1]!.role !== 'user') {
    throw new TypeError('Conversation dispatch requires the latest committed message to be from the user.');
  }
  const envelope = findEnvelope(input.abstraction, input.envelopeId);
  const providerId = normalizeAIProviderId(input.providerId);
  const modelId = normalizeAIModelId(input.modelId);
  const reservedOutputTokens = input.abstraction.modelWindow.reservedOutputTokens;
  const providerRequest = createAIProviderGenerateRequest({
    providerId,
    modelId,
    messages: input.conversation.messages.map((message) => Object.freeze({ role: message.role, content: message.content })),
    maxOutputTokens: reservedOutputTokens > 0 ? reservedOutputTokens : null,
    temperature: input.temperature,
  });

  return Object.freeze({
    schema: CONVERSATION_DISPATCH_SCHEMA,
    conversationSchema: CONVERSATION_SCHEMA,
    tokenAbstractionSchema: TOKEN_ABSTRACTION_SCHEMA,
    conversationId: input.conversation.id,
    workspaceId: input.conversation.workspaceId,
    conversationRevision: input.conversation.revision,
    contextEnvelopeId: envelope.id,
    carriedContextIds: Object.freeze([...envelope.carriedContextIds]),
    providerRequest,
    conversationHistory: true,
    persistentConversation: true,
    jobLifecycleIndependent: true,
    tokenAbstraction: true,
    finiteModelWindow: true,
    fullHistoryOrReject: true,
    silentTruncation: false,
    attachmentIngestion: false,
    mentionResolution: false,
    voiceContextShared: true,
    voiceTransport: false,
    providerExecution: false,
    persistenceMutation: false,
    projectMemory: false,
  });
}
