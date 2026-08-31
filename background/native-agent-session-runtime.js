import {createNativeAgentSession,bindNativeProposal,verifyNativeResume,verifyProposalBinding,switchNativeRuntime,markNativeSessionVerified,closeNativeSession,runtimeSelectionRecord} from '../core/native-agent-sessions.js';

const PORT_NAME='ld2-native-agent-sessions';
const SESSION_KEY='ld74_native_agent_sessions_v1';
const SELECTION_KEY='ld74_runtime_selections_v1';
const text=(v,max=4000)=>String(v??'').trim().slice(0,max);
const err=(code)=>Object.assign(new Error(code),{code});
async function load(key){const out=await chrome.storage.session.get(key);return out?.[key]&&typeof out[key]==='object'?out[key]:{};}
async function save(key,value){await chrome.storage.session.set({[key]:value});return value;}
async function getSession(id){const map=await load(SESSION_KEY);const session=map[text(id,160)];if(!session)throw err('NATIVE_SESSION_NOT_FOUND');return {map,session};}
async function put(session,map=null){const store=map||await load(SESSION_KEY);store[session.id]=session;await save(SESSION_KEY,store);return session;}

async function handle(action,payload={}){
  const op=String(action||'status').toLowerCase();
  if(op==='status'){const sessions=await load(SESSION_KEY);const selections=await load(SELECTION_KEY);return {schema:'ld-native-agent-session-runtime/1',build:74,sessionCount:Object.keys(sessions).length,selectionCount:Object.keys(selections).length,storage:'session-only',silentSwitch:false,approvalCarryOver:false,replayAuthority:false,writeAuthority:false};}
  if(op==='list'){const sessions=await load(SESSION_KEY);return {sessions:Object.values(sessions)};}
  if(op==='create'){const session=createNativeAgentSession(payload);await put(session);const selections=await load(SELECTION_KEY);selections[session.taskId]=runtimeSelectionRecord({taskId:session.taskId,runtimeId:session.runtimeId,generation:session.generation,reason:'user'});await save(SELECTION_KEY,selections);return {session};}
  const id=text(payload.id||payload.sessionId,160);if(!id)throw err('NATIVE_SESSION_ID_REQUIRED');
  const {map,session}=await getSession(id);
  if(op==='get')return {session};
  if(op==='bind_proposal'){const next=bindNativeProposal(session,payload.proposalDigest);await put(next,map);return {session:next};}
  if(op==='verify_resume')return {verification:verifyNativeResume(session,payload)};
  if(op==='verify_proposal')return {verification:verifyProposalBinding(session,payload)};
  if(op==='verify'){const next=markNativeSessionVerified(session,payload);await put(next,map);return {session:next};}
  if(op==='switch_runtime'){
    const previous=session.runtimeId;const next=switchNativeRuntime(session,payload);await put(next,map);
    const selections=await load(SELECTION_KEY);selections[next.taskId]=runtimeSelectionRecord({taskId:next.taskId,runtimeId:next.runtimeId,previousRuntimeId:previous,generation:next.generation,reason:'user'});await save(SELECTION_KEY,selections);
    return {session:next,approvalInvalidated:true,replayAllowed:false};
  }
  if(op==='close'){const next=closeNativeSession(session);await put(next,map);return {session:next};}
  throw err('NATIVE_SESSION_ACTION_INVALID');
}

export function installNativeAgentSessionRuntime(){
  if(globalThis.__LD74_NATIVE_AGENT_SESSION_RUNTIME__)return;
  globalThis.__LD74_NATIVE_AGENT_SESSION_RUNTIME__=true;
  chrome.runtime.onConnect.addListener(port=>{
    if(port.name!==PORT_NAME)return;
    const listener=async message=>{const id=text(message?.id,160);try{port.postMessage({id,ok:true,data:await handle(message?.action,message?.payload||{})});}catch(error){try{port.postMessage({id,ok:false,error:error?.message||String(error),code:error?.code||'NATIVE_SESSION_RUNTIME_FAILED'});}catch(_){}}};
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterNativeAgentSessions=Object.freeze({build:74,schema:'ld-native-agent-session/1',port:PORT_NAME,storage:'session-only',silentSwitch:false,approvalCarryOver:false,replayAuthority:false,writeAuthority:false});
}
