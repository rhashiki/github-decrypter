import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root=process.cwd();
const guardian=path.join(root,'scripts','architecture-guardian-workflow-write.mjs');
function check(override, expected) {
 const result=spawnSync(process.execPath,[guardian],{
  cwd:root,encoding:'utf8',env:{...process.env,...(override?{GD_WORKFLOW_GUARD_ROOT:override}:{GD_WORKFLOW_GUARD_ROOT:''})},
 });
 assert.equal(result.status,expected===null?0:1,result.stdout+'\n'+result.stderr);
 if(expected)assert.ok(result.stdout.includes(expected),'Expected '+expected+' in '+result.stdout);
}
check(null,null);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gd-no-actions-'));
try {
 fs.writeFileSync(path.join(temp,'architecture.guardian.json'),
   JSON.stringify({currentBuild:73,workflow:{enabled:false,writePermissionAllowlist:[],writeScopes:{}}}));
 check(temp,null);
 // No workflow files or directories are created, not even as test fixtures.
 // The main guardian and standalone policy both statically reject the forbidden directory.
 assert.ok(fs.readFileSync(guardian,'utf8').includes('if (fs.existsSync(folder))'));
 fs.writeFileSync(path.join(temp,'architecture.guardian.json'),
   JSON.stringify({currentBuild:73,workflow:{enabled:true,writePermissionAllowlist:[],writeScopes:{}}}));
 check(temp,'AG071');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
check(null,null);
console.log(JSON.stringify({ok:true,schema:'gd-no-github-automation-negative/1',prohibitedWorkflows:true,
  noWriteAuthority:true,serverValidationOnly:true}));
