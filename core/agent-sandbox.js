import { assertSafeRepoPath } from './utils.js';

export const AGENT_SANDBOX_SCHEMA='ld-agent-sandbox/1';
export const AGENT_SANDBOX_DIFF_SCHEMA='ld-agent-sandbox-diff/1';
export const AGENT_SANDBOX_MATERIALIZATION_SCHEMA='ld-agent-sandbox-materialization/1';

const te=new TextEncoder();
const SENSITIVE=/(^|\/)(?:\.git|\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\.json)?|service-account\.json)(?:\/|$)|\.(?:pem|key|p12|pfx|jks|keystore)$/i;
const ALLOWED_ACTIONS=new Set(['create','update','delete','rename']);
const text=(v,max=4000)=>String(v??'').trim().slice(0,max);
const bytes=v=>te.encode(String(v??'')).byteLength;
const err=(code,details={})=>Object.assign(new Error(code),{code,...details});

export function canonicalSandboxPath(path=''){
  let normalized;
  try{normalized=assertSafeRepoPath(String(path||''));}catch{throw err('SANDBOX_PATH_INVALID',{path:String(path||'')});}
  if(!normalized||SENSITIVE.test(normalized))throw err('SANDBOX_SENSITIVE_PATH',{path:normalized});
  return normalized;
}

export function assertSafeSandboxEntry(entry={}){
  const path=canonicalSandboxPath(entry.path);
  const kind=String(entry.kind||entry.type||'file').toLowerCase();
  if(['symlink','hardlink','junction','device','fifo','socket'].includes(kind))throw err('SANDBOX_LINK_OR_SPECIAL_FILE_FORBIDDEN',{path,kind});
  const linkCount=Number(entry.linkCount??entry.nlink??1);
  if(Number.isFinite(linkCount)&&linkCount>1)throw err('SANDBOX_HARDLINK_FORBIDDEN',{path,linkCount});
  if(entry.symlinkTarget||entry.linkTarget)throw err('SANDBOX_SYMLINK_FORBIDDEN',{path});
  return {path,kind:'file',mode:'100644'};
}

export function createSandboxDescriptor({taskId,runtimeId,baseHeadSha,projectId=null,rootHint=''}={}){
  const task=text(taskId,160),runtime=text(runtimeId,120),head=text(baseHeadSha,160);
  if(!task)throw err('SANDBOX_TASK_ID_REQUIRED');
  if(!runtime)throw err('SANDBOX_RUNTIME_ID_REQUIRED');
  if(!head)throw err('SANDBOX_BASE_HEAD_REQUIRED');
  return {
    schema:AGENT_SANDBOX_SCHEMA,
    id:crypto.randomUUID(),taskId:task,runtimeId:runtime,projectId:text(projectId,200)||null,baseHeadSha:head,
    rootHint:text(rootHint,300)||null,status:'created',createdAt:new Date().toISOString(),sealedAt:null,destroyedAt:null,
    isolation:{physicalWorktree:'bridge-required',authoritativeWorkspace:false,authoritativeWrite:false,gitCredentials:false,providerCredentials:false,networkDefault:'deny',processSpawn:'bridge-required'},
    authority:{proposalOnly:true,requiresDiffImport:true,requiresFreshScopeEvaluation:true,requiresHumanApproval:true,writeAuthority:false}
  };
}

export function buildSandboxMaterialization({sandbox,files=[]}={}){
  if(!sandbox?.id||sandbox.schema!==AGENT_SANDBOX_SCHEMA)throw err('SANDBOX_INVALID');
  if(!Array.isArray(files)||!files.length)throw err('SANDBOX_FILES_REQUIRED');
  if(files.length>5000)throw err('SANDBOX_FILE_COUNT_LIMIT');
  let totalBytes=0;
  const seen=new Set();
  const entries=[];
  for(const file of files){
    const safe=assertSafeSandboxEntry(file);
    if(seen.has(safe.path))throw err('SANDBOX_DUPLICATE_PATH',{path:safe.path});
    seen.add(safe.path);
    const content=typeof file.content==='string'?file.content:'';
    const size=bytes(content);
    if(size>2_000_000)throw err('SANDBOX_FILE_SIZE_LIMIT',{path:safe.path});
    totalBytes+=size;
    if(totalBytes>80_000_000)throw err('SANDBOX_TOTAL_SIZE_LIMIT');
    entries.push({...safe,size,content});
  }
  return {schema:AGENT_SANDBOX_MATERIALIZATION_SCHEMA,sandboxId:sandbox.id,taskId:sandbox.taskId,runtimeId:sandbox.runtimeId,baseHeadSha:sandbox.baseHeadSha,entries,totalBytes,readOnlySource:true,authoritativeCredentialsIncluded:false};
}

