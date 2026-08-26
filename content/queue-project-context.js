(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_QUEUE_PROJECT_CONTEXT__) return;
  window.__LOVABLE_DECRYPTER_QUEUE_PROJECT_CONTEXT__ = true;

  const SELECTED_SKILLS_KEY = 'ld2_selected_skill_slugs';
  const AUTO_SKILL_KEY = 'ld2_auto_skill_enabled';
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  function bridge() {
    return [...document.querySelectorAll('.ld2-native-bridge')].find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || null;
  }
  function composerInput(bar) {
    const host = bar?.nextElementSibling;
    return host?.matches?.('textarea,[contenteditable="true"],[role="textbox"]') ? host : host?.querySelector?.('textarea,[contenteditable="true"],[role="textbox"]');
  }
  function readInput(input) { return !input ? '' : ('value' in input ? String(input.value || '') : String(input.innerText || input.textContent || '')); }
  function clearInput(input) {
    if (!input) return;
    if ('value' in input) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, ''); else input.value = '';
    } else input.textContent = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function toast(text, error = false) {
    const wrap = document.querySelector('#ld2-root .ld2-toast-wrap'); if (!wrap) return;
    const el = document.createElement('div'); el.className = `ld2-toast${error ? ' error' : ''}`; el.textContent = text; wrap.appendChild(el); setTimeout(() => el.remove(), 3500);
  }
  function closeCloudModal() {
    const modal = document.querySelector('#ld2-root .ld2-modal'); const card = modal?.querySelector('.ld2-card');
    modal?.classList.remove('open'); if (card) { card.className = 'ld2-card'; card.innerHTML = ''; }
  }
  async function settings() { return runtime({ type: 'LD2_SETTINGS_GET' }); }
  async function context() {
    const cfg = await settings();
    const projectId = String(window.LovableDecrypterV2?.getProjectId?.() || '');
    if (!projectId) throw new Error('Projeto Lovable não identificado.');
    const mapping = cfg?.projectMappings?.[projectId] || {};
    const github = { ...(cfg?.github || {}), ...mapping };
    if (!github.owner || !github.repo) throw new Error('Configure o repositório GitHub deste projeto antes de criar a fila.');
    return { cfg, projectId, github };
  }
  async function backend(cfg, slug, body, withGemini = false) {
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!base || !key || !device) throw new Error('Licença/dispositivo ainda não estão prontos.');
    const res = await fetch(`${base}/${slug}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': key,
        'x-device-id': device,
        ...(withGemini && cfg?.gemini?.apiKey ? { 'x-gemini-key': String(cfg.gemini.apiKey) } : {})
      },
      body: JSON.stringify(body)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }
  function unique(values) { return [...new Set((values || []).map(String).filter(Boolean))].slice(0, 12); }
  async function buildItems(cfg, commands) {
    const stored = await chrome.storage.local.get([SELECTED_SKILLS_KEY, AUTO_SKILL_KEY]);
    const manual = Array.isArray(stored[SELECTED_SKILLS_KEY]) ? stored[SELECTED_SKILLS_KEY].map(String).filter(Boolean).slice(0, 12) : [];
    const auto = stored[AUTO_SKILL_KEY] !== false;
    if (!auto) return commands.map(command => ({ command, skill_slugs: unique(manual) }));
    const routed = await backend(cfg, 'ld-skills', { action: 'route_many', commands }, true);
    const map = new Map((routed.routes || []).map(row => [Number(row.index), Array.isArray(row.skill_slugs) ? row.skill_slugs : []]));
    return commands.map((command, index) => ({ command, skill_slugs: unique([...manual, ...(map.get(index) || [])]) }));
  }

  async function scopedEnqueue(event, button) {
    event.preventDefault(); event.stopImmediatePropagation(); if (button.disabled) return;
    const bar = bridge(); const input = composerInput(bar); const prompt = readInput(input).trim();
    const commands = [...document.querySelectorAll('#ld2-root .ld2-cloud-card.fragment [data-fragment-command]')].map(el => String(el.value || '').trim()).filter(Boolean);
    if (!prompt || !commands.length) return toast('Não foi possível recuperar o prompt/ações para a fila.', true);
    button.disabled = true; button.textContent = 'Roteando Skills…';
    try {
      const { cfg, projectId, github } = await context();
      const items = await buildItems(cfg, commands);
      button.textContent = 'Enfileirando…';
      const mode = bar?.querySelector('[data-ld2-mode].active')?.dataset.ld2Mode === 'plan' ? 'plan' : 'build';
      const out = await backend(cfg, 'ld-queue', {
        action: 'enqueue_many', prompt, items, mode, source: 'native_composer',
        project_id: projectId, github_owner: String(github.owner || ''), github_repo: String(github.repo || ''), github_branch: String(github.branch || 'main')
      });
      clearInput(input); closeCloudModal(); toast(`${out.count || commands.length} ação(ões) adicionada(s) à fila deste projeto.`);
      window.dispatchEvent(new CustomEvent('ld2:queue-changed', { detail: { projectId, count: out.count || commands.length } }));
      window.LovableDecrypterQueueExecutor?.kick?.();
    } catch (error) {
      const code = error?.message || String(error);
      toast(code === 'AUTO_SKILL_FREE_QUOTA_EXHAUSTED' ? 'A cota gratuita do Gemini acabou durante o Auto Skill. Nada foi enfileirado.' : code, true);
      button.disabled = false; button.textContent = 'Adicionar à fila';
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#ld2-root .ld2-cloud-card.fragment [data-fragment-enqueue]');
    if (button) scopedEnqueue(event, button);
  }, true);
})();