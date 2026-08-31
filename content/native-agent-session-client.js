(()=>{
  'use strict';
  if(window.__LD74_NATIVE_AGENT_SESSION_CLIENT__)return;
  window.__LD74_NATIVE_AGENT_SESSION_CLIENT__=true;
  const PORT='ld2-native-agent-sessions';
  function call(action,payload={}){return new Promise((resolve,reject)=>{const port=chrome.runtime.connect({name:PORT});const id=crypto.randomUUID();const timer=setTimeout(()=>{try{port.disconnect();}catch(_){}reject(Object.assign(new Error('NATIVE_SESSION_RUNTIME_TIMEOUT'),{code:'NATIVE_SESSION_RUNTIME_TIMEOUT'}));},30000);port.onMessage.addListener(message=>{if(message?.id!==id)return;clearTimeout(timer);try{port.disconnect();}catch(_){}if(message.ok)resolve(message.data);else reject(Object.assign(new Error(message.error||message.code||'NATIVE_SESSION_RUNTIME_FAILED'),{code:message.code||'NATIVE_SESSION_RUNTIME_FAILED'}));});port.postMessage({id,action,payload});});}
  window.LovableDecrypterNativeAgentSessions=Object.freeze({
    build:74,schema:'ld-native-agent-session/1',writeAuthority:false,replayAuthority:false,silentSwitch:false,
    status:()=>call('status'),list:()=>call('list'),create:payload=>call('create',payload),get:id=>call('get',{id}),
    bindProposal:(id,proposalDigest)=>call('bind_proposal',{id,proposalDigest}),
    verifyResume:(id,payload)=>call('verify_resume',{id,...payload}),
    verifyProposal:(id,payload)=>call('verify_proposal',{id,...payload}),
    verify:(id,payload)=>call('verify',{id,...payload}),
    switchRuntime:(id,payload)=>call('switch_runtime',{id,...payload}),
    close:id=>call('close',{id})
  });
  window.dispatchEvent(new CustomEvent('ld2:native-agent-sessions-ready',{detail:{build:74,writeAuthority:false,replayAuthority:false}}));
})();
