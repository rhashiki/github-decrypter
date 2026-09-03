import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { assertJsonValue, type JsonValue } from '@github-decrypter/protocol';
import type { EventBus } from '@github-decrypter/shared';
import type { LocalDatabase } from './database.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import {
  DURABLE_JOB_STATES,
  asDurableJobId,
  isDurableJobState,
  isDurableJobTerminalState,
  type DurableJobClaim,
  type DurableJobEnqueueOptions,
  type DurableJobEngineStatus,
  type DurableJobId,
  type DurableJobRecord,
  type DurableJobState,
  type DurableJobSummary,
  type DurableJobTransition,
} from './job-types.js';

const DEFAULT_LEASE_MS = 30_000;
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_PRIORITY = 1_000_000;

interface RawJobRow {
  readonly id: unknown;
  readonly kind: unknown;
  readonly payload_json: unknown;
  readonly state: unknown;
  readonly priority: unknown;
  readonly queue_order: unknown;
  readonly available_at: unknown;
  readonly created_at: unknown;
  readonly updated_at: unknown;
  readonly started_at: unknown;
  readonly finished_at: unknown;
  readonly worker_id: unknown;
  readonly lease_token: unknown;
  readonly lease_expires_at: unknown;
  readonly attempt_count: unknown;
  readonly max_attempts: unknown;
  readonly pause_requested: unknown;
  readonly cancel_requested: unknown;
  readonly checkpoint_json: unknown;
  readonly result_json: unknown;
  readonly error_json: unknown;
}

interface RawTransitionRow {
  readonly id: unknown;
  readonly job_id: unknown;
  readonly from_state: unknown;
  readonly to_state: unknown;
  readonly reason: unknown;
  readonly occurred_at: unknown;
}

interface RawCountRow {
  readonly state: unknown;
  readonly count: unknown;
}

export interface DurableJobEngineOptions {
  readonly database: LocalDatabase;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
  readonly uuid?: () => string;
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

function booleanInteger(value: unknown, label: string): boolean {
  const normalized = integer(value, label);
  if (normalized !== 0 && normalized !== 1) throw new Error(`SQLite returned invalid boolean for ${label}.`);
  return normalized === 1;
}

function parseJson(value: unknown, label: string): JsonValue {
  const parsed = JSON.parse(text(value, label)) as unknown;
  assertJsonValue(parsed);
  return parsed;
}

function parseNullableJson(value: unknown, label: string): JsonValue | null {
  if (value === null) return null;
  return parseJson(value, label);
}

function encodeJson(value: JsonValue): string {
  assertJsonValue(value);
  return JSON.stringify(value);
}

function normalizeKind(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Durable job kind must be a non-empty string.');
  if (normalized.length > 200) throw new TypeError('Durable job kind may not exceed 200 characters.');
  return normalized;
}

function normalizeWorkerId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Worker ID must be a non-empty string.');
  if (normalized.length > 200) throw new TypeError('Worker ID may not exceed 200 characters.');
  return normalized;
}

function normalizeReason(value: string | undefined | null): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 2_000) throw new TypeError('Job transition reason may not exceed 2000 characters.');
  return normalized;
}

function normalizePriority(value: number | undefined): number {
  const normalized = value ?? 0;
  if (!Number.isSafeInteger(normalized) || Math.abs(normalized) > MAX_PRIORITY) {
    throw new TypeError(`Job priority must be an integer between -${MAX_PRIORITY} and ${MAX_PRIORITY}.`);
  }
  return normalized;
}

function normalizeMaxAttempts(value: number | undefined): number {
  const normalized = value ?? 1;
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > 1_000) {
    throw new TypeError('maxAttempts must be an integer between 1 and 1000.');
  }
  return normalized;
}

function normalizeLeaseMs(value: number | undefined): number {
  const normalized = value ?? DEFAULT_LEASE_MS;
  if (!Number.isSafeInteger(normalized) || normalized < 1_000 || normalized > MAX_LEASE_MS) {
    throw new TypeError(`Lease duration must be an integer between 1000 and ${MAX_LEASE_MS} milliseconds.`);
  }
  return normalized;
}

