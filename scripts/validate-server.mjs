import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const version=JSON.parse(readFileSync(resolve(root,'architecture.guardian.json'),'utf8')).currentBuild;
const targeted=process.argv.includes('--build73') || process.argv.includes('--current');
if(process.argv.includes('--build73') && version!==73){console.error('Build 73 validation requires Build 73 checkout.');process.exit(2);}
const jobs=[
 ['No GitHub automation',process.execPath,['scripts/architecture-guardian-workflow-write.mjs']],
 ['Architecture checks', 'pnpm',['run','guardian']],
 ['Build '+version+' tests','pnpm',['run','check:build'+version]],
 ...(version>=73?[['Code Intelligence TypeScript','pnpm',['--filter','@github-decrypter/code-intelligence','run','typecheck']]]:[]),
 ['Local Runtime TypeScript','pnpm',['--filter','@github-decrypter/local','run','typecheck']],
 ['Studio TypeScript','pnpm',['--filter','@github-decrypter/studio','run','typecheck']],
 ['Studio production bundle','pnpm',['--filter','@github-decrypter/studio','run','build']],
];
if(!targeted) jobs.splice(2,1,['Historical regression suite','pnpm',['run','ci']]);
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
const report={schema:'gd-server-validation/1',build:version,executedLocally:true,
 usesGitHubActions:false,scope:targeted?'current-build':'full-regression',
 ok:results.every(x=>x.ok),results};
const reportPath=resolve(root,'reports','server-validation-'+version+'.json');
mkdirSync(resolve(root,'reports'),{recursive:true});
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({...report,reportPath},null,2));
if(!results.every(x=>x.ok))process.exit(1);
