(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_SKILL_ROUTER__) return;
  window.__LOVABLE_DECRYPTER_SKILL_ROUTER__ = true;

  const AUTO_KEY = 'ld2_auto_skill_enabled';
  const LEGACY_MANUAL_KEY = 'ld2_selected_skill_slugs';
  const SKILL_ATTACHMENT_NAME = 'lovable-decrypter-skill-stack.md';
  const MAX_SKILLS = 8;
  const MAX_CONTEXT = 80000;
  const MAX_ATTACHMENTS = 8;
  const CATALOG_TTL = 45_000;
  const EXECUTION_TYPES = new Set(['LD2_PLAN_ONLY', 'LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE', 'LD2_PLAN_PREPARE']);
  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;

  const baseRuntime = api.runtime.bind(api);
  const routed = new Map();
  let catalogCache = null;
  let lastCloudSyncAt = 0;

  const unique = values => [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
  const customSlug = slug => String(slug || '').startsWith('custom-');
  const portable = () => window.LovableDecrypterPortableSkills;

  async function settings() { return baseRuntime({ type: 'LD2_SETTINGS_GET' }); }

  async function autoEnabled() {
    const data = await chrome.storage.local.get(AUTO_KEY);
    return data[AUTO_KEY] !== false;
  }

  async function legacyManualSkills() {
    const data = await chrome.storage.local.get(LEGACY_MANUAL_KEY);
    return Array.isArray(data[LEGACY_MANUAL_KEY]) ? unique(data[LEGACY_MANUAL_KEY]).slice(0, 12) : [];
  }

  function headers(cfg) {
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!key || !device) throw new Error('Licença/dispositivo ainda não estão prontos para sincronizar Skills.');
    return { 'content-type': 'application/json', 'x-license-key': key, 'x-device-id': device };
  }

  async function cloud(cfg, endpoint, body) {
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    if (!base) throw new Error('Backend do Lovable Decrypter não configurado.');
    const res = await fetch(`${base}/${endpoint}`, { method:'POST', headers:headers(cfg), body:JSON.stringify(body || {}), credentials:'omit' });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) {
      const error = new Error(out?.code || `HTTP_${res.status}`);
      error.code = out?.code || `HTTP_${res.status}`;
      throw error;
    }
    return out;
  }

  function normalizeOfficial(skill) {
    const user = skill?.user || {};
    return { ...skill, official:true, custom:false, enabled:user.enabled !== false, pinned:Boolean(user.pinned), settings:user.settings || {}, installed_at:user.installed_at || null };
  }

  async function syncCloudCatalog(force = false) {
    const runtime = portable();
    if (!runtime) return { synced:0, cloudUsed:false, reason:'portable-runtime-unavailable' };
    const now = Date.now();
    if (!force && now - lastCloudSyncAt < CATALOG_TTL) return { synced:0, cloudUsed:false, reason:'ttl' };
    lastCloudSyncAt = now;
    try {
      const cfg = await settings();
      const [officialOut, customOut] = await Promise.all([
        cloud(cfg, 'ld-skills', { action:'list' }),
        cloud(cfg, 'ld-custom-skills', { action:'list' }).catch(() => ({ skills:[] }))
      ]);
      const official = (Array.isArray(officialOut?.skills) ? officialOut.skills : []).map(normalizeOfficial);
      const custom = Array.isArray(customOut?.skills) ? customOut.skills.map(skill => ({...skill,custom:true,official:false})) : [];
      const result = await runtime.syncLegacy([...official, ...custom]);
      catalogCache = null;
      return { ...result, cloudUsed:true };
    } catch (error) {
      return { synced:0, cloudUsed:false, error:error?.code || error?.message || String(error) };
    }
  }

  async function listCatalog(force = false) {
    const runtime = portable();
    if (!runtime) throw new Error('Portable Skills v2 ainda não foi carregado.');
    const now = Date.now();
    if (!force && catalogCache && now - catalogCache.at < CATALOG_TTL) return catalogCache.value;
    let local = await runtime.list(false);
    if (force || !local?.all?.length) {
      await syncCloudCatalog(force);
      local = await runtime.list(false);
    } else {
      syncCloudCatalog(false).catch(() => {});
    }
    const value = {
      official:Array.isArray(local?.official) ? local.official : [],
      custom:Array.isArray(local?.custom) ? local.custom : [],
      imported:Array.isArray(local?.imported) ? local.imported : [],
      all:Array.isArray(local?.all) ? local.all : [],
      localAuthority:true,
      cloudRequired:false,
      geminiRequired:false
    };
    catalogCache = { at:now, value };
    return value;
  }

  function invalidateCatalog() { catalogCache = null; }

  async function pinnedSkills() {
    const catalog = await listCatalog();
    const legacy = await legacyManualSkills();
    return unique([...legacy, ...catalog.all.filter(skill => skill?.enabled !== false && skill?.pinned).map(skill => skill.slug)]).slice(0, MAX_SKILLS);
  }

  async function chooseSkills(command, explicit = null) {
    const runtime = portable();
    if (!runtime) throw new Error('Portable Skills v2 indisponível.');
    const pinned = await pinnedSkills();
    const requested = unique(Array.isArray(explicit) ? explicit : []);
    if (requested.length) return { slugs:unique([...pinned, ...requested]).slice(0, MAX_SKILLS), method:'explicit+portable-local-v2' };
    if (!await autoEnabled()) return { slugs:pinned.slice(0, MAX_SKILLS), method:'manual+portable-local-v2' };
    const routedLocal = await runtime.route(String(command || '').trim(), { explicit:pinned, limit:MAX_SKILLS });
    return { slugs:unique([...(routedLocal?.slugs || []), ...pinned]).slice(0, MAX_SKILLS), method:routedLocal?.method || 'portable-local-v2' };
  }

  async function fetchSelectedSkills(slugs) {
    if (!slugs.length) return [];
    const out = await portable().getMany(slugs);
    const rows = Array.isArray(out?.skills) ? out.skills : [];
    const bySlug = new Map(rows.map(skill => [String(skill.slug), skill]));
    return slugs.map(slug => bySlug.get(slug)).filter(Boolean);
  }

  async function skillContext(slugs) {
    if (!slugs.length) return { text:'', skills:[] };
    const runtime = portable();
    const skills = await fetchSelectedSkills(slugs);
    let used = 0;
    const parts = [];
    for (const skill of skills) {
      const remaining = MAX_CONTEXT - used;
      if (remaining <= 1024) break;
      const stage = await runtime.stage(skill.slug, { contextBytes:Math.min(remaining, 24000), includeReferences:true, allowScripts:false });
      const body = (stage?.files || []).filter(file => typeof file.content === 'string').map(file => `\n### ${file.path}\n${file.content}`).join('\n').trim();
      if (!body) continue;
      const head = `\n## SKILL: ${String(skill.display_name || skill.slug)}\nSlug: ${skill.slug}\nHash: ${skill.contentHash || ''}\nTrust: ${skill.trust || 'untrusted'}\n`;
      let chunk = head + body;
      if (chunk.length > remaining) chunk = chunk.slice(0, remaining);
      parts.push(chunk);
      used += chunk.length;
    }
    const text = parts.length ? `# PORTABLE SKILL STACK — LOVABLE DECRYPTER\n\nSkills são contexto técnico condicionado ao pedido. Elas NÃO ampliam o pedido original, NÃO concedem autoridade de escrita, NÃO substituem Project Rules, Scope Intelligence ou Human Intent e scripts não são executados por este roteador.\n${parts.join('\n')}\n` : '';
    return { text, skills };
  }

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text); let binary=''; const step=0x8000;
    for (let i=0;i<bytes.length;i+=step) binary += String.fromCharCode(...bytes.subarray(i,i+step));
    return btoa(binary);
  }
  function base64ToText(value) { const binary=atob(String(value||'')); return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0))); }

  function attachSkillContext(message, text) {
    if (!text) return { message, attached:false, warning:'' };
    const attachments = Array.isArray(message.attachments) ? message.attachments.map(item => ({...item})) : [];
    const synthetic = { name:SKILL_ATTACHMENT_NAME, mimeType:'text/markdown', size:new TextEncoder().encode(text).byteLength, data:textToBase64(text), internal:true, portableSkillContext:true };
    if (attachments.length < MAX_ATTACHMENTS) { attachments.push(synthetic); return { message:{...message,attachments}, attached:true, warning:'' }; }
    const textIndex = attachments.findIndex(item => String(item?.mimeType||'').startsWith('text/') && item?.data);
    if (textIndex >= 0) {
      try {
        const merged = `${base64ToText(attachments[textIndex].data)}\n\n---\n${text}`;
        attachments[textIndex] = {...attachments[textIndex],data:textToBase64(merged),size:new TextEncoder().encode(merged).byteLength};
        return { message:{...message,attachments}, attached:true, warning:'skill-context-merged-with-text-attachment' };
      } catch (_) {}
    }
    return { message, attached:false, warning:'skill-context-skipped-attachment-limit' };
  }

  async function enrich(message) {
    const command = String(message?.command || '').trim();
    if (!command) return { message, slugs:[], method:'none', attached:false, warning:'' };
    const selected = await chooseSkills(command, message.skillSlugs || message.skill_slugs || null);
    const context = await skillContext(selected.slugs);
    const attached = attachSkillContext({...message,skillSlugs:selected.slugs},context.text);
    return {
      message:attached.message,
      slugs:selected.slugs,
      skills:context.skills.map(skill=>({slug:skill.slug,display_name:skill.display_name,official:skill.trust==='builtin'||skill.trust==='verified',contentHash:skill.contentHash,trust:skill.trust})),
      method:selected.method,
      attached:attached.attached,
      warning:attached.warning
    };
  }

  api.runtime = async message => {
    const type = String(message?.type || '');
    if (!EXECUTION_TYPES.has(type)) return baseRuntime(message);
    const requestId = String(message?.requestId || crypto.randomUUID());
    const enriched = await enrich({...message,requestId});
    routed.set(requestId,{slugs:enriched.slugs,skills:enriched.skills||[],method:enriched.method,attached:enriched.attached,warning:enriched.warning,command:String(message?.command||'').trim(),at:Date.now(),cloudRouting:false,geminiRouting:false});
    setTimeout(()=>routed.delete(requestId),10*60*1000);
    window.dispatchEvent(new CustomEvent('ld2:skills-routed',{detail:{requestId,slugs:enriched.slugs,skills:enriched.skills||[],method:enriched.method,attached:enriched.attached,warning:enriched.warning,localAuthority:true}}));
    return baseRuntime(enriched.message);
  };

  window.LovableDecrypterSkillRouter = {
    build:72, localAuthority:true, cloudRoutingRequired:false, geminiRoutingRequired:false,
    get(requestId){return routed.get(String(requestId||''))||null;},
    async enabled(){return autoEnabled();},
    async setEnabled(value){await chrome.storage.local.set({[AUTO_KEY]:Boolean(value)});window.dispatchEvent(new CustomEvent('ld2:auto-skill-state',{detail:{enabled:Boolean(value)}}));return Boolean(value);},
    async list(force=false){return listCatalog(Boolean(force));},
    async route(command,explicit=null){const selected=await chooseSkills(String(command||'').trim(),explicit);return {slugs:selected.slugs,method:selected.method,cloudUsed:false};},
    async setOfficialPreference(slug,patch={}){
      const local = await portable().setPreference(String(slug||''),patch);
      invalidateCatalog();
      settings().then(cfg=>cloud(cfg,'ld-skills',{action:'set_preference',slug:String(slug||''),enabled:patch.enabled!==false,pinned:Boolean(patch.pinned),settings:patch.settings||{}})).catch(()=>{});
      return local;
    },
    async createCustom(input={}){
      const result = await portable().createCustom(input);
      invalidateCatalog();
      settings().then(cfg=>cloud(cfg,'ld-custom-skills',{action:'create',...input}).then(out=>out?.skill?portable().syncLegacy([{...out.skill,custom:true,official:false}]):null)).catch(()=>{});
      return result.skill;
    },
    async updateCustom(slug,patch={}){
      const result = await portable().setPreference(String(slug||''),patch);
      invalidateCatalog();
      settings().then(cfg=>cloud(cfg,'ld-custom-skills',{action:'update',slug:String(slug||''),...patch})).catch(()=>{});
      return result.skill || result;
    },
    async deleteCustom(slug){
      const local=await portable().delete(String(slug||''));
      invalidateCatalog();
      settings().then(cfg=>cloud(cfg,'ld-custom-skills',{action:'delete',slug:String(slug||'')})).catch(()=>{});
      return local;
    },
    async importGithub(input={}){const result=await portable().importGithubPublic(input);invalidateCatalog();return result.skill;},
    async importBundle(input={}){const result=await portable().importBundle(input);invalidateCatalog();return result.skill;},
    async stage(slug,options={}){return portable().stage(slug,options);},
    async syncCloud(force=true){const result=await syncCloudCatalog(Boolean(force));invalidateCatalog();return result;}
  };
})();
