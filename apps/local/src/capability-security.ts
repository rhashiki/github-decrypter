import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { EventBus } from '@github-decrypter/shared';
import type { LocalDatabase } from './database.js';
import { isDurableJobTerminalState, type DurableJobId, type DurableJobState } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';

export const CAPABILITIES = [
  'READ',
  'WRITE',
  'EXECUTE',
  'NETWORK',
  'DATABASE_WRITE',
  'GIT_WRITE',
  'DESTRUCTIVE',
  'SECRETS',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_SCOPE_MATCH_MODES = ['exact', 'prefix'] as const;
export type CapabilityScopeMatchMode = (typeof CAPABILITY_SCOPE_MATCH_MODES)[number];

declare const capabilityGrantIdBrand: unique symbol;
declare const capabilityTokenBrand: unique symbol;

export type CapabilityGrantId = string & { readonly [capabilityGrantIdBrand]: 'capability-grant' };
export type CapabilityToken = string & { readonly [capabilityTokenBrand]: 'capability-token' };

export interface CapabilityClaim {
  readonly capability: Capability;
  readonly resource: string;
  readonly match: CapabilityScopeMatchMode;
}

export interface CapabilityRequirement {
  readonly capability: Capability;
  readonly resource: string;
}

export interface CapabilityGrantRequest {
  readonly jobId: DurableJobId;
  readonly claims: readonly CapabilityClaim[];
  readonly ttlMs: number;
  readonly label?: string;
}

export interface CapabilityGrantRecord {
  readonly id: CapabilityGrantId;
  readonly jobId: DurableJobId;
  readonly claims: readonly CapabilityClaim[];
  readonly label: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
}

export interface CapabilityGrantIssued {
  readonly grant: CapabilityGrantRecord;
  readonly token: CapabilityToken;
}

export interface CapabilityAuthorizationRequest {
  readonly jobId: DurableJobId;
  readonly requirements: readonly CapabilityRequirement[];
}

export interface CapabilityAuthorizationDecision {
  readonly allowed: boolean;
  readonly grantId: CapabilityGrantId | null;
  readonly reason: string;
  readonly missing: readonly CapabilityRequirement[];
}

export interface CapabilitySecurityStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly activeGrants: number;
  readonly revokedGrants: number;
  readonly expiredGrants: number;
  readonly restartRevocations: number;
  readonly denyByDefault: true;
  readonly plaintextTokenPersistence: false;
  readonly secretsVaultReady: false;
  readonly approvalTransactionsReady: false;
  readonly externalGrantTransport: false;
}

export interface CapabilitySecurityOptions {
  readonly database: LocalDatabase;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
  readonly processInstanceId?: string;
}

interface GrantRow {
  readonly id: unknown;
  readonly job_id: unknown;
  readonly process_instance_id: unknown;
  readonly label: unknown;
  readonly issued_at: unknown;
  readonly expires_at: unknown;
  readonly revoked_at: unknown;
  readonly revocation_reason: unknown;
}

interface ClaimRow {
  readonly capability: unknown;
  readonly resource: unknown;
  readonly match_mode: unknown;
}

interface JobStateRow {
  readonly state: unknown;
}

interface CountRow {
  readonly count: unknown;
}

export const CAPABILITY_TOKEN_PREFIX = 'gd_cap_v1_';
export const CAPABILITY_GRANT_MIN_TTL_MS = 1_000;
export const CAPABILITY_GRANT_MAX_TTL_MS = 24 * 60 * 60 * 1_000;
export const CAPABILITY_RESTART_REVOCATION_REASON = 'runtime process restarted before Secrets Vault continuity';

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

function asCapability(value: unknown): Capability {
  if (typeof value === 'string' && (CAPABILITIES as readonly string[]).includes(value)) {
    return value as Capability;
  }
  throw new TypeError(`Unsupported capability: ${String(value)}.`);
}

function asMatchMode(value: unknown): CapabilityScopeMatchMode {
  if (typeof value === 'string' && (CAPABILITY_SCOPE_MATCH_MODES as readonly string[]).includes(value)) {
    return value as CapabilityScopeMatchMode;
  }
  throw new TypeError(`Unsupported capability scope match mode: ${String(value)}.`);
}

