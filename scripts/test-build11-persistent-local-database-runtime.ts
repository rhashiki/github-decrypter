import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  LocalDatabase,
  LocalRuntimeDaemon,
  LOCAL_DATABASE_SCHEMA_VERSION,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';
import { createEventBus } from '../packages/shared/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build11-'));
const databasePath = join(tempRoot, 'runtime.sqlite3');
const lockPath = join(tempRoot, 'runtime.lock');
const config = { host: '127.0.0.1', port: 0, lockPath, databasePath } as const;

try {
  const database = new LocalDatabase({ path: databasePath });
  assert.equal(database.isOpen, false);
  assert.equal(existsSync(databasePath), false);

  const opened = database.open();
  assert.equal(existsSync(databasePath), true);
  assert.equal(opened.open, true);
  assert.equal(opened.schemaVersion, LOCAL_DATABASE_SCHEMA_VERSION);
  assert.equal(opened.schemaVersion, 1);
  assert.equal(opened.journalMode, 'wal');
  assert.equal(opened.foreignKeys, true);
  assert.equal(opened.integrity, 'ok');
  assert.equal(database.listMigrations().length, 1);
  assert.match(database.listMigrations()[0]!.checksum, /^[a-f0-9]{64}$/);

  database.setMetadata('build11.persistence', {
    project: 'github-decrypter',
    build: 11,
    flags: ['persistent', 'local-only'],
  });
  assert.deepEqual(database.getMetadata('build11.persistence'), {
    project: 'github-decrypter',
    build: 11,
    flags: ['persistent', 'local-only'],
  });

  assert.throws(() => database.transaction((sqlite) => {
    sqlite.prepare('INSERT INTO gd_metadata (key, value_json, updated_at) VALUES (?, ?, ?)')
      .run('build11.rollback', JSON.stringify({ shouldPersist: false }), new Date().toISOString());
    throw new Error('force rollback');
  }), /force rollback/);
  assert.equal(database.getMetadata('build11.rollback'), undefined);
  database.close();
  assert.equal(database.isOpen, false);

  const reopened = new LocalDatabase({ path: databasePath });
  reopened.open();
  assert.deepEqual(reopened.getMetadata('build11.persistence'), {
    project: 'github-decrypter',
    build: 11,
    flags: ['persistent', 'local-only'],
  });
  assert.equal(reopened.integrityCheck(), 'ok');
  reopened.close();

  const databaseEvents: string[] = [];
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build11-test' });
  bus.subscribe('gd.local.database.opened', () => {
    databaseEvents.push('opened');
  });
  bus.subscribe('gd.local.database.closed', () => {
    databaseEvents.push('closed');
  });

  const daemon = new LocalRuntimeDaemon({ config, eventBus: bus });
  const address = await daemon.start();
  assert.equal(daemon.database.isOpen, true);
  const healthResponse = await fetch(`${address.origin}/healthz`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json() as Record<string, any>;
  assert.equal(health.build, 11);
  assert.equal(health.version, '0.0.11');
  assert.equal(health.database.open, true);
  assert.equal(health.database.schemaVersion, 1);
  assert.equal(health.database.journalMode, 'wal');
  assert.equal(health.database.foreignKeys, true);
  assert.equal(health.database.integrity, 'ok');

  const ready = await (await fetch(`${address.origin}/readyz`)).json() as Record<string, unknown>;
  assert.equal(ready.ready, true);
  assert.equal(ready.databaseReady, true);

  daemon.database.setMetadata('build11.daemon-persistence', { survivesRestart: true });
  await daemon.stop('Build 11 persistence restart test');
  assert.equal(daemon.database.isOpen, false);
  assert.deepEqual(databaseEvents, ['opened', 'closed']);

  const restarted = new LocalRuntimeDaemon({ config });
  await restarted.start();
  assert.deepEqual(restarted.database.getMetadata('build11.daemon-persistence'), { survivesRestart: true });
  await restarted.stop('Build 11 restart verified');

  const tamper = new DatabaseSync(databasePath);
  tamper.prepare("UPDATE gd_schema_migrations SET checksum = 'tampered' WHERE version = 1").run();
  tamper.close();
  const tampered = new LocalDatabase({ path: databasePath });
  assert.throws(() => tampered.open(), /provenance mismatch/i);

  const futurePath = join(tempRoot, 'future.sqlite3');
  const future = new DatabaseSync(futurePath);
  future.exec('PRAGMA user_version = 999');
  future.close();
  const futureDatabase = new LocalDatabase({ path: futurePath });
  assert.throws(() => futureDatabase.open(), /newer than supported/i);

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build11-persistent-local-database-runtime/1',
    sqlite: true,
    schemaVersion: 1,
    wal: true,
    foreignKeys: true,
    persistenceAcrossReopen: true,
    transactionRollback: true,
    daemonLifecycleIntegration: true,
    migrationProvenanceFailClosed: true,
    futureSchemaFailClosed: true,
    jobSchemaAuthority: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
