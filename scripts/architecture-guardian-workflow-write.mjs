import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.env.GD_WORKFLOW_GUARD_ROOT || process.cwd());
const policy=JSON.parse(fs.readFileSync(path.join(root,'architecture.guardian.json'),'utf8'));
const folder=path.join(root,'.github','workflows');
const violations=[];
if (fs.existsSync(folder)) {
  violations.push({code:'AG070',message:'GitHub automation workflow directory is prohibited.',detail:'.github/workflows'});
}
if (policy.workflow?.enabled !== false
    || (policy.workflow?.writePermissionAllowlist??[]).length !== 0
    || Object.keys(policy.workflow?.writeScopes??{}).length !== 0) {
  violations.push({code:'AG071',message:'Workflow execution or write authorization is prohibited by project policy.'});
}
const report={ok:violations.length===0,schema:'gd-architecture-guardian-workflow-write-report/2',
  currentBuild:policy.currentBuild,githubWorkflowAuthority:false,serverValidationOnly:true,violations};
console.log(JSON.stringify(report,null,2));
if(violations.length)process.exit(1);
