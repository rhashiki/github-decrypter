import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/ai/package.json',
  'packages/ai/src/agent-runtime.ts',
  'packages/ai/src/architecture-contract.ts',
  'packages/ai/src/heimdall.ts',
  'packages/ai/src/agent-orchestrator.ts',
  'apps/studio/src/viktor-session.ts',
  'docs/architecture/ARCHITECTURAL_INTEGRITY.md',
];
const originals=new Map(files.map(file=>[file,fs.readFileSync(file,'utf8')]));

function restore(){for(const [file,content] of originals)fs.writeFileSync(file,content);}
function run(){return spawnSync(process.execPath,['scripts/architecture-guardian-agent-orchestrator.mjs'],{encoding:'utf8'});}
function expectFailure(code,mutate){
  restore(); mutate();
  const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly passed '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}

try{
  expectFailure('AG620',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.currentBuild=63;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG621',()=>{
    const p=JSON.parse(originals.get('packages/ai/package.json'));
    delete p.exports['./agent-orchestrator'];
    fs.writeFileSync('packages/ai/package.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG622',()=>{
    fs.writeFileSync('packages/ai/src/agent-runtime.ts',originals.get('packages/ai/src/agent-runtime.ts').replace("name: 'Heimdall'","name: 'HeimdallBroken'"));
  });
  expectFailure('AG623',()=>{
    fs.writeFileSync('packages/ai/src/architecture-contract.ts',originals.get('packages/ai/src/architecture-contract.ts').replace('canonicalProjectArchitecture:true','canonicalProjectArchitecture:false'));
  });
  expectFailure('AG624',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.heimdallAuthority.architectureEnforcementAuthority=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG625',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.agentOrchestratorAuthority.toolExecution=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG626',()=>{
    fs.writeFileSync('packages/ai/src/heimdall.ts',originals.get('packages/ai/src/heimdall.ts')+"\nimport 'node:fs';\n");
  });
  expectFailure('AG627',()=>{
    fs.writeFileSync('apps/studio/src/viktor-session.ts',originals.get('apps/studio/src/viktor-session.ts')+"\nvoid localStorage;\n");
  });
  expectFailure('AG628',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.reviewAgentAuthority.vetoAuthority=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG629',()=>{
    fs.writeFileSync('docs/architecture/ARCHITECTURAL_INTEGRITY.md','# drifted\n');
  });
}finally{
  restore();
}

const final=run();
assert.equal(final.status,0,'Build 64 Guardian did not return green after restoration:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,schema:'gd-build64-agent-orchestrator-guardian-negative/1',
  probes:['AG620','AG621','AG622','AG623','AG624','AG625','AG626','AG627','AG628','AG629'],
},null,2));
