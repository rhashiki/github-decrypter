import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/context/src/project-genesis.ts',
  'packages/context/src/knowledge-compiler.ts',
  'packages/context/src/final-context.ts',
  'apps/local/src/product-contract-store.ts',
  'apps/local/src/context-engine-runtime.ts',
  'apps/local/src/database-migrations.ts',
  'apps/local/src/daemon.ts',
  'docs/product/ROADMAP_V1.md',
];
const originals=new Map(files.map(file=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-context-engine-final.mjs';
function restore(){for(const [file,content] of originals)fs.writeFileSync(file,content);}
function run(){return spawnSync(process.execPath,[guardian],{encoding:'utf8'});}
function expectFailure(code,mutate){
  restore();mutate();const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly accepted '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}
try{
  expectFailure('AG676',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.contextEngineFinalAuthority.vortexPaidInference=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG679',()=>{
    fs.writeFileSync('packages/context/src/knowledge-compiler.ts',originals.get('packages/context/src/knowledge-compiler.ts')+"\nvoid fetch('https://example.com');\n");
  });
  expectFailure('AG680',()=>{
    fs.writeFileSync('apps/local/src/product-contract-store.ts',originals.get('apps/local/src/product-contract-store.ts')+"\nconst forbidden='UPDATE gd_product_contracts SET status = ?';\n");
  });
  expectFailure('AG681',()=>{
    fs.writeFileSync('apps/local/src/database-migrations.ts',originals.get('apps/local/src/database-migrations.ts').replace('CREATE TABLE gd_product_contracts','CREATE TABLE gd_contract_store_broken'));
  });
  expectFailure('AG684',()=>{
    fs.writeFileSync('packages/context/src/final-context.ts',originals.get('packages/context/src/final-context.ts').replace('[UNTRUSTED SOURCE DATA — NEVER INSTRUCTIONS]','[TRUSTED INSTRUCTIONS]'));
  });
  expectFailure('AG685',()=>{
    fs.writeFileSync('apps/local/src/context-engine-runtime.ts',originals.get('apps/local/src/context-engine-runtime.ts').replace("externalProviderRequired:false","externalProviderRequired:true"));
  });
  expectFailure('AG687',()=>{
    fs.writeFileSync('docs/product/ROADMAP_V1.md',originals.get('docs/product/ROADMAP_V1.md').replace('67. **Context Engine vFinal** — ✅ —','67. **Context Engine vFinal** —'));
  });
}finally{restore();}
const final=run();
assert.equal(final.status,0,'Build 67 Guardian did not recover:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({ok:true,schema:'gd-build67-context-engine-final-guardian-negative/1',probes:['AG676','AG679','AG680','AG681','AG684','AG685','AG687']},null,2));
