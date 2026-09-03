import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));

for (const file of [
  'apps/local/src/config.ts',
  'apps/local/src/identity.ts',
  'apps/local/src/instance-lock.ts',
  'apps/local/src/lifecycle.ts',
  'apps/local/src/server.ts',
  'apps/local/src/daemon.ts',
  'apps/local/src/cli.ts',
  'docs/architecture/LOCAL_RUNTIME_DAEMON.md',
  'docs/builds/BUILD_10_LOCAL_RUNTIME_DAEMON.md',
]) {
  assert.ok(fs.existsSync(file), `Build 10 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
const versionMatch = String(rootPackage.version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
assert.ok(versionMatch, 'root version must remain numeric semver');
const [, major, minor, patch] = versionMatch.map(Number);
assert.ok(major > 0 || minor > 0 || patch >= 10, 'root version must not regress below Build 10');
assert.ok(rootPackage.scripts?.['check:build10'], 'Build 10 regression command is required');

const localPackage = json('apps/local/package.json');
assert.equal(localPackage.name, '@github-decrypter/local');
assert.equal(localPackage.dependencies?.['@github-decrypter/protocol'], 'workspace:*');
assert.equal(localPackage.dependencies?.['@github-decrypter/shared'], 'workspace:*');
assert.equal(localPackage.scripts?.start, 'tsx src/cli.ts');

const config = read('apps/local/src/config.ts');
assert.ok(config.includes("DEFAULT_LOCAL_RUNTIME_HOST = '127.0.0.1'"));
assert.ok(config.includes('assertLoopbackHost'));

const server = read('apps/local/src/server.ts');
for (const route of ['/healthz', '/readyz', '/v1/handshake']) {
  assert.ok(server.includes(route), `Build 10 route missing: ${route}`);
}
assert.ok(server.includes('gd-local-health/1'));
assert.ok(server.includes('handshake.accept'));
assert.ok(server.includes('handshake.reject'));

const daemon = read('apps/local/src/daemon.ts');
assert.ok(daemon.includes('class LocalRuntimeDaemon'));
assert.ok(daemon.includes('acquireLocalRuntimeInstanceLock'));
assert.ok(daemon.includes("publish('gd.local.lifecycle'"));

const cli = read('apps/local/src/cli.ts');
assert.ok(cli.includes('SIGINT'));
assert.ok(cli.includes('SIGTERM'));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build10-local-runtime-daemon/1',
  authority: '@github-decrypter/local',
  loopbackOnly: true,
  endpoints: ['/healthz', '/readyz', '/v1/handshake'],
  persistentDatabaseAuthority: false,
  jobEngineAuthority: false,
  capabilitySecurityAuthority: false,
}, null, 2));
