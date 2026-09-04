import {
  AI_CHANGE_SESSION_STATES,
  CHANGE_ORIGINS,
  CHANGE_TRACKING_SCHEMA,
  type AiChangeSessionId,
  type AiChangeSessionRecord,
  type AiChangeSessionState,
  type ChangeOrigin,
  type ChangePathAttribution,
  type ChangeTrackingCounts,
  type ChangeTrackingSnapshot,
} from '@github-decrypter/git';
import type { WorkspaceId } from '@github-decrypter/workspace';
import type { EventBus } from '@github-decrypter/shared';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import type { LocalDatabase } from './database.js';
import type { GitRuntime } from './git-runtime.js';
import { isDurableJobTerminalState, type DurableJobId, type DurableJobState } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import type { CapabilitySecurityAuthority } from './capability-security.js';
import type { WorkspaceManager } from './workspace-manager.js';

export interface ChangeTrackerStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly activeSessions: number;
  readonly invalidatedSessions: number;
  readonly trackedPaths: number;
  readonly human: number;
  readonly ai: number;
  readonly mixed: number;
  readonly unknown: number;
  readonly explicitBoundaries: true;
  readonly contentPersistence: false;
  readonly filesystemMutation: false;
  readonly externalTransport: false;
}

export interface AiChangeAuthorization {
  readonly jobId: DurableJobId;
  readonly token: string;
}

export interface ChangeTrackerOptions {
  readonly database: LocalDatabase;
  readonly git: Pick<GitRuntime, 'statusSnapshot' | 'diff'>;
  readonly workspaces: WorkspaceManager;
  readonly capabilities: Pick<CapabilitySecurityAuthority, 'assertAuthorized'>;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly processInstanceId: string;
  readonly now?: () => string;
}

export interface AiChangeCompletion {
  readonly session: AiChangeSessionRecord;
  readonly snapshot: ChangeTrackingSnapshot;
}

interface CapturedPath {
  readonly path: string;
  readonly digest: string;
  readonly staged: boolean;
  readonly unstaged: boolean;
  readonly untracked: boolean;
  readonly conflicted: boolean;
}

interface BaselineEntry extends CapturedPath {
  readonly origin: ChangeOrigin;
}

interface CapturedWorkspace {
  readonly workspaceId: WorkspaceId;
  readonly paths: readonly CapturedPath[];
  readonly observedAt: string;
}

interface SessionRow {
  readonly id: unknown;
  readonly workspace_id: unknown;
  readonly job_id: unknown;
  readonly process_instance_id: unknown;
  readonly state: unknown;
  readonly baseline_json: unknown;
  readonly baseline_digest: unknown;
  readonly baseline_paths: unknown;
  readonly started_at: unknown;
  readonly completed_at: unknown;
  readonly invalidation_reason: unknown;
}

interface PathEventRow {
  readonly seq: unknown;
  readonly workspace_id: unknown;
  readonly path: unknown;
  readonly origin: unknown;
  readonly state_digest: unknown;
  readonly dirty: unknown;
  readonly session_id: unknown;
  readonly job_id: unknown;
  readonly observed_at: unknown;
}

interface CountRow { readonly count: unknown; }
interface JobStateRow { readonly state: unknown; }

interface PendingPathEvent {
  readonly workspaceId: WorkspaceId;
  readonly path: string;
  readonly origin: ChangeOrigin;
  readonly digest: string;
  readonly dirty: boolean;
  readonly sessionId: AiChangeSessionId | null;
  readonly jobId: DurableJobId | null;
  readonly observedAt: string;
}

const CLEAN_DIGEST = createHash('sha256').update('gd-change-tracking-clean-v1').digest('hex');
const RESTART_INVALIDATION_REASON = 'runtime process restarted during active AI change session';

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

function asOrigin(value: unknown): ChangeOrigin {
  if (typeof value === 'string' && (CHANGE_ORIGINS as readonly string[]).includes(value)) return value as ChangeOrigin;
  throw new TypeError(`Unsupported change origin: ${String(value)}.`);
}

