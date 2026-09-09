import type { JsonValue } from '@github-decrypter/protocol';
import { assertProjectRulesRecord, type ProjectRulesRecord } from '@github-decrypter/plan/project-rules';
import { asWorkspaceId } from '@github-decrypter/workspace';
import { LocalDatabase } from './database.js';

export const LOCAL_PROJECT_RULES_STORE_BUILD = 50 as const;
export const LOCAL_PROJECT_RULES_STORE_SCHEMA = 'gd-local-project-rules-store/1' as const;
export const LOCAL_PROJECT_RULES_METADATA_PREFIX = 'project-rules:' as const;

export interface StoredProjectRules {
  readonly schema: typeof LOCAL_PROJECT_RULES_STORE_SCHEMA;
  readonly storageRevision: number;
  readonly record: ProjectRulesRecord;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function metadataKey(workspaceId: string): string {
  return `${LOCAL_PROJECT_RULES_METADATA_PREFIX}${asWorkspaceId(workspaceId)}`;
}

function jsonObject(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Stored Project Rules metadata must be an object.');
  return value as Record<string, JsonValue>;
}

function workspaceExists(database: LocalDatabase, workspaceId: string): boolean {
  const id = asWorkspaceId(workspaceId);
  return database.read((sqlite) => Boolean(sqlite.prepare('SELECT 1 AS present FROM gd_workspaces WHERE id = ?').get(id)));
}

function parseStored(value: JsonValue | undefined, workspaceId: string): StoredProjectRules | undefined {
  const row = jsonObject(value);
  if (!row) return undefined;
  if (row.schema !== LOCAL_PROJECT_RULES_STORE_SCHEMA || !Number.isSafeInteger(row.storageRevision) || (row.storageRevision as number) < 1
      || typeof row.createdAt !== 'string' || typeof row.updatedAt !== 'string') {
    throw new TypeError('Stored Project Rules metadata is invalid.');
  }
  assertProjectRulesRecord(row.record);
  if (row.record.workspaceId !== asWorkspaceId(workspaceId)) throw new TypeError('Stored Project Rules workspace binding is invalid.');
  return Object.freeze({
    schema: LOCAL_PROJECT_RULES_STORE_SCHEMA,
    storageRevision: row.storageRevision as number,
    record: row.record,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function encodeStored(stored: StoredProjectRules): JsonValue {
  return JSON.parse(JSON.stringify(stored)) as JsonValue;
}

export class LocalProjectRulesStore {
  readonly #database: LocalDatabase;
  readonly #now: () => string;

  constructor(database: LocalDatabase, now: () => string = () => new Date().toISOString()) {
    this.#database = database;
    this.#now = now;
  }

  get(workspaceId: string): StoredProjectRules | undefined {
    const id = asWorkspaceId(workspaceId);
    if (!workspaceExists(this.#database, id)) return undefined;
    return parseStored(this.#database.getMetadata(metadataKey(id)), id);
  }

  save(record: ProjectRulesRecord): StoredProjectRules {
    assertProjectRulesRecord(record);
    const id = asWorkspaceId(record.workspaceId);
    if (!workspaceExists(this.#database, id)) throw new Error(`Workspace not found for Project Rules: ${id}.`);
    const current = parseStored(this.#database.getMetadata(metadataKey(id)), id);
    const now = this.#now();
    const next = Object.freeze({
      schema: LOCAL_PROJECT_RULES_STORE_SCHEMA,
      storageRevision: (current?.storageRevision ?? 0) + 1,
      record,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });
    this.#database.setMetadata(metadataKey(id), encodeStored(next));
    return next;
  }

  clear(workspaceId: string): boolean {
    const id = asWorkspaceId(workspaceId);
    return this.#database.deleteMetadata(metadataKey(id));
  }
}

export function createLocalProjectRulesStore(database: LocalDatabase, now?: () => string): LocalProjectRulesStore {
  return new LocalProjectRulesStore(database, now);
}
