import { randomUUID } from 'node:crypto';
import {
  normalizeProjectMemoryEntry,
  normalizeProjectMemoryQuery,
  type ProjectMemoryCoverageStatus,
  type ProjectMemoryEntry,
  type ProjectMemoryKind,
  type ProjectMemoryLifecycle,
  type ProjectMemoryQueryInput,
} from '@github-decrypter/context/project-memory';
import type { LocalDatabase } from './database.js';

export interface ProjectMemoryAppendInput {
  readonly workspaceId: string;
  readonly kind: ProjectMemoryKind;
  readonly statement: string;
  readonly sourceRefs: readonly string[];
  readonly decisionProvenanceRefs?: readonly string[];
  readonly createdBy: string;
  readonly supersedesId?: string | null;
  readonly lifecycle?: ProjectMemoryLifecycle;
  readonly coverageStatus?: ProjectMemoryCoverageStatus | null;
}

export interface ProjectMemoryStoreStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly entryCount: number;
  readonly activeEntryCount: number;
  readonly durable: true;
  readonly localOnly: true;
  readonly workspaceScoped: true;
  readonly authoritative: false;
  readonly externalTransport: false;
}

export interface ProjectMemoryStoreOptions {
  readonly database: LocalDatabase;
  readonly now?: () => string;
  readonly idFactory?: () => string;
}

interface MemoryRow {
  readonly id: unknown;
  readonly workspace_id: unknown;
  readonly kind: unknown;
  readonly statement: unknown;
  readonly source_refs_json: unknown;
  readonly decision_provenance_refs_json: unknown;
  readonly created_by: unknown;
  readonly created_at: unknown;
  readonly supersedes_id: unknown;
  readonly lifecycle: unknown;
  readonly coverage_status: unknown;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error('SQLite returned invalid text for ' + label + '.');
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) throw new Error('SQLite returned invalid integer for ' + label + '.');
  return normalized as number;
}

function stringArray(value: unknown, label: string): readonly string[] {
  const parsed = JSON.parse(text(value, label)) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('SQLite returned invalid string array for ' + label + '.');
  }
  return parsed;
}

export class ProjectMemoryStore {
  readonly #database: LocalDatabase;
  readonly #now: () => string;
  readonly #idFactory: () => string;
  #ready = false;

  constructor(options: ProjectMemoryStoreOptions) {
    this.#database = options.database;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#idFactory = options.idFactory ?? (() => 'pmem:' + randomUUID());
  }

  initialize(): ProjectMemoryStoreStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 13) {
      throw new Error('Project Memory requires Local Database schema 13 or newer.');
    }
    this.#ready = true;
    return this.status();
  }

  shutdown(): void {
    this.#ready = false;
  }

  status(): ProjectMemoryStoreStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 13) {
      return Object.freeze({
        ready: false,
        schemaVersion,
        entryCount: 0,
        activeEntryCount: 0,
        durable: true,
        localOnly: true,
        workspaceScoped: true,
        authoritative: false,
        externalTransport: false,
      });
    }
    const summary = this.#database.read((database) => database.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN NOT EXISTS (
          SELECT 1 FROM gd_project_memory_entries newer
          WHERE newer.supersedes_id = current.id
        ) THEN 1 ELSE 0 END) AS active
      FROM gd_project_memory_entries current
    `).get() as unknown as { total: unknown; active: unknown });
    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      entryCount: integer(summary.total, 'project memory total'),
      activeEntryCount: integer(summary.active ?? 0, 'project memory active'),
      durable: true,
      localOnly: true,
      workspaceScoped: true,
      authoritative: false,
      externalTransport: false,
    });
  }

  append(input: ProjectMemoryAppendInput): ProjectMemoryEntry {
    this.#assertReady();
    const record = normalizeProjectMemoryEntry({
      ...input,
      id: this.#idFactory(),
      createdAt: this.#now(),
      decisionProvenanceRefs: input.decisionProvenanceRefs ?? [],
      supersedesId: input.supersedesId ?? null,
      lifecycle: input.lifecycle ?? 'active',
      coverageStatus: input.coverageStatus ?? null,
    });

    this.#database.transaction((database) => {
      const workspace = database.prepare('SELECT id FROM gd_workspaces WHERE id = ?').get(record.workspaceId) as { id?: unknown } | undefined;
      if (!workspace) throw new Error('Project Memory workspace is not registered.');

      if (record.supersedesId) {
        const previous = database.prepare(`
          SELECT id, workspace_id, kind
          FROM gd_project_memory_entries
          WHERE id = ?
        `).get(record.supersedesId) as unknown as { id?: unknown; workspace_id?: unknown; kind?: unknown } | undefined;
        if (!previous) throw new Error('Project Memory superseded entry does not exist.');
        if (text(previous.workspace_id, 'project memory previous workspace') !== record.workspaceId) {
          throw new Error('Project Memory cannot supersede an entry from another workspace.');
        }
        if (text(previous.kind, 'project memory previous kind') !== record.kind) {
          throw new Error('Project Memory supersession must preserve entry kind.');
        }
        const existingReplacement = database.prepare(
          'SELECT id FROM gd_project_memory_entries WHERE supersedes_id = ?',
        ).get(record.supersedesId) as { id?: unknown } | undefined;
        if (existingReplacement) throw new Error('Project Memory entry has already been superseded.');
      }

      database.prepare(`
        INSERT INTO gd_project_memory_entries (
          id, workspace_id, kind, statement, source_refs_json,
          decision_provenance_refs_json, created_by, created_at,
          supersedes_id, lifecycle, coverage_status, authoritative, truth_role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'operational-memory')
      `).run(
        record.id,
        record.workspaceId,
        record.kind,
        record.statement,
        JSON.stringify(record.sourceRefs),
        JSON.stringify(record.decisionProvenanceRefs),
        record.createdBy,
        record.createdAt,
        record.supersedesId,
        record.lifecycle,
        record.coverageStatus,
      );
    });

    const persisted = this.getById(record.id);
    if (!persisted) throw new Error('Project Memory entry disappeared after append.');
    return persisted;
  }

  getById(id: string): ProjectMemoryEntry | null {
    if (!this.#database.isOpen || (this.#database.status?.schemaVersion ?? 0) < 13) return null;
    const row = this.#database.read((database) => database.prepare(`
      SELECT id, workspace_id, kind, statement, source_refs_json,
             decision_provenance_refs_json, created_by, created_at,
             supersedes_id, lifecycle, coverage_status
      FROM gd_project_memory_entries WHERE id = ?
    `).get(id) as unknown as MemoryRow | undefined);
    return row ? this.#record(row) : null;
  }

  list(input: ProjectMemoryQueryInput): readonly ProjectMemoryEntry[] {
    this.#assertReady();
    const query = normalizeProjectMemoryQuery(input);
    const conditions = ['current.workspace_id = ?'];
    const parameters: Array<string | number> = [query.workspaceId];

    if (query.kinds.length > 0) {
      conditions.push('current.kind IN (' + query.kinds.map(() => '?').join(', ') + ')');
      parameters.push(...query.kinds);
    }
    if (query.lifecycle !== null) {
      conditions.push('current.lifecycle = ?');
      parameters.push(query.lifecycle);
    }
    if (!query.includeSuperseded) {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM gd_project_memory_entries newer
        WHERE newer.supersedes_id = current.id
      )`);
    }
    parameters.push(query.limit);

    const rows = this.#database.read((database) => database.prepare(`
      SELECT current.id, current.workspace_id, current.kind, current.statement,
             current.source_refs_json, current.decision_provenance_refs_json,
             current.created_by, current.created_at, current.supersedes_id,
             current.lifecycle, current.coverage_status
      FROM gd_project_memory_entries current
      WHERE ${conditions.join(' AND ')}
      ORDER BY current.created_at DESC, current.id ASC
      LIMIT ?
    `).all(...parameters) as unknown as MemoryRow[]);
    return Object.freeze(rows.map((row) => this.#record(row)));
  }

  #record(row: MemoryRow): ProjectMemoryEntry {
    return normalizeProjectMemoryEntry({
      id: text(row.id, 'project memory id'),
      workspaceId: text(row.workspace_id, 'project memory workspace'),
      kind: text(row.kind, 'project memory kind') as ProjectMemoryKind,
      statement: text(row.statement, 'project memory statement'),
      sourceRefs: stringArray(row.source_refs_json, 'project memory source refs'),
      decisionProvenanceRefs: stringArray(row.decision_provenance_refs_json, 'project memory decision provenance refs'),
      createdBy: text(row.created_by, 'project memory created by'),
      createdAt: text(row.created_at, 'project memory created at'),
      supersedesId: nullableText(row.supersedes_id, 'project memory supersedes id'),
      lifecycle: text(row.lifecycle, 'project memory lifecycle') as ProjectMemoryLifecycle,
      coverageStatus: nullableText(row.coverage_status, 'project memory coverage status') as ProjectMemoryCoverageStatus | null,
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Project Memory Store is not ready.');
  }
}

export function createProjectMemoryStore(options: ProjectMemoryStoreOptions): ProjectMemoryStore {
  return new ProjectMemoryStore(options);
}
