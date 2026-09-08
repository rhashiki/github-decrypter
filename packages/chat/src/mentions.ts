import { asWorkspaceId, type WorkspaceId } from '@github-decrypter/workspace';
import {
  asConversationId,
  asConversationMessageId,
  assertConversationRecord,
  type ConversationId,
  type ConversationMessageId,
  type ConversationRecord,
} from './index.js';

export const CONTEXT_MENTIONS_BUILD = 46 as const;
export const CONTEXT_MENTION_SCHEMA = 'gd-context-mention/1' as const;
export const CONTEXT_MENTION_TARGET_SCHEMA = 'gd-context-mention-target/1' as const;
export const CONTEXT_MENTION_RESOLUTION_SCHEMA = 'gd-context-mention-resolution/1' as const;
export const CONTEXT_MENTION_MAX_ITEMS = 64 as const;
export const CONTEXT_MENTION_MAX_CATALOG_ITEMS = 4096 as const;
export const CONTEXT_MENTION_MAX_REFERENCE_CHARACTERS = 2048 as const;
export const CONTEXT_MENTION_MAX_LABEL_CHARACTERS = 256 as const;

export const CONTEXT_MENTION_KINDS = [
  'file',
  'folder',
  'repository',
  'commit',
  'branch',
  'pull-request',
  'issue',
  'database',
  'preview',
  'terminal',
] as const;
export type ContextMentionKind = (typeof CONTEXT_MENTION_KINDS)[number];

declare const contextMentionIdBrand: unique symbol;
export type ContextMentionId = string & { readonly [contextMentionIdBrand]: 'context-mention-id' };

export interface ContextMention {
  readonly schema: typeof CONTEXT_MENTION_SCHEMA;
  readonly id: ContextMentionId;
  readonly kind: ContextMentionKind;
  readonly reference: string;
  readonly label: string | null;
}

export interface ContextMentionTarget {
  readonly schema: typeof CONTEXT_MENTION_TARGET_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly kind: ContextMentionKind;
  readonly reference: string;
  readonly label: string;
}

export interface ResolvedContextMention {
  readonly mentionId: ContextMentionId;
  readonly kind: ContextMentionKind;
  readonly reference: string;
  readonly mentionLabel: string | null;
  readonly targetLabel: string;
}

export interface ResolveContextMentionsInput {
  readonly conversation: ConversationRecord;
  readonly messageId: string;
  readonly mentions: readonly ContextMention[];
  readonly catalog: readonly ContextMentionTarget[];
}

export interface ContextMentionResolution {
  readonly schema: typeof CONTEXT_MENTION_RESOLUTION_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly conversationId: ConversationId;
  readonly conversationRevision: number;
  readonly messageId: ConversationMessageId;
  readonly resolved: readonly ResolvedContextMention[];
  readonly mentionResolution: true;
  readonly explicitCatalogOnly: true;
  readonly exactReferenceMatch: true;
  readonly structuredReferencesOnly: true;
  readonly textualMentionParsing: false;
  readonly contentMaterialization: false;
  readonly sourceReads: false;
  readonly filesystemRead: false;
  readonly gitRead: false;
  readonly githubRead: false;
  readonly databaseRead: false;
  readonly previewRead: false;
  readonly terminalRead: false;
  readonly attachmentIngestion: false;
  readonly providerExecution: false;
  readonly jobCreation: false;
  readonly persistenceMutation: false;
  readonly networkAuthority: false;
  readonly projectMemory: false;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MENTION_ID = /^gd_mention_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function canonicalKind(value: unknown): ContextMentionKind {
  if (typeof value !== 'string' || !CONTEXT_MENTION_KINDS.includes(value as ContextMentionKind)) {
    throw new TypeError('Context mention kind is invalid.');
  }
  return value as ContextMentionKind;
}

function canonicalReference(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Context mention reference must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > CONTEXT_MENTION_MAX_REFERENCE_CHARACTERS || CONTROL_CHARACTERS.test(normalized)) {
    throw new TypeError('Context mention reference is invalid.');
  }
  return normalized;
}

function canonicalLabel(value: unknown, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string') throw new TypeError('Context mention label must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > CONTEXT_MENTION_MAX_LABEL_CHARACTERS || CONTROL_CHARACTERS.test(normalized)) {
    throw new TypeError('Context mention label is invalid.');
  }
  return normalized;
}

export function asContextMentionId(value: string): ContextMentionId {
  if (!MENTION_ID.test(value)) throw new TypeError('Context mention IDs must use the gd_mention_<uuid> format.');
  return value.toLowerCase() as ContextMentionId;
}

export function createContextMention(input: Omit<ContextMention, 'schema' | 'id'> & { readonly id: string }): ContextMention {
  const row = asRecord(input, 'Context mention input');
  assertExactKeys(row, ['id', 'kind', 'reference', 'label'], 'Context mention input');
  return Object.freeze({
    schema: CONTEXT_MENTION_SCHEMA,
    id: asContextMentionId(input.id),
    kind: canonicalKind(input.kind),
    reference: canonicalReference(input.reference),
    label: canonicalLabel(input.label, true),
  });
}

export function assertContextMention(value: unknown): asserts value is ContextMention {
  const row = asRecord(value, 'Context mention');
  assertExactKeys(row, ['schema', 'id', 'kind', 'reference', 'label'], 'Context mention');
  if (row.schema !== CONTEXT_MENTION_SCHEMA) throw new TypeError('Context mention schema is invalid.');
  if (typeof row.id !== 'string' || asContextMentionId(row.id) !== row.id) throw new TypeError('Context mention id must be canonical.');
  canonicalKind(row.kind);
  if (canonicalReference(row.reference) !== row.reference) throw new TypeError('Context mention reference must be canonical.');
  if (canonicalLabel(row.label, true) !== row.label) throw new TypeError('Context mention label must be canonical.');
}

