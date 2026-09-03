import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type { EventBus } from '@github-decrypter/shared';
import type { CapabilitySecurityAuthority, CapabilityToken } from './capability-security.js';
import type { LocalDatabase } from './database.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import {
  createLocalVaultKeyStore,
  type LocalVaultKeyStore,
} from './vault-key-store.js';

export const SECRETS_VAULT_CIPHER = 'AES-256-GCM' as const;
export const SECRETS_VAULT_KDF = 'HKDF-SHA256' as const;
export const SECRETS_VAULT_CIPHER_VERSION = 1;
export const SECRETS_VAULT_MAX_VALUE_BYTES = 1024 * 1024;

export type SecretVaultOperation = 'created' | 'updated' | 'deleted';

export interface SecretsVaultStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly secretCount: number;
  readonly cipher: typeof SECRETS_VAULT_CIPHER;
  readonly kdf: typeof SECRETS_VAULT_KDF;
  readonly keyBackend: 'local-key-file-v1';
  readonly plaintextPersistence: false;
  readonly plaintextResourcePersistence: false;
  readonly externalTransport: false;
}

export interface SecretsVaultOptions {
  readonly database: LocalDatabase;
  readonly capabilities: CapabilitySecurityAuthority;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly keyStore?: LocalVaultKeyStore;
  readonly keyPath?: string;
  readonly now?: () => string;
}

export interface PutSecretRequest {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
  readonly resource: string;
  readonly value: string;
}

export interface ReadSecretRequest {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
  readonly resource: string;
}

export interface DeleteSecretRequest extends ReadSecretRequest {}

export interface SecretVaultRecord {
  readonly id: string;
  readonly resource: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface VaultMetadataRow {
  readonly key_fingerprint: unknown;
  readonly cipher: unknown;
  readonly kdf: unknown;
}

interface VaultSecretRow {
  readonly id: unknown;
  readonly resource_hmac: unknown;
  readonly resource_ciphertext: unknown;
  readonly resource_nonce: unknown;
  readonly resource_tag: unknown;
  readonly value_ciphertext: unknown;
  readonly value_nonce: unknown;
  readonly value_tag: unknown;
  readonly created_at: unknown;
  readonly updated_at: unknown;
}

interface CountRow {
  readonly count: unknown;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`SQLite returned invalid text for ${label}.`);
  return value;
}

function bytes(value: unknown, label: string): Buffer {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new Error(`SQLite returned invalid bytes for ${label}.`);
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) throw new Error(`SQLite returned invalid integer for ${label}.`);
  return normalized as number;
}

function normalizeSecretResource(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 2_048) {
    throw new TypeError('Secret resources must be non-empty and at most 2048 characters.');
  }
  if (/\s/.test(normalized) || normalized.includes('*')) {
    throw new TypeError('Secret resources may not contain whitespace or wildcard characters.');
  }
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'gd:' || parsed.hostname !== 'secret') {
    throw new TypeError('Secret resources must use the gd://secret/... namespace.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname === '/') {
    throw new TypeError('Secret resources must not contain credentials, query strings or fragments and require a path.');
  }
  return normalized;
}

function normalizeSecretValue(value: string): string {
  if (typeof value !== 'string') throw new TypeError('Secret values must be strings.');
  const size = Buffer.byteLength(value, 'utf8');
  if (size === 0) throw new TypeError('Secret values must not be empty.');
  if (size > SECRETS_VAULT_MAX_VALUE_BYTES) {
    throw new RangeError(`Secret values may not exceed ${SECRETS_VAULT_MAX_VALUE_BYTES} bytes.`);
  }
  return value;
}

function deriveSubkey(masterKey: Buffer, info: string): Buffer {
  return Buffer.from(hkdfSync('sha256', masterKey, Buffer.alloc(0), Buffer.from(info, 'utf8'), 32));
}

function encryptText(key: Buffer, plaintext: string, aad: string): { ciphertext: Buffer; nonce: Buffer; tag: Buffer } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, nonce, tag };
}