function normalizeResource(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Capability resources must be non-empty strings.');
  if (normalized.length > 2_048) throw new TypeError('Capability resources may not exceed 2048 characters.');
  if (/\s/.test(normalized)) throw new TypeError('Capability resources may not contain whitespace.');
  if (normalized.includes('*')) throw new TypeError('Capability resources may not contain wildcard characters.');
  if (!normalized.startsWith('gd://')) throw new TypeError('Capability resources must use the gd:// resource namespace.');
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'gd:' || !parsed.hostname) {
    throw new TypeError('Capability resources must contain a gd:// authority segment.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError('Capability resources may not contain credentials, query strings or fragments.');
  }
  return normalized;
}

function normalizeLabel(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 200) throw new TypeError('Capability grant labels may not exceed 200 characters.');
  return normalized;
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Capability revocation reasons must be non-empty strings.');
  if (normalized.length > 2_000) throw new TypeError('Capability revocation reasons may not exceed 2000 characters.');
  return normalized;
}

function normalizeTtl(value: number): number {
  if (!Number.isSafeInteger(value)) throw new TypeError('Capability grant ttlMs must be a safe integer.');
  if (value < CAPABILITY_GRANT_MIN_TTL_MS || value > CAPABILITY_GRANT_MAX_TTL_MS) {
    throw new RangeError(
      `Capability grant ttlMs must be between ${CAPABILITY_GRANT_MIN_TTL_MS} and ${CAPABILITY_GRANT_MAX_TTL_MS}.`,
    );
  }
  return value;
}

function normalizeClaim(claim: CapabilityClaim): CapabilityClaim {
  return Object.freeze({
    capability: asCapability(claim.capability),
    resource: normalizeResource(claim.resource),
    match: asMatchMode(claim.match),
  });
}

function normalizeRequirement(requirement: CapabilityRequirement): CapabilityRequirement {
  return Object.freeze({
    capability: asCapability(requirement.capability),
    resource: normalizeResource(requirement.resource),
  });
}

function deduplicateClaims(claims: readonly CapabilityClaim[]): readonly CapabilityClaim[] {
  if (claims.length === 0) throw new TypeError('Capability grants require at least one claim.');
  const normalized = claims.map(normalizeClaim);
  const byKey = new Map<string, CapabilityClaim>();
  for (const claim of normalized) {
    byKey.set(`${claim.capability}\u0000${claim.match}\u0000${claim.resource}`, claim);
  }
  return Object.freeze([...byKey.values()]);
}

