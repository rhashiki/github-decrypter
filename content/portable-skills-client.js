(()=>{
  if(window.LovableDecrypterPortableSkills)return;
  const PORT='ld2-portable-skills-v2';
  let port=null,seq=0;
  const pending=new Map();
  function ensure(){
    if(port)return port;
    port=chrome.runtime.connect({name:PORT});
    port.onMessage.addListener(msg=>{
      const id=String(msg?.id||'');const item=pending.get(id);if(!item)return;pending.delete(id);
      if(msg?.ok)item.resolve(msg.data);else{const e=new Error(msg?.error||'Portable Skills failed');e.code=msg?.code||'PORTABLE_SKILLS_FAILED';item.reject(e);}
    });
    port.onDisconnect.addListener(()=>{const e=new Error('Portable Skills disconnected');e.code='PORTABLE_SKILLS_DISCONNECTED';for(const p of pending.values())p.reject(e);pending.clear();port=null;});
    return port;
  }
  function request(action,payload={}){return new Promise((resolve,reject)=>{const id=`ld72-${Date.now().toString(36)}-${(++seq).toString(36)}`;pending.set(id,{resolve,reject});try{ensure().postMessage({id,action,payload});}catch(e){pending.delete(id);reject(e);}});}
  window.LovableDecrypterPortableSkills=Object.freeze({
    build:72,schema:'ld-portable-skill-registry/2',
    status:()=>request('status'),
    list:(includeBody=false)=>request('list',{includeBody}),
    getMany:slugs=>request('get_many',{slugs}),
    route:(command,options={})=>request('route',{command,options}),
    stage:(slug,options={})=>request('stage',{slug,options}),
    syncLegacy:skills=>request('sync_legacy',{skills}),
    setPreference:(slug,patch={})=>request('set_preference',{slug,...patch}),
    createCustom:input=>request('create_custom',input||{}),
    delete:slug=>request('delete',{slug}),
    importBundle:input=>request('import_bundle',input||{}),
    importGithubPublic:input=>request('import_github_public',input||{}),
    localAuthority:true,cloudRequired:false,geminiRequired:false,writeAuthority:false
  });
})();
