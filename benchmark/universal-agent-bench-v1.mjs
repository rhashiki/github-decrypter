import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  createSandboxDescriptor,
  buildSandboxMaterialization,
  normalizeSandboxDiff,
  assertSandboxDiffBinding,
  transitionSandbox
} from '../core/agent-sandbox.js';
import {
  createNativeAgentSession,
  bindNativeProposal,
  verifyNativeResume,
  verifyProposalBinding,
  switchNativeRuntime,
  closeNativeSession
} from '../core/native-agent-sessions.js';
import {
  listAgentRuntimeDefinitions,
  normalizeRuntimeEvent,
  planPromptTransport
} from '../core/agent-runtime-registry.js';
import { evaluateScopeIntelligence } from '../core/scope-intelligence-v2.js';
import { evaluateAccountIntegrationReadiness } from '../core/account-integration-readiness.js';
import { sanitizeDurableSettings } from '../storage/secret-sanitizer.js';

export const UNIVERSAL_AGENT_BENCH_SCHEMA='ld-universal-agent-bench/1';
export const UNIVERSAL_AGENT_BENCH_BUILD=75;

const cases=[];
const assert=(value,message='assertion failed')=>{if(!value)throw new Error(message);};
const expects=(fn,code)=>{
  try{fn();}catch(error){if(!code||error?.code===code)return error;throw new Error(`expected ${code}, got ${error?.code||error}`);}
  throw new Error(`expected rejection ${code||''}`);
};
const expectsAsync=async(fn,code)=>{
  try{await fn();}catch(error){if(!code||error?.code===code)return error;throw new Error(`expected ${code}, got ${error?.code||error}`);}
  throw new Error(`expected rejection ${code||''}`);
};
async function probe(name,category,fn){
  const started=performance.now();
  try{await fn();cases.push({name,category,ok:true,ms:Number((performance.now()-started).toFixed(2))});}
  catch(error){cases.push({name,category,ok:false,ms:Number((performance.now()-started).toFixed(2)),error:String(error?.message||error),code:error?.code||null});}
}

function readyFixture(){
  return {
    projectId:'lovable-project',
    settings:{
      auth:{licenseKey:'LD-TEST',deviceId:'device-1'},
      github:{},supabase:{},
      projectMappings:{'lovable-project':{owner:'acme',repo:'app',installationId:42}},
      supabaseMappings:{'lovable-project':{projectRef:'project-ref',projectName:'App DB'}}
    },
    githubStatus:{app_configured:true,connected:true,installation:{id:42,account_login:'acme'},repositories:[{full_name:'acme/app'}]},
    supabaseStatus:{app_configured:true,connected:true,reauthorize_required:false,missing_scopes:[],projects:[{ref:'project-ref',name:'App DB'}]}
  };
}

