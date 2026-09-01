(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD18_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD18_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const root = () => document.getElementById(ROOT_ID);

  async function status(force = false) {
    try {
      const gateway = window.LovableDecrypterBuild17;
      if (!gateway?.status) return { ok: false, code: 'MODEL_GATEWAY_UNAVAILABLE' };
      return await gateway.status(force);
    } catch (error) {
      return { ok: false, code: error?.message || String(error) };
    }
  }

  function localProvider(state = {}) {
    return (Array.isArray(state?.providers) ? state.providers : []).find(provider => provider?.id === 'decrypter-local') || null;
  }

  function health(provider) {
    if (provider?.active === true) return { label: 'ATIVO', state: 'good' };
    if (provider?.configured === true) return { label: 'DEGRADADO', state: 'warn' };
    return { label: 'RUNTIME NÃO CONFIGURADO', state: 'warn' };
  }

  function addCard() {
    const grid = root()?.querySelector('.ld2-unified-shell [data-ul-section="intelligence"] .ld2-ul-grid');
    if (!grid) return null;
    let card = grid.querySelector('[data-ul-action="decrypter-local"]');
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.className = 'ld2-ul-card';
      card.dataset.ulAction = 'decrypter-local';
      card.innerHTML = '<span>DL</span><div><b>Decrypter Local</b><small>Runtime self-hosted · Qwen3-Coder</small></div><em data-ul-badge="decrypter-local" data-state="warn">VERIFICANDO</em>';
      const gateway = grid.querySelector('[data-ul-action="model-gateway"]');
      if (gateway?.nextSibling) grid.insertBefore(card, gateway.nextSibling);
      else grid.appendChild(card);
    }
    return card;
  }

  async function reconcile(force = false) {
    const r = root();
    if (!r) return false;
    r.dataset.ld2Build = '18';
    const hero = r.querySelector('.ld2-unified-shell .ld2-ul-hero small');
    if (hero && hero.textContent !== 'LOVABLE DECRYPTER · BUILD 18') hero.textContent = 'LOVABLE DECRYPTER · BUILD 18';
    const card = addCard();
    if (!card) return false;
    const state = await status(force);
    const provider = localProvider(state);
    const h = health(provider);
    const badge = card.querySelector('[data-ul-badge="decrypter-local"]');
    if (badge) {
      badge.textContent = h.label;
      badge.dataset.state = h.state;
    }
    card.title = provider?.active
      ? `${provider.model_label || 'Decrypter Local'} · ${provider.health || 'OK'}${provider.latency_ms != null ? ` · health ${provider.latency_ms} ms` : ''}`
      : provider?.configured
        ? `Runtime configurado, mas indisponível: ${provider.health || 'health falhou'}`
        : 'O provider está integrado, mas nenhum runtime GPU privado foi configurado no backend.';
    return true;
  }

  async function openLocal() {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld2-cloud-card';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>BUILD 18 · DECRYPTER LOCAL</small><h2>Decrypter AI Runtime</h2><p>Provider self-hosted, privado e health-gated atrás do Model Gateway.</p></div><button class="ld2-close" type="button" data-b18-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Consultando runtime…</p></div>';
    $('[data-b18-close]', card).onclick = () => modal.classList.remove('open');

    const state = await status(true);
    const provider = localProvider(state);
    const h = health(provider);
    const body = $('.ld2-modal-body', card);
    if (!body) return;
    body.innerHTML = `<div class="ld2-kv">
      <div>Provider</div><div>${esc(h.label)} · decrypter-local</div>
      <div>Gateway</div><div>${state?.ok ? '<span class="ld2-ul-diag-good">ATIVO</span>' : '<span class="ld2-ul-diag-warn">DEGRADADO</span>'} · server-authoritative</div>
      <div>Modelo recomendado</div><div>${esc(provider?.model_label || 'Qwen/Qwen3-Coder-30B-A3B-Instruct')}</div>
      <div>Nome lógico servido</div><div>${esc(provider?.served_model || 'decrypter-local')}</div>
      <div>Runtime</div><div>vLLM · OpenAI-compatible · privado</div>
      <div>Configurado no backend</div><div>${provider?.configured ? 'SIM' : 'NÃO'}</div>
      <div>Health</div><div>${esc(provider?.health || 'LOCAL_RUNTIME_NOT_CONFIGURED')}</div>
      <div>Latência do health</div><div>${provider?.latency_ms != null ? `${Number(provider.latency_ms)} ms` : '—'}</div>
      <div>Chave Gemini</div><div>${provider?.active ? '<span class="ld2-ul-diag-good">NÃO NECESSÁRIA NO LOCAL</span>' : 'usada apenas quando o Gateway escolhe Gemini'}</div>
      <div>Cross-provider retry</div><div><span class="ld2-ul-diag-good">DESATIVADO</span></div>
      <div>Segredos do runtime no browser</div><div><span class="ld2-ul-diag-good">NENHUM</span></div>
    </div>
    <p class="ld2-help" style="margin-top:12px">O Model Gateway só seleciona Decrypter Local após confirmar o modelo carregado em /v1/models. Se a inferência Local falhar depois de iniciada, a operação falha fechado; não existe retry silencioso em Gemini. Anexos multimodais/binaries continuam no executor compatível.</p>`;
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#ld2-root .ld2-unified-shell [data-ul-action="decrypter-local"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openLocal();
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ld2_gateway_last_v1) reconcile(false);
  });
  window.addEventListener('ld2:unified-launcher-ready', () => reconcile(true));
  window.addEventListener('ld2:ui-mounted', () => reconcile(true));

  window.LovableDecrypterBuild18 = Object.freeze({ build: 18, schema: 'ld-local-runtime/1', status, reconcile, open: openLocal });

  let attempts = 0;
  const bounded = () => {
    Promise.resolve(reconcile(attempts === 0)).then(done => {
      if (!done && ++attempts < 30) setTimeout(bounded, 100 + attempts * 25);
    });
  };
  bounded();
})();