export function createContextMentionTarget(input: Omit<ContextMentionTarget, 'schema' | 'workspaceId'> & { readonly workspaceId: string }): ContextMentionTarget {
  const row = asRecord(input, 'Context mention target input');
  assertExactKeys(row, ['workspaceId', 'kind', 'reference', 'label'], 'Context mention target input');
  return Object.freeze({
    schema: CONTEXT_MENTION_TARGET_SCHEMA,
    workspaceId: asWorkspaceId(input.workspaceId),
    kind: canonicalKind(input.kind),
    reference: canonicalReference(input.reference),
    label: canonicalLabel(input.label, false) as string,
  });
}

export function assertContextMentionTarget(value: unknown): asserts value is ContextMentionTarget {
  const row = asRecord(value, 'Context mention target');
  assertExactKeys(row, ['schema', 'workspaceId', 'kind', 'reference', 'label'], 'Context mention target');
  if (row.schema !== CONTEXT_MENTION_TARGET_SCHEMA) throw new TypeError('Context mention target schema is invalid.');
  if (typeof row.workspaceId !== 'string' || asWorkspaceId(row.workspaceId) !== row.workspaceId) {
    throw new TypeError('Context mention target workspace id must be canonical.');
  }
  canonicalKind(row.kind);
  if (canonicalReference(row.reference) !== row.reference) throw new TypeError('Context mention target reference must be canonical.');
  if (canonicalLabel(row.label, false) !== row.label) throw new TypeError('Context mention target label must be canonical.');
}

function targetKey(kind: ContextMentionKind, reference: string): string {
  return `${kind}\u0000${reference}`;
}

export function resolveContextMentions(input: ResolveContextMentionsInput): ContextMentionResolution {
  const row = asRecord(input, 'Resolve context mentions input');
  assertExactKeys(row, ['conversation', 'messageId', 'mentions', 'catalog'], 'Resolve context mentions input');
  assertConversationRecord(input.conversation);
  const messageId = asConversationMessageId(input.messageId);
  const message = input.conversation.messages.find((candidate) => candidate.id === messageId);
  if (!message) throw new TypeError('Context mention message does not belong to the supplied conversation.');
  if (message.role !== 'user') throw new TypeError('Context mentions may only bind to a committed user message.');
  if (!Array.isArray(input.mentions) || input.mentions.length === 0 || input.mentions.length > CONTEXT_MENTION_MAX_ITEMS) {
    throw new RangeError(`Context mention resolution requires 1-${CONTEXT_MENTION_MAX_ITEMS} mentions.`);
  }
  if (!Array.isArray(input.catalog) || input.catalog.length > CONTEXT_MENTION_MAX_CATALOG_ITEMS) {
    throw new RangeError(`Context mention catalog accepts at most ${CONTEXT_MENTION_MAX_CATALOG_ITEMS} targets.`);
  }

  const targets = new Map<string, ContextMentionTarget>();
  for (const target of input.catalog) {
    assertContextMentionTarget(target);
    if (target.workspaceId !== input.conversation.workspaceId) {
      throw new TypeError('Context mention target workspace does not match the conversation workspace.');
    }
    const key = targetKey(target.kind, target.reference);
    if (targets.has(key)) throw new TypeError(`Context mention catalog target is duplicated: ${target.kind}:${target.reference}.`);
    targets.set(key, target);
  }

  const mentionIds = new Set<string>();
  const mentionKeys = new Set<string>();
  const resolved: ResolvedContextMention[] = [];
  for (const mention of input.mentions) {
    assertContextMention(mention);
    if (mentionIds.has(mention.id)) throw new TypeError(`Context mention id is duplicated: ${mention.id}.`);
    mentionIds.add(mention.id);
    const key = targetKey(mention.kind, mention.reference);
    if (mentionKeys.has(key)) throw new TypeError(`Context mention reference is duplicated: ${mention.kind}:${mention.reference}.`);
    mentionKeys.add(key);
    const target = targets.get(key);
    if (!target) throw new TypeError(`Context mention target was not supplied by the authoritative catalog: ${mention.kind}:${mention.reference}.`);
    resolved.push(Object.freeze({
      mentionId: mention.id,
      kind: mention.kind,
      reference: mention.reference,
      mentionLabel: mention.label,
      targetLabel: target.label,
    }));
  }

  return Object.freeze({
    schema: CONTEXT_MENTION_RESOLUTION_SCHEMA,
    workspaceId: input.conversation.workspaceId,
    conversationId: asConversationId(input.conversation.id),
    conversationRevision: input.conversation.revision,
    messageId,
    resolved: Object.freeze(resolved),
    mentionResolution: true,
    explicitCatalogOnly: true,
    exactReferenceMatch: true,
    structuredReferencesOnly: true,
    textualMentionParsing: false,
    contentMaterialization: false,
    sourceReads: false,
    filesystemRead: false,
    gitRead: false,
    githubRead: false,
    databaseRead: false,
    previewRead: false,
    terminalRead: false,
    attachmentIngestion: false,
    providerExecution: false,
    jobCreation: false,
    persistenceMutation: false,
    networkAuthority: false,
    projectMemory: false,
  });
}
