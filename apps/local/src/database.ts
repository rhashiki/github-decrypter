import { chmodSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { assertJsonValue, type JsonValue } from '@github-decrypter/protocol';
import { ensureLocalDatabaseParent, resolveLocalDatabasePath } from './database-path.js';
import {
  LOCAL_DATABASE_BOOTSTRAP_SQL,
  LOCAL_DATABASE_MIGRATIONS,
  LOCAL_DATABASE_SCHEMA_VERSION,
} from './database-migrations.js';

export interface LocalDatabaseOptions {
  readonly path?: string;
  readonly now?: () => string;
}

export interface LocalDatabaseMigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly appliedAt: string;
}

export interface LocalDatabaseStatus {
  readonly open: boolean;
  readonly path: string;
  readonly schemaVersion: number;
  readonly journalMode: string;
  readonly foreignKeys: boolean;
  readonly integrity: 'ok';
}

interface RawMigrationRow {
  readonly version: number | bigint;
  readonly name: string;
  readonly checksum: string;
  readonly applied_at: string;
}

interface RawMetadataRow {
  readonly value_json: string;
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) {
    throw new Error(`SQLite returned an invalid integer for ${label}.`);
  }
  return normalized as number;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`SQLite returned invalid text for ${label}.`);
  return value;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof (value as { then?: unknown }).then === 'function';
}

export class LocalDatabase {
  readonly #path: string;
  readonly #now: () => string;
  #database: DatabaseSync | null = null;
  #status: LocalDatabaseStatus | null = null;

