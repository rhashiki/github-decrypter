import { randomUUID } from 'node:crypto';
import type { EventBus } from '@github-decrypter/shared';
import type { LocalDatabase } from './database.js';
import { asDurableJobId, type DurableJobId, type DurableJobState } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';

const DEFAULT_SWEEP_INTERVAL_MS = 5_000;
const MIN_SWEEP_INTERVAL_MS = 1_000;
const MAX_SWEEP_INTERVAL_MS = 60_000;

export type CrashRecoveryAction = 'requeued' | 'paused' | 'cancelled' | 'failed';

export interface CrashRecoveryBatch {
  readonly scanned: number;
  readonly requeued: number;
  readonly paused: number;
  readonly cancelled: number;
  readonly failed: number;
}

export interface CrashRecoveryStatus {
  readonly ready: boolean;
  readonly sessionActive: boolean;
  readonly priorUncleanSessions: number;
  readonly startupRecovered: number;
  readonly lastSweepRecovered: number;
  readonly lastSweepAt: string | null;
  readonly healthy: boolean;
}

export interface RuntimeSessionRecord {
  readonly id: string;
  readonly startedAt: string;
  readonly recoveryCompletedAt: string | null;
  readonly startupRecoveredJobs: number;
  readonly priorUncleanSessions: number;
  readonly cleanShutdownAt: string | null;
  readonly shutdownReason: string | null;
  readonly reconciledAt: string | null;
}

export interface JobRecoveryRecord {
  readonly id: number;
  readonly jobId: DurableJobId;
  readonly sessionId: string;
  readonly action: CrashRecoveryAction;
  readonly previousWorkerId: string | null;
  readonly previousLeaseExpiresAt: string | null;
  readonly reason: string;
  readonly recoveredAt: string;
}

export interface CrashPowerRecoveryOptions {
  readonly database: LocalDatabase;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
  readonly uuid?: () => string;
  readonly sweepIntervalMs?: number;
}

interface RawRunningJob {
  readonly id: unknown;
  readonly worker_id: unknown;
  readonly lease_expires_at: unknown;
  readonly attempt_count: unknown;
  readonly max_attempts: unknown;
  readonly pause_requested: unknown;
  readonly cancel_requested: unknown;
}

interface RawSessionRow {
  readonly id: unknown;
  readonly started_at: unknown;
  readonly recovery_completed_at: unknown;
  readonly startup_recovered_jobs: unknown;
  readonly prior_unclean_sessions: unknown;
  readonly clean_shutdown_at: unknown;
  readonly shutdown_reason: unknown;
  readonly reconciled_at: unknown;
}

interface RawRecoveryRow {
  readonly id: unknown;
  readonly job_id: unknown;
  readonly session_id: unknown;
  readonly action: unknown;
  readonly previous_worker_id: unknown;
  readonly previous_lease_expires_at: unknown;
  readonly reason: unknown;
  readonly recovered_at: unknown;
}

interface RecoveryChange {
  readonly jobId: DurableJobId;
  readonly currentState: DurableJobState;
  readonly action: CrashRecoveryAction;
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) throw new Error(`SQLite returned invalid integer for ${label}.`);
  return normalized as number;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`SQLite returned invalid text for ${label}.`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}

function booleanInteger(value: unknown, label: string): boolean {
  const normalized = integer(value, label);
  if (normalized !== 0 && normalized !== 1) throw new Error(`SQLite returned invalid boolean for ${label}.`);
  return normalized === 1;
}

