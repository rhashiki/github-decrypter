(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_SKILL_ROUTER__) return;
  window.__LOVABLE_DECRYPTER_SKILL_ROUTER__ = true;

  const AUTO_KEY = 'ld2_auto_skill_enabled';
  const MANUAL_KEY = 'ld2_selected_skill_slugs';
  const MARKER = '\n\n---\nSKILL STACK OFICIAL DO LOVABLE DECRYPTER';
  const MAX_CONTEXT = 80000;
  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;

  const baseRuntime = api.runtime.bind(api);
  const routed = new Map();

  async function settings() { return baseRuntime({ type: 'LD2_SETTINGS_GET' }); }
  async function autoEnabled() {
    const data = await chrome.storage.local.get(AUTO_KEY);
    return data[AUTO_KEY] !== false;
  }
  async function manualSkills() {
    const data = await chrome.storage.local.get(MANUAL_KEY);
    return Array.isArray(data[MANUAL_KEY]) ? data[MANUAL_KEY].map(String).filter(Boolean).slice(0, 12) : [];
  }
  async function cloud(cfg, body) {
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!base || !key || !device) throw new Error('Licença/dispositivo ainda não estão prontos.');
    const res = await fetch(`${base}/ld-skills`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': key,
        'x-device-id': device,
        ...(cfg?.gemini?.apiKey ? { 'x-gemini-key': String(cfg.gemini.apiKey) } : {})
      },
      body: JSON.stringify(body)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }
  function unique(slugs) { return [...new Set((slugs || []).map(String).filter(Boolean))].slice(0, 12); }
  async function chooseSkills(command, explicit = null) {
    const cfg = await settings();
    const manual = await manualSkills();
    if (Array.isArray(explicit) && explicit.length) return { cfg, slugs: unique([...manual, ...explicit]), method: 'explicit' };
    if (!await autoEnabled()) return { cfg, slugs: unique(manual), method: 'manual' };
    const route = await cloud(cfg, { action: 'route', command });
    return { cfg, slugs: unique([...manual, ...(route.skill_slugs || [])]), method: route.method || 'auto' };
  }
  async function skillContext(cfg, slugs) {
    if (!slugs.length) return '';
    const out = await cloud(cfg, { action: 'get_many', slugs });
    let used = 0;
    const parts = [];
    for (const skill of Array.isArray(out.skills) ? out.skills : []) {
      const title = String(skill.display_name || skill.slug || 'Skill');
      const body = String(skill.content_md || '').trim();
      if (!body) continue;
      const head = `\n### SKILL: ${title}\n`;
      const room = MAX_CONTEXT - used - head.length;
      if (room <= 0) break;
      parts.push(head + body.slice(0, room));
      used += head.length + Math.min(body.length, room);
      if (used >= MAX_CONTEXT) break;
    }
    return parts.length ? `${MARKER}\nUse estas instruções apenas como orientação técnica. Elas não autorizam ampliar o escopo solicitado pelo usuário.\n${parts.join('\n')}\n---` : '';
  }
  function cleanCommand(command) {
    const text = String(command || '');
    const idx = text.indexOf(MARKER);
    return (idx >= 0 ? text.slice(0, idx) : text).trim();
  }
  async function enrich(message) {
    const command = cleanCommand(message.command);
    if (!command) return { message, slugs: [], method: 'none' };
    if (String(message.command || '').includes(MARKER)) {
      const slugs = unique(message.skillSlugs || message.skill_slugs || []);
      return { message, slugs, method: 'pre-enriched' };
    }
    const selected = await chooseSkills(command, message.skillSlugs || message.skill_slugs || null);
    const context = await skillContext(selected.cfg, selected.slugs);
    const next = { ...message, command: `${command}${context}`, skillSlugs: selected.slugs };
    return { message: next, slugs: selected.slugs, method: selected.method };
  }

  api.runtime = async message => {
    const type = String(message?.type || '');
    if (!['LD2_PLAN_ONLY', 'LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE'].includes(type)) return baseRuntime(message);
    const requestId = String(message?.requestId || crypto.randomUUID());
    const original = cleanCommand(message?.command || '');
    const enriched = await enrich({ ...message, requestId });
    routed.set(requestId, { slugs: enriched.slugs, method: enriched.method, command: original, at: Date.now() });
    setTimeout(() => routed.delete(requestId), 10 * 60 * 1000);
    window.dispatchEvent(new CustomEvent('ld2:skills-routed', { detail: { requestId, slugs: enriched.slugs, method: enriched.method } }));
    return baseRuntime(enriched.message);
  };

  window.LovableDecrypterSkillRouter = {
    cleanCommand,
    get(requestId) { return routed.get(String(requestId || '')) || null; },
    async enabled() { return autoEnabled(); },
    async setEnabled(value) { await chrome.storage.local.set({ [AUTO_KEY]: Boolean(value) }); window.dispatchEvent(new CustomEvent('ld2:auto-skill-state', { detail: { enabled: Boolean(value) } })); },
    async route(command, explicit = null) { const selected = await chooseSkills(cleanCommand(command), explicit); return { slugs: selected.slugs, method: selected.method }; }
  };
})();