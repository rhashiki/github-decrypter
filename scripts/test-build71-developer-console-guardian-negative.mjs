import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/preview/src/index.ts',
  'apps/local/src/developer-console-runtime.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/preview-telemetry.ts',
  'docs/product/ROADMAP_V1.md',
  'docs/research/BUILD_71_SOURCE_TRIAGE.md',
];
const originals=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-developer-console.mjs';

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
  expectFailure('AG762',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.developerConsoleAuthority.secondCollectorAllowed=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG765',()=>{
    fs.writeFileSync(
      'apps/local/src/developer-console-runtime.ts',
      originals.get('apps/local/src/developer-console-runtime.ts')+"\nconst forbidden='CdpClient Network.enable';\n",
    );
  });
  expectFailure('AG766',()=>{
    fs.writeFileSync(
      'apps/local/src/developer-console-runtime.ts',
      originals.get('apps/local/src/developer-console-runtime.ts')+"\nconst requestHeaders = {};\n",
    );
  });
  expectFailure('AG767',()=>{
    fs.writeFileSync(
      'apps/local/src/developer-console-runtime.ts',
      originals.get('apps/local/src/developer-console-runtime.ts')+"\nconst forbidden='writeFile';\n",
    );
  });
  expectFailure('AG768',()=>{
    fs.writeFileSync(
      'apps/local/src/preview-browser-runtime.ts',
      originals.get('apps/local/src/preview-browser-runtime.ts').replace(
        'developerConsole.createToolRegistrations(scopeLock)',
        '[]',
      ),
    );
  });
  expectFailure('AG770',()=>{
    fs.writeFileSync(
      'docs/research/BUILD_71_SOURCE_TRIAGE.md',
      originals.get('docs/research/BUILD_71_SOURCE_TRIAGE.md').replace(
        'Classification: **direct-candidate — selective protocol/data-model patterns only**',
        'Classification: **reference-only**',
      ),
    );
  });
  expectFailure('AG771',()=>{
    fs.writeFileSync(
      'docs/product/ROADMAP_V1.md',
      originals.get('docs/product/ROADMAP_V1.md').replace(
        '71. **Developer Console** — ✅',
        '71. **Developer Console**',
      ),
    );
  });
}finally{
  restore();
}

const final=run();
assert.equal(final.status,0,'Build 71 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build71-developer-console-guardian-negative/1',
  probes:['AG762','AG765','AG766','AG767','AG768','AG770','AG771'],
},null,2));