function asSessionState(value: unknown): AiChangeSessionState {
  if (typeof value === 'string' && (AI_CHANGE_SESSION_STATES as readonly string[]).includes(value)) return value as AiChangeSessionState;
  throw new TypeError(`Unsupported AI change session state: ${String(value)}.`);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

async function digestFile(path: string): Promise<string> {
  const stat = statSync(path);
  if (!stat.isFile()) return sha256(`non-file:${stat.mode}:${stat.size}`);
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}

function safeRelativePath(path: string): string {
  const normalized = path.trim();
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[A-Za-z]:[\\/]/.test(normalized)) {
    throw new TypeError('Change-tracking paths must be non-empty workspace-relative paths.');
  }
  const segments = normalized.replace(/\\/g, '/').split('/');
  if (segments.some((segment) => segment === '..')) throw new TypeError('Change-tracking paths may not escape the workspace.');
  return normalized.replace(/\\/g, '/');
}

function baselineDigest(entries: readonly BaselineEntry[]): string {
  return sha256(JSON.stringify(entries.map((entry) => ({
    path: entry.path,
    digest: entry.digest,
    origin: entry.origin,
    staged: entry.staged,
    unstaged: entry.unstaged,
    untracked: entry.untracked,
    conflicted: entry.conflicted,
  }))));
}

