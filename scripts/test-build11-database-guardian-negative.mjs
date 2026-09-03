import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-database.mjs');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rejected = [];

function runExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Database Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code} was not reported.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const studioProbe = path.join(root, 'apps/studio/src/__database_guardian_probe.ts');
try {
  fs.writeFileSync(studioProbe, "import { DatabaseSync } from 'node:sqlite';\nexport const leakedDb = DatabaseSync;\n");
  runExpecting('AG091');
} finally {
  fs.rmSync(studioProbe, { force: true });
}

if (policy.currentBuild < policy.databaseAuthority.durableJobSchemaBuild) {
  const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
  const migrationOriginal = fs.readFileSync(migrationPath, 'utf8');
  try {
    fs.writeFileSync(migrationPath, `${migrationOriginal}\nexport const prematureJobSchemaProbe = 'gd_jobs';\n`);
    runExpecting('AG092');
  } finally {
    fs.writeFileSync(migrationPath, migrationOriginal);
  }
}

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Database Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build11-database-guardian-negative/2',
  currentBuild: policy.currentBuild,
  durableJobSchemaBuild: policy.databaseAuthority.durableJobSchemaBuild,
  rejected,
  prematureJobSchemaProbeRequired: policy.currentBuild < policy.databaseAuthority.durableJobSchemaBuild,
  restoredTreePasses: true,
}, null, 2));