function normalizeChange(change={}){
  const action=String(change.action||'update').toLowerCase();
  if(!ALLOWED_ACTIONS.has(action))throw err('SANDBOX_DIFF_ACTION_INVALID',{action});
  const path=canonicalSandboxPath(change.path);
  const fromPath=action==='rename'?canonicalSandboxPath(change.fromPath||change.from_path):null;
  if(action==='rename'&&fromPath===path)throw err('SANDBOX_RENAME_NOOP',{path});
  const entryKind=String(change.kind||'file').toLowerCase();
  if(entryKind!=='file')throw err('SANDBOX_DIFF_SPECIAL_FILE_FORBIDDEN',{path,kind:entryKind});
  if(change.symlinkTarget||change.linkTarget||Number(change.linkCount||1)>1)throw err('SANDBOX_DIFF_LINK_FORBIDDEN',{path});
  const content=action==='delete'?null:String(change.content??'');
  if(content!=null&&bytes(content)>2_000_000)throw err('SANDBOX_DIFF_FILE_SIZE_LIMIT',{path});
  return {action,path,fromPath,content};
}

export async function normalizeSandboxDiff({sandbox,taskId,runtimeId,baseHeadSha,changes=[]}={}){
  if(!sandbox?.id||sandbox.schema!==AGENT_SANDBOX_SCHEMA)throw err('SANDBOX_INVALID');
  if(sandbox.status==='destroyed')throw err('SANDBOX_DESTROYED');
  if(String(taskId||'')!==sandbox.taskId)throw err('SANDBOX_TASK_MISMATCH');
  if(String(runtimeId||'')!==sandbox.runtimeId)throw err('SANDBOX_RUNTIME_MISMATCH');
  if(String(baseHeadSha||'')!==sandbox.baseHeadSha)throw err('SANDBOX_BASE_HEAD_MISMATCH');
  if(!Array.isArray(changes)||!changes.length)throw err('SANDBOX_DIFF_EMPTY');
  if(changes.length>256)throw err('SANDBOX_DIFF_FILE_COUNT_LIMIT');
  const normalized=changes.map(normalizeChange);
  const seen=new Set();
  for(const item of normalized){
    const key=`${item.action}:${item.path}:${item.fromPath||''}`;
    if(seen.has(key))throw err('SANDBOX_DIFF_DUPLICATE',{path:item.path});
    seen.add(key);
  }
  const canonical=JSON.stringify({sandboxId:sandbox.id,taskId:sandbox.taskId,runtimeId:sandbox.runtimeId,baseHeadSha:sandbox.baseHeadSha,changes:normalized});
  const digest=await crypto.subtle.digest('SHA-256',te.encode(canonical));
  const proposalDigest=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {schema:AGENT_SANDBOX_DIFF_SCHEMA,sandboxId:sandbox.id,taskId:sandbox.taskId,runtimeId:sandbox.runtimeId,baseHeadSha:sandbox.baseHeadSha,changes:normalized,proposalDigest,proposalOnly:true,writeAuthority:false,requiresFreshScopeEvaluation:true,requiresHumanApproval:true};
}

export function assertSandboxDiffBinding(diff,{sandboxId,taskId,runtimeId,baseHeadSha}={}){
  if(!diff||diff.schema!==AGENT_SANDBOX_DIFF_SCHEMA)throw err('SANDBOX_DIFF_INVALID');
  if(sandboxId&&diff.sandboxId!==sandboxId)throw err('SANDBOX_DIFF_SANDBOX_MISMATCH');
  if(taskId&&diff.taskId!==taskId)throw err('SANDBOX_DIFF_TASK_MISMATCH');
  if(runtimeId&&diff.runtimeId!==runtimeId)throw err('SANDBOX_DIFF_RUNTIME_MISMATCH');
  if(baseHeadSha&&diff.baseHeadSha!==baseHeadSha)throw err('SANDBOX_DIFF_BASE_HEAD_MISMATCH');
  if(diff.writeAuthority!==false||diff.proposalOnly!==true)throw err('SANDBOX_DIFF_AUTHORITY_INVALID');
  return diff;
}

export function transitionSandbox(sandbox,next){
  if(!sandbox?.id||sandbox.schema!==AGENT_SANDBOX_SCHEMA)throw err('SANDBOX_INVALID');
  const allowed={created:['running','destroyed'],running:['sealed','destroyed'],sealed:['destroyed'],destroyed:[]};
  const target=String(next||'');
  if(!(allowed[sandbox.status]||[]).includes(target))throw err('SANDBOX_STATE_TRANSITION_INVALID',{from:sandbox.status,to:target});
  const now=new Date().toISOString();
  return {...sandbox,status:target,sealedAt:target==='sealed'?now:sandbox.sealedAt,destroyedAt:target==='destroyed'?now:sandbox.destroyedAt};
}
