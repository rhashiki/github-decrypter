import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { EventBus } from '@github-decrypter/shared';
import { CAPABILITIES, type Capability, type CapabilityRequirement } from './capability-security.js';
import type { LocalDatabase } from './database.js';
import { isDurableJobTerminalState, type DurableJobId, type DurableJobState } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';

export const APPROVAL_TRANSACTION_STATES = ['pending', 'approved', 'denied', 'consumed', 'expired', 'cancelled'] as const;
export type ApprovalTransactionState = (typeof APPROVAL_TRANSACTION_STATES)[number];

declare const approvalTransactionIdBrand: unique symbol;
declare const approvalReceiptBrand: unique symbol;
export type ApprovalTransactionId = string & { readonly [approvalTransactionIdBrand]: 'approval-transaction' };
export type ApprovalReceipt = string & { readonly [approvalReceiptBrand]: 'approval-receipt' };

export interface ApprovalTransactionRequest {
  readonly jobId: DurableJobId;
  readonly action: string;
  readonly summary: string;
  readonly requirements: readonly CapabilityRequirement[];
  readonly payloadDigest: string;
  readonly ttlMs: number;
}

export interface ApprovalDecisionRequest {
  readonly transactionId: ApprovalTransactionId;
  readonly reviewerId: string;
  readonly reviewerKind: 'human';
  readonly reason?: string;
}

export interface ApprovalTransactionRecord {
  readonly id: ApprovalTransactionId;
  readonly jobId: DurableJobId;
  readonly action: string;
  readonly summary: string;
  readonly requirements: readonly CapabilityRequirement[];
  readonly payloadDigest: string;
  readonly state: ApprovalTransactionState;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly decidedAt: string | null;
  readonly reviewerId: string | null;
  readonly reviewerKind: 'human' | null;
  readonly decisionReason: string | null;
  readonly consumedAt: string | null;
}

export interface ApprovedTransaction {
  readonly transaction: ApprovalTransactionRecord;
  readonly receipt: ApprovalReceipt;
}

export interface ApprovalTransactionsStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly pending: number;
  readonly approved: number;
  readonly consumed: number;
  readonly denied: number;
  readonly expired: number;
  readonly cancelled: number;
  readonly humanReviewRequired: true;
  readonly oneShotReceipts: true;
  readonly plaintextReceiptPersistence: false;
  readonly payloadDigestBinding: true;
  readonly externalDecisionTransport: false;
}

export interface ApprovalTransactionsOptions {
  readonly database: LocalDatabase;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

interface ApprovalRow {
  readonly id: unknown;
  readonly job_id: unknown;
  readonly action: unknown;
  readonly summary: unknown;
  readonly requirements_json: unknown;
  readonly payload_digest: unknown;
  readonly state: unknown;
  readonly requested_at: unknown;
  readonly expires_at: unknown;
  readonly decided_at: unknown;
  readonly reviewer_id: unknown;
  readonly reviewer_kind: unknown;
  readonly decision_reason: unknown;
  readonly consumed_at: unknown;
}
interface StateCountRow { readonly state: unknown; readonly count: unknown; }
interface JobStateRow { readonly state: unknown; }

export const APPROVAL_RECEIPT_PREFIX = 'gd_approval_v1_';
export const APPROVAL_MIN_TTL_MS = 1_000;
export const APPROVAL_MAX_TTL_MS = 24 * 60 * 60 * 1_000;

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`SQLite returned invalid text for ${label}.`);
  return value;
}
function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
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
function normalizeDigest(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new TypeError('payloadDigest must be a SHA-256 hex digest.');
  return normalized;
}
function normalizeResource(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 2_048 || /\s|\*/.test(normalized)) {
    throw new TypeError('Approval resources must be explicit gd:// resources without whitespace or wildcards.');
  }
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'gd:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError('Approval resources must be canonical gd:// resources.');
  }
  return normalized;
}
function normalizeCapability(value: Capability): Capability {
  if (!(CAPABILITIES as readonly string[]).includes(value)) throw new TypeError(`Unsupported approval capability: ${String(value)}.`);
  return value;
}
function normalizeRequirements(requirements: readonly CapabilityRequirement[]): readonly CapabilityRequirement[] {
  if (requirements.length === 0) throw new TypeError('Approval Transactions require at least one capability requirement.');
  const unique = new Map<string, CapabilityRequirement>();
  for (const requirement of requirements) {
    const normalized = Object.freeze({
      capability: normalizeCapability(requirement.capability),
      resource: normalizeResource(requirement.resource),
    });
    unique.set(`${normalized.capability}\u0000${normalized.resource}`, normalized);
  }
  return Object.freeze([...unique.values()].sort((a, b) =>
    `${a.capability}\u0000${a.resource}`.localeCompare(`${b.capability}\u0000${b.resource}`),
  ));
}
function normalizeTtl(ttlMs: number): number {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < APPROVAL_MIN_TTL_MS || ttlMs > APPROVAL_MAX_TTL_MS) {
    throw new RangeError(`Approval ttlMs must be between ${APPROVAL_MIN_TTL_MS} and ${APPROVAL_MAX_TTL_MS}.`);
  }
  return ttlMs;
}
function createReceipt(): ApprovalReceipt {
  return `${APPROVAL_RECEIPT_PREFIX}${randomBytes(32).toString('base64url')}` as ApprovalReceipt;
}
function validReceipt(value: unknown): value is ApprovalReceipt {
  return typeof value === 'string' && value.startsWith(APPROVAL_RECEIPT_PREFIX)
    && /^[A-Za-z0-9_-]{43}$/.test(value.slice(APPROVAL_RECEIPT_PREFIX.length));
}
function receiptHash(receipt: string): string {
  return createHash('sha256').update(receipt, 'utf8').digest('hex');
}
function asState(value: unknown): ApprovalTransactionState {
  if (typeof value === 'string' && (APPROVAL_TRANSACTION_STATES as readonly string[]).includes(value)) return value as ApprovalTransactionState;
  throw new Error(`SQLite returned invalid approval state ${String(value)}.`);
}

