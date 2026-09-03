import type { EventBus } from '@github-decrypter/shared';
import type { LocalDatabase } from './database.js';
import type { DurableJobClaim, DurableJobId } from './job-types.js';
import type { DurableJobEngine } from './job-engine.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';

export const CONNECTIVITY_STATES = ['unknown', 'online', 'offline'] as const;
export type ConnectivityState = (typeof CONNECTIVITY_STATES)[number];

export interface OfflineExecutionStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly connectivity: ConnectivityState;
  readonly source: string;
  readonly observedAt: string;
  readonly networkRequired: number;
  readonly waitingForNetwork: number;
  readonly localQueued: number;
  readonly localExecutionAvailable: true;
  readonly automaticNetworkProbe: false;
}

export interface OfflineExecutionOptions {
  readonly database: LocalDatabase;
  readonly jobs: DurableJobEngine;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

interface ConnectivityRow {
  readonly state: unknown;
  readonly source: unknown;
  readonly observed_at: unknown;
}

interface CountRow {
  readonly count: unknown;
}

interface JobIdRow {
  readonly id: unknown;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`SQLite returned invalid text for ${label}.`);
  return value;
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) throw new Error(`SQLite returned invalid integer for ${label}.`);
  return normalized as number;
}

function normalizeConnectivityState(value: string): ConnectivityState {
  if ((CONNECTIVITY_STATES as readonly string[]).includes(value)) return value as ConnectivityState;
  throw new TypeError(`Unsupported connectivity state: ${value}`);
}

function normalizeSource(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Connectivity source must be a non-empty string.');
  if (normalized.length > 200) throw new TypeError('Connectivity source may not exceed 200 characters.');
  return normalized;
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Network wait reason must be a non-empty string.');
  if (normalized.length > 2_000) throw new TypeError('Network wait reason may not exceed 2000 characters.');
  return normalized;
}

export class OfflineExecutionCoordinator {
  readonly #database: LocalDatabase;
  readonly #jobs: DurableJobEngine;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;

  constructor(options: OfflineExecutionOptions) {
    this.#database = options.database;
    this.#jobs = options.jobs;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  status(): OfflineExecutionStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 4) {
      return Object.freeze({
        ready: false,
        schemaVersion,
        connectivity: 'unknown',
        source: 'unavailable',
        observedAt: '1970-01-01T00:00:00.000Z',
        networkRequired: 0,
        waitingForNetwork: 0,
        localQueued: 0,
        localExecutionAvailable: true,
        automaticNetworkProbe: false,
      });
    }

    return this.#database.read((database) => {
      const row = database
        .prepare('SELECT state, source, observed_at FROM gd_connectivity_state WHERE id = 1')
        .get() as ConnectivityRow | undefined;
      if (!row) throw new Error('Connectivity state row is missing.');

      const networkRequired = database
        .prepare('SELECT COUNT(*) AS count FROM gd_job_network_requirements')
        .get() as CountRow | undefined;
      const waiting = database.prepare(`
        SELECT COUNT(*) AS count
        FROM gd_job_network_requirements requirement
        JOIN gd_jobs job ON job.id = requirement.job_id
        WHERE requirement.blocked_for_network = 1 AND job.state = 'waiting'
      `).get() as CountRow | undefined;
      const localQueued = database.prepare(`
        SELECT COUNT(*) AS count
        FROM gd_jobs job
        LEFT JOIN gd_job_network_requirements requirement ON requirement.job_id = job.id
        WHERE job.state = 'queued' AND requirement.job_id IS NULL
      `).get() as CountRow | undefined;

