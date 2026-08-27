(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD9_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD9_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  function status() {
    return Object.freeze({
      build: 9,
      version: chrome.runtime.getManifest().version,
      composerRouting: !!window.__LOVABLE_DECRYPTER_COMPOSER_BRIDGE_V3__,
      projectIntelligence: !!window.__LOVABLE_DECRYPTER_PROJECT_INTELLIGENCE__,
      projectRules: !!window.__LOVABLE_DECRYPTER_PROJECT_RULES_CACHE__,
      skills: !!window.__LOVABLE_DECRYPTER_SKILL_ROUTER__,
      checkpoints: !!window.__LD2_CHECKPOINT_UI__,
      queue: false,
      globalNetworkInterception: false
    });
  }

  function toast(root, text, error = false) {
    const wrap = $('.ld2-toast-wrap', root);
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function reconcileLabels() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const queue = $('[data-cc-batch]', root);
    if (queue) {
      const small = $('small', queue), badge = $('em', queue);
      if (small) small.textContent = 'Execution Engine será reativado na Build 10';
      if (badge) badge.textContent = 'BUILD 10';
      queue.dataset.ld2Reconciled = 'deferred';
    }
    const copy = $('.ld2-cc-native-chat small', root);
    if (copy) copy.textContent = 'Plan/Build, Auto Skill, Project Brain, Project Rules, Impact Map, Explain Project, Histórico e Checkpoints estão reconciliados. Fila avançada permanece reservada para a Build 10.';
  }

  async function openDiagnostics(root) {
    const modal = $('.ld2-modal', root), card = $('.ld2-card', root);
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>BUILD 9</small><h2>Diagnóstico reconciliado</h2><p>Estado real dos módulos carregados nesta versão.</p></div><button class="ld2-close" type="button" data-b9-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Executando verificações…</p></div>';
    $('[data-b9-close]', card).onclick = () => modal.classList.remove('open');
    try {
      const [settings, license] = await Promise.all([
        runtime({ type: 'LD2_SETTINGS_GET' }),
        runtime({ type: 'LD2_LICENSE_STATUS' }).catch(() => ({ valid: false }))
      ]);
      let repo = null;
      try { repo = await runtime({ type: 'LD2_REPO_SCAN', projectId: window.LovableDecrypterV2?.getProjectId?.() || '' }); }
      catch (error) { repo = { error: error?.message || String(error) }; }
      const s = status();
      const state = value => value ? '<span style="color:#39ff84">ATIVO</span>' : '<span style="color:#ff6577">INATIVO</span>';
      $('.ld2-modal-body', card).innerHTML = `<div class="ld2-kv">
        <div>Versão</div><div>${esc(chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version)}</div>
        <div>Licença</div><div>${license?.valid ? 'VALIDADA' : 'NÃO VALIDADA'}</div>
        <div>Projeto</div><div>${esc(window.LovableDecrypterV2?.getProjectId?.() || 'não identificado')}</div>
        <div>GitHub</div><div>${esc(repo?.error || `${repo?.repo || '—'} · ${repo?.files || 0} arquivos`)}</div>
        <div>Modelo configurado</div><div>${esc(settings?.gemini?.model || '—')}</div>
        <div>Roteamento do composer</div><div>${state(s.composerRouting)}</div>
        <div>Intercepção global de rede</div><div>DESATIVADA · por design</div>
        <div>Project Intelligence</div><div>${state(s.projectIntelligence)}</div>
        <div>Project Rules</div><div>${state(s.projectRules)}</div>
        <div>Skills Engine</div><div>${state(s.skills)}</div>
        <div>Checkpoints</div><div>${state(s.checkpoints)}</div>
        <div>Fila avançada</div><div>DESATIVADA · Build 10</div>
      </div>`;
    } catch (error) {
      $('.ld2-modal-body', card).textContent = error?.message || String(error);
    }
  }

  document.addEventListener('click', event => {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const diag = event.target.closest?.('#ld2-root [data-action="diag"], #ld2-root [data-cc-action="diag"]');
    if (diag) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openDiagnostics(root);
      return;
    }
    const queue = event.target.closest?.('#ld2-root [data-cc-batch]');
    if (queue) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast(root, 'Fila avançada permanece desativada nesta Build 9. A reativação autoritativa será feita na Build 10.');
    }
  }, true);

  window.LovableDecrypterBuild9 = Object.freeze({ status, reconcile: reconcileLabels });
  new MutationObserver(reconcileLabels).observe(document.documentElement, { childList: true, subtree: true });
  reconcileLabels();
})();