function parseBaseline(raw: string): readonly BaselineEntry[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Stored AI change baseline is malformed.');
  const entries = parsed.map((value): BaselineEntry => {
    if (!value || typeof value !== 'object') throw new Error('Stored AI change baseline entry is malformed.');
    const record = value as Record<string, unknown>;
    const path = safeRelativePath(text(record.path, 'baseline path'));
    const digest = text(record.digest, 'baseline digest');
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error('Stored AI change baseline digest is malformed.');
    return Object.freeze({
      path,
      digest,
      origin: asOrigin(record.origin),
      staged: record.staged === true,
      unstaged: record.unstaged === true,
      untracked: record.untracked === true,
      conflicted: record.conflicted === true,
    });
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return Object.freeze(entries);
}

function combineHuman(previous: ChangeOrigin | null): ChangeOrigin {
  if (previous === 'ai' || previous === 'mixed') return 'mixed';
  if (previous === 'unknown') return 'unknown';
  return 'human';
}

function combineAi(previous: ChangeOrigin | null): ChangeOrigin {
  if (previous === 'human' || previous === 'mixed') return 'mixed';
  if (previous === 'unknown') return 'unknown';
  return 'ai';
}

function counts(paths: readonly ChangePathAttribution[]): ChangeTrackingCounts {
  const result = { human: 0, ai: 0, mixed: 0, unknown: 0 };
  for (const path of paths) result[path.origin] += 1;
  return Object.freeze(result);
}

export function changeTrackingWorkspaceResource(workspaceId: WorkspaceId): string {
  return `gd://workspace/${workspaceId}/files`;
}

export class ChangeTracker {
  readonly #database: LocalDatabase;
  readonly #git: Pick<GitRuntime, 'statusSnapshot' | 'diff'>;
  readonly #workspaces: WorkspaceManager;
  readonly #capabilities: Pick<CapabilitySecurityAuthority, 'assertAuthorized'>;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #processInstanceId: string;
  readonly #now: () => string;
  #ready = false;

  constructor(options: ChangeTrackerOptions) {
    this.#database = options.database;
    this.#git = options.git;
    this.#workspaces = options.workspaces;
    this.#capabilities = options.capabilities;
    this.#eventBus = options.eventBus;
    this.#processInstanceId = options.processInstanceId;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  async initialize(): Promise<ChangeTrackerStatus> {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 10) throw new Error('Human vs AI Change Tracking requires Local Database schema 10 or newer.');

    const stale = this.#database.read((database) => database.prepare(`
      SELECT id, workspace_id, job_id, process_instance_id, state, baseline_json, baseline_digest,
             baseline_paths, started_at, completed_at, invalidation_reason
      FROM gd_change_sessions
      WHERE state = 'active' AND process_instance_id <> ?
      ORDER BY started_at, id
    `).all(this.#processInstanceId) as unknown as SessionRow[]);
    const occurredAt = this.#now();
    if (stale.length > 0) {
      this.#database.transaction((database) => {
        database.prepare(`
          UPDATE gd_change_sessions
          SET state = 'invalidated', completed_at = ?, invalidation_reason = ?
          WHERE state = 'active' AND process_instance_id <> ?
        `).run(occurredAt, RESTART_INVALIDATION_REASON, this.#processInstanceId);
      });
    }

    this.#ready = true;
    for (const row of stale) {
      await this.#eventBus?.publish('gd.local.change-tracking.invalidated', {
        sessionId: text(row.id, 'change session id') as AiChangeSessionId,
        workspaceId: text(row.workspace_id, 'change session workspace id') as WorkspaceId,
        jobId: text(row.job_id, 'change session job id') as DurableJobId,
        reason: RESTART_INVALIDATION_REASON,
        occurredAt,
      });
    }

    const status = this.status();
    await this.#eventBus?.publish('gd.local.change-tracking.ready', {
      activeSessions: status.activeSessions,
      trackedPaths: status.trackedPaths,
      explicitBoundaries: true,
      contentPersistence: false,
      filesystemMutation: false,
      externalTransport: false,
    });
    return status;
  }

  async shutdown(reason = 'local runtime stopped'): Promise<number> {
    if (!this.#ready || !this.#database.isOpen) return 0;
    const occurredAt = this.#now();
    const rows = this.#database.read((database) => database.prepare(`
      SELECT id, workspace_id, job_id, process_instance_id, state, baseline_json, baseline_digest,
             baseline_paths, started_at, completed_at, invalidation_reason
      FROM gd_change_sessions
      WHERE state = 'active' AND process_instance_id = ?
      ORDER BY started_at, id
    `).all(this.#processInstanceId) as unknown as SessionRow[]);
    if (rows.length > 0) {
      this.#database.transaction((database) => {
        database.prepare(`
          UPDATE gd_change_sessions
          SET state = 'invalidated', completed_at = ?, invalidation_reason = ?
          WHERE state = 'active' AND process_instance_id = ?
        `).run(occurredAt, reason, this.#processInstanceId);
      });
      for (const row of rows) {
        await this.#eventBus?.publish('gd.local.change-tracking.invalidated', {
          sessionId: text(row.id, 'change session id') as AiChangeSessionId,
          workspaceId: text(row.workspace_id, 'change session workspace id') as WorkspaceId,
          jobId: text(row.job_id, 'change session job id') as DurableJobId,
          reason,
          occurredAt,
        });
      }
    }
    this.#ready = false;
    return rows.length;
  }

  status(): ChangeTrackerStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 10) {
      return Object.freeze({
        ready: false,
        schemaVersion,
        activeSessions: 0,
        invalidatedSessions: 0,
        trackedPaths: 0,
        human: 0,
        ai: 0,
        mixed: 0,
        unknown: 0,
        explicitBoundaries: true,
        contentPersistence: false,
        filesystemMutation: false,
        externalTransport: false,
      });
    }

    const sessionCounts = this.#database.read((database) => ({
      active: database.prepare("SELECT COUNT(*) AS count FROM gd_change_sessions WHERE state = 'active'").get() as CountRow | undefined,
      invalidated: database.prepare("SELECT COUNT(*) AS count FROM gd_change_sessions WHERE state = 'invalidated'").get() as CountRow | undefined,
    }));
    const latest = this.#latestEvents();
    const current = [...latest.values()].filter((row) => integer(row.dirty, 'change event dirty flag') === 1);
    const originCounts = { human: 0, ai: 0, mixed: 0, unknown: 0 };
    for (const row of current) originCounts[asOrigin(row.origin)] += 1;
    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      activeSessions: integer(sessionCounts.active?.count ?? 0, 'active change session count'),
      invalidatedSessions: integer(sessionCounts.invalidated?.count ?? 0, 'invalidated change session count'),
      trackedPaths: current.length,
      human: originCounts.human,
      ai: originCounts.ai,
      mixed: originCounts.mixed,
      unknown: originCounts.unknown,
      explicitBoundaries: true,
      contentPersistence: false,
      filesystemMutation: false,
      externalTransport: false,
    });
  }

  async snapshot(workspaceId: WorkspaceId): Promise<ChangeTrackingSnapshot> {
    this.#assertReady();
    const captured = await this.#capture(workspaceId);
    return this.#snapshotFromCapture(captured, this.#latestEvents(workspaceId));
  }

  async observeHumanChanges(workspaceId: WorkspaceId): Promise<ChangeTrackingSnapshot> {
    this.#assertReady();
    if (this.#activeSession(workspaceId)) throw new Error('Cannot record human changes while an AI change session is active for this workspace.');
    const captured = await this.#capture(workspaceId);
    const latest = this.#latestEvents(workspaceId);
    const currentByPath = new Map(captured.paths.map((path) => [path.path, path]));
    const events: PendingPathEvent[] = [];
    const observedAt = captured.observedAt;
    const paths = new Set<string>([...currentByPath.keys(), ...latest.keys()]);

    for (const path of [...paths].sort()) {
      const current = currentByPath.get(path) ?? null;
      const previous = latest.get(path) ?? null;
      const previousDirty = previous ? integer(previous.dirty, 'change event dirty flag') === 1 : false;
      const previousDigest = previous ? text(previous.state_digest, 'change event digest') : null;
      if (!current) {
        if (previousDirty) {
          events.push({
            workspaceId,
            path,
            origin: asOrigin(previous!.origin),
            digest: CLEAN_DIGEST,
            dirty: false,
            sessionId: null,
            jobId: null,
            observedAt,
          });
        }
        continue;
      }
      if (previousDirty && previousDigest === current.digest) continue;
      events.push({
        workspaceId,
        path,
        origin: combineHuman(previousDirty ? asOrigin(previous!.origin) : null),
        digest: current.digest,
        dirty: true,
        sessionId: null,
        jobId: null,
        observedAt,
      });
    }

    this.#appendEvents(events);
    const snapshot = this.#snapshotFromCapture(captured, this.#latestEvents(workspaceId));
    await this.#eventBus?.publish('gd.local.change-tracking.human-observed', {
      workspaceId,
      changedPaths: events.length,
      human: snapshot.counts.human,
      mixed: snapshot.counts.mixed,
      unknown: snapshot.counts.unknown,
      observedAt,
    });
    return snapshot;
  }

  async beginAiChange(workspaceId: WorkspaceId, authorization: AiChangeAuthorization): Promise<AiChangeSessionRecord> {
    this.#assertReady();
    if (this.#activeSession(workspaceId)) throw new Error('Only one AI change session may be active per workspace.');
    this.#assertJobActive(authorization.jobId);
    await this.#authorizeAi(workspaceId, authorization);
    const captured = await this.#capture(workspaceId);
    const latest = this.#latestEvents(workspaceId);
    const currentByPath = new Map(captured.paths.map((path) => [path.path, path]));
    const reconciliation: PendingPathEvent[] = [];
    const baseline: BaselineEntry[] = [];

    for (const path of captured.paths) {
      const previous = latest.get(path.path) ?? null;
      const previousDirty = previous ? integer(previous.dirty, 'change event dirty flag') === 1 : false;
      const previousDigest = previous ? text(previous.state_digest, 'change event digest') : null;
      const origin = previousDirty && previousDigest === path.digest ? asOrigin(previous!.origin) : 'unknown';
      baseline.push(Object.freeze({ ...path, origin }));
      if (!(previousDirty && previousDigest === path.digest)) {
        reconciliation.push({
          workspaceId,
          path: path.path,
          origin: 'unknown',
          digest: path.digest,
          dirty: true,
          sessionId: null,
          jobId: null,
          observedAt: captured.observedAt,
        });
      }
    }

    for (const [path, previous] of latest.entries()) {
      if (integer(previous.dirty, 'change event dirty flag') === 1 && !currentByPath.has(path)) {
        reconciliation.push({
          workspaceId,
          path,
          origin: asOrigin(previous.origin),
          digest: CLEAN_DIGEST,
          dirty: false,
          sessionId: null,
          jobId: null,
          observedAt: captured.observedAt,
        });
      }
    }

    baseline.sort((a, b) => a.path.localeCompare(b.path));
    const digest = baselineDigest(baseline);
    const id = `gd_changesession_${randomUUID()}` as AiChangeSessionId;
    const startedAt = this.#now();
    const baselineJson = JSON.stringify(baseline);

    this.#database.transaction((database) => {
      this.#insertEvents(database, reconciliation);
      database.prepare(`
        INSERT INTO gd_change_sessions (
          id, workspace_id, job_id, process_instance_id, state,
          baseline_json, baseline_digest, baseline_paths, started_at, completed_at, invalidation_reason
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL, NULL)
      `).run(id, workspaceId, authorization.jobId, this.#processInstanceId, baselineJson, digest, baseline.length, startedAt);
    });

    const session = this.getSession(id);
    if (!session) throw new Error('AI change session disappeared after creation.');
    await this.#eventBus?.publish('gd.local.change-tracking.ai-started', {
      sessionId: id,
      workspaceId,
      jobId: authorization.jobId,
      baselinePaths: baseline.length,
      startedAt,
    });
    return session;
  }

  async completeAiChange(sessionId: AiChangeSessionId, authorization: AiChangeAuthorization): Promise<AiChangeCompletion> {
    return this.#finishAiChange(sessionId, authorization, 'completed');
  }

  async cancelAiChange(sessionId: AiChangeSessionId, authorization: AiChangeAuthorization): Promise<AiChangeCompletion> {
    return this.#finishAiChange(sessionId, authorization, 'cancelled');
  }

  getSession(sessionId: AiChangeSessionId): AiChangeSessionRecord | null {
    if (!this.#database.isOpen || (this.#database.status?.schemaVersion ?? 0) < 10) return null;
    const row = this.#database.read((database) => database.prepare(`
      SELECT id, workspace_id, job_id, process_instance_id, state, baseline_json, baseline_digest,
             baseline_paths, started_at, completed_at, invalidation_reason
      FROM gd_change_sessions WHERE id = ?
    `).get(sessionId) as SessionRow | undefined);
    return row ? this.#sessionRecord(row) : null;
  }

  async #finishAiChange(
    sessionId: AiChangeSessionId,
    authorization: AiChangeAuthorization,
    state: 'completed' | 'cancelled',
  ): Promise<AiChangeCompletion> {
    this.#assertReady();
    const row = this.#sessionRow(sessionId);
    if (asSessionState(row.state) !== 'active') throw new Error(`AI change session ${sessionId} is not active.`);
    if (text(row.process_instance_id, 'change session process instance') !== this.#processInstanceId) {
      throw new Error('AI change session belongs to a stale runtime process.');
    }
    const workspaceId = text(row.workspace_id, 'change session workspace id') as WorkspaceId;
    const jobId = text(row.job_id, 'change session job id') as DurableJobId;
    if (authorization.jobId !== jobId) throw new Error('AI change session job does not match authorization job.');
    this.#assertJobActive(jobId);
    await this.#authorizeAi(workspaceId, authorization);

    const baseline = parseBaseline(text(row.baseline_json, 'change session baseline'));
    if (baselineDigest(baseline) !== text(row.baseline_digest, 'change session baseline digest')) {
      throw new Error('AI change session baseline integrity check failed.');
    }
    const captured = await this.#capture(workspaceId);
    const before = new Map(baseline.map((path) => [path.path, path]));
    const after = new Map(captured.paths.map((path) => [path.path, path]));
    const events: PendingPathEvent[] = [];
    const occurredAt = this.#now();
    const paths = new Set<string>([...before.keys(), ...after.keys()]);

    for (const path of [...paths].sort()) {
      const previous = before.get(path) ?? null;
      const current = after.get(path) ?? null;
      if (previous && current && previous.digest === current.digest) continue;
      const origin = state === 'cancelled' ? 'unknown' : combineAi(previous?.origin ?? null);
      events.push({
        workspaceId,
        path,
        origin,
        digest: current?.digest ?? CLEAN_DIGEST,
        dirty: Boolean(current),
        sessionId,
        jobId,
        observedAt: occurredAt,
      });
    }

    this.#database.transaction((database) => {
      this.#insertEvents(database, events);
      const result = database.prepare(`
        UPDATE gd_change_sessions
        SET state = ?, completed_at = ?, invalidation_reason = ?
        WHERE id = ? AND state = 'active' AND process_instance_id = ?
      `).run(state, occurredAt, state === 'cancelled' ? 'AI change session cancelled before trusted completion' : null, sessionId, this.#processInstanceId);
      if (Number(result.changes) !== 1) throw new Error('AI change session completion lost its active-session precondition.');
    });

    const session = this.getSession(sessionId);
    if (!session) throw new Error('AI change session disappeared after completion.');
    const snapshot = this.#snapshotFromCapture(captured, this.#latestEvents(workspaceId));
    if (state === 'completed') {
      const changed = events.filter((event) => event.dirty);
      await this.#eventBus?.publish('gd.local.change-tracking.ai-completed', {
        sessionId,
        workspaceId,
        jobId,
        changedPaths: events.length,
        ai: changed.filter((event) => event.origin === 'ai').length,
        mixed: changed.filter((event) => event.origin === 'mixed').length,
        unknown: changed.filter((event) => event.origin === 'unknown').length,
        completedAt: occurredAt,
      });
    } else {
      await this.#eventBus?.publish('gd.local.change-tracking.invalidated', {
        sessionId,
        workspaceId,
        jobId,
        reason: 'AI change session cancelled before trusted completion',
        occurredAt,
      });
    }
    return Object.freeze({ session, snapshot });
  }

  async #capture(workspaceId: WorkspaceId): Promise<CapturedWorkspace> {
    const status = await this.#git.statusSnapshot(workspaceId);
    if (!status.repository) throw new Error('Human vs AI Change Tracking requires a Git repository workspace.');
    const staged = new Set(status.staged.map(safeRelativePath));
    const unstaged = new Set(status.unstaged.map(safeRelativePath));
    const untracked = new Set(status.untracked.map(safeRelativePath));
    const conflicted = new Set(status.conflicted.map(safeRelativePath));
    const all = [...new Set([...staged, ...unstaged, ...untracked, ...conflicted])].sort();
    const paths: CapturedPath[] = [];

    for (const path of all) {
      const [workingDiff, stagedDiff] = await Promise.all([
        this.#git.diff(workspaceId, { paths: [path] }),
        this.#git.diff(workspaceId, { staged: true, paths: [path] }),
      ]);
      let fileHash = 'missing';
      try {
        const resolved = this.#workspaces.resolveExistingPath(workspaceId, path);
        fileHash = await digestFile(resolved);
      } catch {
        fileHash = 'missing';
      }
      const flags = {
        staged: staged.has(path),
        unstaged: unstaged.has(path),
        untracked: untracked.has(path),
        conflicted: conflicted.has(path),
      };
      const digest = sha256(JSON.stringify({
        path,
        ...flags,
        fileHash,
        workingDiff: sha256(workingDiff.text),
        stagedDiff: sha256(stagedDiff.text),
      }));
      paths.push(Object.freeze({ path, digest, ...flags }));
    }

    return Object.freeze({ workspaceId, paths: Object.freeze(paths), observedAt: this.#now() });
  }

  #snapshotFromCapture(captured: CapturedWorkspace, latest: Map<string, PathEventRow>): ChangeTrackingSnapshot {
    const paths = captured.paths.map((current): ChangePathAttribution => {
      const previous = latest.get(current.path) ?? null;
      const origin = previous
        && integer(previous.dirty, 'change event dirty flag') === 1
        && text(previous.state_digest, 'change event digest') === current.digest
        ? asOrigin(previous.origin)
        : 'unknown';
      return Object.freeze({ ...current, origin });
    });
    return Object.freeze({
      schema: CHANGE_TRACKING_SCHEMA,
      workspaceId: captured.workspaceId,
      paths: Object.freeze(paths),
      counts: counts(paths),
      observedAt: captured.observedAt,
    });
  }

  #latestEvents(workspaceId?: WorkspaceId): Map<string, PathEventRow> {
    const rows = this.#database.read((database) => database.prepare(`
      SELECT seq, workspace_id, path, origin, state_digest, dirty, session_id, job_id, observed_at
      FROM gd_change_path_events
      ${workspaceId ? 'WHERE workspace_id = ?' : ''}
      ORDER BY seq ASC
    `)[workspaceId ? 'all' : 'all'](...(workspaceId ? [workspaceId] : [])) as unknown as PathEventRow[]);
    const map = new Map<string, PathEventRow>();
    for (const row of rows) {
      const workspace = text(row.workspace_id, 'change event workspace id');
      const path = safeRelativePath(text(row.path, 'change event path'));
      map.set(workspaceId ? path : `${workspace}\0${path}`, row);
    }
    return map;
  }

  #appendEvents(events: readonly PendingPathEvent[]): void {
    if (events.length === 0) return;
    this.#database.transaction((database) => this.#insertEvents(database, events));
  }

  #insertEvents(database: Parameters<Parameters<LocalDatabase['transaction']>[0]>[0], events: readonly PendingPathEvent[]): void {
    if (events.length === 0) return;
    const insert = database.prepare(`
      INSERT INTO gd_change_path_events (
        workspace_id, path, origin, state_digest, dirty, session_id, job_id, observed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const event of events) {
      insert.run(
        event.workspaceId,
        safeRelativePath(event.path),
        event.origin,
        event.digest,
        event.dirty ? 1 : 0,
        event.sessionId,
        event.jobId,
        event.observedAt,
      );
    }
  }

  #activeSession(workspaceId: WorkspaceId): SessionRow | null {
    return this.#database.read((database) => database.prepare(`
      SELECT id, workspace_id, job_id, process_instance_id, state, baseline_json, baseline_digest,
             baseline_paths, started_at, completed_at, invalidation_reason
      FROM gd_change_sessions WHERE workspace_id = ? AND state = 'active'
    `).get(workspaceId) as SessionRow | undefined) ?? null;
  }

  #sessionRow(sessionId: AiChangeSessionId): SessionRow {
    const row = this.#database.read((database) => database.prepare(`
      SELECT id, workspace_id, job_id, process_instance_id, state, baseline_json, baseline_digest,
             baseline_paths, started_at, completed_at, invalidation_reason
      FROM gd_change_sessions WHERE id = ?
    `).get(sessionId) as SessionRow | undefined);
    if (!row) throw new Error(`Unknown AI change session ${sessionId}.`);
    return row;
  }

  #sessionRecord(row: SessionRow): AiChangeSessionRecord {
    return Object.freeze({
      schema: CHANGE_TRACKING_SCHEMA,
      id: text(row.id, 'change session id') as AiChangeSessionId,
      workspaceId: text(row.workspace_id, 'change session workspace id') as WorkspaceId,
      jobId: text(row.job_id, 'change session job id'),
      state: asSessionState(row.state),
      baselineDigest: text(row.baseline_digest, 'change session baseline digest'),
      baselinePaths: integer(row.baseline_paths, 'change session baseline path count'),
      startedAt: text(row.started_at, 'change session started_at'),
      completedAt: nullableText(row.completed_at, 'change session completed_at'),
      invalidationReason: nullableText(row.invalidation_reason, 'change session invalidation reason'),
    });
  }

  #assertJobActive(jobId: DurableJobId): void {
    const row = this.#database.read((database) => database.prepare('SELECT state FROM gd_jobs WHERE id = ?').get(jobId) as JobStateRow | undefined);
    if (!row) throw new Error(`Unknown durable job ${jobId}.`);
    const state = text(row.state, 'durable job state') as DurableJobState;
    if (isDurableJobTerminalState(state)) throw new Error(`Cannot track AI changes for terminal job ${jobId} (${state}).`);
  }

  async #authorizeAi(workspaceId: WorkspaceId, authorization: AiChangeAuthorization): Promise<void> {
    await this.#capabilities.assertAuthorized({
      jobId: authorization.jobId,
      requirements: [{ capability: 'WRITE', resource: changeTrackingWorkspaceResource(workspaceId) }],
    }, authorization.token);
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Human vs AI Change Tracking authority is not ready.');
  }
}

export function createChangeTracker(options: ChangeTrackerOptions): ChangeTracker {
  return new ChangeTracker(options);
}
