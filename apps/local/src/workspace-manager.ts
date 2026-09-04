import { randomUUID } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { asWorkspaceId, WORKSPACE_SCHEMA, type WorkspaceDescriptor, type WorkspaceId } from '@github-decrypter/workspace';
import type { EventBus } from '@github-decrypter/shared';
import type { LocalDatabase } from './database.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';

export interface WorkspaceManagerStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly registered: number;
  readonly available: number;
  readonly filesystemMutation: false;
  readonly externalTransport: false;
}

export interface WorkspaceManagerOptions {
  readonly database: LocalDatabase;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

interface WorkspaceRow {
  readonly id: unknown;
  readonly root_path: unknown;
  readonly display_name: unknown;
  readonly registered_at: unknown;
  readonly last_opened_at: unknown;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`SQLite returned invalid text for ${label}.`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) throw new Error(`SQLite returned invalid integer for ${label}.`);
  return normalized as number;
}

function normalizeDisplayName(value: string | undefined, rootPath: string): string {
  const normalized = (value ?? basename(rootPath)).trim();
  if (!normalized) throw new TypeError('Workspace display name must be non-empty.');
  if (normalized.length > 200) throw new TypeError('Workspace display name may not exceed 200 characters.');
  return normalized;
}

function canonicalDirectory(path: string): string {
  const normalized = path.trim();
  if (!normalized) throw new TypeError('Workspace root path must be non-empty.');
  const canonical = realpathSync(normalized);
  if (!statSync(canonical).isDirectory()) throw new TypeError('Workspace root must be an existing directory.');
  return canonical;
}

function isContained(root: string, target: string): boolean {
  const relation = relative(root, target);
  return relation === '' || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith(`..${sep}`));
}

export class WorkspaceManager {
  readonly #database: LocalDatabase;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  #ready = false;