      return Object.freeze({
        ready: true,
        schemaVersion,
        connectivity: normalizeConnectivityState(text(row.state, 'connectivity state')),
        source: text(row.source, 'connectivity source'),
        observedAt: text(row.observed_at, 'connectivity observed_at'),
        networkRequired: integer(networkRequired?.count ?? 0, 'network-required count'),
        waitingForNetwork: integer(waiting?.count ?? 0, 'network waiting count'),
        localQueued: integer(localQueued?.count ?? 0, 'local queued count'),
        localExecutionAvailable: true,
        automaticNetworkProbe: false,
      });
    });
  }

  async initialize(): Promise<OfflineExecutionStatus> {
    const status = this.status();
    if (!status.ready) throw new Error('Offline Execution requires Local Database schema 4 or newer.');
    await this.reconcile();
    const current = this.status();
    await this.#eventBus?.publish('gd.local.offline.ready', {
      connectivity: current.connectivity,
      waitingForNetwork: current.waitingForNetwork,
      localExecutionAvailable: true,
      automaticNetworkProbe: false,
    });
    return current;
  }

  isNetworkRequired(jobId: DurableJobId): boolean {
    return this.#database.read((database) => Boolean(
      database.prepare('SELECT 1 AS found FROM gd_job_network_requirements WHERE job_id = ?').get(jobId),
    ));
  }

  async declareNetworkRequired(jobId: DurableJobId): Promise<void> {
    const now = this.#now();
    this.#database.transaction((database) => {
      const job = database.prepare('SELECT id FROM gd_jobs WHERE id = ?').get(jobId);
      if (!job) throw new Error(`Unknown durable job ${jobId}.`);
      database.prepare(`
        INSERT INTO gd_job_network_requirements (
          job_id, requirement, blocked_for_network, blocked_at, updated_at
        ) VALUES (?, 'network-required', 0, NULL, ?)
        ON CONFLICT(job_id) DO UPDATE SET
          requirement = 'network-required',
          updated_at = excluded.updated_at
      `).run(jobId, now);
    });

    if (this.status().connectivity !== 'online') {
      await this.#parkQueuedNetworkJobs();
    }
  }

  async clearNetworkRequirement(jobId: DurableJobId): Promise<void> {
    const wasBlocked = this.#database.read((database) => Boolean(database.prepare(`
      SELECT 1 AS found
      FROM gd_job_network_requirements requirement
      JOIN gd_jobs job ON job.id = requirement.job_id
      WHERE requirement.job_id = ?
        AND requirement.blocked_for_network = 1
        AND job.state = 'waiting'
    `).get(jobId)));

    this.#database.transaction((database) => {
      database.prepare('DELETE FROM gd_job_network_requirements WHERE job_id = ?').run(jobId);
    });

    if (wasBlocked) await this.#jobs.resume(jobId, this.#now(), 'network requirement removed');
  }

  async setConnectivity(state: ConnectivityState, source: string): Promise<OfflineExecutionStatus> {
    const current = normalizeConnectivityState(state);
    const normalizedSource = normalizeSource(source);
    const observedAt = this.#now();
    const previous = this.status().connectivity;

    this.#database.transaction((database) => {
      database.prepare(`
        UPDATE gd_connectivity_state
        SET state = ?, source = ?, observed_at = ?
        WHERE id = 1
      `).run(current, normalizedSource, observedAt);
      database.prepare(`
        INSERT INTO gd_connectivity_events (previous_state, current_state, source, observed_at)
        VALUES (?, ?, ?, ?)
      `).run(previous, current, normalizedSource, observedAt);
    });

    await this.reconcile();
    const status = this.status();
    await this.#eventBus?.publish('gd.local.connectivity.changed', {
      previous,
      current,
      source: normalizedSource,
      observedAt,
      waitingForNetwork: status.waitingForNetwork,
    });
    return status;
  }

  async markOnline(source = 'runtime-observation'): Promise<OfflineExecutionStatus> {
    return this.setConnectivity('online', source);
  }

  async markOffline(source = 'runtime-observation'): Promise<OfflineExecutionStatus> {
    return this.setConnectivity('offline', source);
  }

  async markUnknown(source = 'runtime-observation'): Promise<OfflineExecutionStatus> {
    return this.setConnectivity('unknown', source);
  }

  async reconcile(): Promise<OfflineExecutionStatus> {
    const state = this.status().connectivity;
    if (state === 'online') await this.#resumeNetworkWaits();
    else await this.#parkQueuedNetworkJobs();
    this.#clearStaleBlockedFlags();
    return this.status();
  }

  async claimNext(workerId: string, leaseMs?: number): Promise<DurableJobClaim | null> {
    await this.reconcile();
    return this.#jobs.claimNext(workerId, leaseMs);
  }

  async waitForNetwork(
    jobId: DurableJobId,
    leaseToken: string,
    reason = 'network dependency unavailable',
  ): Promise<void> {
    if (!this.isNetworkRequired(jobId)) await this.declareNetworkRequired(jobId);
    const normalizedReason = normalizeReason(reason);
    await this.#jobs.wait(jobId, leaseToken, this.#now(), normalizedReason);
    const blockedAt = this.#now();
    this.#database.transaction((database) => {
      database.prepare(`
        UPDATE gd_job_network_requirements
        SET blocked_for_network = 1, blocked_at = ?, updated_at = ?
        WHERE job_id = ?
      `).run(blockedAt, blockedAt, jobId);
    });
    await this.#eventBus?.publish('gd.local.offline.waiting', {
      jobId,
      reason: normalizedReason,
      blockedAt,
    });
  }

  #clearStaleBlockedFlags(): void {
    const now = this.#now();
    this.#database.transaction((database) => {
      database.prepare(`
        UPDATE gd_job_network_requirements
        SET blocked_for_network = 0, blocked_at = NULL, updated_at = ?
        WHERE blocked_for_network = 1
          AND job_id IN (SELECT id FROM gd_jobs WHERE state <> 'waiting')
      `).run(now);
    });
  }

  async #parkQueuedNetworkJobs(): Promise<void> {
    const now = this.#now();
    const parked = this.#database.transaction((database) => {
      const rows = database.prepare(`
        SELECT job.id
        FROM gd_jobs job
        JOIN gd_job_network_requirements requirement ON requirement.job_id = job.id
        WHERE job.state = 'queued' AND requirement.blocked_for_network = 0
        ORDER BY job.queue_order
      `).all() as unknown as JobIdRow[];

      const ids = rows.map((row) => text(row.id, 'network-blocked job id') as DurableJobId);
      for (const jobId of ids) {
        database.prepare(`
          UPDATE gd_jobs
          SET state = 'waiting', worker_id = NULL, lease_token = NULL,
              lease_expires_at = NULL, updated_at = ?
          WHERE id = ? AND state = 'queued'
        `).run(now, jobId);
        database.prepare(`
          UPDATE gd_job_network_requirements
          SET blocked_for_network = 1, blocked_at = ?, updated_at = ?
          WHERE job_id = ?
        `).run(now, now, jobId);
        database.prepare(`
          INSERT INTO gd_job_transitions (job_id, from_state, to_state, reason, occurred_at)
          VALUES (?, 'queued', 'waiting', 'network unavailable; preserved for offline execution', ?)
        `).run(jobId, now);
      }
      return ids;
    });

    for (const jobId of parked) {
      await this.#eventBus?.publish('gd.local.job.changed', {
        jobId,
        previousState: 'queued',
        currentState: 'waiting',
        reason: 'network unavailable; preserved for offline execution',
      });
      await this.#eventBus?.publish('gd.local.offline.waiting', {
        jobId,
        reason: 'network unavailable; preserved for offline execution',
        blockedAt: now,
      });
    }
  }

  async #resumeNetworkWaits(): Promise<void> {
    const rows = this.#database.read((database) => database.prepare(`
      SELECT job.id
      FROM gd_jobs job
      JOIN gd_job_network_requirements requirement ON requirement.job_id = job.id
      WHERE job.state = 'waiting' AND requirement.blocked_for_network = 1
      ORDER BY job.queue_order
    `).all() as unknown as JobIdRow[]);

    for (const row of rows) {
      const jobId = text(row.id, 'network-resume job id') as DurableJobId;
      await this.#jobs.resume(jobId, this.#now(), 'network connectivity restored');
      const resumedAt = this.#now();
      this.#database.transaction((database) => {
        database.prepare(`
          UPDATE gd_job_network_requirements
          SET blocked_for_network = 0, blocked_at = NULL, updated_at = ?
          WHERE job_id = ?
        `).run(resumedAt, jobId);
      });
      await this.#eventBus?.publish('gd.local.offline.resumed', { jobId, resumedAt });
    }
  }
}

export function createOfflineExecutionCoordinator(options: OfflineExecutionOptions): OfflineExecutionCoordinator {
  return new OfflineExecutionCoordinator(options);
}