  constructor(options: LocalDatabaseOptions = {}) {
    this.#path = resolveLocalDatabasePath(options.path);
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  get path(): string {
    return this.#path;
  }

  get isOpen(): boolean {
    return this.#database !== null;
  }

  get status(): LocalDatabaseStatus | null {
    return this.#status;
  }

  open(): LocalDatabaseStatus {
    if (this.#database && this.#status) return this.#status;

    ensureLocalDatabaseParent(this.#path);
    const existedBeforeOpen = existsSync(this.#path);
    const database = new DatabaseSync(this.#path);

    try {
      if (!existedBeforeOpen && process.platform !== 'win32') {
        try {
          chmodSync(this.#path, 0o600);
        } catch {
          // File permissions are best-effort on filesystems that do not expose POSIX modes.
        }
      }

      this.#configure(database);
      this.#applyMigrations(database);

      const integrity = this.#quickCheck(database);
      if (integrity !== 'ok') {
        throw new Error(`Local database integrity check failed: ${integrity}`);
      }

      const status: LocalDatabaseStatus = Object.freeze({
        open: true,
        path: this.#path,
        schemaVersion: this.#userVersion(database),
        journalMode: this.#journalMode(database),
        foreignKeys: this.#foreignKeysEnabled(database),
        integrity: 'ok',
      });

      this.#database = database;
      this.#status = status;
      return status;
    } catch (error) {
      database.close();
      throw error;
    }
  }

  close(): void {
    const database = this.#database;
    this.#database = null;
    this.#status = null;
    database?.close();
  }

  integrityCheck(): 'ok' {
    const result = this.#quickCheck(this.#requireDatabase());
    if (result !== 'ok') throw new Error(`Local database integrity check failed: ${result}`);
    return 'ok';
  }

  listMigrations(): readonly LocalDatabaseMigrationRecord[] {
    const rows = this.#requireDatabase()
      .prepare('SELECT version, name, checksum, applied_at FROM gd_schema_migrations ORDER BY version')
      .all() as unknown as RawMigrationRow[];

    return rows.map((row) => Object.freeze({
      version: integer(row.version, 'migration version'),
      name: text(row.name, 'migration name'),
      checksum: text(row.checksum, 'migration checksum'),
      appliedAt: text(row.applied_at, 'migration applied_at'),
    }));
  }

  getMetadata(key: string): JsonValue | undefined {
    const normalizedKey = this.#metadataKey(key);
    const row = this.#requireDatabase()
      .prepare('SELECT value_json FROM gd_metadata WHERE key = ?')
      .get(normalizedKey) as RawMetadataRow | undefined;
    if (!row) return undefined;

    const parsed = JSON.parse(text(row.value_json, 'metadata value')) as unknown;
    assertJsonValue(parsed);
    return parsed;
  }

  setMetadata(key: string, value: JsonValue): void {
    const normalizedKey = this.#metadataKey(key);
    assertJsonValue(value);
    const encoded = JSON.stringify(value);
    this.#requireDatabase()
      .prepare(`
        INSERT INTO gd_metadata (key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
      `)
      .run(normalizedKey, encoded, this.#now());
  }

  deleteMetadata(key: string): boolean {
    const result = this.#requireDatabase()
      .prepare('DELETE FROM gd_metadata WHERE key = ?')
      .run(this.#metadataKey(key));
    return Number(result.changes) > 0;
  }

  transaction<T>(operation: (database: DatabaseSync) => T): T {
    const database = this.#requireDatabase();
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation(database);
      if (isThenable(result)) {
        throw new TypeError('LocalDatabase transactions must be synchronous.');
      }
      database.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        database.exec('ROLLBACK');
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
  }

  #configure(database: DatabaseSync): void {
    database.exec('PRAGMA busy_timeout = 5000');
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('PRAGMA trusted_schema = OFF');
    database.exec('PRAGMA synchronous = NORMAL');
    database.exec('PRAGMA journal_mode = WAL');

    if (!this.#foreignKeysEnabled(database)) {
      throw new Error('Local SQLite foreign key enforcement could not be enabled.');
    }
  }

  #applyMigrations(database: DatabaseSync): void {
    database.exec(LOCAL_DATABASE_BOOTSTRAP_SQL);

    const userVersion = this.#userVersion(database);
    if (userVersion > LOCAL_DATABASE_SCHEMA_VERSION) {
      throw new Error(
        `Local database schema ${userVersion} is newer than supported schema ${LOCAL_DATABASE_SCHEMA_VERSION}.`,
      );
    }

    const applied = new Map(
      (database
        .prepare('SELECT version, name, checksum, applied_at FROM gd_schema_migrations ORDER BY version')
        .all() as unknown as RawMigrationRow[])
        .map((row) => [integer(row.version, 'migration version'), row] as const),
    );

    for (const version of applied.keys()) {
      if (!LOCAL_DATABASE_MIGRATIONS.some((migration) => migration.version === version)) {
        throw new Error(`Local database contains unsupported migration version ${version}.`);
      }
    }

    for (const migration of LOCAL_DATABASE_MIGRATIONS) {
      const existing = applied.get(migration.version);
      if (existing) {
        if (existing.name !== migration.name || existing.checksum !== migration.checksum) {
          throw new Error(`Local database migration ${migration.version} provenance mismatch.`);
        }
        continue;
      }

      database.exec('BEGIN IMMEDIATE');
      try {
        migration.apply(database);
        database
          .prepare('INSERT INTO gd_schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
          .run(migration.version, migration.name, migration.checksum, this.#now());
        database.exec(`PRAGMA user_version = ${migration.version}`);
        database.exec('COMMIT');
      } catch (error) {
        try {
          database.exec('ROLLBACK');
        } catch {
          // Preserve the migration failure.
        }
        throw error;
      }
    }

    const finalVersion = this.#userVersion(database);
    if (finalVersion !== LOCAL_DATABASE_SCHEMA_VERSION) {
      throw new Error(
        `Local database user_version ${finalVersion} does not match expected schema ${LOCAL_DATABASE_SCHEMA_VERSION}.`,
      );
    }
  }

  #quickCheck(database: DatabaseSync): string {
    const row = database.prepare('PRAGMA quick_check').get() as Record<string, unknown> | undefined;
    return text(row?.quick_check, 'PRAGMA quick_check');
  }

  #userVersion(database: DatabaseSync): number {
    const row = database.prepare('PRAGMA user_version').get() as Record<string, unknown> | undefined;
    return integer(row?.user_version, 'PRAGMA user_version');
  }

  #journalMode(database: DatabaseSync): string {
    const row = database.prepare('PRAGMA journal_mode').get() as Record<string, unknown> | undefined;
    return text(row?.journal_mode, 'PRAGMA journal_mode').toLowerCase();
  }

  #foreignKeysEnabled(database: DatabaseSync): boolean {
    const row = database.prepare('PRAGMA foreign_keys').get() as Record<string, unknown> | undefined;
    return integer(row?.foreign_keys, 'PRAGMA foreign_keys') === 1;
  }

  #metadataKey(key: string): string {
    const normalized = key.trim();
    if (!normalized) throw new TypeError('Metadata keys must be non-empty strings.');
    if (normalized.length > 200) throw new TypeError('Metadata keys may not exceed 200 characters.');
    return normalized;
  }

  #requireDatabase(): DatabaseSync {
    if (!this.#database) throw new Error('Local database is not open.');
    return this.#database;
  }
}

export function createLocalDatabase(options?: LocalDatabaseOptions): LocalDatabase {
  return new LocalDatabase(options);
}