export class ApprovalTransactions {
  readonly #database: LocalDatabase;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  #ready = false;

  constructor(options: ApprovalTransactionsOptions) {
    this.#database = options.database;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  status(): ApprovalTransactionsStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    const counts = new Map<ApprovalTransactionState, number>();
    if (this.#database.isOpen && schemaVersion >= 7) {
      const rows = this.#database.read((database) => database.prepare(
        'SELECT state, COUNT(*) AS count FROM gd_approval_transactions GROUP BY state',
      ).all() as unknown as StateCountRow[]);
      for (const row of rows) counts.set(asState(row.state), integer(row.count, 'approval count'));
    }
    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      pending: counts.get('pending') ?? 0,
      approved: counts.get('approved') ?? 0,
      consumed: counts.get('consumed') ?? 0,
      denied: counts.get('denied') ?? 0,
      expired: counts.get('expired') ?? 0,
      cancelled: counts.get('cancelled') ?? 0,
      humanReviewRequired: true,
      oneShotReceipts: true,
      plaintextReceiptPersistence: false,
      payloadDigestBinding: true,
      externalDecisionTransport: false,
    });
  }

  async initialize(): Promise<ApprovalTransactionsStatus> {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 7) throw new Error('Approval Transactions require Local Database schema 7 or newer.');
    await this.expireDue();
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.approval.ready', {
      pending: status.pending,
      approved: status.approved,
      humanReviewRequired: true,
      oneShotReceipts: true,
      plaintextReceiptPersistence: false,
      payloadDigestBinding: true,
      externalDecisionTransport: false,
    });
    return status;
  }

  async request(input: ApprovalTransactionRequest): Promise<ApprovalTransactionRecord> {
    this.#assertReady();
    this.#assertJobActive(input.jobId);
    const action = normalizeText(input.action, 'action', 200);
    const summary = normalizeText(input.summary, 'summary', 2_000);
    const requirements = normalizeRequirements(input.requirements);
    const payloadDigest = normalizeDigest(input.payloadDigest);
    const ttlMs = normalizeTtl(input.ttlMs);
    const requestedAt = this.#now();
    const requestedMs = Date.parse(requestedAt);
    if (!Number.isFinite(requestedMs)) throw new Error('Approval clock returned an invalid timestamp.');
    const expiresAt = new Date(requestedMs + ttlMs).toISOString();
    const id = `gd_approval_${randomUUID()}` as ApprovalTransactionId;

    this.#database.transaction((database) => {
      database.prepare(`
        INSERT INTO gd_approval_transactions (
          id, job_id, action, summary, requirements_json, payload_digest, state,
          requested_at, expires_at, decided_at, reviewer_id, reviewer_kind,
          decision_reason, receipt_hash, consumed_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)
      `).run(id, input.jobId, action, summary, JSON.stringify(requirements), payloadDigest, requestedAt, expiresAt);
    });

    const record = this.#requireRecord(id);
    await this.#eventBus?.publish('gd.local.approval.requested', {
      transactionId: id,
      jobId: input.jobId,
      action,
      expiresAt,
      requirementCount: requirements.length,
    });
    return record;
  }

  async approve(input: ApprovalDecisionRequest): Promise<ApprovedTransaction> {
    this.#assertReady();
    if (input.reviewerKind !== 'human') throw new TypeError('Approval decisions require reviewerKind="human".');
    const reviewerId = normalizeText(input.reviewerId, 'reviewerId', 200);
    const reason = input.reason ? normalizeText(input.reason, 'reason', 2_000) : null;
    const current = await this.#requirePendingFresh(input.transactionId);
    this.#assertJobActive(current.jobId);
    const now = this.#now();
    const receipt = createReceipt();
    const hash = receiptHash(receipt);
    const changed = this.#database.transaction((database) => Number(database.prepare(`
      UPDATE gd_approval_transactions
      SET state = 'approved', decided_at = ?, reviewer_id = ?, reviewer_kind = 'human',
          decision_reason = ?, receipt_hash = ?
      WHERE id = ? AND state = 'pending'
    `).run(now, reviewerId, reason, hash, current.id).changes) === 1);
    if (!changed) throw new Error('Approval transaction changed concurrently.');
    const transaction = this.#requireRecord(current.id);
    await this.#eventBus?.publish('gd.local.approval.decided', {
      transactionId: current.id,
      jobId: current.jobId,
      decision: 'approved',
      reviewerKind: 'human',
      occurredAt: now,
    });
    return Object.freeze({ transaction, receipt });
  }

  async deny(input: ApprovalDecisionRequest): Promise<ApprovalTransactionRecord> {
    this.#assertReady();
    if (input.reviewerKind !== 'human') throw new TypeError('Approval decisions require reviewerKind="human".');
    const reviewerId = normalizeText(input.reviewerId, 'reviewerId', 200);
    const reason = normalizeText(input.reason ?? 'denied', 'reason', 2_000);
    const current = await this.#requirePendingFresh(input.transactionId);
    const now = this.#now();
    const changed = this.#database.transaction((database) => Number(database.prepare(`
      UPDATE gd_approval_transactions
      SET state = 'denied', decided_at = ?, reviewer_id = ?, reviewer_kind = 'human',
          decision_reason = ?, receipt_hash = NULL
      WHERE id = ? AND state = 'pending'
    `).run(now, reviewerId, reason, current.id).changes) === 1);
    if (!changed) throw new Error('Approval transaction changed concurrently.');
    const transaction = this.#requireRecord(current.id);
    await this.#eventBus?.publish('gd.local.approval.decided', {
      transactionId: current.id,
      jobId: current.jobId,
      decision: 'denied',
      reviewerKind: 'human',
      occurredAt: now,
    });
    return transaction;
  }

  async cancel(transactionId: ApprovalTransactionId, reason = 'cancelled'): Promise<boolean> {
    this.#assertReady();
    const current = this.get(transactionId);
    if (!current || (current.state !== 'pending' && current.state !== 'approved')) return false;
    const now = this.#now();
    const normalizedReason = normalizeText(reason, 'reason', 2_000);
    const changed = this.#database.transaction((database) => Number(database.prepare(`
      UPDATE gd_approval_transactions
      SET state = 'cancelled', decided_at = COALESCE(decided_at, ?),
          decision_reason = COALESCE(decision_reason, ?), receipt_hash = NULL
      WHERE id = ? AND state IN ('pending', 'approved')
    `).run(now, normalizedReason, transactionId).changes) === 1);
    if (changed) await this.#eventBus?.publish('gd.local.approval.cancelled', { transactionId, jobId: current.jobId, occurredAt: now });
    return changed;
  }

  async consume(transactionId: ApprovalTransactionId, receipt: string, expectedPayloadDigest: string): Promise<ApprovalTransactionRecord> {
    this.#assertReady();
    if (!validReceipt(receipt)) throw new Error('Approval receipt is missing or invalid.');
    const payloadDigest = normalizeDigest(expectedPayloadDigest);
    const current = this.#requireRecord(transactionId);
    if (current.state !== 'approved') throw new Error(`Approval transaction is ${current.state}, not approved.`);
    if (current.payloadDigest !== payloadDigest) throw new Error('Approval payload digest mismatch.');
    this.#assertJobActive(current.jobId);
    const now = this.#now();
    if (Date.parse(current.expiresAt) <= Date.parse(now)) {
      await this.#expireOne(transactionId, now);
      throw new Error('Approval transaction expired before consumption.');
    }
    const hash = receiptHash(receipt);
    const changed = this.#database.transaction((database) => Number(database.prepare(`
      UPDATE gd_approval_transactions
      SET state = 'consumed', consumed_at = ?, receipt_hash = NULL
      WHERE id = ? AND state = 'approved' AND receipt_hash = ?
    `).run(now, transactionId, hash).changes) === 1);
    if (!changed) throw new Error('Approval receipt is invalid, already consumed or changed concurrently.');
    const transaction = this.#requireRecord(transactionId);
    await this.#eventBus?.publish('gd.local.approval.consumed', { transactionId, jobId: current.jobId, occurredAt: now });
    return transaction;
  }

  get(transactionId: ApprovalTransactionId): ApprovalTransactionRecord | null {
    if (!this.#database.isOpen) return null;
    const row = this.#database.read((database) => database.prepare(`
      SELECT id, job_id, action, summary, requirements_json, payload_digest, state,
             requested_at, expires_at, decided_at, reviewer_id, reviewer_kind,
             decision_reason, consumed_at
      FROM gd_approval_transactions WHERE id = ?
    `).get(transactionId) as ApprovalRow | undefined);
    return row ? this.#record(row) : null;
  }

  async expireDue(): Promise<number> {
    if (!this.#database.isOpen || (this.#database.status?.schemaVersion ?? 0) < 7) return 0;
    const now = this.#now();
    return this.#database.transaction((database) => Number(database.prepare(`
      UPDATE gd_approval_transactions
      SET state = 'expired', decided_at = COALESCE(decided_at, ?),
          decision_reason = COALESCE(decision_reason, 'expired'), receipt_hash = NULL
      WHERE state IN ('pending', 'approved') AND expires_at <= ?
    `).run(now, now).changes));
  }

  shutdown(): void { this.#ready = false; }

  async #requirePendingFresh(id: ApprovalTransactionId): Promise<ApprovalTransactionRecord> {
    const current = this.#requireRecord(id);
    if (current.state !== 'pending') throw new Error(`Approval transaction is ${current.state}, not pending.`);
    const now = this.#now();
    if (Date.parse(current.expiresAt) <= Date.parse(now)) {
      await this.#expireOne(id, now);
      throw new Error('Approval transaction expired before decision.');
    }
    return current;
  }

  async #expireOne(id: ApprovalTransactionId, now: string): Promise<void> {
    this.#database.transaction((database) => {
      database.prepare(`
        UPDATE gd_approval_transactions
        SET state = 'expired', decided_at = COALESCE(decided_at, ?),
            decision_reason = COALESCE(decision_reason, 'expired'), receipt_hash = NULL
        WHERE id = ? AND state IN ('pending', 'approved')
      `).run(now, id);
    });
  }

  #assertJobActive(jobId: DurableJobId): void {
    const row = this.#database.read((database) => database.prepare('SELECT state FROM gd_jobs WHERE id = ?').get(jobId) as JobStateRow | undefined);
    if (!row) throw new Error(`Unknown durable job ${jobId}.`);
    const state = text(row.state, 'durable job state') as DurableJobState;
    if (isDurableJobTerminalState(state)) throw new Error(`Approval transaction cannot be used by terminal job ${jobId} (${state}).`);
  }

  #record(row: ApprovalRow): ApprovalTransactionRecord {
    const parsed = JSON.parse(text(row.requirements_json, 'approval requirements')) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Approval requirements are not an array.');
    const requirements = normalizeRequirements(parsed.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error('Approval requirement is invalid.');
      const record = item as Record<string, unknown>;
      return { capability: record.capability as Capability, resource: String(record.resource ?? '') };
    }));
    const reviewerKindRaw = nullableText(row.reviewer_kind, 'approval reviewer kind');
    if (reviewerKindRaw !== null && reviewerKindRaw !== 'human') throw new Error('Approval reviewer kind is invalid.');
    return Object.freeze({
      id: text(row.id, 'approval id') as ApprovalTransactionId,
      jobId: text(row.job_id, 'approval job id') as DurableJobId,
      action: text(row.action, 'approval action'),
      summary: text(row.summary, 'approval summary'),
      requirements,
      payloadDigest: normalizeDigest(text(row.payload_digest, 'approval payload digest')),
      state: asState(row.state),
      requestedAt: text(row.requested_at, 'approval requested_at'),
      expiresAt: text(row.expires_at, 'approval expires_at'),
      decidedAt: nullableText(row.decided_at, 'approval decided_at'),
      reviewerId: nullableText(row.reviewer_id, 'approval reviewer id'),
      reviewerKind: reviewerKindRaw as 'human' | null,
      decisionReason: nullableText(row.decision_reason, 'approval decision reason'),
      consumedAt: nullableText(row.consumed_at, 'approval consumed_at'),
    });
  }

  #requireRecord(id: ApprovalTransactionId): ApprovalTransactionRecord {
    const record = this.get(id);
    if (!record) throw new Error(`Unknown approval transaction ${id}.`);
    return record;
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Approval Transactions authority is not ready.');
  }
}

export function createApprovalTransactions(options: ApprovalTransactionsOptions): ApprovalTransactions {
  return new ApprovalTransactions(options);
}
