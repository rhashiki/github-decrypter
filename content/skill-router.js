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

  // The Project Rules cache is intentionally loaded after this file in the manifest.
  // Its runtime wrapper is therefore outermost: Project Rules hydrate first, then this router runs.
  const baseRuntime = api.runtime.bind(api);
  const routed = new Map();
  let catalogCache = null;

  const unique = values => [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
  const customSlug = slug => String(slug || '').startsWith('custom-');

  async function settings() {
    return baseRuntime({ type: 'LD2_SETTINGS_GET' });
  }

  async function autoEnabled() {
    const data = await chrome.storage.local.get(AUTO_KEY);
    return data[AUTO_KEY] !== false;
  }

  async function legacyManualSkills() {
    const data = await chrome.storage.local.get(LEGACY_MANUAL_KEY);
    return Array.isArray(data[LEGACY_MANUAL_KEY]) ? unique(data[LEGACY_MANUAL_KEY]).slice(0, 12) : [];
  }

  function headers(cfg, includeGemini = false) {
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!key || !device) throw new Error('Licença/dispositivo ainda não estão prontos para Skills.');
    return {
      'content-type': 'application/json',
      'x-license-key': key,
      'x-device-id': device,
      ...(includeGemini && cfg?.gemini?.apiKey ? { 'x-gemini-key': String(cfg.gemini.apiKey) } : {})
    };
  }

  async function cloud(cfg, endpoint, body, includeGemini = false) {
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    if (!base) throw new Error('Backend do Lovable Decrypter não configurado.');
    const res = await fetch(`${base}/${endpoint}`, {
      method: 'POST',
      headers: headers(cfg, includeGemini),
      body: JSON.stringify(body || {})
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) {
      const code = out?.code || `HTTP_${res.status}`;
      const error = new Error(code);
      error.code = code;
      error.status = res.status;
      throw error;
    }
    return out;
  }

  function normalizeOfficial(skill) {
    const user = skill?.user || {};
    return {
      ...skill,
      official: true,
      custom: false,
      enabled: user.enabled !== false,
      pinned: Boolean(user.pinned),
      settings: user.settings || {},
      installed_at: user.installed_at || null
    };
  }

  async function listCatalog(force = false) {
    const now = Date.now();
    if (!force && catalogCache && now - catalogCache.at < CATALOG_TTL) return catalogCache.value;
    const cfg = await settings();
    const [officialOut, customOut] = await Promise.all([
      cloud(cfg, 'ld-skills', { action: 'list' }),
      cloud(cfg, 'ld-custom-skills', { action: 'list' }).catch(() => ({ skills: [] }))
    ]);
    const official = (Array.isArray(officialOut?.skills) ? officialOut.skills : []).map(normalizeOfficial);
    const custom = Array.isArray(customOut?.skills) ? customOut.skills : [];
    const value = { official, custom, all: [...official, ...custom] };
    catalogCache = { at: now, value };
    return value;
  }

  function invalidateCatalog() {
    catalogCache = null;
  }

  async function pinnedSkills() {
    const catalog = await listCatalog();
    const legacy = await legacyManualSkills();
    return unique([
      ...legacy,
      ...catalog.all.filter(skill => skill?.enabled !== false && skill?.pinned).map(skill => skill.slug)
    ]).slice(0, MAX_SKILLS);
  }

  async function chooseSkills(command, explicit = null) {
    const cfg = await settings();
    const pinned = await pinnedSkills();
    const requested = unique(Array.isArray(explicit) ? explicit : []);
    if (requested.length) return { cfg, slugs: unique([...pinned, ...requested]).slice(0, MAX_SKILLS), method: 'explicit' };
    if (!await autoEnabled()) return { cfg, slugs: pinned.slice(0, MAX_SKILLS), method: 'manual' };

    const [officialRoute, customRoute] = await Promise.all([
      cloud(cfg, 'ld-skills', { action: 'route', command }, true),
      cloud(cfg, 'ld-custom-skills', { action: 'route', command }).catch(() => ({ skill_slugs: [], method: 'custom-unavailable' }))
    ]);
    const slugs = unique([
      ...pinned,
      ...(officialRoute?.skill_slugs || []),
      ...(customRoute?.skill_slugs || [])
    ]).slice(0, MAX_SKILLS);
    return {
      cfg,
      slugs,
      method: [officialRoute?.method || 'official', customRoute?.method || 'custom'].filter(Boolean).join('+')
    };
  }

  async function fetchSelectedSkills(cfg, slugs) {
    const officialSlugs = slugs.filter(slug => !customSlug(slug));
    const customSlugs = slugs.filter(customSlug);
    const [officialOut, customOut] = await Promise.all([
      officialSlugs.length ? cloud(cfg, 'ld-skills', { action: 'get_many', slugs: officialSlugs }) : Promise.resolve({ skills: [] }),
      customSlugs.length ? cloud(cfg, 'ld-custom-skills', { action: 'get_many', slugs: customSlugs }) : Promise.resolve({ skills: [] })
    ]);
    const bySlug = new Map();
    for (const skill of [...(officialOut?.skills || []), ...(customOut?.skills || [])]) bySlug.set(String(skill.slug), skill);
    return slugs.map(slug => bySlug.get(slug)).filter(Boolean);
  }

  async function skillContext(cfg, slugs) {
    if (!slugs.length) return { text: '', skills: [] };
    const skills = await fetchSelectedSkills(cfg, slugs);
    let used = 0;
    const parts = [];
    for (const skill of skills) {
      const title = String(skill.display_name || skill.slug || 'Skill');
      const slug = String(skill.slug || '');
      const body = String(skill.content_md || '').trim();
      if (!body) continue;
      const head = `\n## SKILL: ${title}\nSlug: ${slug}\n`;
      const room = MAX_CONTEXT - used - head.length;
      if (room <= 0) break;
      const chunk = body.slice(0, room);
      parts.push(head + chunk);
      used += head.length + chunk.length;
      if (used >= MAX_CONTEXT) break;
    }
    const text = parts.length ? `# SKILL STACK OFICIAL DO LOVABLE DECRYPTER\n\nEstas Skills são contexto técnico condicional. Elas NÃO alteram o pedido original do usuário, NÃO concedem permissão para ampliar escopo e NÃO substituem Project Rules nem guardrails de execução.\n${parts.join('\n')}\n` : '';
    return { text, skills };
  }

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
    return btoa(binary);
  }

  function base64ToText(value) {
    const binary = atob(String(value || ''));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function attachSkillContext(message, text) {
    if (!text) return { message, attached: false, warning: '' };
    const attachments = Array.isArray(message.attachments) ? message.attachments.map(item => ({ ...item })) : [];
    const encoded = textToBase64(text);
    const size = new TextEncoder().encode(text).byteLength;
    const synthetic = { name: SKILL_ATTACHMENT_NAME, mimeType: 'text/markdown', size, data: encoded, internal: true };

    if (attachments.length < MAX_ATTACHMENTS) {
      attachments.push(synthetic);
      return { message: { ...message, attachments }, attached: true, warning: '' };
    }

    // Preserve all eight user attachments. If one is textual, fold the internal Skill context into it.
    const textIndex = attachments.findIndex(item => String(item?.mimeType || '').startsWith('text/') && item?.data);
    if (textIndex >= 0) {
      try {
        const original = base64ToText(attachments[textIndex].data);
        const merged = `${original}\n\n---\n${text}`;
        attachments[textIndex] = {
          ...attachments[textIndex],
          data: textToBase64(merged),
          size: new TextEncoder().encode(merged).byteLength
        };
        return { message: { ...message, attachments }, attached: true, warning: 'skill-context-merged-with-text-attachment' };
      } catch (_) {}
    }

    return { message, attached: false, warning: 'skill-context-skipped-attachment-limit' };
  }

  async function enrich(message) {
    const command = String(message?.command || '').trim();
    if (!command) return { message, slugs: [], method: 'none', attached: false, warning: '' };
    const selected = await chooseSkills(command, message.skillSlugs || message.skill_slugs || null);
    const context = await skillContext(selected.cfg, selected.slugs);
    const attached = attachSkillContext({ ...message, skillSlugs: selected.slugs }, context.text);
    return {
      message: attached.message,
      slugs: selected.slugs,
      skills: context.skills.map(skill => ({ slug: skill.slug, display_name: skill.display_name, official: skill.official !== false })),
      method: selected.method,
      attached: attached.attached,
      warning: attached.warning
    };
  }

  api.runtime = async message => {
    const type = String(message?.type || '');
    if (!EXECUTION_TYPES.has(type)) return baseRuntime(message);
    const requestId = String(message?.requestId || crypto.randomUUID());
    const enriched = await enrich({ ...message, requestId });
    routed.set(requestId, {
      slugs: enriched.slugs,
      skills: enriched.skills || [],
      method: enriched.method,
      attached: enriched.attached,
      warning: enriched.warning,
      command: String(message?.command || '').trim(),
      at: Date.now()
    });
    setTimeout(() => routed.delete(requestId), 10 * 60 * 1000);
    window.dispatchEvent(new CustomEvent('ld2:skills-routed', {
      detail: { requestId, slugs: enriched.slugs, skills: enriched.skills || [], method: enriched.method, attached: enriched.attached, warning: enriched.warning }
    }));
    return baseRuntime(enriched.message);
  };

  window.LovableDecrypterSkillRouter = {
    get(requestId) { return routed.get(String(requestId || '')) || null; },
    async enabled() { return autoEnabled(); },
    async setEnabled(value) {
      await chrome.storage.local.set({ [AUTO_KEY]: Boolean(value) });
      window.dispatchEvent(new CustomEvent('ld2:auto-skill-state', { detail: { enabled: Boolean(value) } }));
      return Boolean(value);
    },
    async list(force = false) { return listCatalog(Boolean(force)); },
    async route(command, explicit = null) {
      const selected = await chooseSkills(String(command || '').trim(), explicit);
      return { slugs: selected.slugs, method: selected.method };
    },
    async setOfficialPreference(slug, patch = {}) {
      const cfg = await settings();
      const result = await cloud(cfg, 'ld-skills', {
        action: 'set_preference',
        slug: String(slug || ''),
        enabled: patch.enabled !== false,
        pinned: Boolean(patch.pinned),
        settings: patch.settings || {}
      });
      invalidateCatalog();
      return result;
    },
    async createCustom(input = {}) {
      const cfg = await settings();
      const result = await cloud(cfg, 'ld-custom-skills', { action: 'create', ...input });
      invalidateCatalog();
      return result.skill;
    },
    async updateCustom(slug, patch = {}) {
      const cfg = await settings();
      const result = await cloud(cfg, 'ld-custom-skills', { action: 'update', slug: String(slug || ''), ...patch });
      invalidateCatalog();
      return result.skill;
    },
    async deleteCustom(slug) {
      const cfg = await settings();
      const result = await cloud(cfg, 'ld-custom-skills', { action: 'delete', slug: String(slug || '') });
      invalidateCatalog();
      return result;
    }
  };
})();