function normalizeIso(value: string, label: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be an ISO-compatible timestamp.`);
  return new Date(milliseconds).toISOString();
}

function addMilliseconds(iso: string, milliseconds: number): string {
  return new Date(Date.parse(normalizeIso(iso, 'Current time')) + milliseconds).toISOString();
}

function state(value: unknown, label: string): DurableJobState {
  if (!isDurableJobState(value)) throw new Error(`SQLite returned invalid durable job state for ${label}.`);
  return value;
}

function mapJob(row: RawJobRow): DurableJobRecord {
  return Object.freeze({
    id: asDurableJobId(text(row.id, 'job id')),
    kind: text(row.kind, 'job kind'),
    payload: parseJson(row.payload_json, 'job payload'),
    state: state(row.state, 'job state'),
    priority: integer(row.priority, 'job priority'),
    queueOrder: integer(row.queue_order, 'job queue order'),
    availableAt: text(row.available_at, 'job available_at'),
    createdAt: text(row.created_at, 'job created_at'),
    updatedAt: text(row.updated_at, 'job updated_at'),
    startedAt: nullableText(row.started_at, 'job started_at'),
    finishedAt: nullableText(row.finished_at, 'job finished_at'),
    workerId: nullableText(row.worker_id, 'job worker_id'),
    leaseExpiresAt: nullableText(row.lease_expires_at, 'job lease_expires_at'),
    attemptCount: integer(row.attempt_count, 'job attempt_count'),
    maxAttempts: integer(row.max_attempts, 'job max_attempts'),
    pauseRequested: booleanInteger(row.pause_requested, 'job pause_requested'),
    cancelRequested: booleanInteger(row.cancel_requested, 'job cancel_requested'),
    checkpoint: parseNullableJson(row.checkpoint_json, 'job checkpoint'),
    result: parseNullableJson(row.result_json, 'job result'),
    error: parseNullableJson(row.error_json, 'job error'),
  });
}

function mapTransition(row: RawTransitionRow): DurableJobTransition {
  return Object.freeze({
    id: integer(row.id, 'transition id'),
    jobId: asDurableJobId(text(row.job_id, 'transition job_id')),
    fromState: row.from_state === null ? null : state(row.from_state, 'transition from_state'),
    toState: state(row.to_state, 'transition to_state'),
    reason: nullableText(row.reason, 'transition reason'),
    occurredAt: text(row.occurred_at, 'transition occurred_at'),
  });
}

export class DurableJobEngine {
  readonly #database: LocalDatabase;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #uuid: () => string;

  constructor(options: DurableJobEngineOptions) {
    this.#database = options.database;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#uuid = options.uuid ?? randomUUID;
  }

  status(): DurableJobEngineStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    return Object.freeze({
      ready: this.#database.isOpen && schemaVersion >= 2,
      schemaVersion,
      summary: this.summary(),
    });
  }

  summary(at = this.#now()): DurableJobSummary {
    if (!this.#database.isOpen) {
      return Object.freeze({ total: 0, nonTerminal: 0, expiredLeases: 0, counts: this.#emptyCounts() });
    }
    const now = normalizeIso(at, 'Summary time');
    return this.#database.read((database) => {
      const counts = this.#emptyCounts();
      const rows = database.prepare('SELECT state, COUNT(*) AS count FROM gd_jobs GROUP BY state').all() as unknown as RawCountRow[];
      for (const row of rows) counts[state(row.state, 'summary state')] = integer(row.count, 'summary count');
      const expired = database
        .prepare("SELECT COUNT(*) AS count FROM gd_jobs WHERE state = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?")
        .get(now) as Record<string, unknown> | undefined;
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      const nonTerminal = DURABLE_JOB_STATES
        .filter((jobState) => !isDurableJobTerminalState(jobState))
        .reduce((sum, jobState) => sum + counts[jobState], 0);
      return Object.freeze({
        total,
        nonTerminal,
        expiredLeases: integer(expired?.count ?? 0, 'expired lease count'),
        counts: Object.freeze({ ...counts }),
      });
    });
  }

  getJob(jobId: DurableJobId): DurableJobRecord | undefined {
    return this.#database.read((database) => {
      const row = database.prepare('SELECT * FROM gd_jobs WHERE id = ?').get(jobId) as RawJobRow | undefined;
      return row ? mapJob(row) : undefined;
    });
  }

  listJobs(): readonly DurableJobRecord[] {
    return this.#database.read((database) => {
      const rows = database.prepare('SELECT * FROM gd_jobs ORDER BY priority DESC, queue_order ASC').all() as unknown as RawJobRow[];
      return rows.map(mapJob);
    });
  }

  listDependencies(jobId: DurableJobId): readonly DurableJobId[] {
    return this.#database.read((database) => {
      const rows = database
        .prepare('SELECT depends_on_job_id FROM gd_job_dependencies WHERE job_id = ? ORDER BY depends_on_job_id')
        .all(jobId) as unknown as Array<{ depends_on_job_id: unknown }>;
      return rows.map((row) => asDurableJobId(text(row.depends_on_job_id, 'dependency id')));
    });
  }

  listTransitions(jobId: DurableJobId): readonly DurableJobTransition[] {
    return this.#database.read((database) => {
      const rows = database
        .prepare('SELECT id, job_id, from_state, to_state, reason, occurred_at FROM gd_job_transitions WHERE job_id = ? ORDER BY id')
        .all(jobId) as unknown as RawTransitionRow[];
      return rows.map(mapTransition);
    });
  }

  listExpiredLeases(at = this.#now()): readonly DurableJobRecord[] {
    const now = normalizeIso(at, 'Expired lease query time');
    return this.#database.read((database) => {
      const rows = database
        .prepare("SELECT * FROM gd_jobs WHERE state = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ? ORDER BY lease_expires_at, queue_order")
        .all(now) as unknown as RawJobRow[];
      return rows.map(mapJob);
    });
  }

  async enqueue(options: DurableJobEnqueueOptions): Promise<DurableJobRecord> {
    const kind = normalizeKind(options.kind);
    const payloadJson = encodeJson(options.payload);
    const priority = normalizePriority(options.priority);
    const maxAttempts = normalizeMaxAttempts(options.maxAttempts);
    const now = normalizeIso(this.#now(), 'Current time');
    const availableAt = normalizeIso(options.availableAt ?? now, 'availableAt');
    const id = asDurableJobId(`gd_job_${this.#uuid()}`);
    const dependencies = [...new Set(options.dependencies ?? [])];

    const job = this.#database.transaction((database) => {
      for (const dependencyId of dependencies) this.#requireJobRow(database, dependencyId);
      const queueRow = database
        .prepare('SELECT COALESCE(MAX(queue_order), 0) + 1 AS next_order FROM gd_jobs')
        .get() as Record<string, unknown>;
      const queueOrder = integer(queueRow.next_order, 'next queue order');
      database.prepare(`
        INSERT INTO gd_jobs (
          id, kind, payload_json, state, priority, queue_order, available_at,
          created_at, updated_at, attempt_count, max_attempts
        ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, 0, ?)
      `).run(id, kind, payloadJson, priority, queueOrder, availableAt, now, now, maxAttempts);
      for (const dependencyId of dependencies) {
        database.prepare('INSERT INTO gd_job_dependencies (job_id, depends_on_job_id, created_at) VALUES (?, ?, ?)')
          .run(id, dependencyId, now);
      }
      this.#insertTransition(database, id, null, 'queued', 'job enqueued', now);
      return mapJob(this.#requireJobRow(database, id));
    });

    await this.#publishChange(job.id, null, 'queued', 'job enqueued');
    return job;
  }

  async addDependency(jobId: DurableJobId, dependsOnJobId: DurableJobId): Promise<void> {
    if (jobId === dependsOnJobId) throw new Error('A durable job cannot depend on itself.');
    this.#database.transaction((database) => {
      const job = mapJob(this.#requireJobRow(database, jobId));
      this.#requireJobRow(database, dependsOnJobId);
      if (job.state !== 'queued' || job.attemptCount !== 0) {
        throw new Error('Dependencies may only be changed before a durable job starts its first attempt.');
      }
      const cycle = database.prepare(`
        WITH RECURSIVE lineage(id) AS (
          SELECT depends_on_job_id FROM gd_job_dependencies WHERE job_id = ?
          UNION
          SELECT dependency.depends_on_job_id
          FROM gd_job_dependencies dependency
          JOIN lineage ON dependency.job_id = lineage.id
        )
        SELECT 1 AS found FROM lineage WHERE id = ? LIMIT 1
      `).get(dependsOnJobId, jobId) as Record<string, unknown> | undefined;
      if (cycle) throw new Error('Durable job dependency would create a cycle.');
      database.prepare('INSERT OR IGNORE INTO gd_job_dependencies (job_id, depends_on_job_id, created_at) VALUES (?, ?, ?)')
        .run(jobId, dependsOnJobId, normalizeIso(this.#now(), 'Current time'));
    });
  }

  async claimNext(workerId: string, leaseMs?: number): Promise<DurableJobClaim | null> {
    const worker = normalizeWorkerId(workerId);
    const duration = normalizeLeaseMs(leaseMs);
    const now = normalizeIso(this.#now(), 'Current time');
    const leaseExpiresAt = addMilliseconds(now, duration);
    const leaseToken = `gd_lease_${this.#uuid()}`;

    const claimed = this.#database.transaction((database) => {
      const candidate = database.prepare(`
        SELECT candidate.*
        FROM gd_jobs candidate
        WHERE candidate.state = 'queued'
          AND candidate.available_at <= ?
          AND candidate.attempt_count < candidate.max_attempts
          AND NOT EXISTS (
            SELECT 1
            FROM gd_job_dependencies dependency
            JOIN gd_jobs prerequisite ON prerequisite.id = dependency.depends_on_job_id
            WHERE dependency.job_id = candidate.id
              AND prerequisite.state NOT IN ('completed', 'skipped')
          )
        ORDER BY candidate.priority DESC, candidate.queue_order ASC
        LIMIT 1
      `).get(now) as RawJobRow | undefined;
      if (!candidate) return null;

      const id = asDurableJobId(text(candidate.id, 'claim candidate id'));
      const updated = database.prepare(`
        UPDATE gd_jobs
        SET state = 'running', worker_id = ?, lease_token = ?, lease_expires_at = ?,
            attempt_count = attempt_count + 1,
            started_at = COALESCE(started_at, ?), updated_at = ?,
            pause_requested = 0, cancel_requested = 0
        WHERE id = ? AND state = 'queued'
      `).run(worker, leaseToken, leaseExpiresAt, now, now, id);
      if (Number(updated.changes) !== 1) return null;
      this.#insertTransition(database, id, 'queued', 'running', `claimed by ${worker}`, now);
      return mapJob(this.#requireJobRow(database, id));
    });

    if (!claimed) return null;
    await this.#publishChange(claimed.id, 'queued', 'running', `claimed by ${worker}`);
    return Object.freeze({ job: claimed, leaseToken });
  }

  heartbeat(jobId: DurableJobId, leaseToken: string, leaseMs?: number): DurableJobRecord {
    const duration = normalizeLeaseMs(leaseMs);
    const now = normalizeIso(this.#now(), 'Current time');
    const expiresAt = addMilliseconds(now, duration);
    return this.#database.transaction((database) => {
      this.#requireLease(database, jobId, leaseToken);
      database.prepare('UPDATE gd_jobs SET lease_expires_at = ?, updated_at = ? WHERE id = ?')
        .run(expiresAt, now, jobId);
      return mapJob(this.#requireJobRow(database, jobId));
    });
  }

  async complete(jobId: DurableJobId, leaseToken: string, result: JsonValue = null): Promise<DurableJobRecord> {
    return this.#finishRunning(jobId, leaseToken, 'completed', result, null, 'job completed');
  }

  async fail(jobId: DurableJobId, leaseToken: string, error: JsonValue, reason = 'job failed'): Promise<DurableJobRecord> {
    return this.#finishRunning(jobId, leaseToken, 'failed', null, error, reason);
  }

  async checkpoint(jobId: DurableJobId, leaseToken: string, checkpoint: JsonValue, reason = 'durable checkpoint reached'): Promise<DurableJobRecord> {
    const encoded = encodeJson(checkpoint);
    return this.#transitionRunning(jobId, leaseToken, 'checkpointed', reason, (database, now) => {
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'checkpointed', checkpoint_json = ?, worker_id = NULL, lease_token = NULL,
            lease_expires_at = NULL, updated_at = ?, pause_requested = 0, cancel_requested = 0
        WHERE id = ?
      `).run(encoded, now, jobId);
    });
  }

  async wait(jobId: DurableJobId, leaseToken: string, availableAt?: string, reason = 'job waiting'): Promise<DurableJobRecord> {
    const nextAvailableAt = normalizeIso(availableAt ?? this.#now(), 'availableAt');
    return this.#transitionRunning(jobId, leaseToken, 'waiting', reason, (database, now) => {
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'waiting', available_at = ?, worker_id = NULL, lease_token = NULL,
            lease_expires_at = NULL, updated_at = ?, pause_requested = 0, cancel_requested = 0
        WHERE id = ?
      `).run(nextAvailableAt, now, jobId);
    });
  }

  async acknowledgePause(jobId: DurableJobId, leaseToken: string, reason = 'pause acknowledged'): Promise<DurableJobRecord> {
    return this.#transitionRunning(jobId, leaseToken, 'paused', reason, (database, now) => {
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'paused', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
            updated_at = ?, pause_requested = 0
        WHERE id = ?
      `).run(now, jobId);
    });
  }

  async acknowledgeCancel(jobId: DurableJobId, leaseToken: string, reason = 'cancel acknowledged'): Promise<DurableJobRecord> {
    return this.#transitionRunning(jobId, leaseToken, 'cancelled', reason, (database, now) => {
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'cancelled', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
            updated_at = ?, finished_at = ?, cancel_requested = 0, pause_requested = 0
        WHERE id = ?
      `).run(now, now, jobId);
    });
  }

  async requestPause(jobId: DurableJobId, reason = 'pause requested'): Promise<DurableJobRecord> {
    return this.#mutateJob(jobId, reason, (database, job, now) => {
      if (isDurableJobTerminalState(job.state) || job.state === 'paused') return { previous: job.state, current: job.state };
      if (job.state === 'running') {
        database.prepare('UPDATE gd_jobs SET pause_requested = 1, updated_at = ? WHERE id = ?').run(now, jobId);
        return { previous: job.state, current: job.state };
      }
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'paused', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
            pause_requested = 0, updated_at = ?
        WHERE id = ?
      `).run(now, jobId);
      this.#insertTransition(database, jobId, job.state, 'paused', reason, now);
      return { previous: job.state, current: 'paused' as const };
    });
  }

  async requestCancel(jobId: DurableJobId, reason = 'cancel requested'): Promise<DurableJobRecord> {
    return this.#mutateJob(jobId, reason, (database, job, now) => {
      if (isDurableJobTerminalState(job.state)) return { previous: job.state, current: job.state };
      if (job.state === 'running') {
        database.prepare('UPDATE gd_jobs SET cancel_requested = 1, updated_at = ? WHERE id = ?').run(now, jobId);
        return { previous: job.state, current: job.state };
      }
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'cancelled', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
            cancel_requested = 0, pause_requested = 0, updated_at = ?, finished_at = ?
        WHERE id = ?
      `).run(now, now, jobId);
      this.#insertTransition(database, jobId, job.state, 'cancelled', reason, now);
      return { previous: job.state, current: 'cancelled' as const };
    });
  }

  async resume(jobId: DurableJobId, availableAt?: string, reason = 'job resumed'): Promise<DurableJobRecord> {
    const nextAvailableAt = normalizeIso(availableAt ?? this.#now(), 'availableAt');
    return this.#mutateJob(jobId, reason, (database, job, now) => {
      if (job.state !== 'paused' && job.state !== 'waiting' && job.state !== 'checkpointed') {
        throw new Error(`Only paused, waiting or checkpointed jobs can resume; current state is ${job.state}.`);
      }
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'queued', available_at = ?, worker_id = NULL, lease_token = NULL,
            lease_expires_at = NULL, pause_requested = 0, cancel_requested = 0,
            updated_at = ?, finished_at = NULL
        WHERE id = ?
      `).run(nextAvailableAt, now, jobId);
      this.#insertTransition(database, jobId, job.state, 'queued', reason, now);
      return { previous: job.state, current: 'queued' as const };
    });
  }

  async retry(jobId: DurableJobId, availableAt?: string, reason = 'job retry queued'): Promise<DurableJobRecord> {
    const nextAvailableAt = normalizeIso(availableAt ?? this.#now(), 'availableAt');
    return this.#mutateJob(jobId, reason, (database, job, now) => {
      if (job.state !== 'failed') throw new Error(`Only failed jobs can be retried; current state is ${job.state}.`);
      if (job.attemptCount >= job.maxAttempts) throw new Error('Durable job has exhausted maxAttempts.');
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'queued', available_at = ?, worker_id = NULL, lease_token = NULL,
            lease_expires_at = NULL, error_json = NULL, finished_at = NULL,
            pause_requested = 0, cancel_requested = 0, updated_at = ?
        WHERE id = ?
      `).run(nextAvailableAt, now, jobId);
      this.#insertTransition(database, jobId, 'failed', 'queued', reason, now);
      return { previous: 'failed' as const, current: 'queued' as const };
    });
  }

  async skip(jobId: DurableJobId, reason = 'job skipped'): Promise<DurableJobRecord> {
    return this.#mutateJob(jobId, reason, (database, job, now) => {
      if (job.state !== 'queued' && job.state !== 'waiting' && job.state !== 'paused' && job.state !== 'checkpointed') {
        throw new Error(`Job cannot be skipped from state ${job.state}.`);
      }
      database.prepare(`
        UPDATE gd_jobs
        SET state = 'skipped', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
            updated_at = ?, finished_at = ?, pause_requested = 0, cancel_requested = 0
        WHERE id = ?
      `).run(now, now, jobId);
      this.#insertTransition(database, jobId, job.state, 'skipped', reason, now);
      return { previous: job.state, current: 'skipped' as const };
    });
  }

  async setPriority(jobId: DurableJobId, priority: number): Promise<DurableJobRecord> {
    const normalized = normalizePriority(priority);
    return this.#mutateJob(jobId, 'priority changed', (database, job, now) => {
      if (isDurableJobTerminalState(job.state)) throw new Error('Terminal durable jobs cannot be reprioritized.');
      database.prepare('UPDATE gd_jobs SET priority = ?, updated_at = ? WHERE id = ?').run(normalized, now, jobId);
      return { previous: job.state, current: job.state };
    });
  }

  #emptyCounts(): Record<DurableJobState, number> {
    return Object.fromEntries(DURABLE_JOB_STATES.map((jobState) => [jobState, 0])) as Record<DurableJobState, number>;
  }

  #requireJobRow(database: DatabaseSync, jobId: DurableJobId): RawJobRow {
    const row = database.prepare('SELECT * FROM gd_jobs WHERE id = ?').get(jobId) as RawJobRow | undefined;
    if (!row) throw new Error(`Durable job not found: ${jobId}`);
    return row;
  }

  #requireLease(database: DatabaseSync, jobId: DurableJobId, leaseToken: string): RawJobRow {
    const normalizedToken = leaseToken.trim();
    if (!normalizedToken) throw new TypeError('Lease token must be a non-empty string.');
    const row = this.#requireJobRow(database, jobId);
    const job = mapJob(row);
    if (job.state !== 'running') throw new Error(`Durable job ${jobId} is not running.`);
    if (text(row.lease_token, 'job lease token') !== normalizedToken) {
      throw new Error(`Durable job ${jobId} lease token does not match the active claim.`);
    }
    return row;
  }

  #insertTransition(
    database: DatabaseSync,
    jobId: DurableJobId,
    fromState: DurableJobState | null,
    toState: DurableJobState,
    reason: string | null,
    occurredAt: string,
  ): void {
    database.prepare(`
      INSERT INTO gd_job_transitions (job_id, from_state, to_state, reason, occurred_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, fromState, toState, normalizeReason(reason), occurredAt);
  }

  async #finishRunning(
    jobId: DurableJobId,
    leaseToken: string,
    target: 'completed' | 'failed',
    result: JsonValue | null,
    error: JsonValue | null,
    reason: string,
  ): Promise<DurableJobRecord> {
    const encodedResult = result === null ? null : encodeJson(result);
    const encodedError = error === null ? null : encodeJson(error);
    return this.#transitionRunning(jobId, leaseToken, target, reason, (database, now) => {
      database.prepare(`
        UPDATE gd_jobs
        SET state = ?, result_json = ?, error_json = ?, worker_id = NULL, lease_token = NULL,
            lease_expires_at = NULL, updated_at = ?, finished_at = ?,
            pause_requested = 0, cancel_requested = 0
        WHERE id = ?
      `).run(target, encodedResult, encodedError, now, now, jobId);
    });
  }

  async #transitionRunning(
    jobId: DurableJobId,
    leaseToken: string,
    target: DurableJobState,
    reason: string,
    mutate: (database: DatabaseSync, now: string) => void,
  ): Promise<DurableJobRecord> {
    const normalizedReason = normalizeReason(reason);
    const now = normalizeIso(this.#now(), 'Current time');
    const job = this.#database.transaction((database) => {
      this.#requireLease(database, jobId, leaseToken);
      mutate(database, now);
      this.#insertTransition(database, jobId, 'running', target, normalizedReason, now);
      return mapJob(this.#requireJobRow(database, jobId));
    });
    await this.#publishChange(jobId, 'running', target, normalizedReason);
    return job;
  }

  async #mutateJob(
    jobId: DurableJobId,
    reason: string,
    mutate: (
      database: DatabaseSync,
      job: DurableJobRecord,
      now: string,
    ) => { readonly previous: DurableJobState; readonly current: DurableJobState },
  ): Promise<DurableJobRecord> {
    const normalizedReason = normalizeReason(reason);
    const now = normalizeIso(this.#now(), 'Current time');
    const outcome = this.#database.transaction((database) => {
      const before = mapJob(this.#requireJobRow(database, jobId));
      const changed = mutate(database, before, now);
      const after = mapJob(this.#requireJobRow(database, jobId));
      return { after, ...changed };
    });
    await this.#publishChange(jobId, outcome.previous, outcome.current, normalizedReason);
    return outcome.after;
  }

  async #publishChange(
    jobId: DurableJobId,
    previousState: DurableJobState | null,
    currentState: DurableJobState,
    reason: string | null,
  ): Promise<void> {
    if (!this.#eventBus) return;
    await this.#eventBus.publish('gd.local.job.changed', {
      jobId,
      previousState,
      currentState,
      reason,
    });
  }
}

export function createDurableJobEngine(options: DurableJobEngineOptions): DurableJobEngine {
  return new DurableJobEngine(options);
}
