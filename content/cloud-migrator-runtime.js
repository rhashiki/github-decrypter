(() => {
  'use strict';
  if (window.__LD2_CLOUD_MIGRATOR_CONTENT__) return;
  window.__LD2_CLOUD_MIGRATOR_CONTENT__ = true;

  const API_BASE = 'https://api.lovable.dev';
  const REQUEST_TIMEOUT_MS = 20000;
  const DEPLOY_RETRIES = [0, 2000, 5000, 10000, 16000];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = value => String(value ?? '').trim();

  function tokenFromObject(value, depth = 0) {
    if (!value || depth > 6) return '';
    if (Array.isArray(value)) {
      for (const item of value) { const token = tokenFromObject(item, depth + 1); if (token) return token; }
      return '';
    }
    if (typeof value !== 'object') return '';
    const direct = value?.stsTokenManager?.accessToken || value?.stsTokenManager?.access_token;
    if (typeof direct === 'string' && direct.split('.').length === 3) return direct;
    for (const [key, item] of Object.entries(value)) {
      if (/^(accessToken|access_token)$/i.test(key) && typeof item === 'string' && item.split('.').length === 3) return item;
    }
    for (const item of Object.values(value)) { const token = tokenFromObject(item, depth + 1); if (token) return token; }
    return '';
  }
  function tokenFromLocalStorage() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!/firebase:authUser:|firebaseLocalStorage/i.test(key)) continue;
        try { const token = tokenFromObject(JSON.parse(localStorage.getItem(key) || 'null')); if (token) return token; } catch (_) {}
      }
    } catch (_) {}
    return '';
  }
  async function tokenFromIndexedDb() {
    try {
      if (typeof indexedDB?.databases !== 'function') return '';
      const databases = await indexedDB.databases();
      if (!databases.some(db => db?.name === 'firebaseLocalStorageDb')) return '';
      return await new Promise(resolve => {
        const request = indexedDB.open('firebaseLocalStorageDb');
        request.onerror = () => resolve('');
        request.onsuccess = () => {
          try {
            const db = request.result;
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) { db.close(); resolve(''); return; }
            const tx = db.transaction('firebaseLocalStorage', 'readonly');
            const getAll = tx.objectStore('firebaseLocalStorage').getAll();
            getAll.onerror = () => { db.close(); resolve(''); };
            getAll.onsuccess = () => { const token = tokenFromObject(getAll.result || []); db.close(); resolve(token || ''); };
          } catch (_) { resolve(''); }
        };
      });
    } catch (_) { return ''; }
  }
  async function lovableToken() { return tokenFromLocalStorage() || await tokenFromIndexedDb(); }

  async function api(projectId, path, options = {}) {
    const token = await lovableToken();
    if (!token) throw new Error('Sessão Lovable não encontrada. Entre novamente no Lovable.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}${path}`, {
        credentials: 'include',
        signal: controller.signal,
        ...options,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
      });
      const raw = await res.text();
      let body = null;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = raw; }
      if (!res.ok) throw new Error(`Lovable HTTP ${res.status}: ${typeof body === 'string' ? body.slice(0, 300) : body?.detail || body?.message || 'falha'}`);
      return body;
    } finally { clearTimeout(timer); }
  }

  function extractContent(body) {
    if (typeof body === 'string') return body;
    const value = body?.content ?? body?.file?.content ?? body?.data?.content ?? '';
    if (body?.encoding === 'base64' && typeof value === 'string') {
      try { return decodeURIComponent(escape(atob(value.replace(/\s/g, '')))); } catch (_) {}
    }
    return typeof value === 'string' ? value : '';
  }
  async function readFile(projectId, path) {
    try { return extractContent(await api(projectId, `/git/file?path=${encodeURIComponent(path)}`)); }
    catch (_) { return ''; }
  }
  async function edit(projectId, changes) {
    return api(projectId, '/edit-code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes })
    });
  }
  async function deploy(projectId) {
    let last = null;
    for (const wait of DEPLOY_RETRIES) {
      if (wait) await sleep(wait);
      try {
        const result = await api(projectId, '/deployments?async=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return result;
      } catch (error) { last = error; }
    }
    throw last || new Error('Não foi possível publicar o helper temporário.');
  }
  function randomKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function viteHelper({ helperKey, brokerUrl, jobId, handoffToken }) {
    return `const ACCESS_KEY=${JSON.stringify(helperKey)};\nconst BROKER=${JSON.stringify(brokerUrl)};\nconst JOB=${JSON.stringify(jobId)};\nconst HANDOFF=${JSON.stringify(handoffToken)};\nconst cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-ld-helper-key","Access-Control-Allow-Methods":"POST,OPTIONS"};\nfunction out(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}\nDeno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});if(req.method!=="POST")return out({ok:false},405);if(req.headers.get("x-ld-helper-key")!==ACCESS_KEY)return out({ok:false,code:"FORBIDDEN"},403);const body=await req.json().catch(()=>({}));if(body.action==="ping")return out({ok:true,ready:true});if(body.action!=="handoff")return out({ok:false,code:"UNKNOWN_ACTION"},400);const dbUrl=Deno.env.get("SUPABASE_DB_URL")||Deno.env.get("DATABASE_URL")||"";if(!/^postgres(?:ql)?:\\/\\//i.test(dbUrl))return out({ok:false,code:"SOURCE_DB_URL_MISSING"},500);const res=await fetch(BROKER,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job_id:JOB,token:HANDOFF,db_url:dbUrl})});const data=await res.json().catch(()=>({}));return out({ok:res.ok&&data.ok===true,broker_status:res.status,code:data.code||null},res.ok?200:502);});\n`;
  }
  function tanstackHelper({ helperKey, brokerUrl, jobId, handoffToken, legacy = false }) {
    const body = `const ACCESS_KEY=${JSON.stringify(helperKey)};\nconst BROKER=${JSON.stringify(brokerUrl)};\nconst JOB=${JSON.stringify(jobId)};\nconst HANDOFF=${JSON.stringify(handoffToken)};\nconst cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-ld-helper-key","Access-Control-Allow-Methods":"POST,OPTIONS"};\nconst out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});\nasync function handle(request:Request){if(request.headers.get("x-ld-helper-key")!==ACCESS_KEY)return out({ok:false,code:"FORBIDDEN"},403);const body=await request.json().catch(()=>({}));if(body.action==="ping")return out({ok:true,ready:true});if(body.action!=="handoff")return out({ok:false,code:"UNKNOWN_ACTION"},400);const dbUrl=process.env.SUPABASE_DB_URL||process.env.DATABASE_URL||"";if(!/^postgres(?:ql)?:\\/\\//i.test(dbUrl))return out({ok:false,code:"SOURCE_DB_URL_MISSING"},500);const res=await fetch(BROKER,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job_id:JOB,token:HANDOFF,db_url:dbUrl})});const data=await res.json().catch(()=>({}));return out({ok:res.ok&&data.ok===true,broker_status:res.status,code:data.code||null},res.ok?200:502)}\n`;
    if (legacy) return `import { createAPIFileRoute } from '@tanstack/react-start/api'\n${body}\nexport const APIRoute=createAPIFileRoute('/api/public/ld-migrate-helper')({POST:({request})=>handle(request),OPTIONS:async()=>new Response(null,{status:204,headers:cors})})\n`;
    return `import { createFileRoute } from '@tanstack/react-router'\n${body}\nexport const Route=createFileRoute('/api/public/ld-migrate-helper')({server:{handlers:{POST:({request})=>handle(request),OPTIONS:async()=>new Response(null,{status:204,headers:cors})}}})\n`;
  }
  function ensureFunctionConfig(source) {
    const block = '[functions.ld-migrate-helper]\nverify_jwt = false\n';
    const cleaned = String(source || '').replace(/\n?\[functions\.ld-migrate-helper\][^\[]*/gi, '\n').trimEnd();
    return `${cleaned}${cleaned ? '\n\n' : ''}${block}`;
  }
  function removeFunctionConfig(source) {
    return String(source || '').replace(/\n?\[functions\.ld-migrate-helper\][^\[]*/gi, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }
  async function ping(url, helperKey, action = 'ping') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'x-ld-helper-key': helperKey }, body: JSON.stringify({ action }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.code || `HELPER_HTTP_${res.status}`);
      return body;
    } finally { clearTimeout(timer); }
  }
  async function waitHelper(url, key) {
    let last = null;
    for (const wait of [1000, 2000, 3500, 5000, 8000, 12000]) {
      await sleep(wait);
      try { return await ping(url, key, 'ping'); } catch (error) { last = error; }
    }
    throw last || new Error('Helper temporário não ficou acessível após o deploy.');
  }
  function stack(context) {
    const framework = text(context?.project?.framework).toLowerCase();
    return framework.includes('tanstack') ? 'tanstack' : 'vite';
  }
  function helperSpec(context) {
    const mode = stack(context);
    if (mode === 'vite') {
      const ref = text(context?.backend?.supabaseRef);
      const base = text(context?.backend?.supabaseUrl) || (ref ? `https://${ref}.supabase.co` : '');
      if (!base) throw new Error('O Lovable Cloud não expôs a URL Supabase gerenciada da origem.');
      return { mode, path: 'supabase/functions/ld-migrate-helper/index.ts', configPath: 'supabase/config.toml', url: `${base.replace(/\/+$/, '')}/functions/v1/ld-migrate-helper` };
    }
    const base = text(context?.preview?.url).replace(/\/+$/, '');
    if (!base) throw new Error('O preview/deploy do projeto TanStack não está disponível para instalar o helper.');
    return { mode, path: 'src/routes/api/public/ld-migrate-helper.ts', configPath: '', url: `${base}/api/public/ld-migrate-helper` };
  }

  async function installAndHandoff({ context, job, handoffToken, brokerUrl }) {
    if (!context?.projectId || !job?.id || !handoffToken || !brokerUrl) throw new Error('Parâmetros do helper incompletos.');
    const spec = helperSpec(context); const helperKey = randomKey(); let configBefore = '';
    if (spec.mode === 'vite') {
      configBefore = await readFile(context.projectId, spec.configPath);
      await edit(context.projectId, [
        { path: spec.path, content: viteHelper({ helperKey, brokerUrl, jobId: job.id, handoffToken }) },
        { path: spec.configPath, content: ensureFunctionConfig(configBefore) }
      ]);
    } else {
      await edit(context.projectId, [{ path: spec.path, content: tanstackHelper({ helperKey, brokerUrl, jobId: job.id, handoffToken, legacy: false }) }]);
    }
    await deploy(context.projectId);
    try {
      await waitHelper(spec.url, helperKey);
    } catch (firstError) {
      if (spec.mode !== 'tanstack') throw firstError;
      await edit(context.projectId, [{ path: spec.path, content: tanstackHelper({ helperKey, brokerUrl, jobId: job.id, handoffToken, legacy: true }) }]);
      await deploy(context.projectId);
      await waitHelper(spec.url, helperKey);
    }
    await ping(spec.url, helperKey, 'handoff');
    return { ...spec, helperKey, configBefore };
  }

  async function cleanup(context, installed) {
    if (!context?.projectId || !installed?.path) return { ok: true, skipped: true };
    const changes = [{ path: installed.path, content: null }];
    if (installed.mode === 'vite' && installed.configPath) {
      const current = await readFile(context.projectId, installed.configPath);
      changes.push({ path: installed.configPath, content: removeFunctionConfig(current) });
    }
    try { await edit(context.projectId, changes); await deploy(context.projectId); return { ok: true }; }
    catch (error) { return { ok: false, error: error?.message || String(error) }; }
  }

  window.LovableDecrypterCloudMigratorContent = { helperSpec, installAndHandoff, cleanup };
})();