function deduplicateRequirements(requirements: readonly CapabilityRequirement[]): readonly CapabilityRequirement[] {
  if (requirements.length === 0) throw new TypeError('Authorization requests require at least one capability requirement.');
  const normalized = requirements.map(normalizeRequirement);
  const byKey = new Map<string, CapabilityRequirement>();
  for (const requirement of normalized) {
    byKey.set(`${requirement.capability}\u0000${requirement.resource}`, requirement);
  }
  return Object.freeze([...byKey.values()]);
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function createCapabilityToken(): CapabilityToken {
  return `${CAPABILITY_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}` as CapabilityToken;
}

function validCapabilityToken(value: unknown): value is CapabilityToken {
  return typeof value === 'string'
    && value.startsWith(CAPABILITY_TOKEN_PREFIX)
    && /^[A-Za-z0-9_-]{43}$/.test(value.slice(CAPABILITY_TOKEN_PREFIX.length));
}

function claimMatches(claim: CapabilityClaim, requirement: CapabilityRequirement): boolean {
  if (claim.capability !== requirement.capability) return false;
  if (claim.match === 'exact') return claim.resource === requirement.resource;
  return requirement.resource === claim.resource || requirement.resource.startsWith(
    claim.resource.endsWith('/') ? claim.resource : `${claim.resource}/`,
  );
}

export class CapabilitySecurityAuthority {
  readonly #database: LocalDatabase;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #processInstanceId: string;
  #ready = false;

  constructor(options: CapabilitySecurityOptions) {
    this.#database = options.database;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#processInstanceId = options.processInstanceId ?? `gd_process_${randomUUID()}`;
  }

  get processInstanceId(): string {
    return this.#processInstanceId;
  }

  status(): CapabilitySecurityStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 5) {
      return Object.freeze({
        ready: false,
        schemaVersion,
        activeGrants: 0,
        revokedGrants: 0,
        expiredGrants: 0,
        restartRevocations: 0,
        denyByDefault: true,
        plaintextTokenPersistence: false,
        secretsVaultReady: false,
        approvalTransactionsReady: false,
        externalGrantTransport: false,
      });
    }

    const now = this.#now();
    return this.#database.read((database) => {
      const active = database.prepare(`
        SELECT COUNT(*) AS count FROM gd_capability_grants
        WHERE revoked_at IS NULL AND expires_at > ?
      `).get(now) as CountRow | undefined;
      const revoked = database.prepare(`
        SELECT COUNT(*) AS count FROM gd_capability_grants
        WHERE revoked_at IS NOT NULL
      `).get() as CountRow | undefined;
      const expired = database.prepare(`
        SELECT COUNT(*) AS count FROM gd_capability_grants
        WHERE revoked_at IS NULL AND expires_at <= ?
      `).get(now) as CountRow | undefined;
      const restartRevoked = database.prepare(`
        SELECT COUNT(*) AS count FROM gd_capability_grants
        WHERE revocation_reason = ?
      `).get(CAPABILITY_RESTART_REVOCATION_REASON) as CountRow | undefined;

      return Object.freeze({
        ready: this.#ready,
        schemaVersion,
        activeGrants: integer(active?.count ?? 0, 'active capability grant count'),
        revokedGrants: integer(revoked?.count ?? 0, 'revoked capability grant count'),
        expiredGrants: integer(expired?.count ?? 0, 'expired capability grant count'),
        restartRevocations: integer(restartRevoked?.count ?? 0, 'restart capability revocation count'),
        denyByDefault: true,
        plaintextTokenPersistence: false,
        secretsVaultReady: false,
        approvalTransactionsReady: false,
        externalGrantTransport: false,
      });
    });
  }

  async initialize(): Promise<CapabilitySecurityStatus> {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 5) {
      throw new Error('Capability Security requires Local Database schema 5 or newer.');
    }

    const revokedAt = this.#now();
    this.#database.transaction((database) => {
      database.prepare(`
        UPDATE gd_capability_grants
        SET revoked_at = ?, revocation_reason = ?
        WHERE revoked_at IS NULL
          AND expires_at > ?
          AND process_instance_id <> ?
      `).run(revokedAt, CAPABILITY_RESTART_REVOCATION_REASON, revokedAt, this.#processInstanceId);
    });

    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.capability.ready', {
      activeGrants: status.activeGrants,
      restartRevocations: status.restartRevocations,
      denyByDefault: true,
      plaintextTokenPersistence: false,
      secretsVaultReady: false,
      approvalTransactionsReady: false,
      externalGrantTransport: false,
    });
    return status;
  }

  issueGrant(request: CapabilityGrantRequest): CapabilityGrantIssued {
    this.#assertReady();
    const claims = deduplicateClaims(request.claims);
    const ttlMs = normalizeTtl(request.ttlMs);
    const label = normalizeLabel(request.label);
    const issuedAt = this.#now();
    const issuedMs = Date.parse(issuedAt);
    if (!Number.isFinite(issuedMs)) throw new Error('Capability Security clock returned an invalid timestamp.');
    const expiresAt = new Date(issuedMs + ttlMs).toISOString();
    const jobState = this.#jobState(request.jobId);
    if (isDurableJobTerminalState(jobState)) {
      throw new Error(`Cannot issue capabilities to terminal job ${request.jobId} (${jobState}).`);
    }

    const grantId = `gd_capgrant_${randomUUID()}` as CapabilityGrantId;
    const token = createCapabilityToken();
    const hash = tokenHash(token);

    this.#database.transaction((database) => {
      database.prepare(`
        INSERT INTO gd_capability_grants (
          id, job_id, token_hash, process_instance_id, label,
          issued_at, expires_at, revoked_at, revocation_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `).run(grantId, request.jobId, hash, this.#processInstanceId, label, issuedAt, expiresAt);

      const insertClaim = database.prepare(`
        INSERT INTO gd_capability_claims (grant_id, capability, resource, match_mode)
        VALUES (?, ?, ?, ?)
      `);
      for (const claim of claims) {
        insertClaim.run(grantId, claim.capability, claim.resource, claim.match);
      }
    });

    const grant = Object.freeze({
      id: grantId,
      jobId: request.jobId,
      claims,
      label,
      issuedAt,
      expiresAt,
      revokedAt: null,
      revocationReason: null,
    });

    void this.#eventBus?.publish('gd.local.capability.granted', {
      grantId,
      jobId: request.jobId,
      capabilities: Object.freeze([...new Set(claims.map((claim) => claim.capability))]),
      claimCount: claims.length,
      issuedAt,
      expiresAt,
    });

    return Object.freeze({ grant, token });
  }

  getGrant(grantId: CapabilityGrantId): CapabilityGrantRecord | null {
    this.#assertReady();
    return this.#database.read((database) => {
      const row = database.prepare(`
        SELECT id, job_id, process_instance_id, label, issued_at, expires_at, revoked_at, revocation_reason
        FROM gd_capability_grants WHERE id = ?
      `).get(grantId) as GrantRow | undefined;
      if (!row) return null;
      const claims = database.prepare(`
        SELECT capability, resource, match_mode
        FROM gd_capability_claims
        WHERE grant_id = ?
        ORDER BY capability, resource, match_mode
      `).all(grantId) as unknown as ClaimRow[];
      return this.#recordFromRows(row, claims);
    });
  }

  async revokeGrant(grantId: CapabilityGrantId, reason: string): Promise<boolean> {
    this.#assertReady();
    const normalizedReason = normalizeReason(reason);
    const revokedAt = this.#now();
    const existing = this.getGrant(grantId);
    if (!existing || existing.revokedAt) return false;

    const changed = this.#database.transaction((database) => {
      const result = database.prepare(`
        UPDATE gd_capability_grants
        SET revoked_at = ?, revocation_reason = ?
        WHERE id = ? AND revoked_at IS NULL
      `).run(revokedAt, normalizedReason, grantId);
      return Number(result.changes) > 0;
    });

    if (changed) {
      await this.#eventBus?.publish('gd.local.capability.revoked', {
        grantId,
        jobId: existing.jobId,
        reason: normalizedReason,
        revokedAt,
      });
    }
    return changed;
  }

  async revokeJobGrants(jobId: DurableJobId, reason: string): Promise<number> {
    this.#assertReady();
    const normalizedReason = normalizeReason(reason);
    const revokedAt = this.#now();
    const grantRows = this.#database.read((database) => database.prepare(`
      SELECT id, job_id, process_instance_id, label, issued_at, expires_at, revoked_at, revocation_reason
      FROM gd_capability_grants
      WHERE job_id = ? AND revoked_at IS NULL
      ORDER BY issued_at, id
    `).all(jobId) as unknown as GrantRow[]);

    if (grantRows.length === 0) return 0;
    this.#database.transaction((database) => {
      database.prepare(`
        UPDATE gd_capability_grants
        SET revoked_at = ?, revocation_reason = ?
        WHERE job_id = ? AND revoked_at IS NULL
      `).run(revokedAt, normalizedReason, jobId);
    });

    for (const row of grantRows) {
      await this.#eventBus?.publish('gd.local.capability.revoked', {
        grantId: text(row.id, 'capability grant id') as CapabilityGrantId,
        jobId,
        reason: normalizedReason,
        revokedAt,
      });
    }
    return grantRows.length;
  }

  async shutdown(reason = 'local runtime stopped'): Promise<number> {
    if (!this.#ready || !this.#database.isOpen) return 0;
    const normalizedReason = normalizeReason(reason);
    const revokedAt = this.#now();
    const rows = this.#database.read((database) => database.prepare(`
      SELECT id, job_id, process_instance_id, label, issued_at, expires_at, revoked_at, revocation_reason
      FROM gd_capability_grants
      WHERE process_instance_id = ? AND revoked_at IS NULL
      ORDER BY issued_at, id
    `).all(this.#processInstanceId) as unknown as GrantRow[]);

    if (rows.length > 0) {
      this.#database.transaction((database) => {
        database.prepare(`
          UPDATE gd_capability_grants
          SET revoked_at = ?, revocation_reason = ?
          WHERE process_instance_id = ? AND revoked_at IS NULL
        `).run(revokedAt, normalizedReason, this.#processInstanceId);
      });
      for (const row of rows) {
        await this.#eventBus?.publish('gd.local.capability.revoked', {
          grantId: text(row.id, 'capability grant id') as CapabilityGrantId,
          jobId: text(row.job_id, 'capability grant job id') as DurableJobId,
          reason: normalizedReason,
          revokedAt,
        });
      }
    }
    this.#ready = false;
    return rows.length;
  }

  async authorize(
    request: CapabilityAuthorizationRequest,
    token: string | null | undefined,
  ): Promise<CapabilityAuthorizationDecision> {
    this.#assertReady();
    const requirements = deduplicateRequirements(request.requirements);
    if (!validCapabilityToken(token)) {
      return this.#deny(request.jobId, 'missing-or-invalid-token', requirements);
    }

    const hash = tokenHash(token);
    const resolved = this.#database.read((database) => {
      const row = database.prepare(`
        SELECT id, job_id, process_instance_id, label, issued_at, expires_at, revoked_at, revocation_reason
        FROM gd_capability_grants WHERE token_hash = ?
      `).get(hash) as GrantRow | undefined;
      if (!row) return null;
      const claims = database.prepare(`
        SELECT capability, resource, match_mode
        FROM gd_capability_claims WHERE grant_id = ?
      `).all(text(row.id, 'capability grant id')) as unknown as ClaimRow[];
      return { row, claims };
    });

    if (!resolved) return this.#deny(request.jobId, 'unknown-token', requirements);
    const grant = this.#recordFromRows(resolved.row, resolved.claims);
    if (text(resolved.row.process_instance_id, 'capability process instance') !== this.#processInstanceId) {
      return this.#deny(request.jobId, 'stale-process-grant', requirements, grant.id);
    }
    if (grant.jobId !== request.jobId) {
      return this.#deny(request.jobId, 'job-mismatch', requirements, grant.id);
    }
    if (grant.revokedAt) {
      return this.#deny(request.jobId, 'grant-revoked', requirements, grant.id);
    }
    if (Date.parse(grant.expiresAt) <= Date.parse(this.#now())) {
      return this.#deny(request.jobId, 'grant-expired', requirements, grant.id);
    }

    const jobState = this.#jobState(request.jobId);
    if (isDurableJobTerminalState(jobState)) {
      return this.#deny(request.jobId, 'job-terminal', requirements, grant.id);
    }

    const missing = requirements.filter(
      (requirement) => !grant.claims.some((claim) => claimMatches(claim, requirement)),
    );
    if (missing.length > 0) return this.#deny(request.jobId, 'missing-capability-or-scope', missing, grant.id);

    return Object.freeze({
      allowed: true,
      grantId: grant.id,
      reason: 'authorized',
      missing: Object.freeze([]),
    });
  }

  async assertAuthorized(
    request: CapabilityAuthorizationRequest,
    token: string | null | undefined,
  ): Promise<CapabilityGrantId> {
    const decision = await this.authorize(request, token);
    if (!decision.allowed || !decision.grantId) {
      throw new Error(`Capability authorization denied: ${decision.reason}.`);
    }
    return decision.grantId;
  }

  #jobState(jobId: DurableJobId): DurableJobState {
    const row = this.#database.read((database) => database
      .prepare('SELECT state FROM gd_jobs WHERE id = ?')
      .get(jobId) as JobStateRow | undefined);
    if (!row) throw new Error(`Unknown durable job ${jobId}.`);
    return text(row.state, 'durable job state') as DurableJobState;
  }

  #recordFromRows(row: GrantRow, claimRows: readonly ClaimRow[]): CapabilityGrantRecord {
    const claims = Object.freeze(claimRows.map((claim) => Object.freeze({
      capability: asCapability(claim.capability),
      resource: normalizeResource(text(claim.resource, 'capability claim resource')),
      match: asMatchMode(claim.match_mode),
    })));
    return Object.freeze({
      id: text(row.id, 'capability grant id') as CapabilityGrantId,
      jobId: text(row.job_id, 'capability job id') as DurableJobId,
      claims,
      label: nullableText(row.label, 'capability grant label'),
      issuedAt: text(row.issued_at, 'capability issued_at'),
      expiresAt: text(row.expires_at, 'capability expires_at'),
      revokedAt: nullableText(row.revoked_at, 'capability revoked_at'),
      revocationReason: nullableText(row.revocation_reason, 'capability revocation_reason'),
    });
  }

  async #deny(
    jobId: DurableJobId,
    reason: string,
    missing: readonly CapabilityRequirement[],
    grantId: CapabilityGrantId | null = null,
  ): Promise<CapabilityAuthorizationDecision> {
    await this.#eventBus?.publish('gd.local.capability.denied', {
      grantId,
      jobId,
      reason,
      missingCapabilities: Object.freeze([...new Set(missing.map((entry) => entry.capability))]),
      missingCount: missing.length,
    });
    return Object.freeze({
      allowed: false,
      grantId,
      reason,
      missing: Object.freeze([...missing]),
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Capability Security authority is not ready.');
  }
}

export function createCapabilitySecurityAuthority(
  options: CapabilitySecurityOptions,
): CapabilitySecurityAuthority {
  return new CapabilitySecurityAuthority(options);
}
