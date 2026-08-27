(() => {
  'use strict';
  if (window.__LD2_CLOUD_MIGRATOR_CONTENT_V2__) return;
  window.__LD2_CLOUD_MIGRATOR_CONTENT_V2__ = true;

  const API_BASE = 'https://api.lovable.dev';
  const REQUEST_TIMEOUT_MS = 20000;
  const DEPLOY_RETRIES = [0, 2000, 5000, 10000, 16000];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = value => String(value ?? '').trim();

  function tokenFromObject(value, depth = 0) {
    if (!value || depth > 6) return '';
    if (Array.isArray(value)) { for (const item of value) { const token = tokenFromObject(item, depth + 1); if (token) return token; } return ''; }
    if (typeof value !== 'object') return '';
    const direct = value?.stsTokenManager?.accessToken || value?.stsTokenManager?.access_token;
    if (typeof direct === 'string' && direct.split('.').length === 3) return direct;
    for (const [key, item] of Object.entries(value)) if (/^(accessToken|access_token)$/i.test(key) && typeof item === 'string' && item.split('.').length === 3) return item;
    for (const item of Object.values(value)) { const token = tokenFromObject(item, depth + 1); if (token) return token; }
    return '';
  }
  function tokenFromLocalStorage() {
    try { for (const key of Object.keys(localStorage)) { if (!/firebase:authUser:|firebaseLocalStorage/i.test(key)) continue; try { const token = tokenFromObject(JSON.parse(localStorage.getItem(key) || 'null')); if (token) return token; } catch (_) {} } } catch (_) {}
    return '';
  }
  async function tokenFromIndexedDb() {
    try {
      if (typeof indexedDB?.databases !== 'function') return '';
      const databases = await indexedDB.databases(); if (!databases.some(db => db?.name === 'firebaseLocalStorageDb')) return '';
      return await new Promise(resolve => {
        const request = indexedDB.open('firebaseLocalStorageDb'); request.onerror = () => resolve('');
        request.onsuccess = () => { try { const db = request.result; if (!db.objectStoreNames.contains('firebaseLocalStorage')) { db.close(); resolve(''); return; }
          const tx = db.transaction('firebaseLocalStorage', 'readonly'), getAll = tx.objectStore('firebaseLocalStorage').getAll();
          getAll.onerror = () => { db.close(); resolve(''); }; getAll.onsuccess = () => { const token = tokenFromObject(getAll.result || []); db.close(); resolve(token || ''); };
        } catch (_) { resolve(''); } };
      });
    } catch (_) { return ''; }
  }
  async function lovableToken() { return tokenFromLocalStorage() || await tokenFromIndexedDb(); }
  async function api(projectId, path, options = {}) {
    const token = await lovableToken(); if (!token) throw new Error('Sessão Lovable não encontrada. Entre novamente no Lovable.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}${path}`, { credentials:'include', signal:controller.signal, ...options, headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(options.headers || {})} });
      const raw = await res.text(); let body = null; try { body = raw ? JSON.parse(raw) : {}; } catch { body = raw; }
      if (!res.ok) throw new Error(`Lovable HTTP ${res.status}: ${typeof body === 'string' ? body.slice(0,300) : body?.detail || body?.message || 'falha'}`);
      return body;
    } finally { clearTimeout(timer); }
  }
  function extractContent(body) {
    if (typeof body === 'string') return body;
    const value = body?.content ?? body?.file?.content ?? body?.data?.content ?? '';
    if (body?.encoding === 'base64' && typeof value === 'string') { try { return decodeURIComponent(escape(atob(value.replace(/\s/g,'')))); } catch (_) {} }
    return typeof value === 'string' ? value : '';
  }
  async function readFile(projectId, path) { try { return extractContent(await api(projectId, `/git/file?path=${encodeURIComponent(path)}`)); } catch (_) { return ''; } }
  async function edit(projectId, changes) { return api(projectId, '/edit-code', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes})}); }
  async function deploy(projectId) {
    let last = null; for (const wait of DEPLOY_RETRIES) { if (wait) await sleep(wait); try { return await api(projectId, '/deployments?async=true', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); } catch (error) { last = error; } }
    throw last || new Error('Não foi possível publicar o helper temporário.');
  }
  function randomKey() { const bytes = crypto.getRandomValues(new Uint8Array(24)); return [...bytes].map(b => b.toString(16).padStart(2,'0')).join(''); }
  function helperBody({ helperKey, core, assets, node = false }) {
    const env = node ? `const env=(n)=>process.env[n]||"";` : `const env=(n)=>Deno.env.get(n)||"";`;
    return `const ACCESS_KEY=${JSON.stringify(helperKey)};\nconst CORE=${JSON.stringify(core || null)};\nconst ASSETS=${JSON.stringify(assets || null)};\nconst cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-ld-helper-key","Access-Control-Allow-Methods":"POST,OPTIONS"};\nconst out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});\n${env}\nasync function post(url,body){const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok!==true)throw new Error(d.code||("BROKER_"+r.status));return d}\nasync function handle(request){\n  if(request.headers.get("x-ld-helper-key")!==ACCESS_KEY)return out({ok:false,code:"FORBIDDEN"},403);\n  const body=await request.json().catch(()=>({}));\n  if(body.action==="ping")return out({ok:true,ready:true});\n  if(body.action==="handoff"){\n    const db=env("SUPABASE_DB_URL")||env("DATABASE_URL");if(!/^postgres(?:ql)?:\\/\\//i.test(db))return out({ok:false,code:"SOURCE_DB_URL_MISSING"},500);\n    if(CORE)await post(CORE.url,{job_id:CORE.job_id,token:CORE.token,db_url:db});\n    if(ASSETS){const supabaseUrl=env("SUPABASE_URL");const sourceKey=env("SUPABASE_SECRET_KEY")||env("SUPABASE_SERVICE_ROLE_KEY");if(!supabaseUrl||!sourceKey)return out({ok:false,code:"SOURCE_ASSET_ACCESS_MISSING"},500);await post(ASSETS.url,{action:"handoff",job_id:ASSETS.job_id,token:ASSETS.token,db_url:db,supabase_url:supabaseUrl,source_key:sourceKey});}\n    return out({ok:true,core:!!CORE,assets:!!ASSETS});\n  }\n  if(body.action==="secrets_handoff"){if(!ASSETS)return out({ok:true,count:0,skipped:true});const names=Array.isArray(body.names)?body.names.filter(n=>/^[A-Z][A-Z0-9_]{1,127}$/.test(String(n))).slice(0,100):[];const secrets={};for(const name of names){const value=env(name);if(value)secrets[name]=value}await post(ASSETS.url,{action:"secrets_handoff",job_id:ASSETS.job_id,token:ASSETS.token,secrets,expected:names.length});return out({ok:true,count:Object.keys(secrets).length,expected:names.length});}\n  return out({ok:false,code:"UNKNOWN_ACTION"},400);\n}\n`;
  }
  function viteHelper(opts) { return `${helperBody({...opts,node:false})}\nDeno.serve(async req=>{if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});if(req.method!=="POST")return out({ok:false},405);try{return await handle(req)}catch(e){return out({ok:false,code:e?.message||String(e)},500)}});\n`; }
  function tanstackHelper(opts, legacy = false) {
    const body = helperBody({...opts,node:true});
    if (legacy) return `import { createAPIFileRoute } from '@tanstack/react-start/api'\n${body}\nexport const APIRoute=createAPIFileRoute('/api/public/ld-migrate-helper')({POST:({request})=>handle(request),OPTIONS:async()=>new Response(null,{status:204,headers:cors})})\n`;
    return `import { createFileRoute } from '@tanstack/react-router'\n${body}\nexport const Route=createFileRoute('/api/public/ld-migrate-helper')({server:{handlers:{POST:({request})=>handle(request),OPTIONS:async()=>new Response(null,{status:204,headers:cors})}}})\n`;
  }
  function ensureFunctionConfig(source) { const block='[functions.ld-migrate-helper]\nverify_jwt = false\n'; const cleaned=String(source||'').replace(/\n?\[functions\.ld-migrate-helper\][^\[]*/gi,'\n').trimEnd(); return `${cleaned}${cleaned?'\n\n':''}${block}`; }
  function removeFunctionConfig(source) { return String(source||'').replace(/\n?\[functions\.ld-migrate-helper\][^\[]*/gi,'\n').replace(/\n{3,}/g,'\n\n').trimEnd()+'\n'; }
  async function callHelper(url, helperKey, action='ping', extra={}) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
    try { const res=await fetch(url,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','x-ld-helper-key':helperKey},body:JSON.stringify({action,...extra})}); const body=await res.json().catch(()=>({})); if(!res.ok||!body?.ok)throw new Error(body?.code||`HELPER_HTTP_${res.status}`); return body; }
    finally {clearTimeout(timer)}
  }
  async function waitHelper(url,key) { let last=null; for(const wait of [1000,2000,3500,5000,8000,12000]){await sleep(wait);try{return await callHelper(url,key,'ping')}catch(e){last=e}} throw last||new Error('Helper temporário não ficou acessível após o deploy.'); }
  function stack(context){return text(context?.project?.framework).toLowerCase().includes('tanstack')?'tanstack':'vite'}
  function helperSpec(context) {
    const mode=stack(context);
    if(mode==='vite'){const ref=text(context?.backend?.supabaseRef),base=text(context?.backend?.supabaseUrl)||(ref?`https://${ref}.supabase.co`:'');if(!base)throw new Error('O Lovable Cloud não expôs a URL Supabase gerenciada da origem.');return {mode,path:'supabase/functions/ld-migrate-helper/index.ts',configPath:'supabase/config.toml',url:`${base.replace(/\/+$/,'')}/functions/v1/ld-migrate-helper`};}
    const base=text(context?.preview?.url).replace(/\/+$/,'');if(!base)throw new Error('O preview/deploy TanStack não está disponível para instalar o helper.');return {mode,path:'src/routes/api/public/ld-migrate-helper.ts',configPath:'',url:`${base}/api/public/ld-migrate-helper`};
  }
  async function installAndHandoff({ context, job, handoffToken, brokerUrl, assets = null }) {
    if(!context?.projectId||!job?.id||!handoffToken||!brokerUrl)throw new Error('Parâmetros do helper incompletos.');
    const spec=helperSpec(context),helperKey=randomKey();let configBefore='';
    const core={job_id:job.id,token:handoffToken,url:brokerUrl};
    const assetSpec=assets?.job?.id&&assets?.handoffToken&&assets?.brokerUrl?{job_id:assets.job.id,token:assets.handoffToken,url:assets.brokerUrl}:null;
    if(spec.mode==='vite'){configBefore=await readFile(context.projectId,spec.configPath);await edit(context.projectId,[{path:spec.path,content:viteHelper({helperKey,core,assets:assetSpec})},{path:spec.configPath,content:ensureFunctionConfig(configBefore)}]);}
    else await edit(context.projectId,[{path:spec.path,content:tanstackHelper({helperKey,core,assets:assetSpec},false)}]);
    await deploy(context.projectId);
    try{await waitHelper(spec.url,helperKey)}catch(first){if(spec.mode!=='tanstack')throw first;await edit(context.projectId,[{path:spec.path,content:tanstackHelper({helperKey,core,assets:assetSpec},true)}]);await deploy(context.projectId);await waitHelper(spec.url,helperKey);}
    await callHelper(spec.url,helperKey,'handoff');
    return {...spec,helperKey,configBefore,assets:assetSpec};
  }
  async function handoffSecrets(installed,names) { if(!installed?.url||!installed?.helperKey)return {ok:false,skipped:true};return callHelper(installed.url,installed.helperKey,'secrets_handoff',{names:Array.isArray(names)?names:[]}); }
  async function cleanup(context,installed) {
    if(!context?.projectId)return {ok:true,skipped:true};const spec=installed?.path?installed:helperSpec(context);const changes=[{path:spec.path,content:null}];
    if(spec.mode==='vite'&&spec.configPath){const current=await readFile(context.projectId,spec.configPath);changes.push({path:spec.configPath,content:removeFunctionConfig(current)});}
    try{await edit(context.projectId,changes);await deploy(context.projectId);return {ok:true}}catch(error){return {ok:false,error:error?.message||String(error)}}
  }
  window.LovableDecrypterCloudMigratorContent = { helperSpec, installAndHandoff, handoffSecrets, cleanup };
})();
