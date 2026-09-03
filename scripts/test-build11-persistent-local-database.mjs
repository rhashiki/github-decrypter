import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));

for (const file of [
  'apps/local/src/database-path.ts',
  'apps/local/src/database-migrations.ts',
  'apps/local/src/database.ts',
  'scripts/architecture-guardian-database.mjs',
  'scripts/test-build11-persistent-local-database-runtime.ts',
  'docs/architecture/PERSISTENT_LOCAL_DATABASE.md',
  'docs/builds/BUILD_11_PERSISTENT_LOCAL_DATABASE.md',
]) {
  assert.ok(fs.existsSync(file), `Build 11 artifact missing: ${file}`);
}

const rootPackage = json('package.json');
assert.equal(rootPackage.version, '0.0.11');
assert.ok(rootPackage.scripts?.guardian?.includes('architecture-guardian-database.mjs'));
assert.ok(rootPackage.scripts?.['check:build11']);

const localPackage = json('apps/local/package.json');
assert.equal(localPackage.version, '0.0.11');
assert.equal(localPackage.dependencies?.['@github-decrypter/protocol'], 'workspace:*');
assert.equal(localPackage.dependencies?.['@github-decrypter/shared'], 'workspace:*');
assert.equal(Object.keys(localPackage.dependencies ?? {}).length, 2, 'Build 11 must not add external DB dependencies');

const policy = json('architecture.guardian.json');
assert.equal(policy.currentBuild, 11);
assert.equal(policy.phaseGates.persistentLocalDatabaseBuild, 11);
assert.equal(policy.phaseGates.durableJobEngineBuild, 12);
assert.equal(policy.databaseAuthority.ownerRoot, 'apps/local');
assert.equal(policy.databaseAuthority.engineImport, 'node:sqlite');
assert.equal(policy.databaseAuthority.durableJobSchemaBuild, 12);

const database = read('apps/local/src/database.ts');
for (const marker of [
  "from 'node:sqlite'",
  'PRAGMA journal_mode = WAL',
  'PRAGMA foreign_keys = ON',
  'PRAGMA trusted_schema = OFF',
  'PRAGMA quick_check',
  'BEGIN IMMEDIATE',
  'ROLLBACK',
  'provenance mismatch',
]) {
  assert.ok(database.includes(marker), `database guarantee missing: ${marker}`);
}

const migrations = read('apps/local/src/database-migrations.ts');
assert.ok(migrations.includes('gd_schema_migrations'));
assert.ok(migrations.includes('gd_metadata'));
assert.ok(migrations.includes('STRICT'));
assert.ok(!/\bgd_(?:jobs?|job_|queue|checkpoints?)\b/i.test(migrations), 'Build 11 must not create Durable Job Engine schema');

const server = read('apps/local/src/server.ts');
assert.ok(server.includes('databaseReady'));
assert.ok(server.includes('schemaVersion'));
assert.ok(!server.includes('/v1/database'), 'Build 11 must not expose generic database RPC');
assert.ok(!server.includes('/v1/sql'), 'Build 11 must not expose SQL RPC');

const identity = read('apps/local/src/identity.ts');
assert.ok(identity.includes("'persistent-sqlite'"));
assert.ok(identity.includes("'schema-migrations'"));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build11-persistent-local-database/1',
  build: 11,
  authority: 'apps/local',
  engine: 'node:sqlite',
  schemaVersion: 1,
  externalDatabaseDependency: false,
  genericDatabaseRpc: false,
  durableJobSchema: false,
}, null, 2));