  constructor(options: WorkspaceManagerOptions) {
    this.#database = options.database;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  async initialize(): Promise<WorkspaceManagerStatus> {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 9) throw new Error('Workspace Manager requires Local Database schema 9 or newer.');
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.workspace.ready', {
      registered: status.registered,
      available: status.available,
      filesystemMutation: false,
      externalTransport: false,
    });
    return status;
  }

  shutdown(): void {
    this.#ready = false;
  }

  status(): WorkspaceManagerStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 9) {
      return Object.freeze({ ready: false, schemaVersion, registered: 0, available: 0, filesystemMutation: false, externalTransport: false });
    }
    const rows = this.list();
    let available = 0;
    for (const workspace of rows) {
      try {
        if (canonicalDirectory(workspace.rootPath) === workspace.rootPath) available += 1;
      } catch {
        // Missing/removable roots do not make the daemon unhealthy.
      }
    }
    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      registered: rows.length,
      available,
      filesystemMutation: false,
      externalTransport: false,
    });
  }

  register(rootPath: string, displayName?: string): WorkspaceDescriptor {
    this.#assertReady();
    const canonicalRoot = canonicalDirectory(rootPath);
    const existing = this.#database.read((database) => database.prepare(`
      SELECT id, root_path, display_name, registered_at, last_opened_at
      FROM gd_workspaces WHERE root_path = ?
    `).get(canonicalRoot) as unknown as WorkspaceRow | undefined);
    if (existing) return this.#record(existing);

    const id = asWorkspaceId(`gd_ws_${randomUUID()}`);
    const now = this.#now();
    const name = normalizeDisplayName(displayName, canonicalRoot);
    this.#database.transaction((database) => {
      database.prepare(`
        INSERT INTO gd_workspaces (id, root_path, display_name, registered_at, last_opened_at)
        VALUES (?, ?, ?, ?, NULL)
      `).run(id, canonicalRoot, name, now);
    });
    const record = this.get(id);
    if (!record) throw new Error('Workspace disappeared after registration.');
    void this.#eventBus?.publish('gd.local.workspace.registered', { workspaceId: record.id, registeredAt: record.registeredAt });
    return record;
  }

  open(id: WorkspaceId): WorkspaceDescriptor {
    this.#assertReady();
    const workspace = this.#require(id);
    const canonicalRoot = canonicalDirectory(workspace.rootPath);
    if (canonicalRoot !== workspace.rootPath) throw new Error('Workspace root identity changed since registration.');
    const openedAt = this.#now();
    this.#database.transaction((database) => {
      database.prepare('UPDATE gd_workspaces SET last_opened_at = ? WHERE id = ?').run(openedAt, id);
    });
    const record = this.#require(id);
    void this.#eventBus?.publish('gd.local.workspace.opened', { workspaceId: record.id, openedAt });
    return record;
  }

  unregister(id: WorkspaceId): boolean {
    this.#assertReady();
    const result = this.#database.transaction((database) => database.prepare('DELETE FROM gd_workspaces WHERE id = ?').run(id));
    const removed = Number(result.changes) > 0;
    if (removed) void this.#eventBus?.publish('gd.local.workspace.unregistered', { workspaceId: id, occurredAt: this.#now() });
    return removed;
  }

  get(id: WorkspaceId): WorkspaceDescriptor | null {
    if (!this.#database.isOpen || (this.#database.status?.schemaVersion ?? 0) < 9) return null;
    const row = this.#database.read((database) => database.prepare(`
      SELECT id, root_path, display_name, registered_at, last_opened_at
      FROM gd_workspaces WHERE id = ?
    `).get(id) as unknown as WorkspaceRow | undefined);
    return row ? this.#record(row) : null;
  }

  list(): readonly WorkspaceDescriptor[] {
    if (!this.#database.isOpen || (this.#database.status?.schemaVersion ?? 0) < 9) return [];
    const rows = this.#database.read((database) => database.prepare(`
      SELECT id, root_path, display_name, registered_at, last_opened_at
      FROM gd_workspaces ORDER BY registered_at ASC, id ASC
    `).all() as unknown as WorkspaceRow[]);
    return Object.freeze(rows.map((row) => this.#record(row)));
  }

  resolveExistingPath(id: WorkspaceId, relativePath: string): string {
    this.#assertReady();
    const workspace = this.#require(id);
    const requested = relativePath.trim();
    if (!requested) return canonicalDirectory(workspace.rootPath);
    if (requested.includes('\0')) throw new TypeError('Workspace paths may not contain NUL bytes.');
    if (isAbsolute(requested)) throw new TypeError('Workspace-relative paths may not be absolute.');
    const lexicalTarget = resolve(workspace.rootPath, requested);
    if (!isContained(workspace.rootPath, lexicalTarget)) throw new Error('Workspace path escapes the registered root.');
    const canonicalTarget = realpathSync(lexicalTarget);
    if (!isContained(workspace.rootPath, canonicalTarget)) throw new Error('Workspace path resolves outside the registered root.');
    return canonicalTarget;
  }

  #record(row: WorkspaceRow): WorkspaceDescriptor {
    return Object.freeze({
      schema: WORKSPACE_SCHEMA,
      id: asWorkspaceId(text(row.id, 'workspace id')),
      rootPath: text(row.root_path, 'workspace root path'),
      displayName: text(row.display_name, 'workspace display name'),
      registeredAt: text(row.registered_at, 'workspace registered_at'),
      lastOpenedAt: nullableText(row.last_opened_at, 'workspace last_opened_at'),
    });
  }

  #require(id: WorkspaceId): WorkspaceDescriptor {
    const workspace = this.get(id);
    if (!workspace) throw new Error(`Unknown workspace ${id}.`);
    return workspace;
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Workspace Manager is not ready.');
  }
}

export function createWorkspaceManager(options: WorkspaceManagerOptions): WorkspaceManager {
  return new WorkspaceManager(options);
}
