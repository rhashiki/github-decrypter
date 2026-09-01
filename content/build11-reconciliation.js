(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD11_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD11_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  let healthInflight = null;
  let lastQueueHealth = { ok: false, checkedAt: 0, code: 'NOT_CHECKED' };

  function modules() {
    const guardian = window.LovableDecrypterComposerGuardian?.snapshot?.() || null;
    return Object.freeze({
      build: 11,
      version: chrome.runtime.getManifest().version,
      composerRouting: !!window.__LOVABLE_DECRYPTER_EDITOR_DIRECT_V3__,
      composerGuardian: !!window.__LOVABLE_DECRYPTER_COMPOSER_GUARDIAN__,
      guardian,
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
    if (!force && lastQueueHealth.checkedAt && Date.now() - lastQueueHealth.checkedAt < 10_000) return lastQueueHealth;
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
          body: JSON.stringify({ action: 'list', limit: 5, project_id: projectId, github_owner: github.owner, github_repo: github.repo, github_branch: github.branch || 'main' })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
        lastQueueHealth = { ok: true, checkedAt: Date.now(), code: 'OK', counts: out?.counts || {} };
      } catch (error) {
        lastQueueHealth = { ok: false, checkedAt: Date.now(), code: String(error?.message || error || 'QUEUE_HEALTH_FAILED') };
      } finally {
        healthInflight = null;
      }
      return lastQueueHealth;
    })();
    return healthInflight;
  }

  function setQueueVisual(root, queue) {
    const card = $('[data-cc-batch]', root);
    if (!card) return;
    const mods = modules();
    const ready = mods.batchMode && mods.queueExecutor && mods.queueProjectContext && queue?.ok;
    const small = $('small', card);
    const badge = $('em', card);
    const text = ready ? 'Sequencial · pause/resume/retry/skip/cancel · recovery' : `Execution Engine degradado · ${queue?.code || 'não validado'}`;
    if (small && small.textContent !== text) small.textContent = text;
    if (badge && badge.textContent !== (ready ? 'ATIVA' : 'DEGRADADA')) badge.textContent = ready ? 'ATIVA' : 'DEGRADADA';
    card.dataset.ld2QueueHealth = ready ? 'active' : 'degraded';
  }

  function setGuardianVisual(root) {
    const guardian = window.LovableDecrypterComposerGuardian?.snapshot?.() || { health: 'INACTIVE', reason: 'guardian_unavailable' };
    const health = $('.ld2-cc-health', root);
    if (!health) return;
    let item = $('[data-cc-guardian-health]', health);
    if (!item) {
      item = document.createElement('div');
      item.dataset.ccGuardianHealth = '1';
      item.innerHTML = '<span class="ld2-cc-dot"></span><small>Composer Guard</small><b>Validando…</b>';
      health.appendChild(item);
    }
    const dot = $('.ld2-cc-dot', item);
    const value = $('b', item);
    dot?.classList.toggle('ready', guardian.health === 'OK');
    item.dataset.state = String(guardian.health || 'INACTIVE').toLowerCase();
    if (value) value.textContent = guardian.health === 'OK' ? 'OK' : guardian.health === 'DEGRADED' ? 'Degradado' : 'Inativo';
    item.title = `${guardian.reason || '—'}${guardian.fingerprintShort ? ` · ${guardian.fingerprintShort}` : ''}`;
  }

  function reconcileCopy(root) {
    const copy = $('.ld2-cc-native-chat small', root);
    const text = 'Composer Guardian fail-closed protege Enter/Enviar/submit. Plan/Build usam Brain + Rules + Skills + HEAD + Scope Lock atuais; a fila continua sequencial e recuperável.';
    if (copy && copy.textContent !== text) copy.textContent = text;
  }

  async function reconcile(force = false) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;
    reconcileCopy(root);
    setGuardianVisual(root);
    const queue = await queueHealth(force);
    setQueueVisual(root, queue);
    return !!root.querySelector('.ld2-control-center');
  }

  function stateHtml(ok, active = 'ATIVO', inactive = 'INATIVO') {
    return ok ? `<span style="color:#39ff84">${active}</span>` : `<span style="color:#ff6577">${inactive}</span>`;
  }

  function guardianHtml(guardian) {
    const health = guardian?.health || 'INACTIVE';
    const color = health === 'OK' ? '#39ff84' : health === 'DEGRADED' ? '#ffd166' : '#ff6577';
    return `<span style="color:${color}">${esc(health)} · ${esc(guardian?.reason || '—')}</span>`;
  }

  async function openDiagnostics(root) {
    const modal = $('.ld2-modal', root);
    const card = $('.ld2-card', root);
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>BUILD 11</small><h2>Diagnóstico do Composer Guardian</h2><p>Proteção real do composer, Execution Engine e integrações.</p></div><button class="ld2-close" type="button" data-b11-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Executando verificações…</p></div>';
    $('[data-b11-close]', card).onclick = () => modal.classList.remove('open');
    try {
      await window.LovableDecrypterComposerGuardian?.rescan?.().catch?.(() => {});
      const [settings, license, queue] = await Promise.all([
        runtime({ type: 'LD2_SETTINGS_GET' }),
        runtime({ type: 'LD2_LICENSE_STATUS' }).catch(() => ({ valid: false })),
        queueHealth(true)
      ]);
      let repo;
      try { repo = await runtime({ type: 'LD2_REPO_CACHE_WARM', projectId: window.LovableDecrypterV2?.getProjectId?.() || '' }); }
      catch (error) { repo = { error: error?.message || String(error) }; }
      const s = modules();
      const g = s.guardian || {};
      const queueReady = s.batchMode && s.queueExecutor && s.queueProjectContext && queue.ok;
      $('.ld2-modal-body', card).innerHTML = `<div class="ld2-kv">
        <div>Versão</div><div>${esc(chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version)}</div>
        <div>Licença</div><div>${license?.valid ? 'VALIDADA' : 'NÃO VALIDADA'}</div>
        <div>Projeto</div><div>${esc(window.LovableDecrypterV2?.getProjectId?.() || 'não identificado')}</div>
        <div>GitHub / HEAD</div><div>${esc(repo?.error || `${repo?.repo || '—'} · ${String(repo?.headSha || '').slice(0, 12) || 'HEAD —'}`)}</div>
        <div>Modelo configurado</div><div>${esc(settings?.gemini?.model || '—')}</div>
        <div>Composer Bridge</div><div>${stateHtml(s.composerRouting)}</div>
        <div>Composer Guardian</div><div>${guardianHtml(g)}</div>
        <div>Fingerprint</div><div>${esc(g.fingerprintShort || '—')}</div>
        <div>Dispatch verificado</div><div>${g.dispatchVerified ? `SIM · ${esc(new Date(g.dispatchVerifiedAt).toLocaleString('pt-BR'))}` : 'AINDA NÃO · será validado no próximo envio'}</div>
        <div>Input / Send / Form</div><div>${g.inputFound ? 'input ✓' : 'input ×'} · ${g.sendFound ? 'send ✓' : 'send ×'} · ${g.formFound ? 'form ✓' : 'form ×'}</div>
        <div>Project Intelligence</div><div>${stateHtml(s.projectIntelligence)}</div>
        <div>Project Rules</div><div>${stateHtml(s.projectRules)}</div>
        <div>Skills Engine</div><div>${stateHtml(s.skills)}</div>
        <div>Checkpoints</div><div>${stateHtml(s.checkpoints)}</div>
        <div>Execution Engine</div><div>${queueReady ? '<span style="color:#39ff84">ATIVO · BACKEND VALIDADO</span>' : `<span style="color:#ffd166">DEGRADADO · ${esc(queue.code)}</span>`}</div>
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

  window.LovableDecrypterBuild11 = Object.freeze({
    modules,
    queueHealth,
    guardian: () => window.LovableDecrypterComposerGuardian?.snapshot?.() || null,
    reconcile: () => reconcile(true)
  });

  window.addEventListener('ld2:ui-mounted', () => reconcile(true));
  window.addEventListener('ld2:project', () => reconcile(true));
  window.addEventListener('ld2:queue-changed', () => reconcile(true));
  window.addEventListener('ld2:composer-guardian-state', () => reconcile(false));
  window.addEventListener('ld2:composer-dispatch-verified', () => reconcile(false));
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
