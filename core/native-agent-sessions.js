export const NATIVE_AGENT_SESSION_SCHEMA='ld-native-agent-session/1';
export const RUNTIME_SELECTION_SCHEMA='ld-runtime-selection/1';
export const NATIVE_AGENT_STRATEGIES=Object.freeze(['none','cli-resume','stream-capture','acp-session-load','remote-conversation']);

const STRATEGIES=new Set(NATIVE_AGENT_STRATEGIES);
const text=(v,max=4000)=>String(v??'').trim().slice(0,max);
const err=(code,details={})=>Object.assign(new Error(code),{code,...details});

function strategy(value='none'){
  const out=String(value||'none');
  if(!STRATEGIES.has(out))throw err('NATIVE_SESSION_STRATEGY_INVALID',{strategy:out});
  return out;
}
function assertSession(session){
  if(!session||session.schema!==NATIVE_AGENT_SESSION_SCHEMA||!session.id)throw err('NATIVE_SESSION_INVALID');
  if(session.writeAuthority!==false||session.replayAuthority!==false)throw err('NATIVE_SESSION_AUTHORITY_INVALID');
  return session;
}

export function createNativeAgentSession({taskId,runtimeId,strategy:sessionStrategy='none',nativeSessionId=null}={}){
  const task=text(taskId,160),runtime=text(runtimeId,120),nativeId=text(nativeSessionId,500)||null;
  if(!task)throw err('NATIVE_SESSION_TASK_REQUIRED');
  if(!runtime)throw err('NATIVE_SESSION_RUNTIME_REQUIRED');
  const selectedStrategy=strategy(sessionStrategy);
  if(selectedStrategy!=='none'&&!nativeId)throw err('NATIVE_SESSION_ID_REQUIRED');
  const now=new Date().toISOString();
  return {
    schema:NATIVE_AGENT_SESSION_SCHEMA,id:crypto.randomUUID(),taskId:task,runtimeId:runtime,strategy:selectedStrategy,nativeSessionId:nativeId,
    generation:1,status:'active',createdAt:now,lastVerifiedAt:null,closedAt:null,
    proposalDigest:null,proposalGeneration:null,proposalRuntimeId:null,proposalNativeSessionId:null,
    approvalInvalidated:false,replayAllowed:false,replayAuthority:false,writeAuthority:false,
    authority:{taskIdentity:'decrypter',nativeSessionIsMetadata:true,proposalOnly:true,approvalRequired:true,freshScopeRequired:true,writeAuthority:false,replayAuthority:false}
  };
}

export function bindNativeProposal(session,digest){
  assertSession(session);
  if(session.status!=='active')throw err('NATIVE_SESSION_CLOSED');
  const proposal=text(digest,160).toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(proposal))throw err('NATIVE_SESSION_PROPOSAL_DIGEST_INVALID');
  return {...session,proposalDigest:proposal,proposalGeneration:session.generation,proposalRuntimeId:session.runtimeId,proposalNativeSessionId:session.nativeSessionId,approvalInvalidated:false,replayAllowed:false,replayAuthority:false,writeAuthority:false};
}

export function verifyNativeResume(session,{taskId,runtimeId,nativeSessionId=null,generation}={}){
  assertSession(session);
  if(session.status!=='active')throw err('NATIVE_SESSION_CLOSED');
  if(text(taskId,160)!==session.taskId)throw err('NATIVE_SESSION_TASK_MISMATCH');
  if(text(runtimeId,120)!==session.runtimeId)throw err('NATIVE_SESSION_RUNTIME_MISMATCH');
  const expectedNative=text(nativeSessionId,500)||null;
  if(expectedNative!==session.nativeSessionId)throw err('NATIVE_SESSION_ID_MISMATCH');
  if(Number(generation)!==Number(session.generation))throw err('NATIVE_SESSION_GENERATION_MISMATCH');
  return {ok:true,sessionId:session.id,taskId:session.taskId,runtimeId:session.runtimeId,nativeSessionId:session.nativeSessionId,generation:session.generation,writeAuthority:false,replayAuthority:false};
}

export function verifyProposalBinding(session,{proposalDigest,generation,runtimeId,nativeSessionId=null}={}){
  assertSession(session);
  const digest=text(proposalDigest,160).toLowerCase();
  if(!session.proposalDigest||digest!==session.proposalDigest)throw err('NATIVE_SESSION_PROPOSAL_MISMATCH');
  if(Number(generation)!==Number(session.proposalGeneration)||Number(generation)!==Number(session.generation))throw err('NATIVE_SESSION_PROPOSAL_GENERATION_MISMATCH');
  if(text(runtimeId,120)!==session.proposalRuntimeId||session.proposalRuntimeId!==session.runtimeId)throw err('NATIVE_SESSION_PROPOSAL_RUNTIME_MISMATCH');
  if((text(nativeSessionId,500)||null)!==session.proposalNativeSessionId||session.proposalNativeSessionId!==session.nativeSessionId)throw err('NATIVE_SESSION_PROPOSAL_ID_MISMATCH');
  if(session.approvalInvalidated)throw err('NATIVE_SESSION_APPROVAL_INVALIDATED');
  return {ok:true,proposalDigest:digest,generation:session.generation,writeAuthority:false,replayAuthority:false};
}

export function switchNativeRuntime(session,{runtimeId,strategy:nextStrategy='none',nativeSessionId=null}={}){
  assertSession(session);
  if(session.status!=='active')throw err('NATIVE_SESSION_CLOSED');
  const runtime=text(runtimeId,120);
  if(!runtime)throw err('NATIVE_SESSION_RUNTIME_REQUIRED');
  const selectedStrategy=strategy(nextStrategy);
  const nativeId=text(nativeSessionId,500)||null;
  if(selectedStrategy!=='none'&&!nativeId)throw err('NATIVE_SESSION_ID_REQUIRED');
  return {...session,runtimeId:runtime,strategy:selectedStrategy,nativeSessionId:nativeId,generation:Number(session.generation||0)+1,proposalDigest:null,proposalGeneration:null,proposalRuntimeId:null,proposalNativeSessionId:null,approvalInvalidated:true,replayAllowed:false,replayAuthority:false,writeAuthority:false,lastVerifiedAt:null};
}

export function markNativeSessionVerified(session,{taskId,runtimeId,nativeSessionId=null,generation}={}){
  verifyNativeResume(session,{taskId,runtimeId,nativeSessionId,generation});
  return {...session,lastVerifiedAt:new Date().toISOString(),writeAuthority:false,replayAuthority:false};
}

export function closeNativeSession(session){
  assertSession(session);
  if(session.status==='closed')return session;
  return {...session,status:'closed',closedAt:new Date().toISOString(),proposalDigest:null,proposalGeneration:null,proposalRuntimeId:null,proposalNativeSessionId:null,approvalInvalidated:true,replayAllowed:false,replayAuthority:false,writeAuthority:false};
}

export function runtimeSelectionRecord({taskId,runtimeId,previousRuntimeId=null,generation=1,reason='user'}={}){
  const task=text(taskId,160),runtime=text(runtimeId,120);
  if(!task||!runtime)throw err('RUNTIME_SELECTION_INVALID');
  return {schema:RUNTIME_SELECTION_SCHEMA,taskId:task,runtimeId:runtime,previousRuntimeId:text(previousRuntimeId,120)||null,generation:Math.max(1,Number(generation)||1),reason:text(reason,80)||'user',selectedAt:new Date().toISOString(),explicit:true,silentSwitch:false,writeAuthority:false,approvalCarryOver:false};
}
