import {
  createHmac,
  createSign,
  timingSafeEqual,
} from 'node:crypto';
import type { EventBus } from '@github-decrypter/shared';
import {
  GITHUB_API_BASE_URL,
  GITHUB_API_VERSION,
  GITHUB_APP_JWT_ALGORITHM,
  GITHUB_APP_SCHEMA,
  GITHUB_WEBHOOK_SIGNATURE_ALGORITHM,
  normalizeGitHubAppId,
  normalizeGitHubInstallationId,
  normalizeGitHubWebhookDeliveryId,
  normalizeGitHubWebhookEvent,
  type GitHubAppConfigurationRecord,
  type GitHubAppInstallationRecord,
  type GitHubAppJwt,
  type GitHubInstallationAccessToken,
  type GitHubInstallationState,
  type GitHubRepositorySelection,
  type GitHubWebhookVerification,
} from '@github-decrypter/github-app';
import type {
  CapabilitySecurityAuthority,
  CapabilityToken,
} from './capability-security.js';
import type { LocalDatabase } from './database.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import type { OfflineExecutionCoordinator } from './offline-execution.js';
import type { SecretsVault } from './secrets-vault.js';

export const GITHUB_APP_PRIVATE_KEY_RESOURCE = 'gd://secret/github-app/private-key' as const;
export const GITHUB_APP_WEBHOOK_SECRET_RESOURCE = 'gd://secret/github-app/webhook-secret' as const;
export const GITHUB_APP_CONFIG_RESOURCE = 'gd://github-app/config' as const;
export const GITHUB_APP_INSTALLATIONS_RESOURCE = 'gd://github-app/installations' as const;
export const GITHUB_APP_WEBHOOK_DELIVERIES_RESOURCE = 'gd://github-app/webhooks/deliveries' as const;

export interface GitHubAppRuntimeStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly configured: boolean;
  readonly installationCount: number;
  readonly apiBaseUrl: typeof GITHUB_API_BASE_URL;
  readonly jwtAlgorithm: typeof GITHUB_APP_JWT_ALGORITHM;
  readonly webhookAlgorithm: typeof GITHUB_WEBHOOK_SIGNATURE_ALGORITHM;
  readonly privateKeyPersistence: 'secrets-vault';
  readonly webhookSecretPersistence: 'secrets-vault';
  readonly installationTokenPersistence: false;
  readonly webhookPayloadPersistence: false;
  readonly genericHttpTransport: false;
}

export interface GitHubAppRuntimeAuthorization {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
}

export interface ConfigureGitHubAppRequest extends GitHubAppRuntimeAuthorization {
  readonly appId: string | number;
  readonly privateKeyPem: string;
  readonly webhookSecret: string;
}

export interface CreateInstallationAccessTokenRequest extends GitHubAppRuntimeAuthorization {
  readonly installationId: number;
}

export interface VerifyGitHubWebhookRequest extends GitHubAppRuntimeAuthorization {
  readonly rawBody: string | Uint8Array;
  readonly signature: string;
  readonly deliveryId: string;
  readonly event: string;
}

export interface UpsertGitHubInstallationRequest extends GitHubAppRuntimeAuthorization {
  readonly installationId: number;
  readonly accountLogin?: string | null;
  readonly accountType?: string | null;
  readonly repositorySelection?: GitHubRepositorySelection | null;
  readonly state?: GitHubInstallationState;
  readonly suspendedAt?: string | null;
}

export interface GitHubAppRuntimeOptions {
  readonly database: LocalDatabase;
  readonly capabilities: CapabilitySecurityAuthority;
  readonly vault: SecretsVault;
  readonly offline: Pick<OfflineExecutionCoordinator, 'status'>;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => string;
}

interface ConfigRow {
  readonly app_id: unknown;
  readonly configured_at: unknown;
  readonly updated_at: unknown;
}

