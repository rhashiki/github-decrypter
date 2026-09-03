import {
  closeSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lockUser = typeof process.getuid === 'function' ? String(process.getuid()) : 'user';
const INVALID_LOCK_GRACE_MS = 5_000;

export const DEFAULT_LOCAL_RUNTIME_LOCK_PATH = join(
  tmpdir(),
  `github-decrypter-local-runtime-${lockUser}.lock`,
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
    // A writer may still be filling a newly-created exclusive lock.
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

function invalidLockIsOldEnoughToRecover(path: string): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs >= INVALID_LOCK_GRACE_MS;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return true;
    throw error;
  }
}

function conflict(message: string, code: string): Error {
  const error = new Error(message);
  (error as NodeJS.ErrnoException).code = code;
  return error;
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
        throw conflict(
          `GitHub Decrypter Local Runtime is already running with PID ${existing.pid}.`,
          'EADDRINUSE',
        );
      }

      if (!existing && !invalidLockIsOldEnoughToRecover(path)) {
        throw conflict('GitHub Decrypter Local Runtime lock is currently being acquired.', 'EAGAIN');
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
