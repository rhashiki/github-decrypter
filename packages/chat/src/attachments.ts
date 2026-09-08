import { asWorkspaceId, type WorkspaceId } from '@github-decrypter/workspace';
import type { ConversationId, ConversationMessageId } from './index.js';

export const ATTACHMENT_BUILD = 45 as const;
export const ATTACHMENT_SCHEMA = 'gd-attachment/1' as const;
export const ATTACHMENT_INGESTION_SCHEMA = 'gd-attachment-ingestion/1' as const;
export const ATTACHMENT_MAX_BYTES = 33_554_432 as const;
export const ATTACHMENT_MAX_NAME_CHARACTERS = 255 as const;

export const ATTACHMENT_KINDS = [
  'image',
  'document',
  'code',
  'log',
  'screenshot',
  'structured-data',
  'audio',
  'media',
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

declare const attachmentIdBrand: unique symbol;
export type AttachmentId = string & { readonly [attachmentIdBrand]: 'attachment-id' };

export interface AttachmentRecord {
  readonly schema: typeof ATTACHMENT_SCHEMA;
  readonly id: AttachmentId;
  readonly conversationId: ConversationId;
  readonly workspaceId: WorkspaceId;
  readonly messageId: ConversationMessageId | null;
  readonly kind: AttachmentKind;
  readonly mediaType: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly createdAt: string;
}

export interface AttachmentIngestionInput {
  readonly id: string;
  readonly conversationId: string;
  readonly workspaceId: string;
  readonly messageId: string | null;
  readonly kind: AttachmentKind;
  readonly mediaType: string;
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly createdAt: string;
}

export interface AttachmentIngestionResult {
  readonly schema: typeof ATTACHMENT_INGESTION_SCHEMA;
  readonly attachment: AttachmentRecord;
  readonly attachmentIngestion: true;
  readonly conversationContextShared: true;
  readonly voiceContextShared: true;
  readonly voiceTransport: false;
  readonly speechToText: false;
  readonly ocr: false;
  readonly contentInterpretation: false;
  readonly providerExecution: false;
  readonly mentionResolution: false;
  readonly jobCreation: false;
  readonly persistenceMutation: false;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ATTACHMENT_ID = /^gd_att_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONVERSATION_ID = /^gd_conv_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_ID = /^gd_msg_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const SHA256 = /^[0-9a-f]{64}$/;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = [...keys].sort();
  const actual = Object.keys(record).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${label} fields are not canonical.`);
}

function canonicalTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new TypeError(`${label} must be a canonical ISO timestamp.`);
  return value;
}

function canonicalConversationId(value: unknown): ConversationId {
  if (typeof value !== 'string' || !CONVERSATION_ID.test(value)) throw new TypeError('Attachment conversationId must be canonical.');
  return value.toLowerCase() as ConversationId;
}

function canonicalMessageId(value: unknown): ConversationMessageId | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !MESSAGE_ID.test(value)) throw new TypeError('Attachment messageId must be canonical or null.');
  return value.toLowerCase() as ConversationMessageId;
}

function canonicalName(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Attachment name must be a string.');
  const normalized = value.trim();
  if (!normalized || normalized.length > ATTACHMENT_MAX_NAME_CHARACTERS || CONTROL_CHARACTERS.test(normalized)
      || normalized.includes('/') || normalized.includes('\\') || normalized === '.' || normalized === '..') {
    throw new TypeError('Attachment name is invalid.');
  }
  return normalized;
}

function canonicalMediaType(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Attachment mediaType must be a string.');
  const normalized = value.trim().toLowerCase();
  if (!MEDIA_TYPE.test(normalized)) throw new TypeError('Attachment mediaType is invalid.');
  return normalized;
}

function canonicalSize(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > ATTACHMENT_MAX_BYTES) {
    throw new RangeError(`Attachment size must be between 1 and ${ATTACHMENT_MAX_BYTES} bytes.`);
  }
  return Number(value);
}

function assertKindMediaCompatibility(kind: AttachmentKind, mediaType: string): void {
  if ((kind === 'image' || kind === 'screenshot') && !mediaType.startsWith('image/')) {
    throw new TypeError(`${kind} attachments require an image/* media type.`);
  }
  if (kind === 'audio' && !mediaType.startsWith('audio/')) {
    throw new TypeError('Audio attachments require an audio/* media type.');
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto SHA-256 is unavailable in this environment.');
  const copy = Uint8Array.from(bytes);
  const digest = await subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export function asAttachmentId(value: string): AttachmentId {
  if (!ATTACHMENT_ID.test(value)) throw new TypeError('Attachment IDs must use the gd_att_<uuid> format.');
  return value.toLowerCase() as AttachmentId;
}

export function assertAttachmentRecord(value: unknown): asserts value is AttachmentRecord {
  const row = asRecord(value, 'Attachment');
  assertExactKeys(row, ['schema', 'id', 'conversationId', 'workspaceId', 'messageId', 'kind', 'mediaType', 'name', 'sizeBytes', 'sha256', 'createdAt'], 'Attachment');
  if (row.schema !== ATTACHMENT_SCHEMA) throw new TypeError('Attachment schema is invalid.');
  if (typeof row.id !== 'string' || asAttachmentId(row.id) !== row.id) throw new TypeError('Attachment id must be canonical.');
  canonicalConversationId(row.conversationId);
  if (typeof row.workspaceId !== 'string' || asWorkspaceId(row.workspaceId) !== row.workspaceId) throw new TypeError('Attachment workspaceId must be canonical.');
  canonicalMessageId(row.messageId);
  if (!ATTACHMENT_KINDS.includes(row.kind as AttachmentKind)) throw new TypeError('Attachment kind is invalid.');
  const mediaType = canonicalMediaType(row.mediaType);
  assertKindMediaCompatibility(row.kind as AttachmentKind, mediaType);
  if (canonicalName(row.name) !== row.name) throw new TypeError('Attachment name must be canonical.');
  canonicalSize(row.sizeBytes);
  if (typeof row.sha256 !== 'string' || !SHA256.test(row.sha256)) throw new TypeError('Attachment sha256 must be a lowercase SHA-256 digest.');
  canonicalTimestamp(row.createdAt, 'Attachment createdAt');
}

export async function ingestAttachment(input: AttachmentIngestionInput): Promise<AttachmentIngestionResult> {
  const row = asRecord(input, 'Attachment ingestion input');
  assertExactKeys(row, ['id', 'conversationId', 'workspaceId', 'messageId', 'kind', 'mediaType', 'name', 'bytes', 'createdAt'], 'Attachment ingestion input');
  if (!(input.bytes instanceof Uint8Array)) throw new TypeError('Attachment bytes must be a Uint8Array.');
  const sizeBytes = canonicalSize(input.bytes.byteLength);
  if (!ATTACHMENT_KINDS.includes(input.kind)) throw new TypeError('Attachment kind is invalid.');
  const mediaType = canonicalMediaType(input.mediaType);
  assertKindMediaCompatibility(input.kind, mediaType);
  const attachment = Object.freeze({
    schema: ATTACHMENT_SCHEMA,
    id: asAttachmentId(input.id),
    conversationId: canonicalConversationId(input.conversationId),
    workspaceId: asWorkspaceId(input.workspaceId),
    messageId: canonicalMessageId(input.messageId),
    kind: input.kind,
    mediaType,
    name: canonicalName(input.name),
    sizeBytes,
    sha256: await sha256(input.bytes),
    createdAt: canonicalTimestamp(input.createdAt, 'Attachment createdAt'),
  });
  assertAttachmentRecord(attachment);
  return Object.freeze({
    schema: ATTACHMENT_INGESTION_SCHEMA,
    attachment,
    attachmentIngestion: true,
    conversationContextShared: true,
    voiceContextShared: true,
    voiceTransport: false,
    speechToText: false,
    ocr: false,
    contentInterpretation: false,
    providerExecution: false,
    mentionResolution: false,
    jobCreation: false,
    persistenceMutation: false,
  });
}

export async function verifyAttachmentPayload(input: { readonly attachment: AttachmentRecord; readonly bytes: Uint8Array }): Promise<void> {
  const row = asRecord(input, 'Attachment payload verification input');
  assertExactKeys(row, ['attachment', 'bytes'], 'Attachment payload verification input');
  assertAttachmentRecord(input.attachment);
  if (!(input.bytes instanceof Uint8Array)) throw new TypeError('Attachment bytes must be a Uint8Array.');
  if (input.bytes.byteLength !== input.attachment.sizeBytes) throw new TypeError('Attachment payload size does not match its descriptor.');
  if (await sha256(input.bytes) !== input.attachment.sha256) throw new TypeError('Attachment payload digest does not match its descriptor.');
}
