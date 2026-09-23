import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/context/package.json',
  'apps/local/package.json',
  'packages/context/src/project-memory.ts',
  'apps/local/src/project-memory-store.ts',
  'apps/local/src/database-migrations.ts',
  'docs/product/ROADMAP_V1.md',
];
const originals=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-project-memory.mjs';

function restore(){for(const [file,content] of originals)fs.writeFileSync(file,content);}
function run(){return spawnSync(process.execPath,[guardian],{encoding:'utf8'});}
function expectFailure(code,mutate){
  restore(); mutate();
  const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly accepted '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}

try{
  expectFailure('AG664',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.projectMemoryAuthority.validationAuthority=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG667',()=>{
    fs.writeFileSync('apps/local/src/project-memory-store.ts',originals.get('apps/local/src/project-memory-store.ts')+"\nvoid fetch('https://example.com');\n");
  });
  expectFailure('AG668',()=>{
    fs.writeFileSync('apps/local/src/project-memory-store.ts',originals.get('apps/local/src/project-memory-store.ts')+"\nconst forbidden='UPDATE gd_project_memory_entries SET statement = ?';\n");
  });
  expectFailure('AG669',()=>{
    fs.writeFileSync('apps/local/src/database-migrations.ts',originals.get('apps/local/src/database-migrations.ts').replace('CREATE TABLE gd_project_memory_entries','CREATE TABLE gd_project_memory_store_broken'));
  });
  expectFailure('AG671',()=>{
    fs.writeFileSync('docs/product/ROADMAP_V1.md',originals.get('docs/product/ROADMAP_V1.md').replace('66. **Project Memory** — ✅ —','66. **Project Memory** —'));
  });
}finally{
  restore();
}

const final=run();
assert.equal(final.status,0,'Build 66 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,schema:'gd-build66-project-memory-guardian-negative/1',
  probes:['AG664','AG667','AG668','AG669','AG671'],
},null,2));
