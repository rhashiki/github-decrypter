import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

for(const file of [
  'packages/context/src/project-memory.ts',
  'apps/local/src/project-memory-store.ts',
  'docs/architecture/PROJECT_MEMORY.md',
  'docs/builds/BUILD_66_PROJECT_MEMORY.md',
  'scripts/architecture-guardian-project-memory.mjs',
  'scripts/test-build66-project-memory-runtime.ts',
  'scripts/test-build66-project-memory-guardian-negative.mjs',
  '.github/workflows/build66-project-memory.yml',
]) assert.ok(fs.existsSync(file),'Build 66 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const contextPackage=json('packages/context/package.json');
const localPackage=json('apps/local/package.json');
assert.ok(policy.currentBuild>=66);
assert.ok(versionBuild(root.version)>=66);
assert.ok(versionBuild(contextPackage.version)>=66);
assert.ok(versionBuild(localPackage.version)>=66);
assert.equal(contextPackage.exports['./project-memory'],'./src/project-memory.ts');
assert.equal(localPackage.dependencies['@github-decrypter/context'],'workspace:*');

const rule=policy.projectMemoryAuthority;
assert.equal(rule.minimumBuild,66);
assert.equal(rule.schema,'gd-project-memory-entry/1');
assert.equal(rule.querySchema,'gd-project-memory-query/1');
assert.equal(rule.databaseSchemaVersion,13);
assert.equal(rule.workspaceScoped,true);
assert.equal(rule.durable,true);
assert.equal(rule.authoritative,false);
assert.equal(rule.architectureLedgerAuthority,false);
assert.equal(rule.productContractAuthority,false);
assert.equal(rule.gitAuthority,false);
assert.equal(rule.validationAuthority,false);
assert.equal(rule.externalTransport,false);
assert.equal(rule.networkAuthority,false);
assert.equal(rule.aiExecution,false);

const source=read('packages/context/src/project-memory.ts');
for(const marker of [
  "'observation'","'finding'","'coverage'","'unresolved-question'","'project-fact'","'decision'","'knowledge-pack'",
  'decision entries require explicit decision provenance',
  'coverage entries require tested or untested coverageStatus',
  'immutableRevision: true',
  'localFirst: true',
]) assert.ok(source.includes(marker),'Missing Project Memory contract marker: '+marker);

const store=read('apps/local/src/project-memory-store.ts');
assert.ok(store.includes('class ProjectMemoryStore'));
assert.ok(store.includes('gd_project_memory_entries'));
assert.ok(!/\bfetch\s*\(|\bWebSocket\b/.test(store));
assert.ok(!/UPDATE\s+gd_project_memory_entries|DELETE\s+FROM\s+gd_project_memory_entries/i.test(store));

const migrations=read('apps/local/src/database-migrations.ts');
assert.ok(migrations.includes('MIGRATION_013_SQL'));
assert.ok(migrations.includes('CREATE TABLE gd_project_memory_entries'));
assert.ok(migrations.includes("name: 'project-memory'"));

const roadmap=read('docs/product/ROADMAP_V1.md');
assert.ok(roadmap.includes('66. **Project Memory** — ✅ — expands into durable **Shared Agent Operational State**'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build66-project-memory-static/1',
  build:66,
  databaseSchemaVersion:13,
  memoryKinds:rule.kinds.length,
  nextBuild:67,
},null,2));
