import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/context/package.json',
  'apps/local/package.json',
  'packages/context/src/final-context.ts',
  'apps/local/src/product-contract-store.ts',
  'apps/local/src/database-migrations.ts',
  'apps/local/src/daemon.ts',
  'docs/product/ROADMAP_V1.md',
];
const originals=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-final-context.mjs';

function restore(){for(const [file,content] of originals)fs.writeFileSync(file,content);}
function run(){return spawnSync(process.execPath,[guardian],{encoding:'utf8'});}
function expectFailure(code,mutate){
  restore(); mutate();
  const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly accepted '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}

try{
  expectFailure('AG683',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.finalContextEngineAuthority.wholesaleContextDump=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG685',()=>{
    fs.writeFileSync('packages/context/src/final-context.ts',originals.get('packages/context/src/final-context.ts')+"\nvoid fetch('https://example.com');\n");
  });
  expectFailure('AG686',()=>{
    fs.writeFileSync('packages/context/src/final-context.ts',originals.get('packages/context/src/final-context.ts')+"\nconst legacy='core/context-engine-v2.js';\n");
  });
  expectFailure('AG688',()=>{
    fs.writeFileSync('apps/local/src/product-contract-store.ts',originals.get('apps/local/src/product-contract-store.ts')+"\nconst forbidden='UPDATE gd_product_contract_revisions SET contract_json = ?';\n");
  });
  expectFailure('AG689',()=>{
    fs.writeFileSync('apps/local/src/database-migrations.ts',originals.get('apps/local/src/database-migrations.ts').replace('CREATE TABLE gd_product_contract_revisions','CREATE TABLE gd_product_contract_broken'));
  });
  expectFailure('AG691',()=>{
    fs.writeFileSync('docs/product/ROADMAP_V1.md',originals.get('docs/product/ROADMAP_V1.md').replace('67. **Context Engine vFinal** — ✅ —','67. **Context Engine vFinal** —'));
  });
}finally{
  restore();
}

const final=run();
assert.equal(final.status,0,'Build 67 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build67-context-engine-final-guardian-negative/1',
  probes:['AG683','AG685','AG686','AG688','AG689','AG691'],
},null,2));
