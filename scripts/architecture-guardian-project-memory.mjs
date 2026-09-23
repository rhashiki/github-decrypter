import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const exists=(file)=>fs.existsSync(file);
const violations=[];
const fail=(code,message,detail=undefined)=>violations.push({code,message,...(detail===undefined?{}:{detail})});
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

const required=[
  'architecture.guardian.json',
  'package.json',
  'packages/context/package.json',
  'packages/context/src/project-memory.ts',
  'apps/local/package.json',
  'apps/local/src/project-memory-store.ts',
  'apps/local/src/database-migrations.ts',
  'docs/architecture/PROJECT_MEMORY.md',
  'docs/builds/BUILD_66_PROJECT_MEMORY.md',
  'scripts/test-build66-project-memory.mjs',
  'scripts/test-build66-project-memory-runtime.ts',
  'scripts/test-build66-project-memory-guardian-negative.mjs',
  'scripts/tsconfig.build66-tests.json',
  '.github/workflows/build66-project-memory.yml',
];
for(const file of required) if(!exists(file)) fail('AG660','Required Build 66 artifact is missing.',file);

if(required.every(exists)){
  const policy=json('architecture.guardian.json');
  const root=json('package.json');
  const contextPackage=json('packages/context/package.json');
  const localPackage=json('apps/local/package.json');
  const contract=read('packages/context/src/project-memory.ts');
  const store=read('apps/local/src/project-memory-store.ts');
  const daemon=read('apps/local/src/daemon.ts');
  const migrations=read('apps/local/src/database-migrations.ts');
  const roadmap=read('docs/product/ROADMAP_V1.md');
  const rule=policy.projectMemoryAuthority||{};

  if(policy.currentBuild<66||versionBuild(root.version)<66||versionBuild(contextPackage.version)<66||versionBuild(localPackage.version)<66){
    fail('AG661','Build 66 version/build authority is not active.');
  }
  if(contextPackage.exports?.['./project-memory']!=='./src/project-memory.ts'){
    fail('AG662','Project Memory contract export is missing.');
  }
  if(localPackage.dependencies?.['@github-decrypter/context']!=='workspace:*'){
    fail('AG663','Local Runtime must consume the Project Memory contract through @github-decrypter/context.');
  }

  for(const [key,expected] of Object.entries({
    minimumBuild:66,
    schema:'gd-project-memory-entry/1',
    querySchema:'gd-project-memory-query/1',
    databaseSchemaVersion:13,
    workspaceScoped:true,
    durable:true,
    localFirst:true,
    immutableRevisions:true,
    sourceReferencesRequired:true,
    decisionProvenanceRequired:true,
    compiledKnowledgePacks:true,
    authoritative:false,
    architectureLedgerAuthority:false,
    productContractAuthority:false,
    gitAuthority:false,
    validationAuthority:false,
    capabilityAuthority:false,
    approvalAuthority:false,
    externalTransport:false,
    networkAuthority:false,
    aiExecution:false,
  })){
    if(rule[key]!==expected) fail('AG664','Project Memory authority drifted: '+key,{expected,actual:rule[key]});
  }

  for(const marker of [
    "PROJECT_MEMORY_SCHEMA = 'gd-project-memory-entry/1'",
    "'observation'","'finding'","'coverage'","'unresolved-question'","'project-fact'","'decision'","'knowledge-pack'",
    'decision entries require explicit decision provenance',
    'authoritative: false',
    "truthRole: 'operational-memory'",
    'architectureLedgerAuthority: false',
    'productContractAuthority: false',
    'gitAuthority: false',
    'validationAuthority: false',
  ]) if(!contract.includes(marker)) fail('AG665','Project Memory contract marker is missing.',marker);

  for(const marker of [
    'class ProjectMemoryStore',
    'gd_project_memory_entries',
    'supersedes_id',
    'Project Memory cannot supersede an entry from another workspace.',
    'Project Memory supersession must preserve entry kind.',
    'externalTransport: false',
  ]) if(!store.includes(marker)) fail('AG666','Project Memory Store marker is missing.',marker);

  for(const marker of [
    "createProjectMemoryStore",
    "readonly projectMemory?: ProjectMemoryStore",
    "readonly #projectMemory: ProjectMemoryStore",
    "get projectMemory(): ProjectMemoryStore",
    "const projectMemoryStatus = this.#projectMemory.initialize()",
    "this.#projectMemory.shutdown()",
    "#closeProjectMemoryBestEffort()",
  ]) if(!daemon.includes(marker)) fail('AG666','Project Memory is not integrated into the Local Runtime lifecycle.',marker);

  if(/\bfetch\s*\(|\bWebSocket\b|https?:\/\//.test(store)){
    fail('AG667','Project Memory Store gained forbidden network transport.');
  }
  if(/UPDATE\s+gd_project_memory_entries|DELETE\s+FROM\s+gd_project_memory_entries/i.test(store)){
    fail('AG668','Project Memory Store gained mutable/destructive memory SQL.');
  }

  for(const marker of [
    'MIGRATION_013_SQL',
    'CREATE TABLE gd_project_memory_entries',
    "CHECK (kind IN ('observation', 'finding', 'coverage', 'unresolved-question', 'project-fact', 'decision', 'knowledge-pack'))",
    "CHECK (authoritative = 0)",
    "CHECK (truth_role = 'operational-memory')",
    "name: 'project-memory'",
  ]) if(!migrations.includes(marker)) fail('AG669','Project Memory migration marker is missing.',marker);

  if(policy.databaseAuthority?.projectMemorySchemaBuild!==66||policy.databaseAuthority?.projectMemorySchemaVersion!==13){
    fail('AG670','Database authority does not bind Project Memory to Build 66 / schema 13.');
  }

  if(!roadmap.includes('66. **Project Memory** — ✅ — expands into durable **Shared Agent Operational State**')){
    fail('AG671','Canonical roadmap does not mark Build 66 Project Memory complete.');
  }

  const server=exists('apps/local/src/server.ts')?read('apps/local/src/server.ts'):'';
  if(/\/v1\/(?:project-)?memory/i.test(server)){
    fail('AG672','Project Memory external transport arrived in Build 66.');
  }
}

console.log(JSON.stringify({
  ok:violations.length===0,
  schema:'gd-architecture-guardian-project-memory-report/1',
  build:66,
  violations,
},null,2));
if(violations.length>0) process.exit(1);
