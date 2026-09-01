(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD10_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD10_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  let healthInflight = null;
  let lastHealth = { ok: false, checkedAt: 0, code: 'NOT_CHECKED' };

  function modules() {
    return Object.freeze({
      build: 10,
      version: chrome.runtime.getManifest().version,
      composerRouting: !!window.__LOVABLE_DECRYPTER_COMPOSER_BRIDGE_V3__,
      projectIntelligence: !!window.__LOVABLE_DECRYPTER_PROJECT_INTELLIGENCE__,
      projectRules: !!window.__LOVABLE_DECRYPTER_PROJECT_RULES_CACHE__,
      skills: !!window.__LOVABLE_DECRYPTER_SKILL_ROUTER__,
      checkpoints: !!window.__LD2_CHECKPOINT_UI__,
      batchMode: !!window.__LOVABLE_DECRYPTER_BATCH_MODE__,
      queueExecutor: !!window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__,
      queueProjectContext: !!window.__LOVABLE_DECRYPTER_QUEUE_PROJECT_CONTEXT__,
      globalNetworkInterception: false
    });
  }

  async function queueHealth(force = false) {
    if (!force && lastHealth.checkedAt && Date.now() - lastHealth.checkedAt < 10_000) return lastHealth;
    if (healthInflight) return healthInflight;
    healthInflight = (async () => {
      try {
        const cfg = await runtime({ type: 'LD2_SETTINGS_GET' });
        const projectId = String(window.LovableDecrypterV2?.getProjectId?.() || '');
        const mapping = cfg?.projectMappings?.[projectId] || {};
        const github = { ...(cfg?.github || {}), ...mapping };
        const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
        const key = String(cfg?.auth?.licenseKey || '');
        const device = String(cfg?.auth?.deviceId || '');
        if (!projectId || !github.owner || !github.repo || !base || !key || !device) throw new Error('QUEUE_CONTEXT_INCOMPLETE');
        const res = await fetch(`${base}/ld-queue`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-license-key': key, 'x-device-id': device },
          body: JSON.stringify({
            action: 'list',
            limit: 5,
            project_id: projectId,
            github_owner: String(github.owner || ''),
            github_repo: String(github.repo || ''),
            github_branch: String(github.branch || 'main')
          })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
        lastHealth = { ok: true, checkedAt: Date.now(), code: 'OK', counts: out?.counts || {} };
      } catch (error) {
        lastHealth = { ok: false, checkedAt: Date.now(), code: String(error?.message || error || 'QUEUE_HEALTH_FAILED') };
      } finally {
        healthInflight = null;
      }
      return lastHealth;
    })();
    return healthInflight;
  }

  function setQueueVisual(root, health) {
    const queue = $('[data-cc-batch]', root);
    if (!queue) return;
    const small = $('small', queue);
    const badge = $('em', queue);
    const mods = modules();
    const localReady = mods.batchMode && mods.queueExecutor && mods.queueProjectContext;
    const ready = localReady && health?.ok;
    if (small) {
      const text = ready
        ? 'Sequencial · pause/resume/retry/skip/cancel · recovery'
        : localReady
          ? `Engine local pronto · backend ${health?.code || 'não validado'}`
          : 'Execution Engine incompleto';
      if (small.textContent !== text) small.textContent = text;
    }
    if (badge) {
      const text = ready ? 'ATIVA' : 'DEGRADADA';
      if (badge.textContent !== text) badge.textContent = text;
    }
    queue.dataset.ld2QueueHealth = ready ? 'active' : 'degraded';
  }

  function reconcileCopy(root) {
    const copy = $('.ld2-cc-native-chat small', root);
    const text = 'Plan/Build usam Project Brain + Rules + Skills + HEAD + Scope Lock atuais. A fila executa um item por vez, cria checkpoints e recupera reloads sem repetir automaticamente um commit incerto.';
    if (copy && copy.textContent !== text) copy.textContent = text;
  }

  async function reconcile(force = false) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;
    reconcileCopy(root);
    const health = await queueHealth(force);
    setQueueVisual(root, health);
    if (root.querySelector('.ld2-control-center')) {
      window.dispatchEvent(new CustomEvent('ld2:control-center-ready', { detail: { build: 10, queue: health } }));
      return true;
    }
    return false;
  }

  async function openDiagnostics(root) {
    const modal = $('.ld2-modal', root);
    const card = $('.ld2-card', root);
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>BUILD 10</small><h2>Diagnóstico do Execution Engine</h2><p>Estado operacional real dos módulos desta build.</p></div><button class="ld2-close" type="button" data-b10-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Executando verificações…</p></div>';
    $('[data-b10-close]', card).onclick = () => modal.classList.remove('open');
    try {
      const [settings, license, health] = await Promise.all([
        runtime({ type: 'LD2_SETTINGS_GET' }),
        runtime({ type: 'LD2_LICENSE_STATUS' }).catch(() => ({ valid: false })),
        queueHealth(true)
      ]);
      let repo = null;
      try {
        repo = await runtime({ type: 'LD2_REPO_CACHE_WARM', projectId: window.LovableDecrypterV2?.getProjectId?.() || '' });
      } catch (error) {
        repo = { error: error?.message || String(error) };
      }
      const s = modules();
      const state = value => value ? '<span style="color:#39ff84">ATIVO</span>' : '<span style="color:#ff6577">INATIVO</span>';
      const queueState = s.batchMode && s.queueExecutor && s.queueProjectContext && health.ok
        ? '<span style="color:#39ff84">ATIVO · BACKEND VALIDADO</span>'
        : `<span style="color:#ffd166">DEGRADADO · ${esc(health.code)}</span>`;
      $('.ld2-modal-body', card).innerHTML = `<div class="ld2-kv">
        <div>Versão</div><div>${esc(chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version)}</div>
        <div>Licença</div><div>${license?.valid ? 'VALIDADA' : 'NÃO VALIDADA'}</div>
        <div>Projeto</div><div>${esc(window.LovableDecrypterV2?.getProjectId?.() || 'não identificado')}</div>
        <div>GitHub / HEAD</div><div>${esc(repo?.error || `${repo?.repo || '—'} · ${String(repo?.headSha || '').slice(0, 12) || 'HEAD —'}`)}</div>
        <div>Modelo configurado</div><div>${esc(settings?.gemini?.model || '—')}</div>
        <div>Composer routing</div><div>${state(s.composerRouting)}</div>
        <div>Project Intelligence</div><div>${state(s.projectIntelligence)}</div>
        <div>Project Rules</div><div>${state(s.projectRules)}</div>
        <div>Skills Engine</div><div>${state(s.skills)}</div>
        <div>Checkpoints</div><div>${state(s.checkpoints)}</div>
        <div>Batch UI</div><div>${state(s.batchMode)}</div>
        <div>Queue Executor</div><div>${state(s.queueExecutor)}</div>
        <div>Queue Context</div><div>${state(s.queueProjectContext)}</div>
        <div>Execution Engine</div><div>${queueState}</div>
        <div>Intercepção global de rede</div><div>DESATIVADA · por design</div>
      </div>`;
    } catch (error) {
      $('.ld2-modal-body', card).textContent = error?.message || String(error);
    }
  }

  document.addEventListener('click', event => {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const diag = event.target.closest?.('#ld2-root [data-action="diag"], #ld2-root [data-cc-action="diag"]');
    if (!diag) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDiagnostics(root);
  }, true);

  window.LovableDecrypterBuild10 = Object.freeze({
    modules,
    health: queueHealth,
    reconcile: () => reconcile(true)
  });

  window.addEventListener('ld2:ui-mounted', () => reconcile(true));
  window.addEventListener('ld2:project', () => reconcile(true));
  window.addEventListener('ld2:queue-changed', () => reconcile(true));
  let attempts = 0;
  const bounded = () => {
    reconcile(false).then(ready => {
      if (!ready && ++attempts < 30) setTimeout(bounded, 100 + attempts * 35);
    }).catch(() => {
      if (++attempts < 30) setTimeout(bounded, 150 + attempts * 35);
    });
  };
  bounded();
})();