function normalizeIso(value: string, label: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be an ISO-compatible timestamp.`);
  return new Date(milliseconds).toISOString();
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Recovery reason must be a non-empty string.');
  if (normalized.length > 2_000) throw new TypeError('Recovery reason may not exceed 2000 characters.');
  return normalized;
}

function normalizeSweepInterval(value: number | undefined): number {
  const normalized = value ?? DEFAULT_SWEEP_INTERVAL_MS;
  if (!Number.isSafeInteger(normalized) || normalized < MIN_SWEEP_INTERVAL_MS || normalized > MAX_SWEEP_INTERVAL_MS) {
    throw new TypeError(`Recovery sweep interval must be between ${MIN_SWEEP_INTERVAL_MS} and ${MAX_SWEEP_INTERVAL_MS} milliseconds.`);
  }
  return normalized;
}

function recoveryAction(value: unknown): CrashRecoveryAction {
  if (value === 'requeued' || value === 'paused' || value === 'cancelled' || value === 'failed') return value;
  throw new Error('SQLite returned invalid crash recovery action.');
}

function emptyBatch(): CrashRecoveryBatch {
  return Object.freeze({ scanned: 0, requeued: 0, paused: 0, cancelled: 0, failed: 0 });
}

export class CrashPowerRecovery {
  readonly #database: LocalDatabase;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #uuid: () => string;
  readonly #sweepIntervalMs: number;
  #sessionId: string | null = null;
  #priorUncleanSessions = 0;
  #startupRecovered = 0;
  #lastSweepRecovered = 0;
  #lastSweepAt: string | null = null;
  #lastError: string | null = null;
  #timer: NodeJS.Timeout | null = null;
  #sweepInFlight = false;

  constructor(options: CrashPowerRecoveryOptions) {
    this.#database = options.database;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#uuid = options.uuid ?? randomUUID;
    this.#sweepIntervalMs = normalizeSweepInterval(options.sweepIntervalMs);
  }

  get sessionId(): string | null {
    return this.#sessionId;
  }

  get status(): CrashRecoveryStatus {
    const sessionActive = this.#sessionId !== null;
    const healthy = this.#lastError === null;
    return Object.freeze({
      ready: this.#database.isOpen && sessionActive && healthy,
      sessionActive,
      priorUncleanSessions: this.#priorUncleanSessions,
      startupRecovered: this.#startupRecovered,
      lastSweepRecovered: this.#lastSweepRecovered,
      lastSweepAt: this.#lastSweepAt,
      healthy,
    });
  }

  async startSession(): Promise<CrashRecoveryStatus> {
    if (!this.#database.isOpen) throw new Error('Crash recovery cannot start before the Local Database is open.');
    if (this.#sessionId) return this.status;

    const now = normalizeIso(this.#now(), 'Current time');
    const sessionId = `gd_session_${this.#uuid()}`;
    const priorSessionIds = this.#database.transaction((database) => {
      const rows = database.prepare(`
        SELECT id
        FROM gd_runtime_sessions
        WHERE clean_shutdown_at IS NULL AND reconciled_at IS NULL
        ORDER BY started_at, id
      `).all() as unknown as Array<{ id: unknown }>;
      database.prepare(`
        INSERT INTO gd_runtime_sessions (
          id, started_at, startup_recovered_jobs, prior_unclean_sessions
        ) VALUES (?, ?, 0, ?)
      `).run(sessionId, now, rows.length);
      return rows.map((row) => text(row.id, 'runtime session id'));
    });

    this.#sessionId = sessionId;
    this.#priorUncleanSessions = priorSessionIds.length;
    this.#lastError = null;

    try {
      const recovered = await this.recoverAllRunning('startup crash/power reconciliation');
      const recoveredTotal = recovered.scanned;
      const completedAt = normalizeIso(this.#now(), 'Recovery completion time');
      this.#database.transaction((database) => {
        for (const priorSessionId of priorSessionIds) {
          database.prepare(`
            UPDATE gd_runtime_sessions
            SET reconciled_at = ?
            WHERE id = ? AND clean_shutdown_at IS NULL AND reconciled_at IS NULL
          `).run(completedAt, priorSessionId);
        }
        database.prepare(`
          UPDATE gd_runtime_sessions
          SET recovery_completed_at = ?, startup_recovered_jobs = ?, prior_unclean_sessions = ?
          WHERE id = ?
        `).run(completedAt, recoveredTotal, priorSessionIds.length, sessionId);
      });
      this.#startupRecovered = recoveredTotal;
      await this.#eventBus?.publish('gd.local.recovery.ready', {
        priorUncleanSessions: priorSessionIds.length,
        startupRecovered: recoveredTotal,
      });
      return this.status;
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : 'startup recovery failed';
      throw error;
    }
  }

  startLeaseSweep(): void {
    if (!this.#sessionId) throw new Error('Crash recovery session must be active before starting lease sweeps.');
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      if (this.#sweepInFlight || !this.#sessionId || !this.#database.isOpen) return;
      this.#sweepInFlight = true;
      void this.sweepExpiredLeases()
        .catch((error: unknown) => {
          this.#lastError = error instanceof Error ? error.message : 'lease recovery sweep failed';
        })
        .finally(() => {
          this.#sweepInFlight = false;
        });
    }, this.#sweepIntervalMs);
    this.#timer.unref();
  }

  stopLeaseSweep(): void {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }

  async sweepExpiredLeases(reason = 'expired worker lease recovery'): Promise<CrashRecoveryBatch> {
    const result = await this.#recover('expired', reason);
    this.#lastSweepRecovered = result.scanned;
    this.#lastSweepAt = normalizeIso(this.#now(), 'Recovery sweep time');
    this.#lastError = null;
    await this.#eventBus?.publish('gd.local.recovery.sweep', {
      recovered: result.scanned,
      requeued: result.requeued,
      paused: result.paused,
      cancelled: result.cancelled,
      failed: result.failed,
      occurredAt: this.#lastSweepAt,
    });
    return result;
  }

  async recoverAllRunning(reason = 'runtime session reconciliation'): Promise<CrashRecoveryBatch> {
    return this.#recover('all', reason);
  }

  async stopSession(reason = 'runtime stopped cleanly'): Promise<number> {
    this.stopLeaseSweep();
    const sessionId = this.#sessionId;
    if (!sessionId) return 0;

    try {
      const handoff = await this.recoverAllRunning(`graceful shutdown handoff: ${reason}`);
      const now = normalizeIso(this.#now(), 'Shutdown time');
      this.#database.transaction((database) => {
        database.prepare(`
          UPDATE gd_runtime_sessions
          SET clean_shutdown_at = ?, shutdown_reason = ?
          WHERE id = ?
        `).run(now, normalizeReason(reason), sessionId);
      });
      this.#sessionId = null;
      this.#lastError = null;
      await this.#eventBus?.publish('gd.local.recovery.closed', {
        handoffRecovered: handoff.scanned,
        clean: true,
        reason: normalizeReason(reason),
      });
      return handoff.scanned;
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : 'clean recovery shutdown failed';
      throw error;
    }
  }

  listSessions(): readonly RuntimeSessionRecord[] {
    if (!this.#database.isOpen) return [];
    return this.#database.read((database) => {
      const rows = database.prepare(`
        SELECT id, started_at, recovery_completed_at, startup_recovered_jobs,
               prior_unclean_sessions, clean_shutdown_at, shutdown_reason, reconciled_at
        FROM gd_runtime_sessions
        ORDER BY started_at, id
      `).all() as unknown as RawSessionRow[];
      return rows.map((row) => Object.freeze({
        id: text(row.id, 'session id'),
        startedAt: text(row.started_at, 'session started_at'),
        recoveryCompletedAt: nullableText(row.recovery_completed_at, 'session recovery_completed_at'),
        startupRecoveredJobs: integer(row.startup_recovered_jobs, 'session startup_recovered_jobs'),
        priorUncleanSessions: integer(row.prior_unclean_sessions, 'session prior_unclean_sessions'),
        cleanShutdownAt: nullableText(row.clean_shutdown_at, 'session clean_shutdown_at'),
        shutdownReason: nullableText(row.shutdown_reason, 'session shutdown_reason'),
        reconciledAt: nullableText(row.reconciled_at, 'session reconciled_at'),
      }));
    });
  }

  listRecoveries(jobId?: DurableJobId): readonly JobRecoveryRecord[] {
    if (!this.#database.isOpen) return [];
    return this.#database.read((database) => {
      const rows = jobId
        ? database.prepare(`
            SELECT id, job_id, session_id, action, previous_worker_id,
                   previous_lease_expires_at, reason, recovered_at
            FROM gd_job_recoveries WHERE job_id = ? ORDER BY id
          `).all(jobId)
        : database.prepare(`
            SELECT id, job_id, session_id, action, previous_worker_id,
                   previous_lease_expires_at, reason, recovered_at
            FROM gd_job_recoveries ORDER BY id
          `).all();
      return (rows as unknown as RawRecoveryRow[]).map((row) => Object.freeze({
        id: integer(row.id, 'recovery id'),
        jobId: asDurableJobId(text(row.job_id, 'recovery job_id')),
        sessionId: text(row.session_id, 'recovery session_id'),
        action: recoveryAction(row.action),
        previousWorkerId: nullableText(row.previous_worker_id, 'recovery previous_worker_id'),
        previousLeaseExpiresAt: nullableText(row.previous_lease_expires_at, 'recovery previous_lease_expires_at'),
        reason: text(row.reason, 'recovery reason'),
        recoveredAt: text(row.recovered_at, 'recovery recovered_at'),
      }));
    });
  }

  async #recover(scope: 'all' | 'expired', rawReason: string): Promise<CrashRecoveryBatch> {
    const sessionId = this.#sessionId;
    if (!sessionId) throw new Error('Crash recovery session is not active.');
    const now = normalizeIso(this.#now(), 'Recovery time');
    const reason = normalizeReason(rawReason);

    const changes = this.#database.transaction((database) => {
      const rows = (scope === 'expired'
        ? database.prepare(`
            SELECT id, worker_id, lease_expires_at, attempt_count, max_attempts,
                   pause_requested, cancel_requested
            FROM gd_jobs
            WHERE state = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
            ORDER BY lease_expires_at, queue_order, id
          `).all(now)
        : database.prepare(`
            SELECT id, worker_id, lease_expires_at, attempt_count, max_attempts,
                   pause_requested, cancel_requested
            FROM gd_jobs
            WHERE state = 'running'
            ORDER BY queue_order, id
          `).all()) as unknown as RawRunningJob[];

      const recovered: RecoveryChange[] = [];
      for (const row of rows) {
        const jobId = asDurableJobId(text(row.id, 'recovery job id'));
        const previousWorkerId = nullableText(row.worker_id, 'recovery worker id');
        const previousLeaseExpiresAt = nullableText(row.lease_expires_at, 'recovery lease expiry');
        const attemptCount = integer(row.attempt_count, 'recovery attempt_count');
        const maxAttempts = integer(row.max_attempts, 'recovery max_attempts');
        const pauseRequested = booleanInteger(row.pause_requested, 'recovery pause_requested');
        const cancelRequested = booleanInteger(row.cancel_requested, 'recovery cancel_requested');

        let action: CrashRecoveryAction;
        let currentState: DurableJobState;
        if (cancelRequested) {
          action = 'cancelled';
          currentState = 'cancelled';
          database.prepare(`
            UPDATE gd_jobs
            SET state = 'cancelled', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
                pause_requested = 0, cancel_requested = 0, updated_at = ?, finished_at = ?
            WHERE id = ? AND state = 'running'
          `).run(now, now, jobId);
        } else if (pauseRequested) {
          action = 'paused';
          currentState = 'paused';
          database.prepare(`
            UPDATE gd_jobs
            SET state = 'paused', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
                pause_requested = 0, cancel_requested = 0, updated_at = ?, finished_at = NULL
            WHERE id = ? AND state = 'running'
          `).run(now, jobId);
        } else if (attemptCount < maxAttempts) {
          action = 'requeued';
          currentState = 'queued';
          database.prepare(`
            UPDATE gd_jobs
            SET state = 'queued', available_at = ?, worker_id = NULL, lease_token = NULL,
                lease_expires_at = NULL, pause_requested = 0, cancel_requested = 0,
                updated_at = ?, finished_at = NULL
            WHERE id = ? AND state = 'running'
          `).run(now, now, jobId);
        } else {
          action = 'failed';
          currentState = 'failed';
          const recoveryError = JSON.stringify({
            code: 'GD_RECOVERY_ATTEMPTS_EXHAUSTED',
            message: 'Interrupted durable job exhausted its retry budget.',
            reason,
            recoveredAt: now,
          });
          database.prepare(`
            UPDATE gd_jobs
            SET state = 'failed', worker_id = NULL, lease_token = NULL, lease_expires_at = NULL,
                pause_requested = 0, cancel_requested = 0, updated_at = ?, finished_at = ?,
                error_json = ?
            WHERE id = ? AND state = 'running'
          `).run(now, now, recoveryError, jobId);
        }

        database.prepare(`
          INSERT INTO gd_job_transitions (job_id, from_state, to_state, reason, occurred_at)
          VALUES (?, 'running', ?, ?, ?)
        `).run(jobId, currentState, `recovery: ${reason}`, now);
        database.prepare(`
          INSERT INTO gd_job_recoveries (
            job_id, session_id, action, previous_worker_id, previous_lease_expires_at, reason, recovered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(jobId, sessionId, action, previousWorkerId, previousLeaseExpiresAt, reason, now);
        recovered.push({ jobId, currentState, action });
      }
      return recovered;
    });

    const counts = { requeued: 0, paused: 0, cancelled: 0, failed: 0 };
    for (const change of changes) {
      counts[change.action] += 1;
      await this.#eventBus?.publish('gd.local.job.changed', {
        jobId: change.jobId,
        previousState: 'running',
        currentState: change.currentState,
        reason: `recovery: ${reason}`,
      });
    }

    return Object.freeze({
      scanned: changes.length,
      requeued: counts.requeued,
      paused: counts.paused,
      cancelled: counts.cancelled,
      failed: counts.failed,
    });
  }
}

export function createCrashPowerRecovery(options: CrashPowerRecoveryOptions): CrashPowerRecovery {
  return new CrashPowerRecovery(options);
}
