import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/preview/src/index.ts',
  'apps/local/src/preview-telemetry.ts',
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/preview-bridge-runtime.ts',
  'apps/local/src/index.ts',
  'docs/product/ROADMAP_V1.md',
  'docs/research/BUILD_70_SOURCE_TRIAGE.md',
];
const originals=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-preview-bridge.mjs';

function restore(){for(const [file,content] of originals)fs.writeFileSync(file,content);}
function run(){return spawnSync(process.execPath,[guardian],{encoding:'utf8'});}
function expectFailure(code,mutate){
  restore();
  mutate();
  const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly accepted '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}

try{
  expectFailure('AG742',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.previewBridgeAuthority.requestHeadersCaptured=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG744',()=>{
    fs.writeFileSync(
      'apps/local/src/preview-telemetry.ts',
      originals.get('apps/local/src/preview-telemetry.ts').replace("parsed.searchParams.append(key, '[redacted]')","parsed.searchParams.append(key, 'raw')"),
    );
  });
  expectFailure('AG745',()=>{
    fs.writeFileSync(
      'apps/local/src/preview-browser-adapter.ts',
      originals.get('apps/local/src/preview-browser-adapter.ts').replace("Runtime.consoleAPICalled","Runtime.consoleMissing"),
    );
  });
  expectFailure('AG747',()=>{
    fs.writeFileSync(
      'apps/local/src/preview-bridge-runtime.ts',
      originals.get('apps/local/src/preview-bridge-runtime.ts').replace("requiredCapabilities: Object.freeze(['READ'] as const)","requiredCapabilities: Object.freeze(['EXECUTE'] as const)"),
    );
  });
  expectFailure('AG748',()=>{
    fs.writeFileSync('apps/local/src/preview-bridge-runtime.ts',originals.get('apps/local/src/preview-bridge-runtime.ts')+"\nconst forbidden='createChromiumCdpAdapter';\n");
  });
  expectFailure('AG749',()=>{
    fs.writeFileSync('apps/local/src/preview-telemetry.ts',originals.get('apps/local/src/preview-telemetry.ts')+"\nconst forbidden='requestHeaders';\n");
  });
  expectFailure('AG752',()=>{
    fs.writeFileSync(
      'docs/research/BUILD_70_SOURCE_TRIAGE.md',
      originals.get('docs/research/BUILD_70_SOURCE_TRIAGE.md').replace('Classification: **reference-only**','Classification: **direct-candidate**'),
    );
  });
  expectFailure('AG754',()=>{
    fs.writeFileSync(
      'docs/product/ROADMAP_V1.md',
      originals.get('docs/product/ROADMAP_V1.md').replace('70. **Preview Bridge** — ✅ —','70. **Preview Bridge** —'),
    );
  });
}finally{
  restore();
}

const final=run();
assert.equal(final.status,0,'Build 70 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build70-preview-bridge-guardian-negative/1',
  probes:['AG742','AG744','AG745','AG747','AG748','AG749','AG752','AG754'],
},null,2));