function decryptText(
  key: Buffer,
  ciphertext: Buffer,
  nonce: Buffer,
  tag: Buffer,
  aad: string,
): string {
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export class SecretsVault {
  readonly #database: LocalDatabase;
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #keyStore: LocalVaultKeyStore;
  readonly #now: () => string;
  #encryptionKey: Buffer | null = null;
  #lookupKey: Buffer | null = null;
  #ready = false;

  constructor(options: SecretsVaultOptions) {
    this.#database = options.database;
    this.#capabilities = options.capabilities;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#keyStore = options.keyStore ?? createLocalVaultKeyStore({
      databasePath: options.database.path,
      path: options.keyPath,
    });
  }

  status(): SecretsVaultStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    const secretCount = this.#database.isOpen && schemaVersion >= 6
      ? this.#database.read((database) => {
        const row = database.prepare('SELECT COUNT(*) AS count FROM gd_vault_secrets').get() as CountRow | undefined;
        return integer(row?.count ?? 0, 'vault secret count');
      })
      : 0;
    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      secretCount,
      cipher: SECRETS_VAULT_CIPHER,
      kdf: SECRETS_VAULT_KDF,
      keyBackend: 'local-key-file-v1',
      plaintextPersistence: false,
      plaintextResourcePersistence: false,
      externalTransport: false,
    });
  }

  async initialize(): Promise<SecretsVaultStatus> {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 6) {
      throw new Error('Secrets Vault requires Local Database schema 6 or newer.');
    }
    if (!this.#capabilities.status().ready) {
      throw new Error('Secrets Vault requires Capability Security to be ready first.');
    }

    const keyStatus = this.#keyStore.initialize();
    this.#keyStore.withKey((masterKey) => {
      this.#encryptionKey = deriveSubkey(masterKey, 'github-decrypter:secrets-vault:encryption:v1');
      this.#lookupKey = deriveSubkey(masterKey, 'github-decrypter:secrets-vault:lookup:v1');
    });

    try {
      this.#database.transaction((database) => {
        const metadata = database.prepare(`
          SELECT key_fingerprint, cipher, kdf FROM gd_vault_metadata WHERE id = 1
        `).get() as VaultMetadataRow | undefined;
        if (!metadata) {
          database.prepare(`
            INSERT INTO gd_vault_metadata (id, key_fingerprint, cipher, kdf, created_at, updated_at)
            VALUES (1, ?, ?, ?, ?, ?)
          `).run(keyStatus.fingerprint, SECRETS_VAULT_CIPHER, SECRETS_VAULT_KDF, this.#now(), this.#now());
          return;
        }
        if (
          text(metadata.key_fingerprint, 'vault key fingerprint') !== keyStatus.fingerprint
          || text(metadata.cipher, 'vault cipher') !== SECRETS_VAULT_CIPHER
          || text(metadata.kdf, 'vault kdf') !== SECRETS_VAULT_KDF
        ) {
          throw new Error('Secrets Vault key or cryptographic metadata does not match this database.');
        }
      });

      this.#ready = true;
      this.#capabilities.setSecretsVaultReady(true);
      const status = this.status();
      await this.#eventBus?.publish('gd.local.vault.ready', {
        secretCount: status.secretCount,
        cipher: status.cipher,
        keyBackend: status.keyBackend,
        plaintextPersistence: false,
        externalTransport: false,
      });
      return status;
    } catch (error) {
      this.#wipeKeys();
      this.#keyStore.close();
      throw error;
    }
  }

  async putSecret(request: PutSecretRequest): Promise<SecretVaultRecord> {
    this.#assertReady();
    const resource = normalizeSecretResource(request.resource);
    const value = normalizeSecretValue(request.value);
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'SECRETS', resource }],
    }, request.token);

    const lookupKey = this.#requireLookupKey();
    const encryptionKey = this.#requireEncryptionKey();
    const resourceHmac = createHmac('sha256', lookupKey).update(resource, 'utf8').digest('hex');
    const existing = this.#findByResourceHmac(resourceHmac);
    const id = existing ? text(existing.id, 'vault secret id') : `gd_secret_${randomUUID()}`;
    const createdAt = existing ? text(existing.created_at, 'vault created_at') : this.#now();
    const updatedAt = this.#now();
    const encryptedResource = encryptText(encryptionKey, resource, `gd-vault-resource-v1\u0000${id}\u0000${resourceHmac}`);
    const encryptedValue = encryptText(encryptionKey, value, `gd-vault-value-v1\u0000${id}\u0000${resourceHmac}`);

    this.#database.transaction((database) => {
      database.prepare(`
        INSERT INTO gd_vault_secrets (
          id, resource_hmac, resource_ciphertext, resource_nonce, resource_tag,
          value_ciphertext, value_nonce, value_tag, cipher_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(resource_hmac) DO UPDATE SET
          resource_ciphertext = excluded.resource_ciphertext,
          resource_nonce = excluded.resource_nonce,
          resource_tag = excluded.resource_tag,
          value_ciphertext = excluded.value_ciphertext,
          value_nonce = excluded.value_nonce,
          value_tag = excluded.value_tag,
          cipher_version = excluded.cipher_version,
          updated_at = excluded.updated_at
      `).run(
        id,
        resourceHmac,
        encryptedResource.ciphertext,
        encryptedResource.nonce,
        encryptedResource.tag,
        encryptedValue.ciphertext,
        encryptedValue.nonce,
        encryptedValue.tag,
        SECRETS_VAULT_CIPHER_VERSION,
        createdAt,
        updatedAt,
      );
    });

    await this.#eventBus?.publish('gd.local.vault.secret.changed', {
      secretId: id,
      operation: existing ? 'updated' : 'created',
      occurredAt: updatedAt,
    });
    return Object.freeze({ id, resource, createdAt, updatedAt });
  }

  async readSecret(request: ReadSecretRequest): Promise<string | null> {
    this.#assertReady();
    const resource = normalizeSecretResource(request.resource);
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'SECRETS', resource }],
    }, request.token);

    const resourceHmac = createHmac('sha256', this.#requireLookupKey()).update(resource, 'utf8').digest('hex');
    const row = this.#findByResourceHmac(resourceHmac);
    if (!row) return null;
    const id = text(row.id, 'vault secret id');
    const decryptedResource = decryptText(
      this.#requireEncryptionKey(),
      bytes(row.resource_ciphertext, 'vault resource ciphertext'),
      bytes(row.resource_nonce, 'vault resource nonce'),
      bytes(row.resource_tag, 'vault resource tag'),
      `gd-vault-resource-v1\u0000${id}\u0000${resourceHmac}`,
    );
    if (decryptedResource !== resource) {
      throw new Error('Secrets Vault resource authentication failed.');
    }
    return decryptText(
      this.#requireEncryptionKey(),
      bytes(row.value_ciphertext, 'vault value ciphertext'),
      bytes(row.value_nonce, 'vault value nonce'),
      bytes(row.value_tag, 'vault value tag'),
      `gd-vault-value-v1\u0000${id}\u0000${resourceHmac}`,
    );
  }

  async deleteSecret(request: DeleteSecretRequest): Promise<boolean> {
    this.#assertReady();
    const resource = normalizeSecretResource(request.resource);
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [
        { capability: 'SECRETS', resource },
        { capability: 'DESTRUCTIVE', resource },
      ],
    }, request.token);

    const resourceHmac = createHmac('sha256', this.#requireLookupKey()).update(resource, 'utf8').digest('hex');
    const row = this.#findByResourceHmac(resourceHmac);
    if (!row) return false;
    const id = text(row.id, 'vault secret id');
    const result = this.#database.transaction((database) => database
      .prepare('DELETE FROM gd_vault_secrets WHERE resource_hmac = ?')
      .run(resourceHmac));
    const deleted = Number(result.changes) > 0;
    if (deleted) {
      await this.#eventBus?.publish('gd.local.vault.secret.changed', {
        secretId: id,
        operation: 'deleted',
        occurredAt: this.#now(),
      });
    }
    return deleted;
  }

  shutdown(): void {
    this.#ready = false;
    this.#capabilities.setSecretsVaultReady(false);
    this.#wipeKeys();
    this.#keyStore.close();
  }

  #findByResourceHmac(resourceHmac: string): VaultSecretRow | null {
    return this.#database.read((database) => database.prepare(`
      SELECT id, resource_hmac, resource_ciphertext, resource_nonce, resource_tag,
             value_ciphertext, value_nonce, value_tag, created_at, updated_at
      FROM gd_vault_secrets WHERE resource_hmac = ?
    `).get(resourceHmac) as VaultSecretRow | undefined) ?? null;
  }

  #requireEncryptionKey(): Buffer {
    if (!this.#encryptionKey) throw new Error('Secrets Vault encryption key is not available.');
    return this.#encryptionKey;
  }

  #requireLookupKey(): Buffer {
    if (!this.#lookupKey) throw new Error('Secrets Vault lookup key is not available.');
    return this.#lookupKey;
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Secrets Vault is not ready.');
  }

  #wipeKeys(): void {
    this.#encryptionKey?.fill(0);
    this.#lookupKey?.fill(0);
    this.#encryptionKey = null;
    this.#lookupKey = null;
  }
}

export function createSecretsVault(options: SecretsVaultOptions): SecretsVault {
  return new SecretsVault(options);
}
