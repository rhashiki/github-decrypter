import {spawnSync} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const targeted=process.argv.includes('--build73');
const jobs=[
 ['No GitHub automation',process.execPath,['scripts/architecture-guardian-workflow-write.mjs']],
 ['Architecture checks', 'pnpm',['run','guardian']],
 ['Build 73 tests','pnpm',['run','check:build73']],
 ['Code Intelligence TypeScript','pnpm',['--filter','@github-decrypter/code-intelligence','run','typecheck']],
 ['Local Runtime TypeScript','pnpm',['--filter','@github-decrypter/local','run','typecheck']],
 ['Studio TypeScript','pnpm',['--filter','@github-decrypter/studio','run','typecheck']],
 ['Studio production bundle','pnpm',['--filter','@github-decrypter/studio','run','build']],
];
if(!targeted) jobs.splice(3,0,['Historical regression suite','pnpm',['run','ci']]);
if(existsSync(resolve(root,'.github','workflows'))){
 console.error('Forbidden GitHub workflow directory exists.');process.exit(1);
}
const results=[];
for(const [label,binary,args] of jobs){
 const start=Date.now();
 process.stdout.write('\n=== '+label+' ===\n');
 const run=spawnSync(binary,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32',
  env:{...process.env,CI:'1',GD_WORKFLOW_GUARD_ROOT:''},timeout:45*60*1000});
 const ok=run.status===0 && !run.error;
 results.push({label,ok,durationMs:Date.now()-start,status:run.status,error:run.error?.message??null});
 if(!ok)break;
}
console.log(JSON.stringify({schema:'gd-server-validation/1',build:73,executedLocally:true,
 usesGitHubActions:false,scope:targeted?'build73':'full-regression',ok:results.every(x=>x.ok),results},null,2));
if(!results.every(x=>x.ok))process.exit(1);
