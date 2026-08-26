(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_PROJECT_INTELLIGENCE__) return;
  window.__LOVABLE_DECRYPTER_PROJECT_INTELLIGENCE__ = true;

  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;
  const baseRuntime = api.runtime.bind(api);
  const nativeFetch = window.fetch.bind(window);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  async function settings() { return baseRuntime({ type: 'LD2_SETTINGS_GET' }); }
  async function context() {
    const cfg = await settings();
    const projectId = String(api.getProjectId?.() || '');
    const mapping = cfg?.projectMappings?.[projectId] || {};
    const github = { ...(cfg?.github || {}), ...mapping };
    return { cfg, projectId, github };
  }
  async function cloud(action, body = {}) {
    const { cfg, projectId, github } = await context();
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!base || !key || !device) throw new Error('Licença/dispositivo ainda não estão prontos.');
    const res = await nativeFetch(`${base}/ld-project-intelligence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-license-key': key, 'x-device-id': device },
      body: JSON.stringify({
        action,
        project_id: projectId,
        github_owner: String(github?.owner || ''),
        github_repo: String(github?.repo || ''),
        github_branch: String(github?.branch || 'main'),
        ...body
      })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }
  function brainCacheKey(github) { return `ld2_agent_profile_${github.owner}_${github.repo}`; }
  function cleanPrompt(v) { return window.LovableDecrypterSkillRouter?.cleanCommand?.(v) || String(v || '').trim(); }
  function routeSlugs(message) {
    const route = window.LovableDecrypterSkillRouter?.get?.(String(message?.requestId || ''));
    return [...new Set([...(Array.isArray(message?.skillSlugs) ? message.skillSlugs : []), ...(route?.slugs || [])].map(String).filter(Boolean))].slice(0, 12);
  }

  async function syncBrain() {
    try {
      const { projectId, github } = await context();
      if (!projectId || !github?.owner || !github?.repo) return null;
      const out = await cloud('get_brain');
      const brain = out?.brain;
      if (!brain) return null;
      const profile = {
        project_summary: brain.project_summary || '',
        architecture: Array.isArray(brain.architecture) ? brain.architecture : [],
        rules: Array.isArray(brain.rules) ? brain.rules : [],
        important_paths: Array.isArray(brain.important_paths) ? brain.important_paths : [],
        validation_checklist: Array.isArray(brain.validation_checklist) ? brain.validation_checklist : []
      };
      await chrome.storage.local.set({ [brainCacheKey(github)]: profile });
      return brain;
    } catch (_) { return null; }
  }

  function impactFromPlan(plan = {}) {
    const files = Array.isArray(plan?.files) ? plan.files : [];
    const paths = [...new Set(files.map(f => String(f?.path || '')).filter(Boolean))];
    const deps = Array.isArray(plan?.dependencies) ? plan.dependencies.map(String).filter(Boolean) : [];
    const warnings = Array.isArray(plan?.warnings) ? plan.warnings.map(String).filter(Boolean) : [];
    const reasons = [];
    let score = 0;
    const joined = paths.join('\n').toLowerCase();
    if (files.some(f => String(f?.action || '').toLowerCase() === 'delete')) { score += 3; reasons.push('Inclui exclusão de arquivo'); }
    if (/supabase\/migrations|\brls\b|policy|auth|security|secret/.test(joined)) { score += 3; reasons.push('Afeta segurança, Auth, RLS ou migrations'); }
    if (/payment|checkout|mercado|webhook|billing/.test(joined)) { score += 3; reasons.push('Afeta pagamentos ou webhooks'); }
    if (/package(-lock)?\.json|pnpm-lock|yarn\.lock|\.github\/workflows/.test(joined)) { score += 2; reasons.push('Afeta dependências ou CI/CD'); }
    if (paths.length > 10) { score += 2; reasons.push(`Altera ${paths.length} arquivos`); }
    else if (paths.length > 5) { score += 1; reasons.push(`Altera ${paths.length} arquivos`); }
    if (warnings.length) { score += 1; reasons.push('Plano contém warnings'); }
    if (deps.length > 3) { score += 1; reasons.push('Múltiplas dependências envolvidas'); }
    const risk = score >= 7 ? 'critical' : score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
    return { affected_paths: paths, dependencies: deps, warnings, risk_level: risk, risk_reasons: reasons };
  }

  async function recordImpact(message, plan, mode, sourceCommitSha = '') {
    const impact = impactFromPlan(plan);
    const prompt = cleanPrompt(message?.command || '');
    if (!prompt) return null;
    const out = await cloud('record_impact', {
      event_id: crypto.randomUUID(),
      mode,
      prompt,
      source_commit_sha: String(sourceCommitSha || ''),
      skill_slugs: routeSlugs(message),
      ...impact,
      metadata: { request_id: String(message?.requestId || '') || null, source: String(message?.source || 'native_composer') }
    });
    window.dispatchEvent(new CustomEvent('ld2:impact-recorded', { detail: { risk: impact.risk_level, paths: impact.affected_paths } }));
    return out;
  }

  api.runtime = async message => {
    const type = String(message?.type || '');
    if (type === 'LD2_BUILD_EXECUTE') {
      const prepared = await baseRuntime({ ...message, type: 'LD2_PLAN_PREPARE' });
      await recordImpact(message, prepared?.plan || {}, 'build', prepared?.baseHeadSha || '');
      const result = await baseRuntime({ type: 'LD2_PLAN_APPLY', id: prepared.id, requestId: message?.requestId });
      return { mode: 'build', bundle: prepared, result };
    }
    if (type === 'LD2_PLAN_APPROVE') {
      await recordImpact(message, message?.approvedPlan || {}, 'build', '');
      return baseRuntime(message);
    }
    if (type === 'LD2_PLAN_ONLY') {
      const out = await baseRuntime(message);
      await recordImpact(message, out?.plan || {}, 'plan', out?.baseHeadSha || '');
      return out;
    }
    return baseRuntime(message);
  };

  function modal() {
    const root = $('#ld2-root');
    return { modal: root?.querySelector('.ld2-modal'), card: root?.querySelector('.ld2-card') };
  }
  function openCard(title, subtitle) {
    const { modal: wrap, card } = modal();
    if (!wrap || !card) return null;
    wrap.classList.add('open');
    card.className = 'ld2-card ld2-cloud-card project-intelligence';
    card.innerHTML = `<div class="ld2-cloud-head"><div><small>PROJECT INTELLIGENCE</small><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" data-intel-close>×</button></div><div class="ld2-cloud-loading">Carregando…</div>`;
    card.querySelector('[data-intel-close]').onclick = () => wrap.classList.remove('open');
    return card;
  }

  async function openBrain() {
    const card = openCard('Project Brain', 'Memória técnica persistente deste projeto.');
    if (!card) return;
    try {
      const brain = (await cloud('get_brain'))?.brain;
      renderBrain(card, brain);
    } catch (e) { card.querySelector('.ld2-cloud-loading').textContent = e?.message || String(e); }
  }
  function renderBrain(card, brain) {
    const body = brain ? `
      <div class="ld2-cloud-empty" style="text-align:left"><b>${esc(brain.project_summary || 'Brain treinado')}</b><br><br>
      Arquitetura: ${Array.isArray(brain.architecture) ? brain.architecture.length : 0} item(ns)<br>
      Regras: ${Array.isArray(brain.rules) ? brain.rules.length : 0}<br>
      Paths importantes: ${Array.isArray(brain.important_paths) ? brain.important_paths.length : 0}<br>
      Atualizado: ${brain.updated_at ? esc(new Date(brain.updated_at).toLocaleString('pt-BR')) : '—'}</div>` : '<div class="ld2-cloud-empty">Este projeto ainda não possui Brain Cloud.</div>';
    card.querySelector('.ld2-cloud-loading').outerHTML = `${body}<div class="ld2-fragment-footer"><button type="button" class="primary" data-brain-train>${brain ? 'Atualizar Brain' : 'Treinar Brain'}</button></div>`;
    card.querySelector('[data-brain-train]').onclick = () => trainBrain(card);
  }
  async function trainBrain(card) {
    const btn = card.querySelector('[data-brain-train]');
    if (btn) { btn.disabled = true; btn.textContent = 'Treinando…'; }
    try {
      const { projectId, github } = await context();
      const [trained, cache] = await Promise.all([
        api.runtime({ type: 'LD2_AGENT_TRAIN', projectId }),
        api.runtime({ type: 'LD2_REPO_CACHE_WARM', projectId }).catch(() => null)
      ]);
      const profile = trained?.profile || {};
      await cloud('upsert_brain', {
        source_commit_sha: String(cache?.headSha || ''),
        profile,
        metadata: { repo: `${github.owner}/${github.repo}`, trained_from: 'extension' }
      });
      await chrome.storage.local.set({ [brainCacheKey(github)]: profile });
      const brain = (await cloud('get_brain'))?.brain;
      renderBrain(card, brain);
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
      const err = document.createElement('div'); err.className = 'ld2-cloud-empty'; err.textContent = e?.message || String(e); card.appendChild(err);
    }
  }

  async function openImpacts() {
    const card = openCard('Impact Map', 'Mapas registrados antes de cada execução.');
    if (!card) return;
    try {
      const items = (await cloud('list_impacts', { limit: 50 }))?.items || [];
      card.querySelector('.ld2-cloud-loading').outerHTML = `<div class="ld2-history-list">${items.length ? items.map(i => `<article class="ld2-history-row status-${esc(i.risk_level)}"><div class="ld2-history-meta"><b>${esc(String(i.risk_level).toUpperCase())}</b><span>${esc(i.mode)}</span><time>${esc(new Date(i.created_at).toLocaleString('pt-BR'))}</time></div><p>${esc(i.prompt)}</p><small>${Array.isArray(i.affected_paths) ? i.affected_paths.length : 0} arquivo(s) afetado(s)</small>${Array.isArray(i.risk_reasons)&&i.risk_reasons.length?`<small>${esc(i.risk_reasons.join(' · '))}</small>`:''}</article>`).join('') : '<div class="ld2-cloud-empty">Nenhum Impact Map registrado ainda.</div>'}</div>`;
    } catch (e) { card.querySelector('.ld2-cloud-loading').textContent = e?.message || String(e); }
  }

  function reconcileControlCenter() {
    const root = $('#ld2-root');
    const grid = root?.querySelector('.ld2-cc-section .ld2-cc-grid');
    if (grid && !grid.querySelector('[data-cc-intel="impact"]')) {
      const btn = document.createElement('button');
      btn.className = 'ld2-cc-card'; btn.type = 'button'; btn.dataset.ccIntel = 'impact';
      btn.innerHTML = '<span>◈</span><div><b>Impact Map</b><small>Arquivos, dependências e risco</small></div>';
      grid.appendChild(btn);
    }
    const copy = root?.querySelector('.ld2-cc-native-chat small');
    if (copy) copy.textContent = 'O chat nativo do Lovable incorpora Plan/Build, Auto Skill, Queue, Think, Rewrite, Visual, Voice, histórico Cloud, Project Brain e Impact Map.';
  }

  document.addEventListener('click', e => {
    const brain = e.target.closest?.('#ld2-root [data-cc-action="train"]');
    if (brain) { e.preventDefault(); e.stopImmediatePropagation(); openBrain(); return; }
    const impact = e.target.closest?.('#ld2-root [data-cc-intel="impact"]');
    if (impact) { e.preventDefault(); e.stopImmediatePropagation(); openImpacts(); }
  }, true);
  window.addEventListener('ld2:project', () => { syncBrain(); reconcileControlCenter(); });
  window.addEventListener('ld2:dom-reconcile', reconcileControlCenter);
  new MutationObserver(reconcileControlCenter).observe(document.documentElement, { childList: true, subtree: true });
  syncBrain();
  reconcileControlCenter();
})();
