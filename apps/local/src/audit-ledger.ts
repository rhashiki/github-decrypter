import { createHash, randomUUID } from 'node:crypto';
import type { EventBus, Unsubscribe } from '@github-decrypter/shared';
import type { LocalDatabase } from './database.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';

export const AUDIT_ENTRY_SCHEMA = 'gd-audit-entry/1' as const;
export const AUDIT_GENESIS_HASH = '0'.repeat(64);
export const AUDIT_CATEGORIES = ['capability', 'vault', 'approval', 'runtime'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export const AUDIT_OUTCOMES = ['requested', 'approved', 'denied', 'consumed', 'cancelled', 'success', 'failed'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

declare const auditEntryIdBrand: unique symbol;
export type AuditEntryId = string & { readonly [auditEntryIdBrand]: 'audit-entry' };

export interface AuditEntryInput {
  readonly category: AuditCategory;
  readonly action: string;
  readonly actor: string;
  readonly subject: string;
  readonly jobId?: DurableJobId | null;
  readonly outcome: AuditOutcome;
  readonly metadata?: unknown;
}

export interface AuditEntryRecord {
  readonly sequence: number;
  readonly id: AuditEntryId;
  readonly occurredAt: string;
  readonly category: AuditCategory;
  readonly action: string;
  readonly actor: string;
  readonly subject: string;
  readonly jobId: DurableJobId | null;
  readonly outcome: AuditOutcome;
  readonly metadata: unknown;
  readonly previousHash: string;
  readonly entryHash: string;
}

export interface AuditLedgerStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly entryCount: number;
  readonly headHash: string;
  readonly integrity: 'ok' | 'unchecked';
  readonly appendOnly: true;
  readonly hashChain: 'sha256';
  readonly sensitivePayloadPersistence: false;
  readonly externalTransport: false;
}

export interface AuditLedgerOptions {
  readonly database: LocalDatabase;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

interface AuditRow {
  readonly seq: unknown;
  readonly id: unknown;
  readonly occurred_at: unknown;
  readonly category: unknown;
  readonly action: unknown;
  readonly actor: unknown;
  readonly subject: unknown;
  readonly job_id: unknown;
  readonly outcome: unknown;
  readonly metadata_json: unknown;
  readonly previous_hash: unknown;
  readonly entry_hash: unknown;
}

interface AuditSummaryRow { readonly count: unknown; readonly head_hash: unknown; }

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
function normalizeText(value: string, label: string, max: number): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} must be non-empty.`);
  if (normalized.length > max) throw new TypeError(`${label} may not exceed ${max} characters.`);
  return normalized;
}
function isAuditCategory(value: unknown): value is AuditCategory {
  return typeof value === 'string' && (AUDIT_CATEGORIES as readonly string[]).includes(value);
}
function isAuditOutcome(value: unknown): value is AuditOutcome {
  return typeof value === 'string' && (AUDIT_OUTCOMES as readonly string[]).includes(value);
}

function normalizeJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Audit metadata numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Audit metadata must be JSON-safe plain data.');
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) normalized[key] = normalizeJson(record[key]);
    return normalized;
  }
  throw new TypeError('Audit metadata must be JSON-safe.');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

function computeEntryHash(input: {
  readonly id: string;
  readonly occurredAt: string;
  readonly category: AuditCategory;
  readonly action: string;
  readonly actor: string;
  readonly subject: string;
  readonly jobId: string | null;
  readonly outcome: AuditOutcome;
  readonly metadataJson: string;
  readonly previousHash: string;
}): string {
  return createHash('sha256').update(canonicalJson({
    schema: AUDIT_ENTRY_SCHEMA,
    id: input.id,
    occurredAt: input.occurredAt,
    category: input.category,
    action: input.action,
    actor: input.actor,
    subject: input.subject,
    jobId: input.jobId,
    outcome: input.outcome,
    metadata: JSON.parse(input.metadataJson) as unknown,
    previousHash: input.previousHash,
  }), 'utf8').digest('hex');
}

export class AuditLedger {
  readonly #database: LocalDatabase;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  #ready = false;
  #integrity: 'ok' | 'unchecked' = 'unchecked';
  #subscriptions: Unsubscribe[] = [];

  constructor(options: AuditLedgerOptions) {
    this.#database = options.database;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  status(): AuditLedgerStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    let entryCount = 0;
    let headHash = AUDIT_GENESIS_HASH;
    if (this.#database.isOpen && schemaVersion >= 8) {
      const summary = this.#database.read((database) => database.prepare(`
        SELECT COUNT(*) AS count,
               COALESCE((SELECT entry_hash FROM gd_audit_entries ORDER BY seq DESC LIMIT 1), ?) AS head_hash
        FROM gd_audit_entries
      `).get(AUDIT_GENESIS_HASH) as AuditSummaryRow);
      entryCount = integer(summary.count, 'audit entry count');
      headHash = text(summary.head_hash, 'audit head hash');
    }
    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      entryCount,
      headHash,
      integrity: this.#integrity,
      appendOnly: true,
      hashChain: 'sha256',
      sensitivePayloadPersistence: false,
      externalTransport: false,
    });
  }

  async initialize(): Promise<AuditLedgerStatus> {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 8) throw new Error('Audit Ledger requires Local Database schema 8 or newer.');
    this.verifyIntegrity();
    this.#subscribeSecurityEvents();
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.audit.ready', {
      entryCount: status.entryCount,
      headHash: status.headHash,
      appendOnly: true,
      hashChain: 'sha256',
      externalTransport: false,
    });
    return status;
  }

  shutdown(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) unsubscribe();
    this.#ready = false;
  }

  append(input: AuditEntryInput): AuditEntryRecord {
    this.#assertReady();
    const category = input.category;
    if (!isAuditCategory(category)) throw new TypeError(`Unsupported audit category: ${String(category)}.`);
    const outcome = input.outcome;
    if (!isAuditOutcome(outcome)) throw new TypeError(`Unsupported audit outcome: ${String(outcome)}.`);
    const action = normalizeText(input.action, 'action', 200);
    const actor = normalizeText(input.actor, 'actor', 200);
    const subject = normalizeText(input.subject, 'subject', 500);
    const jobId = input.jobId ?? null;
    const metadataJson = canonicalJson(input.metadata ?? {});
    if (metadataJson.length > 16_384) throw new RangeError('Audit metadata may not exceed 16384 serialized characters.');
    const occurredAt = this.#now();
    if (!Number.isFinite(Date.parse(occurredAt))) throw new Error('Audit clock returned an invalid timestamp.');
    const id = `gd_audit_${randomUUID()}` as AuditEntryId;

    const sequence = this.#database.transaction((database) => {
      const previousRow = database.prepare('SELECT entry_hash FROM gd_audit_entries ORDER BY seq DESC LIMIT 1').get() as { entry_hash?: unknown } | undefined;
      const previousHash = previousRow ? text(previousRow.entry_hash, 'previous audit hash') : AUDIT_GENESIS_HASH;
      const entryHash = computeEntryHash({ id, occurredAt, category, action, actor, subject, jobId, outcome, metadataJson, previousHash });
      const result = database.prepare(`
        INSERT INTO gd_audit_entries (
          id, occurred_at, category, action, actor, subject, job_id, outcome,
          metadata_json, previous_hash, entry_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, occurredAt, category, action, actor, subject, jobId, outcome, metadataJson, previousHash, entryHash);
      return Number(result.lastInsertRowid);
    });

    const record = this.getBySequence(sequence);
    if (!record) throw new Error('Audit entry disappeared after append.');
    void this.#eventBus?.publish('gd.local.audit.appended', {
      entryId: record.id,
      sequence: record.sequence,
      category: record.category,
      action: record.action,
      outcome: record.outcome,
      occurredAt: record.occurredAt,
    });
    return record;
  }

  getBySequence(sequence: number): AuditEntryRecord | null {
    if (!Number.isSafeInteger(sequence) || sequence < 1) return null;
    if (!this.#database.isOpen) return null;
    const row = this.#database.read((database) => database.prepare(`
      SELECT seq, id, occurred_at, category, action, actor, subject, job_id, outcome,
             metadata_json, previous_hash, entry_hash
      FROM gd_audit_entries WHERE seq = ?
    `).get(sequence) as AuditRow | undefined);
    return row ? this.#record(row) : null;
  }

  verifyIntegrity(): { readonly entryCount: number; readonly headHash: string } {
    if (!this.#database.isOpen || (this.#database.status?.schemaVersion ?? 0) < 8) throw new Error('Audit Ledger integrity cannot be verified before schema 8 is open.');
    const rows = this.#database.read((database) => database.prepare(`
      SELECT seq, id, occurred_at, category, action, actor, subject, job_id, outcome,
             metadata_json, previous_hash, entry_hash
      FROM gd_audit_entries ORDER BY seq ASC
    `).all() as unknown as AuditRow[]);
    let previousHash = AUDIT_GENESIS_HASH;
    let expectedSequence = 1;
    for (const row of rows) {
      const record = this.#record(row);
      if (record.sequence !== expectedSequence) throw new Error(`Audit Ledger sequence gap at ${expectedSequence}.`);
      if (record.previousHash !== previousHash) throw new Error(`Audit Ledger previous-hash mismatch at sequence ${record.sequence}.`);
      const metadataJson = canonicalJson(record.metadata);
      const expectedHash = computeEntryHash({
        id: record.id,
        occurredAt: record.occurredAt,
        category: record.category,
        action: record.action,
        actor: record.actor,
        subject: record.subject,
        jobId: record.jobId,
        outcome: record.outcome,
        metadataJson,
        previousHash,
      });
      if (record.entryHash !== expectedHash) throw new Error(`Audit Ledger entry-hash mismatch at sequence ${record.sequence}.`);
      previousHash = record.entryHash;
      expectedSequence += 1;
    }
    this.#integrity = 'ok';
    return Object.freeze({ entryCount: rows.length, headHash: previousHash });
  }

  #record(row: AuditRow): AuditEntryRecord {
    const category = text(row.category, 'audit category');
    const outcome = text(row.outcome, 'audit outcome');
    if (!isAuditCategory(category)) throw new Error(`SQLite returned invalid audit category ${category}.`);
    if (!isAuditOutcome(outcome)) throw new Error(`SQLite returned invalid audit outcome ${outcome}.`);
    const metadataText = text(row.metadata_json, 'audit metadata');
    return Object.freeze({
      sequence: integer(row.seq, 'audit sequence'),
      id: text(row.id, 'audit entry id') as AuditEntryId,
      occurredAt: text(row.occurred_at, 'audit occurred_at'),
      category,
      action: text(row.action, 'audit action'),
      actor: text(row.actor, 'audit actor'),
      subject: text(row.subject, 'audit subject'),
      jobId: nullableText(row.job_id, 'audit job id') as DurableJobId | null,
      outcome,
      metadata: JSON.parse(metadataText) as unknown,
      previousHash: text(row.previous_hash, 'audit previous hash'),
      entryHash: text(row.entry_hash, 'audit entry hash'),
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Audit Ledger is not ready.');
  }

  #subscribeSecurityEvents(): void {
    if (!this.#eventBus || this.#subscriptions.length > 0) return;
    const subscribe = <K extends keyof LocalRuntimeEventCatalog>(name: K, handler: (payload: LocalRuntimeEventCatalog[K]) => void) => {
      this.#subscriptions.push(this.#eventBus!.subscribe(name, (event) => handler(event.payload)));
    };

    subscribe('gd.local.capability.granted', (payload) => {
      this.append({ category: 'capability', action: 'capability.granted', actor: 'local-runtime', subject: payload.grantId, jobId: payload.jobId, outcome: 'success', metadata: { capabilities: payload.capabilities, claimCount: payload.claimCount, expiresAt: payload.expiresAt } });
    });
    subscribe('gd.local.capability.revoked', (payload) => {
      this.append({ category: 'capability', action: 'capability.revoked', actor: 'local-runtime', subject: payload.grantId, jobId: payload.jobId, outcome: 'success', metadata: { reason: payload.reason, revokedAt: payload.revokedAt } });
    });
    subscribe('gd.local.capability.denied', (payload) => {
      this.append({ category: 'capability', action: 'capability.denied', actor: 'local-runtime', subject: payload.grantId ?? payload.jobId, jobId: payload.jobId, outcome: 'denied', metadata: { reason: payload.reason, missingCapabilities: payload.missingCapabilities, missingCount: payload.missingCount } });
    });
    subscribe('gd.local.vault.secret.changed', (payload) => {
      this.append({ category: 'vault', action: `vault.secret.${payload.operation}`, actor: 'local-runtime', subject: payload.secretId, outcome: 'success', metadata: { occurredAt: payload.occurredAt } });
    });
    subscribe('gd.local.approval.requested', (payload) => {
      this.append({ category: 'approval', action: 'approval.requested', actor: 'local-runtime', subject: payload.transactionId, jobId: payload.jobId, outcome: 'requested', metadata: { action: payload.action, expiresAt: payload.expiresAt } });
    });
    subscribe('gd.local.approval.decided', (payload) => {
      this.append({ category: 'approval', action: 'approval.decided', actor: payload.actor, subject: payload.transactionId, jobId: payload.jobId, outcome: payload.decision, metadata: { occurredAt: payload.occurredAt } });
    });
    subscribe('gd.local.approval.consumed', (payload) => {
      this.append({ category: 'approval', action: 'approval.consumed', actor: 'local-runtime', subject: payload.transactionId, jobId: payload.jobId, outcome: 'consumed', metadata: { occurredAt: payload.occurredAt } });
    });
    subscribe('gd.local.approval.cancelled', (payload) => {
      this.append({ category: 'approval', action: 'approval.cancelled', actor: 'local-runtime', subject: payload.transactionId, jobId: payload.jobId, outcome: 'cancelled', metadata: { occurredAt: payload.occurredAt } });
    });
  }
}

export function createAuditLedger(options: AuditLedgerOptions): AuditLedger {
  return new AuditLedger(options);
}
