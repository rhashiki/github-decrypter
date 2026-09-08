import type { DatabaseSync } from 'node:sqlite';
import {
  appendConversationMessage,
  asConversationId,
  assertConversationMessage,
  assertConversationRecord,
  type ConversationId,
  type ConversationMessage,
  type ConversationRecord,
} from '@github-decrypter/chat';
import { asWorkspaceId, type WorkspaceId } from '@github-decrypter/workspace';
import { LocalDatabase } from './database.js';

export const LOCAL_CONVERSATION_STORE_BUILD = 44 as const;
export const LOCAL_CONVERSATION_STORE_SCHEMA = 'gd-local-conversation-store/1' as const;

interface ConversationRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly title: string;
  readonly revision: number | bigint;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ConversationMessageRow {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  readonly created_at: string;
}

function integer(value: number | bigint, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`SQLite returned an invalid integer for ${label}.`);
  }
  return normalized;
}

function readConversation(database: DatabaseSync, id: ConversationId): ConversationRecord | undefined {
  const row = database.prepare(`
    SELECT id, workspace_id, title, revision, created_at, updated_at
    FROM gd_conversations
    WHERE id = ?
  `).get(id) as ConversationRow | undefined;
  if (!row) return undefined;

  const messageRows = database.prepare(`
    SELECT id, role, content, created_at
    FROM gd_conversation_messages
    WHERE conversation_id = ?
    ORDER BY ordinal ASC
  `).all(id) as unknown as ConversationMessageRow[];

  const messages = Object.freeze(messageRows.map((messageRow) => {
    const message = Object.freeze({
      schema: 'gd-conversation-message/1' as const,
      id: messageRow.id,
      role: messageRow.role,
      content: messageRow.content,
      createdAt: messageRow.created_at,
    });
    assertConversationMessage(message);
    return message;
  }));

  const conversation = Object.freeze({
    schema: 'gd-conversation/1' as const,
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    revision: integer(row.revision, 'conversation revision'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
  });
  assertConversationRecord(conversation);
  return conversation;
}

export class LocalConversationStore {
  readonly #database: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.#database = database;
  }

  create(conversation: ConversationRecord): ConversationRecord {
    assertConversationRecord(conversation);
    if (conversation.revision !== 0 || conversation.messages.length !== 0) {
      throw new TypeError('Local Conversation Store creates only pristine conversations; messages must be appended transactionally.');
    }

    this.#database.transaction((database) => {
      database.prepare(`
        INSERT INTO gd_conversations (
          id, workspace_id, title, revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        conversation.id,
        conversation.workspaceId,
        conversation.title,
        conversation.revision,
        conversation.createdAt,
        conversation.updatedAt,
      );
    });
    return conversation;
  }

  get(id: string): ConversationRecord | undefined {
    const conversationId = asConversationId(id);
    return this.#database.read((database) => readConversation(database, conversationId));
  }

  list(workspaceId: string): readonly ConversationRecord[] {
    const canonicalWorkspaceId: WorkspaceId = asWorkspaceId(workspaceId);
    return this.#database.read((database) => {
      const rows = database.prepare(`
        SELECT id
        FROM gd_conversations
        WHERE workspace_id = ?
        ORDER BY updated_at DESC, id ASC
      `).all(canonicalWorkspaceId) as unknown as { readonly id: string }[];
      return Object.freeze(rows.map((row) => {
        const conversation = readConversation(database, asConversationId(row.id));
        if (!conversation) throw new Error(`Conversation disappeared during list: ${row.id}.`);
        return conversation;
      }));
    });
  }

  append(conversationId: string, message: ConversationMessage): ConversationRecord {
    const id = asConversationId(conversationId);
    assertConversationMessage(message);

    return this.#database.transaction((database) => {
      const current = readConversation(database, id);
      if (!current) throw new Error(`Conversation not found: ${id}.`);
      const next = appendConversationMessage({ conversation: current, message });
      const ordinal = next.messages.length;

      database.prepare(`
        INSERT INTO gd_conversation_messages (
          id, conversation_id, ordinal, role, content, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(message.id, id, ordinal, message.role, message.content, message.createdAt);

      const updated = database.prepare(`
        UPDATE gd_conversations
        SET revision = ?, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(next.revision, next.updatedAt, id, current.revision);
      if (Number(updated.changes) !== 1) {
        throw new Error(`Conversation revision changed during append: ${id}.`);
      }
      return next;
    });
  }
}

export function createLocalConversationStore(database: LocalDatabase): LocalConversationStore {
  return new LocalConversationStore(database);
}
