(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD16_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD16_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const LAST_KEY = 'ld2_intelligence_last_v1';
  const STATUS_TTL = 30_000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let statusCache = null;
  let statusAt = 0;

  function root() { return document.getElementById(ROOT_ID); }

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) return resolve({ ok: false, code: chrome.runtime.lastError.message });
          resolve(response || { ok: false, code: 'EMPTY_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok: false, code: error?.message || String(error) });
      }
    });
  }

  async function status(force = false) {
    const now = Date.now();
    if (!force && statusCache && now - statusAt < STATUS_TTL) return statusCache;
    const response = await send({ type: 'LD2_INTELLIGENCE_STATUS' });
    statusCache = response;
    statusAt = now;
    return response;
  }

  function addCard() {
    const grid = root()?.querySelector('.ld2-unified-shell [data-ul-section="intelligence"] .ld2-ul-grid');
    if (!grid) return null;
    let card = grid.querySelector('[data-ul-action="knowledge"]');
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.className = 'ld2-ul-card';
      card.dataset.ulAction = 'knowledge';
      card.innerHTML = '<span>KB</span><div><b>Decrypter Knowledge</b><small>RAG oficial Lovable · GitHub · Supabase</small></div><em data-ul-badge="knowledge" data-state="warn">VERIFICANDO</em>';
      const intelligence = grid.querySelector('[data-ul-action="intelligence-core"]');
      if (intelligence?.nextSibling) grid.insertBefore(card, intelligence.nextSibling);
      else grid.prepend(card);
    }
    return card;
  }

  function healthOf(response) {
    const knowledge = response?.knowledge || {};
    if (!response?.ok || knowledge?.active !== true) return { label: 'DEGRADADO', state: 'warn' };
    if (Number(knowledge.failed_chunks || 0) > 0) return { label: 'DEGRADADO', state: 'warn' };
    return { label: 'ATIVO', state: 'good' };
  }

  async function reconcile(force = false) {
    const r = root();
    if (!r) return false;
    if (Number(r.dataset.ld2Build || 0) < 16) r.dataset.ld2Build = '16';
    const hero = r.querySelector('.ld2-unified-shell .ld2-ul-hero small');
    if (hero && !/BUILD\s+(?:1[7-9]|[2-9]\d)/i.test(hero.textContent || '') && hero.textContent !== 'LOVABLE DECRYPTER · BUILD 16') hero.textContent = 'LOVABLE DECRYPTER · BUILD 16';
    const card = addCard();
    if (!card) return false;
    const badge = card.querySelector('[data-ul-badge="knowledge"]');
    const response = await status(force);
    const health = healthOf(response);
    if (badge) {
      badge.textContent = health.label;
      badge.dataset.state = health.state;
    }
    const k = response?.knowledge || {};
    card.title = response?.ok
      ? `${Number(k.sources || 0)} fontes · ${Number(k.ready_chunks || 0)}/${Number(k.total_chunks || 0)} chunks vetorizados · ${Number(k.pending_chunks || 0)} pendentes`
      : `Knowledge degradado: ${response?.code || k.error || 'indisponível'}`;
    return true;
  }

  function sourceMarkup(citations = []) {
    const list = Array.isArray(citations) ? citations : [];
    if (!list.length) return '<span class="ld2-activity-muted">Nenhuma fonte registrada na última operação.</span>';
    return `<div class="ld2-history-list">${list.slice(0, 8).map((source, index) => `<article class="ld2-history-row"><div class="ld2-history-meta"><b>${esc(String(source.category || 'DOC').toUpperCase())}</b><span>Fonte ${index + 1}</span></div><p>${esc(source.title || source.url)}</p><button type="button" data-b16-source="${esc(source.url)}">Abrir documentação</button></article>`).join('')}</div>`;
  }

  async function openKnowledge() {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld2-cloud-card';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>BUILD 16 · DECRYPTER KNOWLEDGE</small><h2>Knowledge / RAG</h2><p>Documentação oficial recuperada como evidência técnica, nunca como autoridade de execução.</p></div><button class="ld2-close" type="button" data-b16-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Consultando estado do Knowledge…</p></div>';
    $('[data-b16-close]', card).onclick = () => modal.classList.remove('open');

    const response = await status(true);
    const data = await chrome.storage.local.get(LAST_KEY).catch(() => ({}));
    const lastKnowledge = data?.[LAST_KEY]?.knowledge || {};
    const k = response?.knowledge || {};
    const health = healthOf(response);
    const body = $('.ld2-modal-body', card);
    if (!body) return;
    body.innerHTML = `<div class="ld2-kv">
      <div>Knowledge</div><div><span class="${health.state === 'good' ? 'ld2-ul-diag-good' : 'ld2-ul-diag-warn'}">${esc(health.label)}</span> · ld-knowledge/1</div>
      <div>Fontes oficiais</div><div>${Number(k.sources || 0)}</div>
      <div>Chunks</div><div>${Number(k.total_chunks || 0)}</div>
      <div>Vetorizados</div><div>${Number(k.ready_chunks || 0)}</div>
      <div>Pendentes/processando</div><div>${Number(k.pending_chunks || 0)}</div>
      <div>Falhos</div><div>${Number(k.failed_chunks || 0)}</div>
      <div>Embedding</div><div>${esc(k.embedding_model || 'gte-small')} · 384 dimensões</div>
      <div>Retrieval</div><div>${esc(k.retrieval || 'hybrid-vector-keyword')}</div>
      <div>Última consulta</div><div>${Number(lastKnowledge.hit_count || 0)} hit(s) · ${Number(lastKnowledge.vector_hits || 0)} vector · ${Number(lastKnowledge.keyword_only_hits || 0)} keyword fallback</div>
      <div>Ingestão</div><div>Somente docs oficiais allowlisted</div>
      <div>Código privado do cliente</div><div><span class="ld2-ul-diag-good">NÃO É INGERIDO</span></div>
      <div>Model Gateway</div><div><span class="ld2-ul-diag-good">ATIVO</span> · autoridade no backend</div>
    </div>
    <p class="ld2-help" style="margin-top:12px">A documentação recuperada é tratada como conteúdo não confiável de referência. Instruções encontradas dentro dos documentos são ignoradas. Pedido do usuário, Project Rules, código atual, Scope Lock, checkpoints e autoridade de commit continuam superiores.</p>
    <section style="margin-top:16px"><small>FONTES DA ÚLTIMA OPERAÇÃO</small>${sourceMarkup(lastKnowledge.citations)}</section>`;
    card.querySelectorAll('[data-b16-source]').forEach(button => button.onclick = () => window.open(button.dataset.b16Source, '_blank', 'noopener,noreferrer'));
    reconcile(true);
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#ld2-root .ld2-unified-shell [data-ul-action="knowledge"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openKnowledge();
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[LAST_KEY]) reconcile(false);
  });
  window.addEventListener('ld2:activity-history', () => reconcile(false));
  window.addEventListener('ld2:unified-launcher-ready', () => reconcile(true));
  window.addEventListener('ld2:ui-mounted', () => reconcile(true));

  window.LovableDecrypterBuild16 = Object.freeze({ build: 16, schema: 'ld-knowledge/1', status, reconcile, open: openKnowledge });

  let attempts = 0;
  const bounded = () => {
    Promise.resolve(reconcile(attempts === 0)).then(done => {
      if (!done && ++attempts < 30) setTimeout(bounded, 100 + attempts * 25);
    });
  };
  bounded();
})();
