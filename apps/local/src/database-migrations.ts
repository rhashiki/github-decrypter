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
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
`;

const MIGRATION_002_SQL = `
CREATE TABLE gd_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'queued', 'running', 'checkpointed', 'waiting', 'paused',
    'completed', 'failed', 'cancelled', 'skipped'
  )),
  priority INTEGER NOT NULL DEFAULT 0,
  queue_order INTEGER NOT NULL,
  available_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  worker_id TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  pause_requested INTEGER NOT NULL DEFAULT 0 CHECK (pause_requested IN (0, 1)),
  cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
  checkpoint_json TEXT,
  result_json TEXT,
  error_json TEXT
) STRICT;

CREATE INDEX gd_jobs_queue_idx
  ON gd_jobs (state, available_at, priority DESC, queue_order ASC);
CREATE INDEX gd_jobs_lease_idx
  ON gd_jobs (state, lease_expires_at);

CREATE TABLE gd_job_dependencies (
  job_id TEXT NOT NULL,
  depends_on_job_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, depends_on_job_id),
  FOREIGN KEY (job_id) REFERENCES gd_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_job_id) REFERENCES gd_jobs(id) ON DELETE RESTRICT,
  CHECK (job_id <> depends_on_job_id)
) STRICT;

CREATE INDEX gd_job_dependencies_reverse_idx
  ON gd_job_dependencies (depends_on_job_id, job_id);

CREATE TABLE gd_job_transitions (
  id INTEGER PRIMARY KEY,
  job_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES gd_jobs(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX gd_job_transitions_job_idx
  ON gd_job_transitions (job_id, id ASC);
`;

const MIGRATION_003_SQL = `
CREATE TABLE gd_runtime_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  recovery_completed_at TEXT,
  startup_recovered_jobs INTEGER NOT NULL DEFAULT 0 CHECK (startup_recovered_jobs >= 0),
  prior_unclean_sessions INTEGER NOT NULL DEFAULT 0 CHECK (prior_unclean_sessions >= 0),
  clean_shutdown_at TEXT,
  shutdown_reason TEXT,
  reconciled_at TEXT
) STRICT;

CREATE INDEX gd_runtime_sessions_unclean_idx
  ON gd_runtime_sessions (clean_shutdown_at, reconciled_at, started_at);

CREATE TABLE gd_job_recoveries (
  id INTEGER PRIMARY KEY,
  job_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('requeued', 'paused', 'cancelled', 'failed')),
  previous_worker_id TEXT,
  previous_lease_expires_at TEXT,
  reason TEXT NOT NULL,
  recovered_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES gd_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES gd_runtime_sessions(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX gd_job_recoveries_job_idx
  ON gd_job_recoveries (job_id, id ASC);
CREATE INDEX gd_job_recoveries_session_idx
  ON gd_job_recoveries (session_id, id ASC);
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
  Object.freeze({
    version: 2,
    name: 'durable-job-engine',
    sql: MIGRATION_002_SQL,
    checksum: checksum(MIGRATION_002_SQL),
    apply(database: DatabaseSync) {
      database.exec(MIGRATION_002_SQL);
    },
  }),
  Object.freeze({
    version: 3,
    name: 'crash-power-recovery',
    sql: MIGRATION_003_SQL,
    checksum: checksum(MIGRATION_003_SQL),
    apply(database: DatabaseSync) {
      database.exec(MIGRATION_003_SQL);
    },
  }),
]);

export const LOCAL_DATABASE_SCHEMA_VERSION = LOCAL_DATABASE_MIGRATIONS.at(-1)?.version ?? 0;
