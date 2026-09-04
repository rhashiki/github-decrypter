import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, realpathSync } from 'node:fs';
import { createEventBus } from '../packages/shared/src/index.js';
import { LocalDatabase, LocalRuntimeDaemon, WorkspaceManager, LOCAL_DATABASE_SCHEMA_VERSION, type LocalRuntimeEventCatalog } from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build19-'));
const workspaceRoot = join(tempRoot, 'workspace');
const outsideRoot = join(tempRoot, 'outside');
mkdirSync(workspaceRoot);
mkdirSync(outsideRoot);
mkdirSync(join(workspaceRoot, 'src'));
writeFileSync(join(workspaceRoot, 'src', 'index.ts'), 'export const value = 1;\n');
writeFileSync(join(outsideRoot, 'secret.txt'), 'outside\n');
let nowMs = Date.parse('2026-09-04T01:00:00.000Z');
const now = () => new Date(nowMs).toISOString();

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'workspace.sqlite3'), now });
  const opened = database.open();
  assert.ok(opened.schemaVersion >= 9);
  assert.ok(LOCAL_DATABASE_SCHEMA_VERSION >= 9);
  assert.ok(database.listMigrations().length >= 9);

  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build19-test', now });
  const observed: Array<{ name: string; payload: unknown }> = [];
  for (const name of ['gd.local.workspace.ready', 'gd.local.workspace.registered', 'gd.local.workspace.opened', 'gd.local.workspace.unregistered'] as const) {
    bus.subscribe(name, (event) => {
      observed.push({ name, payload: event.payload });
    });
  }

  const manager = new WorkspaceManager({ database, eventBus: bus, now });
  const initial = await manager.initialize();
  assert.equal(initial.ready, true);
  assert.equal(initial.registered, 0);
  assert.equal(initial.available, 0);
  assert.equal(initial.filesystemMutation, false);
  assert.equal(initial.externalTransport, false);

  const registered = manager.register(workspaceRoot, 'Build 19 Fixture');
  assert.equal(registered.schema, 'gd-workspace/1');
  assert.match(registered.id, /^gd_ws_[0-9a-f-]{36}$/i);
  assert.equal(registered.rootPath, realpathSync(workspaceRoot));
  assert.equal(registered.displayName, 'Build 19 Fixture');
  assert.equal(registered.lastOpenedAt, null);
  assert.equal(manager.status().registered, 1);
  assert.equal(manager.status().available, 1);

  const duplicate = manager.register(join(workspaceRoot, '.'));
  assert.equal(duplicate.id, registered.id);
  assert.equal(manager.list().length, 1);

  nowMs += 1_000;
  const openedWorkspace = manager.open(registered.id);
  assert.equal(openedWorkspace.lastOpenedAt, now());

  assert.equal(manager.resolveExistingPath(registered.id, 'src/index.ts'), realpathSync(join(workspaceRoot, 'src', 'index.ts')));
  assert.throws(() => manager.resolveExistingPath(registered.id, '../outside/secret.txt'), /escapes the registered root/i);
  assert.throws(() => manager.resolveExistingPath(registered.id, join(outsideRoot, 'secret.txt')), /may not be absolute/i);

  let symlinkChecked = false;
  try {
    symlinkSync(outsideRoot, join(workspaceRoot, 'outside-link'), 'dir');
    symlinkChecked = true;
    assert.throws(() => manager.resolveExistingPath(registered.id, 'outside-link/secret.txt'), /outside the registered root/i);
  } catch (error) {
    if (symlinkChecked) throw error;
  }

  assert.equal(manager.unregister(registered.id), true);
  assert.equal(manager.get(registered.id), null);
  assert.equal(existsSync(workspaceRoot), true, 'unregister must not delete the workspace directory');
  assert.equal(existsSync(join(workspaceRoot, 'src', 'index.ts')), true, 'unregister must not delete project files');

  const serializedEvents = JSON.stringify(observed);
  assert.equal(serializedEvents.includes(realpathSync(workspaceRoot)), false, 'workspace events must not expose root paths');
  assert.equal(serializedEvents.includes('Build 19 Fixture'), false, 'workspace events must not expose display names');

  manager.shutdown();
  database.close();

  const daemonRoot = join(tempRoot, 'daemon');
  mkdirSync(daemonRoot);
  const daemon = new LocalRuntimeDaemon({
    config: {
      host: '127.0.0.1',
      port: 0,
      databasePath: join(daemonRoot, 'runtime.sqlite3'),
      lockPath: join(daemonRoot, 'runtime.lock'),
      vaultKeyPath: join(daemonRoot, 'vault.key'),
    },
    now,
  });
  const address = await daemon.start();
  const readiness = await fetch(`${address.origin}/readyz`).then((response) => response.json()) as Record<string, unknown>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.workspaceManagerReady, true);
  assert.equal(readiness.registeredWorkspaces, 0);
  assert.equal(readiness.availableWorkspaces, 0);
  assert.equal(JSON.stringify(readiness).includes(workspaceRoot), false);
  const health = await fetch(`${address.origin}/healthz`).then((response) => response.json()) as { workspaces?: Record<string, unknown> };
  assert.equal(health.workspaces?.ready, true);
  assert.equal(health.workspaces?.filesystemMutation, false);
  assert.equal(health.workspaces?.externalTransport, false);
  await daemon.stop('build19 test complete');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build19-workspace-manager-runtime/2',
    minimumSchemaVersion: 9,
    currentSchemaVersion: opened.schemaVersion,
    registrationIdempotent: true,
    traversalRejected: true,
    symlinkEscapeChecked: symlinkChecked,
    unregisterPreservesFilesystem: true,
    eventMetadataOnly: true,
    daemonReadinessIntegrated: true,
    allowsLaterSchemaMigrations: true,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
