(()=>{
  'use strict';
  if(window.__LD73_AGENT_SANDBOX_CLIENT__)return;
  window.__LD73_AGENT_SANDBOX_CLIENT__=true;
  const PORT='ld2-agent-sandbox';
  function call(action,payload={}){return new Promise((resolve,reject)=>{const port=chrome.runtime.connect({name:PORT});const id=crypto.randomUUID();const timer=setTimeout(()=>{try{port.disconnect();}catch(_){}reject(Object.assign(new Error('SANDBOX_RUNTIME_TIMEOUT'),{code:'SANDBOX_RUNTIME_TIMEOUT'}));},30000);port.onMessage.addListener(message=>{if(message?.id!==id)return;clearTimeout(timer);try{port.disconnect();}catch(_){}if(message.ok)resolve(message.data);else reject(Object.assign(new Error(message.error||message.code||'SANDBOX_RUNTIME_FAILED'),{code:message.code||'SANDBOX_RUNTIME_FAILED'}));});port.postMessage({id,action,payload});});}
  window.LovableDecrypterAgentSandbox=Object.freeze({
    build:73,schema:'ld-agent-sandbox/1',physicalWorktree:'bridge-required',writeAuthority:false,
    status:()=>call('status'),
    create:payload=>call('create',payload),
    get:id=>call('get',{id}),
    start:id=>call('start',{id}),
    seal:id=>call('seal',{id}),
    validateDiff:payload=>call('validate_diff',payload),
    destroy:id=>call('destroy',{id})
  });
  window.dispatchEvent(new CustomEvent('ld2:agent-sandbox-ready',{detail:{build:73,writeAuthority:false}}));
})();
