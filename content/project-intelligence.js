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
      const [brainOut, rulesOut] = await Promise.all([
        cloud('get_brain'),
        cloud('list_rules').catch(() => ({ rules: [] }))
      ]);
      const brain = brainOut?.brain;
      if (!brain) return null;
      const manualRules = (Array.isArray(rulesOut?.rules) ? rulesOut.rules : [])
        .filter(r => r?.enabled !== false)
        .map(r => String(r?.rule_text || '').trim())
        .filter(Boolean);
      const profile = {
        project_summary: brain.project_summary || '',
        architecture: Array.isArray(brain.architecture) ? brain.architecture : [],
        rules: [...new Set([...(Array.isArray(brain.rules) ? brain.rules : []), ...manualRules])],
        important_paths: Array.isArray(brain.important_paths) ? brain.important_paths : [],
        validation_checklist: Array.isArray(brain.validation_checklist) ? brain.validation_checklist : []
      };
      await chrome.storage.local.set({ [brainCacheKey(github)]: profile });
      return { brain, projectRules: manualRules };
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
      Regras do Brain: ${Array.isArray(brain.rules) ? brain.rules.length : 0}<br>
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
      await syncBrain();
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

  async function openRules() {
    const card = openCard('Project Rules', 'Regras permanentes e independentes do prompt atual.');
    if (!card) return;
    try { await renderRules(card); }
    catch (e) { card.querySelector('.ld2-cloud-loading').textContent = e?.message || String(e); }
  }
  async function renderRules(card) {
    const rules = (await cloud('list_rules'))?.rules || [];
    card.querySelector('.ld2-cloud-loading')?.remove();
    const old = card.querySelector('[data-rules-body]'); old?.remove();
    const body = document.createElement('div'); body.dataset.rulesBody = '1';
    body.innerHTML = `<div class="ld2-fragment-row"><span>+</span><textarea rows="2" data-rule-new placeholder="Ex.: Sempre validar mobile e desktop"></textarea><button type="button" data-rule-add>Salvar</button></div><div class="ld2-history-list">${rules.length ? rules.map(r => `<article class="ld2-history-row"><div class="ld2-history-meta"><b>${r.enabled ? 'ON' : 'OFF'}</b><span>${esc(r.source)}</span></div><p>${esc(r.rule_text)}</p><div class="ld2-queue-actions"><button type="button" data-rule-toggle="${esc(r.id)}" data-enabled="${r.enabled ? '1' : '0'}">${r.enabled ? 'Desligar' : 'Ligar'}</button><button type="button" data-rule-delete="${esc(r.id)}">×</button></div></article>`).join('') : '<div class="ld2-cloud-empty">Nenhuma regra permanente cadastrada.</div>'}</div>`;
    card.appendChild(body);
    body.querySelector('[data-rule-add]').onclick = async () => {
      const input = body.querySelector('[data-rule-new]'); const rule = String(input.value || '').trim(); if (!rule) return;
      await cloud('save_rule', { rule_text: rule, enabled: true, source: 'manual' });
      await syncBrain(); await renderRules(card);
    };
    body.querySelectorAll('[data-rule-toggle]').forEach(btn => btn.onclick = async () => {
      await cloud('toggle_rule', { id: btn.dataset.ruleToggle, enabled: btn.dataset.enabled !== '1' });
      await syncBrain(); await renderRules(card);
    });
    body.querySelectorAll('[data-rule-delete]').forEach(btn => btn.onclick = async () => {
      await cloud('delete_rule', { id: btn.dataset.ruleDelete });
      await syncBrain(); await renderRules(card);
    });
  }

  async function openExplain() {
    const card = openCard('Explain Project', 'Resumo técnico do projeto sem nova chamada Gemini.');
    if (!card) return;
    try {
      const explain = (await cloud('explain_project'))?.explain || {};
      const brain = explain.brain || {};
      const rules = Array.isArray(explain.project_rules) ? explain.project_rules : [];
      const stats = explain.impact_stats || {};
      card.querySelector('.ld2-cloud-loading').outerHTML = `<div class="ld2-cloud-empty" style="text-align:left"><b>${esc(brain.project_summary || 'Brain ainda não treinado.')}</b><br><br><b>Arquitetura</b><br>${(Array.isArray(brain.architecture)?brain.architecture:[]).map(x=>`• ${esc(x)}`).join('<br>') || '—'}<br><br><b>Regras ativas</b><br>${rules.map(r=>`• ${esc(r.rule_text)}`).join('<br>') || '—'}<br><br><b>Paths importantes</b><br>${(Array.isArray(brain.important_paths)?brain.important_paths:[]).slice(0,30).map(x=>`• ${esc(x)}`).join('<br>') || '—'}<br><br><b>Risco recente</b><br>LOW ${Number(stats.low||0)} · MEDIUM ${Number(stats.medium||0)} · HIGH ${Number(stats.high||0)} · CRITICAL ${Number(stats.critical||0)}</div>`;
    } catch (e) { card.querySelector('.ld2-cloud-loading').textContent = e?.message || String(e); }
  }

  function addIntelCard(grid, key, icon, title, small) {
    if (!grid || grid.querySelector(`[data-cc-intel="${key}"]`)) return;
    const btn = document.createElement('button'); btn.className = 'ld2-cc-card'; btn.type = 'button'; btn.dataset.ccIntel = key;
    btn.innerHTML = `<span>${icon}</span><div><b>${title}</b><small>${small}</small></div>`; grid.appendChild(btn);
  }
  function reconcileControlCenter() {
    const root = $('#ld2-root');
    const grid = root?.querySelector('.ld2-cc-section .ld2-cc-grid');
    addIntelCard(grid, 'impact', '◈', 'Impact Map', 'Arquivos, dependências e risco');
    addIntelCard(grid, 'rules', '≡', 'Project Rules', 'Regras permanentes do projeto');
    addIntelCard(grid, 'explain', '?', 'Explain Project', 'Arquitetura, regras e riscos');
    const copy = root?.querySelector('.ld2-cc-native-chat small');
    if (copy) copy.textContent = 'O chat nativo do Lovable incorpora Plan/Build, Auto Skill, Queue, Think, Rewrite, Visual, Voice, histórico Cloud, Project Brain, Impact Map e Project Rules.';
  }

  document.addEventListener('click', e => {
    const brain = e.target.closest?.('#ld2-root [data-cc-action="train"]');
    if (brain) { e.preventDefault(); e.stopImmediatePropagation(); openBrain(); return; }
    const impact = e.target.closest?.('#ld2-root [data-cc-intel="impact"]');
    if (impact) { e.preventDefault(); e.stopImmediatePropagation(); openImpacts(); return; }
    const rules = e.target.closest?.('#ld2-root [data-cc-intel="rules"]');
    if (rules) { e.preventDefault(); e.stopImmediatePropagation(); openRules(); return; }
    const explain = e.target.closest?.('#ld2-root [data-cc-intel="explain"]');
    if (explain) { e.preventDefault(); e.stopImmediatePropagation(); openExplain(); }
  }, true);
  window.addEventListener('ld2:project', () => { syncBrain(); reconcileControlCenter(); });
  window.addEventListener('ld2:dom-reconcile', reconcileControlCenter);
  new MutationObserver(reconcileControlCenter).observe(document.documentElement, { childList: true, subtree: true });
  syncBrain();
  reconcileControlCenter();
})();
