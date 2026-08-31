(()=>{
  if(window.LovableDecrypterAgentRuntimeRegistryClient)return;
  const PORT='ld2-agent-runtime-registry';
  let port=null;
  let seq=0;
  const pending=new Map();
  function ensurePort(){
    if(port)return port;
    port=chrome.runtime.connect({name:PORT});
    port.onMessage.addListener(message=>{
      const id=String(message?.id||'');
      const item=pending.get(id);
      if(!item)return;
      pending.delete(id);
      if(message?.ok)item.resolve(message.data);
      else {const error=new Error(message?.error||'Agent Runtime Registry failed');error.code=message?.code||'AGENT_RUNTIME_REGISTRY_FAILED';item.reject(error);}
    });
    port.onDisconnect.addListener(()=>{
      const error=new Error('Agent Runtime Registry disconnected');
      error.code='AGENT_RUNTIME_REGISTRY_DISCONNECTED';
      for(const item of pending.values())item.reject(error);
      pending.clear();
      port=null;
    });
    return port;
  }
  function request(action,payload={}){
    return new Promise((resolve,reject)=>{
      const id=`ld71-${Date.now().toString(36)}-${(++seq).toString(36)}`;
      pending.set(id,{resolve,reject});
      try{ensurePort().postMessage({id,action,payload});}
      catch(error){pending.delete(id);reject(error);}
    });
  }
  window.LovableDecrypterAgentRuntimeRegistryClient=Object.freeze({
    build:71,
    schema:'ld-agent-runtime-registry/1',
    status:()=>request('status'),
    list:()=>request('list'),
    get:runtimeId=>request('get',{runtimeId}),
    probe:(runtimeId,options={})=>request('probe',{runtimeId,...options}),
    probeAll:()=>request('probe_all'),
    permissionStatus:(runtimeId,endpoint='')=>request('permission_status',{runtimeId,endpoint}),
    requestPermission:(runtimeId,endpoint='')=>request('request_permission',{runtimeId,endpoint}),
    setSessionEndpoint:(runtimeId,endpoint)=>request('set_session_endpoint',{runtimeId,endpoint}),
    setSessionAuth:(runtimeId,auth)=>request('set_session_auth',{runtimeId,auth}),
    clearSessionAuth:runtimeId=>request('clear_session_auth',{runtimeId}),
    normalizeEvent:(runtimeId,event)=>request('normalize_event',{runtimeId,event}),
    promptTransport:(runtimeId,options)=>request('prompt_transport',{runtimeId,options}),
    watchdogPolicy:options=>request('watchdog_policy',options||{}),
    writeAuthority:false,
    credentialsDurable:false
  });
})();
