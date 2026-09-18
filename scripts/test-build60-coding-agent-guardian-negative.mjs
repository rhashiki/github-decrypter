import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const policyPath = 'architecture.guardian.json';
const aiPackagePath = 'packages/ai/package.json';
const sourcePath = 'packages/ai/src/coding-agent.ts';
const localIndexPath = 'apps/local/src/index.ts';
const architectureDocPath = 'docs/architecture/CODING_AGENT.md';
const originals = new Map([
  [policyPath, fs.readFileSync(policyPath, 'utf8')],
  [aiPackagePath, fs.readFileSync(aiPackagePath, 'utf8')],
  [sourcePath, fs.readFileSync(sourcePath, 'utf8')],
  [localIndexPath, fs.readFileSync(localIndexPath, 'utf8')],
  [architectureDocPath, fs.readFileSync(architectureDocPath, 'utf8')],
]);
function runGuardian(){ return spawnSync(process.execPath,['scripts/architecture-guardian-coding-agent.mjs'],{encoding:'utf8'}); }
function restore(){ for(const [file,content] of originals) fs.writeFileSync(file,content); }
function expectFailure(code,mutate){ restore(); mutate(); const result=runGuardian(); assert.notEqual(result.status,0); assert.match(result.stdout+'\n'+result.stderr,new RegExp(code)); }

try {
  expectFailure('AG580',()=>{ const p=JSON.parse(originals.get(policyPath)); p.currentBuild=59; fs.writeFileSync(policyPath,JSON.stringify(p,null,2)+'\n'); });
  expectFailure('AG581',()=>{ const p=JSON.parse(originals.get(aiPackagePath)); delete p.exports['./coding-agent']; fs.writeFileSync(aiPackagePath,JSON.stringify(p,null,2)+'\n'); });
  expectFailure('AG582',()=>{ fs.writeFileSync(sourcePath,originals.get(sourcePath).replaceAll('executeCodingAgent(','executeCodingAgentBroken(')); });
  expectFailure('AG583',()=>{ fs.writeFileSync(sourcePath,originals.get(sourcePath).replaceAll('createToolRuntime(','createToolRuntimeBroken(')); });
  expectFailure('AG584',()=>{ fs.writeFileSync(sourcePath,originals.get(sourcePath)+"\nfetch('https://example.invalid');\n"); });
  expectFailure('AG585',()=>{ const p=JSON.parse(originals.get(policyPath)); p.codingAgentAuthority.allowedCapabilities.push('DATABASE_WRITE'); fs.writeFileSync(policyPath,JSON.stringify(p,null,2)+'\n'); });
  expectFailure('AG586',()=>{ const p=JSON.parse(originals.get(policyPath)); p.codingAgentAuthority.databaseAgentBuild=60; fs.writeFileSync(policyPath,JSON.stringify(p,null,2)+'\n'); });
  expectFailure('AG587',()=>{ const p=JSON.parse(originals.get(policyPath)); p.toolRuntimeAuthority.capabilityGrantAuthority=true; fs.writeFileSync(policyPath,JSON.stringify(p,null,2)+'\n'); });
  expectFailure('AG588',()=>{ fs.writeFileSync(localIndexPath,originals.get(localIndexPath)+"\nexport * from '@github-decrypter/ai/coding-agent';\n"); });
  expectFailure('AG589',()=>{ fs.writeFileSync(architectureDocPath,'# drifted\n'); });
} finally { restore(); }

const final=runGuardian();
assert.equal(final.status,0,'Guardian did not return green after restoration:\n'+final.stdout+'\n'+final.stderr);
console.log(JSON.stringify({ok:true,schema:'gd-build60-coding-agent-guardian-negative/1',probes:['AG580','AG581','AG582','AG583','AG584','AG585','AG586','AG587','AG588','AG589']},null,2));
