import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/preview/src/index.ts',
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/index.ts',
  'apps/local/src/daemon.ts',
  'docs/product/ROADMAP_V1.md',
];
const originals=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-preview-runtime.mjs';

function restore(){for(const [file,content] of originals)fs.writeFileSync(file,content);}
function run(){return spawnSync(process.execPath,[guardian],{encoding:'utf8'});}
function expectFailure(code,mutate){
  restore(); mutate();
  const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly accepted '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}

try{
  expectFailure('AG703',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.previewRuntimeAuthority.scopeLockRequiredForMutation=false;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG705',()=>{
    fs.writeFileSync('packages/preview/src/index.ts',originals.get('packages/preview/src/index.ts')+"\nvoid fetch('https://example.com');\n");
  });
  expectFailure('AG706',()=>{
    fs.writeFileSync('apps/local/src/preview-browser-adapter.ts',originals.get('apps/local/src/preview-browser-adapter.ts').replace('--remote-debugging-address=127.0.0.1','--remote-debugging-address=0.0.0.0'));
  });
  expectFailure('AG707',()=>{
    fs.writeFileSync('apps/local/src/preview-browser-runtime.ts',originals.get('apps/local/src/preview-browser-runtime.ts').replaceAll('assertScopedResource(', 'bypassScopedResource('));
  });
  expectFailure('AG708',()=>{
    fs.writeFileSync('apps/local/src/index.ts',originals.get('apps/local/src/index.ts')+"\nexport * from './preview-browser-adapter.js';\n");
  });
  expectFailure('AG709',()=>{
    fs.writeFileSync('apps/local/src/preview-browser-runtime.ts',originals.get('apps/local/src/preview-browser-runtime.ts')+"\nconst legacy='core/browser-runtime.js';\n");
  });
  expectFailure('AG712',()=>{
    fs.writeFileSync('docs/product/ROADMAP_V1.md',originals.get('docs/product/ROADMAP_V1.md').replace('68. **Preview Runtime** — ✅ —','68. **Preview Runtime** —'));
  });
}finally{
  restore();
}
const final=run();
assert.equal(final.status,0,'Build 68 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build68-preview-runtime-guardian-negative/1',
  probes:['AG703','AG705','AG706','AG707','AG708','AG709','AG712'],
},null,2));
