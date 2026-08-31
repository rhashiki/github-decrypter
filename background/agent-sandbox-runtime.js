import { createSandboxDescriptor, normalizeSandboxDiff, assertSandboxDiffBinding, transitionSandbox } from '../core/agent-sandbox.js';

const PORT_NAME='ld2-agent-sandbox';
const SESSION_KEY='ld73_agent_sandboxes_v1';
const text=(v,max=4000)=>String(v??'').trim().slice(0,max);
const err=(code,details={})=>Object.assign(new Error(code),{code,...details});

async function load(){const out=await chrome.storage.session.get(SESSION_KEY);return out?.[SESSION_KEY]&&typeof out[SESSION_KEY]==='object'?out[SESSION_KEY]:{};}
async function save(map){await chrome.storage.session.set({[SESSION_KEY]:map});return map;}
function publicSandbox(s){return s?{...s,isolation:{...s.isolation},authority:{...s.authority}}:null;}

async function status(){const map=await load();return {schema:'ld-agent-sandbox-runtime/1',build:73,count:Object.keys(map).length,physicalWorktree:'bridge-required',storage:'session-only',rawFileContentPersisted:false,gitCredentials:false,providerCredentials:false,writeAuthority:false};}
async function create(payload={}){const map=await load();const sandbox=createSandboxDescriptor(payload);map[sandbox.id]=sandbox;await save(map);return publicSandbox(sandbox);}
async function get(id){const map=await load();const sandbox=map[text(id,160)];if(!sandbox)throw err('SANDBOX_NOT_FOUND');return publicSandbox(sandbox);}
async function transition(id,state){const map=await load();const key=text(id,160);if(!map[key])throw err('SANDBOX_NOT_FOUND');map[key]=transitionSandbox(map[key],state);await save(map);return publicSandbox(map[key]);}
async function validateDiff(payload={}){const sandbox=await get(payload.sandboxId);const diff=await normalizeSandboxDiff({sandbox,...payload});assertSandboxDiffBinding(diff,{sandboxId:sandbox.id,taskId:sandbox.taskId,runtimeId:sandbox.runtimeId,baseHeadSha:sandbox.baseHeadSha});return diff;}
async function destroy(id){const map=await load();const key=text(id,160);if(!map[key])return {destroyed:false,id:key};const destroyed=transitionSandbox(map[key],'destroyed');delete map[key];await save(map);return {destroyed:true,id:key,destroyedAt:destroyed.destroyedAt,residue:false};}

async function handle(action,payload={}){const op=String(action||'status').toLowerCase();if(op==='status')return status();if(op==='create')return {sandbox:await create(payload)};if(op==='get')return {sandbox:await get(payload.id||payload.sandboxId)};if(op==='start')return {sandbox:await transition(payload.id||payload.sandboxId,'running')};if(op==='seal')return {sandbox:await transition(payload.id||payload.sandboxId,'sealed')};if(op==='validate_diff')return {diff:await validateDiff(payload)};if(op==='destroy')return destroy(payload.id||payload.sandboxId);throw err('SANDBOX_ACTION_INVALID');}

export function installAgentSandboxRuntime(){
  if(globalThis.__LD73_AGENT_SANDBOX_RUNTIME__)return;
  globalThis.__LD73_AGENT_SANDBOX_RUNTIME__=true;
  chrome.runtime.onConnect.addListener(port=>{
    if(port.name!==PORT_NAME)return;
    const listener=async message=>{const id=text(message?.id,160);try{port.postMessage({id,ok:true,data:await handle(message?.action,message?.payload||{})});}catch(error){try{port.postMessage({id,ok:false,error:error?.message||String(error),code:error?.code||'SANDBOX_RUNTIME_FAILED'});}catch(_){}}};
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterAgentSandbox=Object.freeze({build:73,schema:'ld-agent-sandbox/1',port:PORT_NAME,physicalWorktree:'bridge-required',storage:'session-only',writeAuthority:false,gitCredentials:false,providerCredentials:false});
}
