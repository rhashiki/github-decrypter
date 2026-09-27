import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/preview/src/index.ts',
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/live-preview-runtime.ts',
  'apps/local/src/index.ts',
  'docs/product/ROADMAP_V1.md',
  'docs/research/BUILD_69_SOURCE_TRIAGE.md',
];
const originals=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-live-preview.mjs';

function restore(){for(const [file,content] of originals)fs.writeFileSync(file,content);}
function run(){return spawnSync(process.execPath,[guardian],{encoding:'utf8'});}
function expectFailure(code,mutate){
  restore(); mutate();
  const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly accepted '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}

try{
  expectFailure('AG722',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.livePreviewAuthority.nativeHmrPreferred=false;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG726',()=>{
    fs.writeFileSync('apps/local/src/live-preview-runtime.ts',originals.get('apps/local/src/live-preview-runtime.ts')+"\nconst forbidden='createChromiumCdpAdapter';\n");
  });
  expectFailure('AG727',()=>{
    fs.writeFileSync('apps/local/src/live-preview-runtime.ts',originals.get('apps/local/src/live-preview-runtime.ts').replace('if (settling.settled)', 'if (true)'));
  });
  expectFailure('AG728',()=>{
    fs.writeFileSync('apps/local/src/live-preview-runtime.ts',originals.get('apps/local/src/live-preview-runtime.ts').replaceAll('assertScopedResource(', 'bypassScopedResource('));
  });
  expectFailure('AG730',()=>{
    fs.writeFileSync('docs/research/BUILD_69_SOURCE_TRIAGE.md',originals.get('docs/research/BUILD_69_SOURCE_TRIAGE.md').replace('Classification: **reference-only**','Classification: **direct-candidate**'));
  });
  expectFailure('AG731',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.previewRuntimeAuthority.secondBrowserRuntimeAllowed=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG732',()=>{
    fs.writeFileSync('docs/product/ROADMAP_V1.md',originals.get('docs/product/ROADMAP_V1.md').replace('69. **Live Preview** — ✅ —','69. **Live Preview** —'));
  });
}finally{
  restore();
}

const final=run();
assert.equal(final.status,0,'Build 69 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build69-live-preview-guardian-negative/1',
  probes:['AG722','AG726','AG727','AG728','AG730','AG731','AG732'],
},null,2));
