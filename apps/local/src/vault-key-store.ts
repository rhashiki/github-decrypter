import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export const LOCAL_VAULT_KEY_FILENAME = 'vault.key' as const;
export const LOCAL_VAULT_KEY_BYTES = 32;
export const LOCAL_VAULT_KEY_BACKEND = 'local-key-file-v1' as const;

export interface LocalVaultKeyStoreOptions {
  readonly databasePath: string;
  readonly path?: string;
}

export interface LocalVaultKeyStatus {
  readonly ready: boolean;
  readonly backend: typeof LOCAL_VAULT_KEY_BACKEND;
  readonly fingerprint: string;
  readonly permissionsHardened: boolean;
}

export function resolveLocalVaultKeyPath(databasePath: string, explicitPath?: string): string {
  const configured = explicitPath?.trim();
  if (configured) return resolve(configured);
  return join(dirname(resolve(databasePath)), LOCAL_VAULT_KEY_FILENAME);
}

function hardenedPermissions(path: string): boolean {
  if (process.platform === 'win32') return true;
  const mode = statSync(path).mode & 0o777;
  return (mode & 0o077) === 0;
}

export class LocalVaultKeyStore {
  readonly #path: string;
  #key: Buffer | null = null;
  #status: LocalVaultKeyStatus | null = null;

  constructor(options: LocalVaultKeyStoreOptions) {
    this.#path = resolveLocalVaultKeyPath(options.databasePath, options.path);
  }

  get path(): string {
    return this.#path;
  }

  get status(): LocalVaultKeyStatus | null {
    return this.#status;
  }

  initialize(): LocalVaultKeyStatus {
    if (this.#key && this.#status) return this.#status;

    mkdirSync(dirname(this.#path), { recursive: true, mode: 0o700 });
    if (!existsSync(this.#path)) {
      const generated = randomBytes(LOCAL_VAULT_KEY_BYTES);
      try {
        writeFileSync(this.#path, generated, { flag: 'wx', mode: 0o600 });
      } finally {
        generated.fill(0);
      }
    }

    if (!hardenedPermissions(this.#path)) {
      throw new Error('Secrets Vault key file permissions are too broad; expected owner-only access.');
    }

    if (process.platform !== 'win32') {
      chmodSync(this.#path, 0o600);
    }

    const key = readFileSync(this.#path);
    if (key.byteLength !== LOCAL_VAULT_KEY_BYTES) {
      key.fill(0);
      throw new Error(`Secrets Vault key file must contain exactly ${LOCAL_VAULT_KEY_BYTES} bytes.`);
    }

    const fingerprint = createHash('sha256').update(key).digest('hex');
    this.#key = key;
    this.#status = Object.freeze({
      ready: true,
      backend: LOCAL_VAULT_KEY_BACKEND,
      fingerprint,
      permissionsHardened: true,
    });
    return this.#status;
  }

  withKey<T>(operation: (key: Buffer) => T): T {
    if (!this.#key) throw new Error('Secrets Vault key store is not initialized.');
    const copy = Buffer.from(this.#key);
    try {
      return operation(copy);
    } finally {
      copy.fill(0);
    }
  }

  close(): void {
    this.#key?.fill(0);
    this.#key = null;
    this.#status = null;
  }
}

export function createLocalVaultKeyStore(options: LocalVaultKeyStoreOptions): LocalVaultKeyStore {
  return new LocalVaultKeyStore(options);
}