interface InstallationRow {
  readonly installation_id: unknown;
  readonly account_login: unknown;
  readonly account_type: unknown;
  readonly repository_selection: unknown;
  readonly state: unknown;
  readonly created_at: unknown;
  readonly updated_at: unknown;
  readonly suspended_at: unknown;
}

interface CountRow { readonly count: unknown; }

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

function normalizeOptionalMetadata(value: string | null | undefined, label: string, max = 255): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max || /[\r\n]/.test(normalized)) throw new TypeError(`${label} is invalid.`);
  return normalized;
}

function normalizeIso(value: string | null | undefined, label: string): string | null {
  if (value == null) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${label} must be an ISO-compatible timestamp.`);
  return new Date(parsed).toISOString();
}

function encodeJwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function installationResource(installationId: number): string {
  return `${GITHUB_APP_INSTALLATIONS_RESOURCE}/${installationId}`;
}

function installationTokenResource(installationId: number): string {
  return `${installationResource(installationId)}/token`;
}

function configurationFromRow(row: ConfigRow): GitHubAppConfigurationRecord {
  return Object.freeze({
    schema: GITHUB_APP_SCHEMA,
    appId: normalizeGitHubAppId(text(row.app_id, 'GitHub App app_id')),
    apiBaseUrl: GITHUB_API_BASE_URL,
    configuredAt: text(row.configured_at, 'GitHub App configured_at'),
    updatedAt: text(row.updated_at, 'GitHub App updated_at'),
  });
}

function installationFromRow(row: InstallationRow): GitHubAppInstallationRecord {
  const repositorySelection = nullableText(row.repository_selection, 'GitHub installation repository_selection');
  if (repositorySelection !== null && repositorySelection !== 'all' && repositorySelection !== 'selected') {
    throw new Error('SQLite returned invalid GitHub repository selection.');
  }
  const state = text(row.state, 'GitHub installation state');
  if (state !== 'active' && state !== 'suspended') throw new Error('SQLite returned invalid GitHub installation state.');
  return Object.freeze({
    installationId: normalizeGitHubInstallationId(integer(row.installation_id, 'GitHub installation id')),
    accountLogin: nullableText(row.account_login, 'GitHub installation account_login'),
    accountType: nullableText(row.account_type, 'GitHub installation account_type'),
    repositorySelection,
    state,
    createdAt: text(row.created_at, 'GitHub installation created_at'),
    updatedAt: text(row.updated_at, 'GitHub installation updated_at'),
    suspendedAt: nullableText(row.suspended_at, 'GitHub installation suspended_at'),
  });
}

export class GitHubAppRuntime {
  readonly #database: LocalDatabase;
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #vault: SecretsVault;
  readonly #offline: Pick<OfflineExecutionCoordinator, 'status'>;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #fetch: typeof fetch;
  readonly #now: () => string;
  #ready = false;

  constructor(options: GitHubAppRuntimeOptions) {
    this.#database = options.database;
    this.#capabilities = options.capabilities;
    this.#vault = options.vault;
    this.#offline = options.offline;
    this.#eventBus = options.eventBus;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  status(): GitHubAppRuntimeStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    let configured = false;
    let installationCount = 0;
    if (this.#database.isOpen && schemaVersion >= 11) {
      configured = this.#database.read((database) => Boolean(database.prepare('SELECT 1 FROM gd_github_app_config WHERE id = 1').get()));
      installationCount = this.#database.read((database) => {
        const row = database.prepare('SELECT COUNT(*) AS count FROM gd_github_app_installations').get() as CountRow | undefined;
        return integer(row?.count ?? 0, 'GitHub installation count');
      });
    }
    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      configured,
      installationCount,
      apiBaseUrl: GITHUB_API_BASE_URL,
      jwtAlgorithm: GITHUB_APP_JWT_ALGORITHM,
      webhookAlgorithm: GITHUB_WEBHOOK_SIGNATURE_ALGORITHM,
      privateKeyPersistence: 'secrets-vault',
      webhookSecretPersistence: 'secrets-vault',
      installationTokenPersistence: false,
      webhookPayloadPersistence: false,
      genericHttpTransport: false,
    });
  }

  async initialize(): Promise<GitHubAppRuntimeStatus> {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 11) throw new Error('GitHub App Runtime requires Local Database schema 11 or newer.');
    if (!this.#capabilities.status().ready) throw new Error('GitHub App Runtime requires Capability Security to be ready.');
    if (!this.#vault.status().ready) throw new Error('GitHub App Runtime requires Secrets Vault to be ready.');
    if (!this.#offline.status().ready) throw new Error('GitHub App Runtime requires Offline Execution to be ready.');
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.github-app.ready', {
      configured: status.configured,
      installationCount: status.installationCount,
      installationTokenPersistence: false,
      webhookPayloadPersistence: false,
      genericHttpTransport: false,
    });
    return status;
  }

  async configure(request: ConfigureGitHubAppRequest): Promise<GitHubAppConfigurationRecord> {
    this.#assertReady();
    const appId = normalizeGitHubAppId(request.appId);
    if (!request.privateKeyPem.includes('PRIVATE KEY')) throw new TypeError('GitHub App private key must be PEM encoded.');
    if (!request.webhookSecret || Buffer.byteLength(request.webhookSecret, 'utf8') < 8) {
      throw new TypeError('GitHub App webhook secret must contain at least 8 bytes.');
    }
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'DATABASE_WRITE', resource: GITHUB_APP_CONFIG_RESOURCE }],
    }, request.token);
    await this.#vault.putSecret({
      jobId: request.jobId,
      token: request.token,
      resource: GITHUB_APP_PRIVATE_KEY_RESOURCE,
      value: request.privateKeyPem,
    });
    await this.#vault.putSecret({
      jobId: request.jobId,
      token: request.token,
      resource: GITHUB_APP_WEBHOOK_SECRET_RESOURCE,
      value: request.webhookSecret,
    });
    const now = this.#now();
    this.#database.transaction((database) => {
      database.prepare(`
        INSERT INTO gd_github_app_config (id, app_id, api_base_url, configured_at, updated_at)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          app_id = excluded.app_id,
          api_base_url = excluded.api_base_url,
          updated_at = excluded.updated_at
      `).run(appId, GITHUB_API_BASE_URL, now, now);
    });
    const configuration = this.#configuration();
    if (!configuration) throw new Error('GitHub App configuration failed to persist.');
    await this.#eventBus?.publish('gd.local.github-app.configured', {
      appId,
      configuredAt: configuration.configuredAt,
      updatedAt: configuration.updatedAt,
    });
    return configuration;
  }

  async createAppJwt(authorization: GitHubAppRuntimeAuthorization): Promise<GitHubAppJwt> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: authorization.jobId,
      requirements: [{ capability: 'READ', resource: GITHUB_APP_CONFIG_RESOURCE }],
    }, authorization.token);
    const configuration = this.#configuration();
    if (!configuration) throw new Error('GitHub App is not configured.');
    const privateKeyPem = await this.#vault.readSecret({
      jobId: authorization.jobId,
      token: authorization.token,
      resource: GITHUB_APP_PRIVATE_KEY_RESOURCE,
    });
    if (!privateKeyPem) throw new Error('GitHub App private key is not available in Secrets Vault.');

    const nowMs = Date.parse(this.#now());
    if (!Number.isFinite(nowMs)) throw new Error('GitHub App clock returned an invalid timestamp.');
    const nowSeconds = Math.floor(nowMs / 1000);
    const issuedAtSeconds = nowSeconds - 60;
    const expiresAtSeconds = nowSeconds + 540;
    const header = encodeJwtPart({ alg: GITHUB_APP_JWT_ALGORITHM, typ: 'JWT' });
    const payload = encodeJwtPart({ iat: issuedAtSeconds, exp: expiresAtSeconds, iss: configuration.appId });
    const signingInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput, 'utf8');
    signer.end();
    const signature = signer.sign(privateKeyPem).toString('base64url');
    return Object.freeze({
      token: `${signingInput}.${signature}`,
      issuedAt: new Date(issuedAtSeconds * 1000).toISOString(),
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      algorithm: GITHUB_APP_JWT_ALGORITHM,
      persistable: false,
    });
  }

  async createInstallationAccessToken(request: CreateInstallationAccessTokenRequest): Promise<GitHubInstallationAccessToken> {
    this.#assertReady();
    const installationId = normalizeGitHubInstallationId(request.installationId);
    const connectivity = this.#offline.status().connectivity;
    if (connectivity !== 'online') throw new Error(`GitHub installation token creation requires online connectivity; current state is ${connectivity}.`);
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'NETWORK', resource: installationTokenResource(installationId) }],
    }, request.token);
    const jwt = await this.createAppJwt(request);
    const response = await this.#fetch(`${GITHUB_API_BASE_URL}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${jwt.token}`,
        'x-github-api-version': GITHUB_API_VERSION,
        'user-agent': 'github-decrypter-local-runtime/0.0.23',
      },
    });
    if (!response.ok) throw new Error(`GitHub installation token request failed with HTTP ${response.status}.`);
    const body = await response.json() as Record<string, unknown>;
    if (typeof body.token !== 'string' || !body.token) throw new Error('GitHub installation token response did not include a token.');
    if (typeof body.expires_at !== 'string' || !Number.isFinite(Date.parse(body.expires_at))) {
      throw new Error('GitHub installation token response did not include a valid expiration.');
    }
    const expiresAt = new Date(Date.parse(body.expires_at)).toISOString();
    const nowMs = Date.parse(this.#now());
    const expiresMs = Date.parse(expiresAt);
    if (expiresMs <= nowMs || expiresMs > nowMs + 3_700_000) {
      throw new Error('GitHub installation token expiration is outside the accepted short-lived window.');
    }
    await this.#eventBus?.publish('gd.local.github-app.installation-token.created', {
      installationId,
      expiresAt,
      persisted: false,
    });
    return Object.freeze({ installationId, token: body.token, expiresAt, persistable: false });
  }

  async verifyWebhook(request: VerifyGitHubWebhookRequest): Promise<GitHubWebhookVerification> {
    this.#assertReady();
    const deliveryId = normalizeGitHubWebhookDeliveryId(request.deliveryId);
    const event = normalizeGitHubWebhookEvent(request.event);
    const signatureMatch = /^sha256=([a-f0-9]{64})$/i.exec(request.signature.trim());
    const secret = await this.#vault.readSecret({
      jobId: request.jobId,
      token: request.token,
      resource: GITHUB_APP_WEBHOOK_SECRET_RESOURCE,
    });
    if (!secret) throw new Error('GitHub App webhook secret is not available in Secrets Vault.');
    const rawBody = typeof request.rawBody === 'string' ? Buffer.from(request.rawBody, 'utf8') : Buffer.from(request.rawBody);
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    const provided = signatureMatch ? Buffer.from(signatureMatch[1], 'hex') : Buffer.alloc(0);
    const valid = provided.byteLength === expected.byteLength && timingSafeEqual(provided, expected);
    let duplicate = false;
    const verifiedAt = this.#now();
    if (valid) {
      await this.#capabilities.assertAuthorized({
        jobId: request.jobId,
        requirements: [{ capability: 'DATABASE_WRITE', resource: GITHUB_APP_WEBHOOK_DELIVERIES_RESOURCE }],
      }, request.token);
      const result = this.#database.transaction((database) => database.prepare(`
        INSERT OR IGNORE INTO gd_github_webhook_deliveries (delivery_id, event, verified_at)
        VALUES (?, ?, ?)
      `).run(deliveryId, event, verifiedAt));
      duplicate = Number(result.changes) === 0;
    }
    await this.#eventBus?.publish('gd.local.github-app.webhook.verified', {
      deliveryId,
      event,
      valid,
      duplicate,
      verifiedAt,
      payloadPersistence: false,
    });
    return Object.freeze({
      valid,
      duplicate,
      deliveryId,
      event,
      algorithm: GITHUB_WEBHOOK_SIGNATURE_ALGORITHM,
      verifiedAt,
      payloadPersistence: false,
    });
  }

  async upsertInstallation(request: UpsertGitHubInstallationRequest): Promise<GitHubAppInstallationRecord> {
    this.#assertReady();
    const installationId = normalizeGitHubInstallationId(request.installationId);
    const state = request.state ?? 'active';
    if (state !== 'active' && state !== 'suspended') throw new TypeError('Unsupported GitHub installation state.');
    const repositorySelection = request.repositorySelection ?? null;
    if (repositorySelection !== null && repositorySelection !== 'all' && repositorySelection !== 'selected') {
      throw new TypeError('Unsupported GitHub repository selection.');
    }
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'DATABASE_WRITE', resource: installationResource(installationId) }],
    }, request.token);
    const now = this.#now();
    const accountLogin = normalizeOptionalMetadata(request.accountLogin, 'GitHub account login');
    const accountType = normalizeOptionalMetadata(request.accountType, 'GitHub account type', 100);
    const suspendedAt = state === 'suspended' ? (normalizeIso(request.suspendedAt, 'GitHub installation suspendedAt') ?? now) : null;
    this.#database.transaction((database) => {
      database.prepare(`
        INSERT INTO gd_github_app_installations (
          installation_id, account_login, account_type, repository_selection, state,
          created_at, updated_at, suspended_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(installation_id) DO UPDATE SET
          account_login = excluded.account_login,
          account_type = excluded.account_type,
          repository_selection = excluded.repository_selection,
          state = excluded.state,
          updated_at = excluded.updated_at,
          suspended_at = excluded.suspended_at
      `).run(installationId, accountLogin, accountType, repositorySelection, state, now, now, suspendedAt);
    });
    const installation = this.#installation(installationId);
    if (!installation) throw new Error('GitHub App installation failed to persist.');
    await this.#eventBus?.publish('gd.local.github-app.installation.changed', {
      installationId,
      state: installation.state,
      updatedAt: installation.updatedAt,
    });
    return installation;
  }

  async listInstallations(authorization: GitHubAppRuntimeAuthorization): Promise<readonly GitHubAppInstallationRecord[]> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: authorization.jobId,
      requirements: [{ capability: 'READ', resource: GITHUB_APP_INSTALLATIONS_RESOURCE }],
    }, authorization.token);
    return Object.freeze(this.#database.read((database) => (
      database.prepare(`
        SELECT installation_id, account_login, account_type, repository_selection, state,
               created_at, updated_at, suspended_at
        FROM gd_github_app_installations ORDER BY installation_id ASC
      `).all() as unknown as InstallationRow[]
    ).map(installationFromRow)));
  }

  shutdown(): void { this.#ready = false; }

  #configuration(): GitHubAppConfigurationRecord | null {
    const row = this.#database.read((database) => database.prepare(`
      SELECT app_id, configured_at, updated_at FROM gd_github_app_config WHERE id = 1
    `).get() as ConfigRow | undefined);
    return row ? configurationFromRow(row) : null;
  }

  #installation(installationId: number): GitHubAppInstallationRecord | null {
    const row = this.#database.read((database) => database.prepare(`
      SELECT installation_id, account_login, account_type, repository_selection, state,
             created_at, updated_at, suspended_at
      FROM gd_github_app_installations WHERE installation_id = ?
    `).get(installationId) as InstallationRow | undefined);
    return row ? installationFromRow(row) : null;
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('GitHub App Runtime is not ready.');
  }
}

export function createGitHubAppRuntime(options: GitHubAppRuntimeOptions): GitHubAppRuntime {
  return new GitHubAppRuntime(options);
}