export async function runUniversalAgentBench(){
  cases.length=0;

  await probe('malformed-sandbox-action','malformed-actions',async()=>{
    const sandbox=createSandboxDescriptor({taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'});
    await expectsAsync(()=>normalizeSandboxDiff({sandbox,taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1',changes:[{action:'execute',path:'src/a.js',content:'x'}]}),'SANDBOX_DIFF_ACTION_INVALID');
  });

  await probe('sandbox-path-traversal','sandbox-escape',async()=>{
    const sandbox=createSandboxDescriptor({taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'});
    expects(()=>buildSandboxMaterialization({sandbox,files:[{path:'../outside.txt',content:'x'}]}),'SANDBOX_PATH_INVALID');
  });

  await probe('sandbox-sensitive-git-env','sandbox-escape',async()=>{
    const sandbox=createSandboxDescriptor({taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'});
    for(const path of ['.git/config','.env','keys/private.pem'])expects(()=>buildSandboxMaterialization({sandbox,files:[{path,content:'x'}]}));
  });

  await probe('sandbox-symlink-hardlink','sandbox-escape',async()=>{
    const sandbox=createSandboxDescriptor({taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'});
    expects(()=>buildSandboxMaterialization({sandbox,files:[{path:'src/link',kind:'symlink',content:'x'}]}),'SANDBOX_LINK_OR_SPECIAL_FILE_FORBIDDEN');
    expects(()=>buildSandboxMaterialization({sandbox,files:[{path:'src/hard',kind:'file',linkCount:2,content:'x'}]}),'SANDBOX_HARDLINK_FORBIDDEN');
  });

  await probe('sandbox-stale-head','stale-approval',async()=>{
    const sandbox=transitionSandbox(createSandboxDescriptor({taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'}),'running');
    await expectsAsync(()=>normalizeSandboxDiff({sandbox,taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-2',changes:[{action:'update',path:'src/a.js',content:'x'}]}),'SANDBOX_BASE_HEAD_MISMATCH');
  });

  await probe('sandbox-cross-agent-mismatch','cross-agent',async()=>{
    const sandbox=transitionSandbox(createSandboxDescriptor({taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'}),'running');
    await expectsAsync(()=>normalizeSandboxDiff({sandbox,taskId:'t1',runtimeId:'aider',baseHeadSha:'head-1',changes:[{action:'update',path:'src/a.js',content:'x'}]}),'SANDBOX_RUNTIME_MISMATCH');
  });

  await probe('sandbox-diff-authority-tamper','tool-runtime-bypass',async()=>{
    const sandbox=transitionSandbox(createSandboxDescriptor({taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'}),'running');
    const diff=await normalizeSandboxDiff({sandbox,taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1',changes:[{action:'update',path:'src/a.js',content:'x'}]});
    expects(()=>assertSandboxDiffBinding({...diff,writeAuthority:true},{sandboxId:sandbox.id,taskId:'t1',runtimeId:'codex-cli',baseHeadSha:'head-1'}),'SANDBOX_DIFF_AUTHORITY_INVALID');
  });

  await probe('native-proposal-digest-mismatch','digest-mismatch',async()=>{
    let session=createNativeAgentSession({taskId:'t1',runtimeId:'codex-cli',strategy:'cli-resume',nativeSessionId:'s1'});
    session=bindNativeProposal(session,'a'.repeat(64));
    expects(()=>verifyProposalBinding(session,{proposalDigest:'b'.repeat(64),generation:1,runtimeId:'codex-cli',nativeSessionId:'s1'}),'NATIVE_SESSION_PROPOSAL_MISMATCH');
  });

  await probe('runtime-switch-invalidates-approval','stale-approval',async()=>{
    let session=createNativeAgentSession({taskId:'t1',runtimeId:'codex-cli',strategy:'cli-resume',nativeSessionId:'s1'});
    session=bindNativeProposal(session,'a'.repeat(64));
    const switched=switchNativeRuntime(session,{runtimeId:'opencode',strategy:'acp-session-load',nativeSessionId:'s2'});
    assert(switched.approvalInvalidated===true,'approval must be invalidated');
    assert(switched.proposalDigest===null,'proposal digest must be cleared');
    expects(()=>verifyProposalBinding(switched,{proposalDigest:'a'.repeat(64),generation:1,runtimeId:'codex-cli',nativeSessionId:'s1'}));
  });

  await probe('native-session-replay-generation','session-replay',async()=>{
    let session=createNativeAgentSession({taskId:'t1',runtimeId:'codex-cli',strategy:'cli-resume',nativeSessionId:'s1'});
    session=switchNativeRuntime(session,{runtimeId:'codex-cli',strategy:'cli-resume',nativeSessionId:'s2'});
    expects(()=>verifyNativeResume(session,{taskId:'t1',runtimeId:'codex-cli',nativeSessionId:'s1',generation:1}));
    assert(session.replayAllowed===false&&session.replayAuthority===false,'replay must remain disabled');
  });

  await probe('closed-session-cannot-resume','runtime-crash',async()=>{
    const closed=closeNativeSession(createNativeAgentSession({taskId:'t1',runtimeId:'opencode',strategy:'acp-session-load',nativeSessionId:'s1'}));
    expects(()=>verifyNativeResume(closed,{taskId:'t1',runtimeId:'opencode',nativeSessionId:'s1',generation:1}),'NATIVE_SESSION_CLOSED');
  });

  await probe('outside-approved-plan','scope-creep',async()=>{
    const report=evaluateScopeIntelligence({command:'Ajuste somente src/App.tsx',approvedPlan:{files:[{path:'src/App.tsx',action:'update',reason:'ajuste solicitado'}]},files:[{path:'src/App.tsx',action:'update',before:'a',content:'b'},{path:'src/extra.ts',action:'update',before:'x',content:'y'}]});
    assert(report.allowed===false,'extra file must fail closed');
    assert(report.violations.some(v=>v.code==='outside-approved-plan'&&v.path==='src/extra.ts'),'outside plan violation missing');
  });

  await probe('unauthorized-delete-and-rename','scope-creep',async()=>{
    const report=evaluateScopeIntelligence({command:'Ajuste src/a.ts',approvedPlan:{files:[{path:'src/a.ts',action:'update',reason:'ajuste'}]},files:[{path:'src/a.ts',action:'delete',before:'x',content:''},{path:'src/b.ts',action:'rename',before:'',content:''}]});
    assert(report.allowed===false,'delete/rename must be rejected');
    assert(report.violations.some(v=>v.code==='delete-intent-missing'),'delete intent violation missing');
    assert(report.violations.some(v=>v.code==='invalid-action'||v.code==='outside-approved-plan'),'rename violation missing');
  });

  await probe('user-edit-outranks-agent','human-intent',async()=>{
    const now=Date.now();
    const recent=[1,2].map(i=>({id:`edit-${i}`,origin:'user',observedAt:new Date(now-i*1000).toISOString(),paths:['src/App.tsx'],evidence:['manual edit']}));
    const report=evaluateScopeIntelligence({command:'Melhore a página',approvedPlan:{files:[{path:'src/App.tsx',action:'update',reason:'melhoria'}]},files:[{path:'src/App.tsx',action:'update',before:'a',content:'b'}],recentUserEdits:recent,now});
    assert(report.allowed===false,'strong human intent must block generic agent edit');
    assert(report.humanIntent.policy==='USER_EDIT > AI_EDIT');
    assert(report.violations.some(v=>v.code==='human-intent-override-required'));
  });

  await probe('durable-secret-sanitization','credential-persistence',async()=>{
    const dirty={github:{token:'pat',installationToken:'install',privateKey:'pem'},supabase:{anonKey:'anon',managementToken:'mgmt',refreshToken:'refresh',clientSecret:'secret'},nested:{serviceRoleKey:'role',databasePassword:'db'}};
    const clean=sanitizeDurableSettings(dirty);
    const serialized=JSON.stringify(clean).toLowerCase();
    for(const secret of ['pat','install','pem','anon','mgmt','refresh','secret','role','db'])assert(!serialized.includes(`:${JSON.stringify(secret).toLowerCase()}`),`secret leaked: ${secret}`);
    assert(clean.github.token==='');
    assert(clean.supabase.managementToken==='');
  });

  await probe('prompt-batch-expansion-blocked','prompt-transport',async()=>{
    expects(()=>planPromptTransport({runtimeId:'codex-cli',transportId:'cli',platform:'win32',executable:'agent.cmd',requested:'argv',prompt:'Show %USERPROFILE% safely'}),'AGENT_PROMPT_ENV_EXPANSION_RISK');
  });

  await probe('prompt-size-bound','prompt-transport',async()=>{
    expects(()=>planPromptTransport({runtimeId:'codex-cli',transportId:'cli',requested:'argv',prompt:'x'.repeat(1_048_577)}),'AGENT_PROMPT_TOO_LARGE');
  });

  await probe('runtime-events-omit-raw-reasoning','runtime-events',async()=>{
    const event=normalizeRuntimeEvent('opencode',{type:'message',message:'safe result',reasoning:'private chain',raw:{secret:true}});
    assert(event.text==='safe result');
    assert(event.reasoningOmitted===true&&event.rawOmitted===true);
    assert(!('reasoning' in event)&&!('raw' in event));
    assert(event.writeAuthority===false);
  });

  await probe('all-runtime-adapters-proposal-only','tool-runtime-bypass',async()=>{
    const runtimes=listAgentRuntimeDefinitions();
    assert(runtimes.length>=5,'runtime registry unexpectedly small');
    for(const runtime of runtimes){
      assert(runtime.capabilities.writeAuthority===false,`${runtime.id} capability write authority`);
      assert(runtime.authority.canWriteAuthoritative===false,`${runtime.id} authoritative writer`);
      assert(runtime.authority.requiresDecrypterApproval===true,`${runtime.id} bypasses approval`);
    }
  });

  await probe('github-revocation-fails-closed','provider-revocation',async()=>{
    const fixture=readyFixture();
    fixture.githubStatus={...fixture.githubStatus,connected:false,repositories:[]};
    const result=evaluateAccountIntegrationReadiness(fixture);
    assert(result.ready===false&&result.github.ready===false);
    assert(result.reasons.some(r=>r.code==='GITHUB_ACCOUNT_REQUIRED'));
  });

  await probe('github-repository-revocation-fails-closed','provider-revocation',async()=>{
    const fixture=readyFixture();
    fixture.githubStatus={...fixture.githubStatus,repositories:[]};
    const result=evaluateAccountIntegrationReadiness(fixture);
    assert(result.ready===false&&result.github.repositoryAuthorized===false);
    assert(result.reasons.some(r=>r.code==='GITHUB_REPOSITORY_NOT_AUTHORIZED'));
  });

  await probe('supabase-revocation-fails-closed','provider-revocation',async()=>{
    const fixture=readyFixture();
    fixture.supabaseStatus={...fixture.supabaseStatus,connected:false,projects:[]};
    const result=evaluateAccountIntegrationReadiness(fixture);
    assert(result.ready===false&&result.supabase.ready===false);
    assert(result.reasons.some(r=>r.code==='SUPABASE_ACCOUNT_REQUIRED'));
  });

  await probe('supabase-scope-revocation-fails-closed','provider-revocation',async()=>{
    const fixture=readyFixture();
    fixture.supabaseStatus={...fixture.supabaseStatus,missing_scopes:['database:write'],reauthorize_required:true};
    const result=evaluateAccountIntegrationReadiness(fixture);
    assert(result.ready===false);
    assert(result.reasons.some(r=>r.code==='SUPABASE_REAUTHORIZE_REQUIRED'));
  });

  await probe('zero-paid-remote-fallback-static','zero-cost',async()=>{
    const settings=fs.readFileSync('settings/config.js','utf8');
    const guard=fs.readFileSync('content/zero-cost-runtime-guard.js','utf8');
    const registry=fs.readFileSync('core/agent-runtime-registry.js','utf8');
    assert(/paidFallbackAllowed:false/.test(settings),'paid fallback enabled in settings');
    assert(/remoteFallbackAllowed:false/.test(settings),'remote fallback enabled in settings');
    assert(/paidFallbackAllowed:false/.test(registry),'local registry paid fallback invariant missing');
    assert(/remoteFallbackAllowed:false/.test(registry),'local registry remote fallback invariant missing');
    assert(/zero-cost|zeroCost|paid/i.test(guard),'zero-cost guard missing');
  });

  const passed=cases.filter(item=>item.ok).length;
  const failed=cases.length-passed;
  const categories={};
  for(const item of cases){const bucket=categories[item.category]??={total:0,passed:0,failed:0};bucket.total++;bucket[item.ok?'passed':'failed']++;}
  return {schema:UNIVERSAL_AGENT_BENCH_SCHEMA,build:UNIVERSAL_AGENT_BENCH_BUILD,total:cases.length,passed,failed,categories,cases:[...cases]};
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  const result=await runUniversalAgentBench();
  console.log(JSON.stringify(result,null,2));
  if(result.failed)process.exitCode=1;
}
