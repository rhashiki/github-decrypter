import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/diagnostics/package.json',
  'packages/diagnostics/src/index.ts',
  'apps/local/package.json',
  'apps/local/src/problems-diagnostics-runtime.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'apps/local/src/index.ts',
  'docs/product/ROADMAP_V1.md',
  'docs/research/BUILD_72_SOURCE_TRIAGE.md',
];
const originals=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]));
const guardian='scripts/architecture-guardian-problems-diagnostics.mjs';

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
  expectFailure('AG783',()=>{
    const policy=JSON.parse(originals.get('architecture.guardian.json'));
    policy.problemsDiagnosticsAuthority.rootCauseAuthority=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(policy,null,2)+'\n');
  });
  expectFailure('AG785',()=>{
    fs.writeFileSync(
      'packages/diagnostics/src/index.ts',
      originals.get('packages/diagnostics/src/index.ts')+"\nvoid fetch('https://example.com');\n",
    );
  });
  expectFailure('AG787',()=>{
    fs.writeFileSync(
      'apps/local/src/problems-diagnostics-runtime.ts',
      originals.get('apps/local/src/problems-diagnostics-runtime.ts')+"\nconst forbidden='CdpClient Network.enable';\n",
    );
  });
  expectFailure('AG788',()=>{
    fs.writeFileSync(
      'apps/local/src/problems-diagnostics-runtime.ts',
      originals.get('apps/local/src/problems-diagnostics-runtime.ts')+"\nconst forbidden='writeFile sqlite';\n",
    );
  });
  expectFailure('AG789',()=>{
    fs.writeFileSync(
      'packages/diagnostics/src/index.ts',
      originals.get('packages/diagnostics/src/index.ts').replaceAll('rootCauseAuthority: false','rootCauseAuthority: true'),
    );
  });
  expectFailure('AG790',()=>{
    fs.writeFileSync(
      'apps/local/src/preview-browser-runtime.ts',
      originals.get('apps/local/src/preview-browser-runtime.ts').replace(
        'problemsDiagnostics.createToolRegistrations(scopeLock)',
        '[]',
      ),
    );
  });
  expectFailure('AG792',()=>{
    fs.writeFileSync(
      'docs/research/BUILD_72_SOURCE_TRIAGE.md',
      originals.get('docs/research/BUILD_72_SOURCE_TRIAGE.md').replace(
        'Classification: **direct-candidate — selective problem normalization/source-correlation patterns only**',
        'Classification: **reference-only**',
      ),
    );
  });
  expectFailure('AG793',()=>{
    fs.writeFileSync(
      'docs/product/ROADMAP_V1.md',
      originals.get('docs/product/ROADMAP_V1.md').replace(
        '72. **Problems & Diagnostics** — ✅ —',
        '72. **Problems & Diagnostics** —',
      ),
    );
  });
}finally{
  restore();
}

const final=run();
assert.equal(final.status,0,'Build 72 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,
  schema:'gd-build72-problems-diagnostics-guardian-negative/1',
  probes:['AG783','AG785','AG787','AG788','AG789','AG790','AG792','AG793'],
},null,2));
