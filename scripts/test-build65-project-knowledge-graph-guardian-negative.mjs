import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const files=[
  'architecture.guardian.json',
  'packages/context/package.json',
  'packages/context/src/knowledge-graph.ts',
  'docs/architecture/PROJECT_KNOWLEDGE_GRAPH.md',
  'docs/builds/BUILD_65_PROJECT_KNOWLEDGE_GRAPH.md',
];
const originals=new Map(files.map(file=>[file,fs.readFileSync(file,'utf8')]));
const restore=()=>{for(const [file,content] of originals) fs.writeFileSync(file,content);};
const run=()=>spawnSync(process.execPath,['scripts/architecture-guardian-knowledge-graph.mjs'],{encoding:'utf8'});
function expectFailure(code,mutate){
  restore(); mutate();
  const result=run();
  assert.notEqual(result.status,0,'Guardian unexpectedly accepted '+code);
  assert.match(result.stdout+'\n'+result.stderr,new RegExp(code));
}

try{
  expectFailure('AG651',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.currentBuild=64;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG652',()=>{
    const p=JSON.parse(originals.get('packages/context/package.json'));
    delete p.exports['./knowledge-graph'];
    fs.writeFileSync('packages/context/package.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG653',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.knowledgeGraphAuthority.queryMaxDepth=99;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG655',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.knowledgeGraphAuthority.persistence=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
  expectFailure('AG656',()=>{
    fs.writeFileSync('packages/context/src/knowledge-graph.ts',originals.get('packages/context/src/knowledge-graph.ts').replace('wholesaleContextDump:false','wholesaleContextDump:true'));
  });
  expectFailure('AG657',()=>{
    fs.writeFileSync('packages/context/src/knowledge-graph.ts',originals.get('packages/context/src/knowledge-graph.ts')+'\nvoid fetch;\n');
  });
  expectFailure('AG658',()=>{
    fs.writeFileSync('docs/architecture/PROJECT_KNOWLEDGE_GRAPH.md','# drifted\n');
  });
  expectFailure('AG659',()=>{
    const p=JSON.parse(originals.get('architecture.guardian.json'));
    p.economicDoctrine.vortexManagedPaidInferenceAllowed=true;
    fs.writeFileSync('architecture.guardian.json',JSON.stringify(p,null,2)+'\n');
  });
}finally{restore();}

const final=run();
assert.equal(final.status,0,'Build 65 Guardian did not recover after probes:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({
  ok:true,schema:'gd-build65-project-knowledge-graph-guardian-negative/1',
  probes:['AG651','AG652','AG653','AG655','AG656','AG657','AG658','AG659'],
},null,2));
