import {
  ATTACHMENT_MAX_BYTES,
  assertAttachmentRecord,
  verifyAttachmentPayload,
  type AttachmentId,
  type AttachmentRecord,
} from '@github-decrypter/chat';
import { mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import type { LocalConversationStore } from './conversation-store.js';

export const LOCAL_ATTACHMENT_STORE_BUILD = 45 as const;
export const LOCAL_ATTACHMENT_STORE_SCHEMA = 'gd-local-attachment-store/1' as const;
export const LOCAL_ATTACHMENT_STORE_MAX_ITEMS_PER_CONVERSATION = 256 as const;

interface StoredAttachmentMetadata {
  readonly schema: typeof LOCAL_ATTACHMENT_STORE_SCHEMA;
  readonly attachment: AttachmentRecord;
}

export interface LocalAttachmentStoreOptions {
  readonly rootPath: string;
  readonly conversations: LocalConversationStore;
}

function canonicalRoot(rootPath: string): string {
  if (typeof rootPath !== 'string' || !rootPath.trim()) throw new TypeError('Attachment Store rootPath must be a non-empty string.');
  mkdirSync(rootPath, { recursive: true, mode: 0o700 });
  return realpathSync(rootPath);
}

function assertContained(root: string, candidate: string): void {
  const resolved = resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error('Attachment Store path escaped its canonical root.');
  }
}

function attachmentDirectory(root: string, id: AttachmentId): string {
  const candidate = join(root, id);
  assertContained(root, candidate);
  return candidate;
}

function metadataPath(root: string, id: AttachmentId): string {
  return join(attachmentDirectory(root, id), 'metadata.json');
}

function contentPath(root: string, id: AttachmentId): string {
  return join(attachmentDirectory(root, id), 'content.bin');
}

function parseMetadata(value: string): StoredAttachmentMetadata {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Stored attachment metadata is invalid.');
  const row = parsed as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== 'attachment,schema' || row.schema !== LOCAL_ATTACHMENT_STORE_SCHEMA) {
    throw new TypeError('Stored attachment metadata schema is invalid.');
  }
  assertAttachmentRecord(row.attachment);
  return Object.freeze({ schema: LOCAL_ATTACHMENT_STORE_SCHEMA, attachment: row.attachment });
}

function atomicWriteDirectory(root: string, attachment: AttachmentRecord, bytes: Uint8Array): void {
  const finalDirectory = attachmentDirectory(root, attachment.id);
  const temporaryDirectory = join(root, `.${attachment.id}.tmp-${process.pid}-${Date.now()}`);
  assertContained(root, temporaryDirectory);
  mkdirSync(temporaryDirectory, { mode: 0o700 });
  try {
    writeFileSync(join(temporaryDirectory, 'content.bin'), bytes, { mode: 0o600, flag: 'wx' });
    writeFileSync(
      join(temporaryDirectory, 'metadata.json'),
      `${JSON.stringify({ schema: LOCAL_ATTACHMENT_STORE_SCHEMA, attachment }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    );
    renameSync(temporaryDirectory, finalDirectory);
  } catch (error) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

export class LocalAttachmentStore {
  readonly #root: string;
  readonly #conversations: LocalConversationStore;

  constructor(options: LocalAttachmentStoreOptions) {
    this.#root = canonicalRoot(options.rootPath);
    this.#conversations = options.conversations;
  }

  get rootPath(): string { return this.#root; }

  async put(attachment: AttachmentRecord, bytes: Uint8Array): Promise<AttachmentRecord> {
    assertAttachmentRecord(attachment);
    await verifyAttachmentPayload({ attachment, bytes });
    const conversation = this.#conversations.get(attachment.conversationId);
    if (!conversation) throw new Error(`Attachment conversation not found: ${attachment.conversationId}.`);
    if (conversation.workspaceId !== attachment.workspaceId) throw new Error('Attachment workspace does not match its conversation.');
    if (attachment.messageId !== null && !conversation.messages.some((message) => message.id === attachment.messageId)) {
      throw new Error('Attachment message does not belong to its conversation.');
    }
    if (this.get(attachment.id)) throw new Error(`Attachment already exists: ${attachment.id}.`);
    if (this.list(attachment.conversationId).length >= LOCAL_ATTACHMENT_STORE_MAX_ITEMS_PER_CONVERSATION) {
      throw new RangeError(`Conversation accepts at most ${LOCAL_ATTACHMENT_STORE_MAX_ITEMS_PER_CONVERSATION} persisted attachments.`);
    }
    atomicWriteDirectory(this.#root, attachment, Uint8Array.from(bytes));
    return attachment;
  }

  get(id: AttachmentId): AttachmentRecord | undefined {
    const path = metadataPath(this.#root, id);
    try {
      if (!statSync(path).isFile()) return undefined;
    } catch {
      return undefined;
    }
    return parseMetadata(readFileSync(path, 'utf8')).attachment;
  }

  list(conversationId: string): readonly AttachmentRecord[] {
    const attachments: AttachmentRecord[] = [];
    for (const entry of readdirSync(this.#root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const path = join(this.#root, entry.name, 'metadata.json');
      try {
        const metadata = parseMetadata(readFileSync(path, 'utf8'));
        if (metadata.attachment.conversationId === conversationId) attachments.push(metadata.attachment);
      } catch {
        continue;
      }
    }
    attachments.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    return Object.freeze(attachments);
  }

  async readBytes(id: AttachmentId): Promise<Uint8Array> {
    const attachment = this.get(id);
    if (!attachment) throw new Error(`Attachment not found: ${id}.`);
    const path = contentPath(this.#root, id);
    assertContained(this.#root, dirname(path));
    const bytes = Uint8Array.from(readFileSync(path));
    if (bytes.byteLength > ATTACHMENT_MAX_BYTES) throw new RangeError('Persisted attachment exceeds the canonical size limit.');
    await verifyAttachmentPayload({ attachment, bytes });
    return bytes;
  }
}

export function createLocalAttachmentStore(options: LocalAttachmentStoreOptions): LocalAttachmentStore {
  return new LocalAttachmentStore(options);
}
