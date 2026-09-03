export const DEFAULT_LOCAL_RUNTIME_HOST = '127.0.0.1' as const;
export const DEFAULT_LOCAL_RUNTIME_PORT = 43110;
export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export interface LocalRuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly lockPath?: string;
  readonly databasePath?: string;
}

export function assertLoopbackHost(host: string): void {
  if (host !== '127.0.0.1' && host !== '::1') {
    throw new TypeError('GitHub Decrypter Local Runtime may bind only to a loopback address.');
  }
}

export function parseLocalRuntimePort(value: string | number | undefined): number {
  if (value === undefined || value === '') return DEFAULT_LOCAL_RUNTIME_PORT;
  const port = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new TypeError('Local Runtime port must be an integer between 0 and 65535.');
  }
  return port;
}

export function localRuntimeConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LocalRuntimeConfig {
  const host = env.GD_LOCAL_HOST?.trim() || DEFAULT_LOCAL_RUNTIME_HOST;
  assertLoopbackHost(host);
  return {
    host,
    port: parseLocalRuntimePort(env.GD_LOCAL_PORT),
    ...(env.GD_LOCAL_LOCK_PATH?.trim() ? { lockPath: env.GD_LOCAL_LOCK_PATH.trim() } : {}),
    ...(env.GD_LOCAL_DB_PATH?.trim() ? { databasePath: env.GD_LOCAL_DB_PATH.trim() } : {}),
  };
}
