import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_LOCAL_RUNTIME_LOCK_PATH = join(
  tmpdir(),
  'github-decrypter-local-runtime.lock',
);

export interface LocalRuntimeLockRecord {
  readonly schema: 'gd-local-runtime-lock/1';
  readonly pid: number;
  readonly createdAt: string;
}

export interface LocalRuntimeInstanceLock {
  readonly path: string;
  readonly record: LocalRuntimeLockRecord;
  release(): void;
}

function pidIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'EPERM';
  }
}

function readExistingRecord(path: string): LocalRuntimeLockRecord | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<LocalRuntimeLockRecord>;
    if (
      parsed.schema === 'gd-local-runtime-lock/1'
      && Number.isSafeInteger(parsed.pid)
      && typeof parsed.pid === 'number'
      && parsed.pid > 0
      && typeof parsed.createdAt === 'string'
    ) {
      return parsed as LocalRuntimeLockRecord;
    }
  } catch {
    // Invalid or concurrently removed lock files are treated as stale below.
  }
  return null;
}

function removeStaleLock(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
  }
}

export function acquireLocalRuntimeInstanceLock(
  path = DEFAULT_LOCAL_RUNTIME_LOCK_PATH,
  now: () => string = () => new Date().toISOString(),
): LocalRuntimeInstanceLock {
  const attempt = (): LocalRuntimeInstanceLock => {
    let fd: number;
    try {
      fd = openSync(path, 'wx', 0o600);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;

      const existing = readExistingRecord(path);
      if (existing && pidIsAlive(existing.pid)) {
        const conflict = new Error(`GitHub Decrypter Local Runtime is already running with PID ${existing.pid}.`);
        (conflict as NodeJS.ErrnoException).code = 'EADDRINUSE';
        throw conflict;
      }

      removeStaleLock(path);
      return attempt();
    }

    const record: LocalRuntimeLockRecord = {
      schema: 'gd-local-runtime-lock/1',
      pid: process.pid,
      createdAt: now(),
    };

    try {
      writeFileSync(fd, `${JSON.stringify(record)}\n`, { encoding: 'utf8' });
    } finally {
      closeSync(fd);
    }

    let released = false;
    return {
      path,
      record,
      release() {
        if (released) return;
        released = true;
        const current = readExistingRecord(path);
        if (current?.pid !== record.pid || current?.createdAt !== record.createdAt) return;
        removeStaleLock(path);
      },
    };
  };

  return attempt();
}
