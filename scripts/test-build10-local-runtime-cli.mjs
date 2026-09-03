import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';

const root = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build10-cli-'));
const lockPath = join(tempRoot, 'runtime.lock');
const child = spawn(process.execPath, ['--import', 'tsx', 'apps/local/src/cli.ts'], {
  cwd: root,
  env: {
    ...process.env,
    GD_LOCAL_HOST: '127.0.0.1',
    GD_LOCAL_PORT: '0',
    GD_LOCAL_LOCK_PATH: lockPath,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => { stderr += chunk; });

function waitForStarted() {
  return new Promise((resolve, reject) => {
    const lines = readline.createInterface({ input: child.stdout });
    const timer = setTimeout(() => {
      lines.close();
      reject(new Error(`Timed out waiting for daemon CLI startup. stderr=${stderr}`));
    }, 10_000);

    lines.on('line', (line) => {
      if (!line.includes('gd-local-runtime-started/1')) return;
      try {
        const payload = JSON.parse(line);
        clearTimeout(timer);
        lines.close();
        resolve(payload);
      } catch (error) {
        clearTimeout(timer);
        lines.close();
        reject(error);
      }
    });

    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Daemon exited before startup. code=${code} signal=${signal} stderr=${stderr}`));
    });
  });
}

function waitForExit() {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

try {
  const started = await waitForStarted();
  assert.equal(started.schema, 'gd-local-runtime-started/1');
  assert.equal(started.build, 10);
  assert.equal(started.version, '0.0.10');
  assert.match(started.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.ok(existsSync(lockPath));

  const healthResponse = await fetch(`${started.origin}/healthz`);
  assert.equal(healthResponse.status, 200);

  const exiting = waitForExit();
  assert.equal(child.kill('SIGTERM'), true);
  const exit = await Promise.race([
    exiting,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Daemon did not exit after SIGTERM.')), 10_000)),
  ]);
  assert.equal(exit.code, 0, `daemon CLI exited non-zero; stderr=${stderr}`);
  assert.equal(existsSync(lockPath), false, 'daemon CLI must remove lock during SIGTERM shutdown');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build10-local-runtime-cli/1',
    separateProcess: true,
    healthReachable: true,
    sigtermGraceful: true,
    lockReleased: true,
  }, null, 2));
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  rmSync(tempRoot, { recursive: true, force: true });
}
