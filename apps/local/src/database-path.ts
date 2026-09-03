import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

export const LOCAL_DATABASE_FILENAME = 'runtime.sqlite3' as const;

export function defaultLocalRuntimeDataDirectory(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home = homedir(),
): string {
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim();
    return localAppData
      ? join(localAppData, 'GitHub Decrypter')
      : join(home, 'AppData', 'Local', 'GitHub Decrypter');
  }

  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'GitHub Decrypter');
  }

  const xdgDataHome = env.XDG_DATA_HOME?.trim();
  return xdgDataHome
    ? join(xdgDataHome, 'github-decrypter')
    : join(home, '.local', 'share', 'github-decrypter');
}

export function resolveLocalDatabasePath(
  explicitPath?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = explicitPath?.trim() || env.GD_LOCAL_DB_PATH?.trim();
  if (configured) return resolve(configured);

  const configuredDataDir = env.GD_LOCAL_DATA_DIR?.trim();
  const dataDir = configuredDataDir
    ? resolve(configuredDataDir)
    : defaultLocalRuntimeDataDirectory(env);
  return join(dataDir, LOCAL_DATABASE_FILENAME);
}

export function ensureLocalDatabaseParent(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
}
