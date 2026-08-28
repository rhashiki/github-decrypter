(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD12_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD12_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const runtime = message => Promise.resolve(window.LovableDecrypterV2?.runtime?.(message));

  function modules() {
    return Object.freeze({
      build: 12,
      version: chrome.runtime.getManifest().version,
      unifiedLauncher: !!window.__LOVABLE_DECRYPTER_UNIFIED_LAUNCHER__,
      composerGuardian: !!window.__LOVABLE_DECRYPTER_COMPOSER_GUARDIAN__,
      composerBridge: !!window.__LOVABLE_DECRYPTER_EDITOR_DIRECT_V3__,
      queue: !!window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__,
      projectIntelligence: !!window.__LOVABLE_DECRYPTER_PROJECT_INTELLIGENCE__,
      projectRules: !!window.__LOVABLE_DECRYPTER_PROJECT_RULES_CACHE__,
      skills: !!window.__LOVABLE_DECRYPTER_SKILL_ROUTER__,
      checkpoints: !!window.__LD2_CHECKPOINT_UI__,
      cloudMigrator: !!window.__LD2_CLOUD_MIGRATOR_COMPLETE_UI__,
      projectCreator: !!window.__LD2_PROJECT_CREATOR_UI__,
      repairLovable: false
    });
  }

  async function snapshot() {
    const [settings, license, queueHealth] = await Promise.all([
      runtime({ type: 'LD2_SETTINGS_GET' }).catch(() => ({})),
      runtime({ type: 'LD2_LICENSE_STATUS' }).catch(() => ({ valid: false })),
      Promise.resolve(window.LovableDecrypterBuild10?.health?.(true)).catch(() => ({ ok: false, code: 'UNAVAILABLE' }))
    ]);
    const projectId = String(window.LovableDecrypterV2?.getProjectId?.() || '');
    const context = window.LovableDecrypterProjectRuntime?.getContext?.() || null;
    const mapping = projectId ? settings?.projectMappings?.[projectId] || {} : {};
    const github = { ...(settings?.github || {}), ...mapping };
    const sbMapping = projectId ? settings?.supabaseMappings?.[projectId] || {} : {};
    const supabase = { ...(settings?.supabase || {}), ...sbMapping };
    const guardian = window.LovableDecrypterComposerGuardian?.snapshot?.() || { health: 'INACTIVE', reason: 'guardian_unavailable', routingEnabled: false };
    return { settings, license, queueHealth, projectId, context, github, supabase, guardian, modules: modules() };
  }

  function state(value) {
    return value ? '<span class="ld2-ul-diag-good">ATIVO</span>' : '<span class="ld2-ul-diag-bad">INATIVO</span>';
  }

  async function openDiagnostics() {
    const root = document.getElementById(ROOT_ID);
    const modal = root?.querySelector('.ld2-modal');
    const card = root?.querySelector('.ld2-card');
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld2-ul-diagnostics';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>BUILD 12 · UNIFIED LAUNCHER</small><h2>Diagnóstico</h2><p>Estado operacional real da extensão.</p></div><button class="ld2-close" type="button" data-b12-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Verificando módulos…</p></div>';
    $('[data-b12-close]', card).onclick = () => modal.classList.remove('open');

    try {
      const s = await snapshot();
      const m = s.modules;
      const repo = s.github?.owner && s.github?.repo ? `${s.github.owner}/${s.github.repo}` : '—';
      const sb = s.supabase?.projectName || s.supabase?.projectRef || '—';
      const guardianHealth = String(s.guardian?.health || 'INACTIVE').toUpperCase();
      const guardianClass = guardianHealth === 'OK' ? 'ld2-ul-diag-good' : guardianHealth === 'DEGRADED' ? 'ld2-ul-diag-warn' : 'ld2-ul-diag-bad';
      const queue = m.queue && s.queueHealth?.ok ? '<span class="ld2-ul-diag-good">ATIVA · BACKEND VALIDADO</span>' : `<span class="ld2-ul-diag-warn">DEGRADADA · ${esc(s.queueHealth?.code || 'UNAVAILABLE')}</span>`;
      $('.ld2-modal-body', card).innerHTML = `<div class="ld2-kv">
        <div>Versão</div><div>${esc(chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version)}</div>
        <div>Unified Launcher</div><div>${state(m.unifiedLauncher)}</div>
        <div>Licença</div><div>${s.license?.valid ? '<span class="ld2-ul-diag-good">VALIDADA</span>' : '<span class="ld2-ul-diag-bad">NÃO VALIDADA</span>'}</div>
        <div>Projeto</div><div>${esc(s.context?.project?.name || s.projectId || 'não identificado')}</div>
        <div>GitHub</div><div>${esc(repo)} · ${esc(s.github?.branch || 'main')}</div>
        <div>Supabase</div><div>${esc(sb)}</div>
        <div>Composer Guardian</div><div><span class="${guardianClass}">${esc(guardianHealth)}</span> · ${esc(s.guardian?.reason || '—')}</div>
        <div>Roteamento</div><div>${s.guardian?.routingEnabled ? '<span class="ld2-ul-diag-good">ON</span>' : '<span class="ld2-ul-diag-bad">OFF</span>'}</div>
        <div>Fingerprint</div><div>${esc(s.guardian?.fingerprintShort || '—')}</div>
        <div>Dispatch verificado</div><div>${s.guardian?.dispatchVerified ? '<span class="ld2-ul-diag-good">SIM</span>' : '<span class="ld2-ul-diag-warn">AINDA NÃO</span>'}</div>
        <div>Composer Bridge</div><div>${state(m.composerBridge)}</div>
        <div>Execution Engine</div><div>${queue}</div>
        <div>Project Intelligence</div><div>${state(m.projectIntelligence)}</div>
        <div>Project Rules</div><div>${state(m.projectRules)}</div>
        <div>Skills Engine</div><div>${state(m.skills)}</div>
        <div>Checkpoints</div><div>${state(m.checkpoints)}</div>
        <div>Cloud Migrator</div><div>${state(m.cloudMigrator)}</div>
        <div>Project Creator</div><div>${state(m.projectCreator)}</div>
        <div>Repair Lovable</div><div><span class="ld2-ul-diag-warn">BUILD 14 · AINDA NÃO ATIVO</span></div>
      </div><p class="ld2-help" style="margin-top:12px">A Build 12 unifica a interface. Não habilita antecipadamente recursos das Builds futuras.</p>`;
    } catch (error) {
      $('.ld2-modal-body', card).textContent = error?.message || String(error);
    }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#ld2-root .ld2-unified-shell [data-ul-action="diagnosis"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDiagnostics();
  }, true);

  function applyFabTruth(root) {
    const guardian = window.LovableDecrypterComposerGuardian?.snapshot?.() || null;
    const health = guardian?.routingEnabled === false ? 'bad' : guardian?.health === 'OK' ? 'good' : guardian?.health === 'DEGRADED' ? 'warn' : 'bad';
    root.dataset.ld2UnifiedHealth = health;
    root.dataset.ld2Routing = guardian?.routingEnabled === false ? 'off' : 'on';
  }

  function reconcile() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;
    root.dataset.ld2Build = '12';
    applyFabTruth(root);
    const repair = root.querySelector('.ld2-unified-shell [data-ul-action="repair"]');
    if (repair) {
      repair.dataset.ulFuture = '1';
      const badge = repair.querySelector('[data-ul-badge="repair"]');
      if (badge && badge.textContent !== 'BUILD 14') badge.textContent = 'BUILD 14';
    }
    return !!root.querySelector('.ld2-unified-shell');
  }

  window.LovableDecrypterBuild12 = Object.freeze({ modules, snapshot, diagnostics: openDiagnostics, reconcile, build: 12 });
  window.addEventListener('ld2:unified-launcher-ready', reconcile);
  window.addEventListener('ld2:ui-mounted', reconcile);
  window.addEventListener('ld2:composer-guardian-state', reconcile);
  let attempts = 0;
  const bounded = () => {
    if (reconcile()) return;
    if (++attempts < 30) setTimeout(bounded, 100 + attempts * 25);
  };
  bounded();
})();