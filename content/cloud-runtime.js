(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_CLOUD_RUNTIME__) return;
  window.__LOVABLE_DECRYPTER_CLOUD_RUNTIME__ = true;

  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;
  const previousRuntime = api.runtime.bind(api);
  const nativeFetch = window.fetch.bind(window);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));

  async function settings() { return previousRuntime({ type: 'LD2_SETTINGS_GET' }); }
  async function context() {
    const cfg = await settings();
    const projectId = String(api.getProjectId?.() || '');
    const mapping = cfg?.projectMappings?.[projectId] || {};
    const github = { ...(cfg?.github || {}), ...mapping };
    return { cfg, projectId, github };
  }
  async function cloud(slug, body = {}) {
    const { cfg } = await context();
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!base || !key || !device) throw new Error('Licença/dispositivo ainda não estão prontos.');
    const res = await nativeFetch(`${base}/${slug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-license-key': key, 'x-device-id': device },
      body: JSON.stringify(body)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    if (!/\/ld-queue(?:\?|$)/.test(url) || !init?.body || typeof init.body !== 'string') return nativeFetch(input, init);
    let body;
    try { body = JSON.parse(init.body); } catch { return nativeFetch(input, init); }
    if (!body || body.project_id) return nativeFetch(input, init);
    try {
      const { projectId, github } = await context();
      if (projectId) body.project_id = projectId;
      if (github?.owner) body.github_owner = String(github.owner);
      if (github?.repo) body.github_repo = String(github.repo);
      body.github_branch = String(github?.branch || 'main');
      return nativeFetch(input, { ...init, body: JSON.stringify(body) });
    } catch { return nativeFetch(input, init); }
  };

  function cleanPrompt(value) {
    return window.LovableDecrypterSkillRouter?.cleanCommand?.(value) || String(value || '').trim();
  }
  function resultSummary(type, out) {
    if (type === 'LD2_PLAN_ONLY') return String(out?.plan?.summary || 'Plano concluído.');
    return String(out?.bundle?.plan?.summary || out?.result?.summary || 'Execução concluída.');
  }
  function commitSha(out) { return String(out?.result?.commitSha || out?.commitSha || ''); }
  async function recordHistory({ eventId, message, status, out = null, error = null, startedAt }) {
    try {
      const { cfg, projectId, github } = await context();
      const requestId = String(message?.requestId || '');
      const route = window.LovableDecrypterSkillRouter?.get?.(requestId);
      const slugs = [...new Set([...(Array.isArray(message?.skillSlugs) ? message.skillSlugs : []), ...(route?.slugs || [])].map(String).filter(Boolean))].slice(0, 12);
      await cloud('ld-history', {
        action: 'record',
        event_id: eventId,
        project_id: projectId,
        github_owner: String(github?.owner || ''),
        github_repo: String(github?.repo || ''),
        github_branch: String(github?.branch || 'main'),
        source: String(message?.source || (message?.type === 'LD2_PLAN_APPROVE' ? 'plan_approval' : 'native_composer')),
        queue_item_id: message?.queueItemId || null,
        command_id: message?.commandId || null,
        mode: message?.type === 'LD2_PLAN_ONLY' ? 'plan' : 'build',
        prompt: cleanPrompt(message?.command || ''),
        skill_slugs: slugs,
        model: String(cfg?.gemini?.model || ''),
        status,
        summary: status === 'completed' ? resultSummary(message?.type, out) : String(error?.message || error || status),
        commit_sha: status === 'completed' ? commitSha(out) : null,
        duration_ms: Date.now() - startedAt,
        metadata: { request_id: requestId || null, router_method: route?.method || null }
      });
      window.dispatchEvent(new CustomEvent('ld2:history-changed', { detail: { projectId } }));
    } catch (_) {}
  }

  api.runtime = async message => {
    const type = String(message?.type || '');
    if (!['LD2_PLAN_ONLY', 'LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE'].includes(type)) return previousRuntime(message);
    const eventId = crypto.randomUUID();
    const startedAt = Date.now();
    try {
      const out = await previousRuntime(message);
      recordHistory({ eventId, message, status: 'completed', out, startedAt });
      return out;
    } catch (error) {
      recordHistory({ eventId, message, status: 'failed', error, startedAt });
      throw error;
    }
  };

  function modal() {
    const root = $('#ld2-root');
    return { modal: root?.querySelector('.ld2-modal'), card: root?.querySelector('.ld2-card') };
  }
  function closeModal() { const m = modal(); m.modal?.classList.remove('open'); if (m.card) { m.card.className = 'ld2-card'; m.card.innerHTML = ''; } }
  async function openHistory() {
    const { modal: wrap, card } = modal();
    if (!wrap || !card) return;
    wrap.classList.add('open');
    card.className = 'ld2-card ld2-cloud-card history-cloud';
    card.innerHTML = '<div class="ld2-cloud-loading">Carregando histórico Cloud…</div>';
    try {
      const { projectId } = await context();
      const out = await cloud('ld-history', { action: 'list', project_id: projectId, limit: 120 });
      const items = Array.isArray(out.items) ? out.items : [];
      card.innerHTML = `
        <div class="ld2-cloud-head"><div><small>EXECUTION HISTORY CLOUD</small><h2>Histórico</h2><p>${items.length} execução(ões) deste projeto.</p></div><button type="button" data-history-close>×</button></div>
        <div class="ld2-history-list">${items.length ? items.map(historyRow).join('') : '<div class="ld2-cloud-empty">Nenhuma execução registrada neste projeto.</div>'}</div>`;
      $('[data-history-close]', card).onclick = closeModal;
    } catch (error) { card.innerHTML = `<div class="ld2-cloud-loading">${esc(error?.message || String(error))}</div>`; }
  }
  function historyRow(item) {
    const date = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
    const skills = Array.isArray(item.skill_slugs) && item.skill_slugs.length ? `<small>Skills: ${esc(item.skill_slugs.join(', '))}</small>` : '';
    const commit = item.commit_sha ? `<small>Commit: ${esc(String(item.commit_sha).slice(0, 12))}</small>` : '';
    const credits = `<small>Créditos: ${Number(item.credit_balance_after || 0).toLocaleString('pt-BR')} · comando ${Number(item.command_remainder_after || 0)}/${Number(item.commands_per_credit || 4)}</small>`;
    return `<article class="ld2-history-row status-${esc(item.status)}"><div class="ld2-history-meta"><b>${esc(item.mode === 'plan' ? 'PLAN' : 'BUILD')}</b><span>${esc(item.status)}</span><time>${esc(date)}</time></div><p>${esc(item.prompt || '')}</p>${item.summary ? `<small>${esc(item.summary)}</small>` : ''}${skills}${commit}${credits}</article>`;
  }

  async function refreshAutoButton(button) {
    const enabled = await window.LovableDecrypterSkillRouter?.enabled?.();
    button.classList.toggle('active', enabled !== false);
    button.textContent = enabled === false ? 'Auto Skill OFF' : 'Auto Skill ✓';
    button.title = enabled === false ? 'Ativar seleção automática de Skills' : 'Auto Skill ativo';
  }
  function reconcile() {
    $$('.ld2-native-bridge').forEach(bar => {
      const controls = $('.ld2-cloud-controls', bar);
      if (!controls || $('[data-auto-skill]', controls)) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.dataset.autoSkill = '1'; controls.prepend(btn);
      btn.onclick = async () => {
        const enabled = await window.LovableDecrypterSkillRouter?.enabled?.();
        await window.LovableDecrypterSkillRouter?.setEnabled?.(enabled === false);
        refreshAutoButton(btn);
      };
      refreshAutoButton(btn);
    });
  }

  document.addEventListener('click', event => {
    const history = event.target.closest?.('#ld2-root [data-cc-action="history"]');
    if (history) { event.preventDefault(); event.stopImmediatePropagation(); openHistory(); }
  }, true);
  window.addEventListener('ld2:auto-skill-state', reconcile);
  window.addEventListener('ld2:history-changed', () => {});
  new MutationObserver(reconcile).observe(document.documentElement, { childList: true, subtree: true });
  reconcile();
})();