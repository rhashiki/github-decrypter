import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface LocalDatabaseMigration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
  apply(database: DatabaseSync): void;
}

export const LOCAL_DATABASE_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS gd_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;
`;

const MIGRATION_001_SQL = `
CREATE TABLE gd_metadata (
  key TEXT PRIMARY KEY CHECK (length(key) > 0),
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
`;

function checksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export const LOCAL_DATABASE_MIGRATIONS: readonly LocalDatabaseMigration[] = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'metadata-foundation',
    sql: MIGRATION_001_SQL,
    checksum: checksum(MIGRATION_001_SQL),
    apply(database: DatabaseSync) {
      database.exec(MIGRATION_001_SQL);
    },
  }),
]);

export const LOCAL_DATABASE_SCHEMA_VERSION = LOCAL_DATABASE_MIGRATIONS.at(-1)?.version ?? 0;
