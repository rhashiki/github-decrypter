(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD15_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD15_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const LAST_KEY = 'ld2_intelligence_last_v1';
  const HISTORY_KEY = 'ld2_intelligence_history_v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function root() { return document.getElementById(ROOT_ID); }

  async function state() {
    const data = await chrome.storage.local.get([LAST_KEY, HISTORY_KEY]);
    const last = data[LAST_KEY] || null;
    const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    let settings = {};
    try { settings = await window.LovableDecrypterV2?.runtime?.({ type: 'LD2_SETTINGS_GET' }) || {}; } catch (_) {}
    return { last, history, settings };
  }

  function addCard() {
    const grid = root()?.querySelector('.ld2-unified-shell [data-ul-section="intelligence"] .ld2-ul-grid');
    if (!grid || grid.querySelector('[data-ul-action="intelligence-core"]')) return;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'ld2-ul-card';
    card.dataset.ulAction = 'intelligence-core';
    card.innerHTML = '<span>DI</span><div><b>Decrypter Intelligence</b><small>Intent, estratégia, tools e validação</small></div><em data-ul-badge="intelligence-core" data-state="good">ATIVA</em>';
    grid.prepend(card);
  }

  async function reconcile() {
    const r = root();
    if (!r) return false;
    if (Number(r.dataset.ld2Build || 0) < 15) r.dataset.ld2Build = '15';
    addCard();

    const hero = r.querySelector('.ld2-unified-shell .ld2-ul-hero small');
    if (hero && !/BUILD\s+(?:1[6-9]|[2-9]\d)/i.test(hero.textContent || '') && hero.textContent !== 'LOVABLE DECRYPTER · BUILD 15') hero.textContent = 'LOVABLE DECRYPTER · BUILD 15';

    const tile = r.querySelector('.ld2-unified-shell [data-ul-status="ai"]');
    if (tile) {
      const label = tile.querySelector('small');
      if (label && label.textContent !== 'Decrypter Intelligence') label.textContent = 'Decrypter Intelligence';
      const value = tile.querySelector('b');
      const data = await chrome.storage.local.get(LAST_KEY);
      const last = data[LAST_KEY];
      const intent = String(last?.intent?.primary || '').toUpperCase();
      const risk = String(last?.risk?.level || '').toUpperCase();
      const text = intent ? `${intent}${risk ? ` · ${risk}` : ''}` : 'PRONTA';
      if (value && value.textContent !== text) value.textContent = text;
      tile.dataset.state = last?.status === 'blocked' || last?.status === 'failed' ? 'warn' : 'good';
      tile.title = last
        ? `Estratégia: ${last.strategy || '—'} · Provider: executor only`
        : 'Decrypter Intelligence ativa. O provider atual executa o Execution Brief.';
    }
    return !!r.querySelector('.ld2-unified-shell');
  }

  function knowledgeStatusMarkup(knowledge = {}) {
    const status = String(knowledge?.status || (knowledge?.active ? 'ready' : 'degraded')).toLowerCase();
    const label = status === 'ready' ? 'READY' : status === 'empty' ? 'EMPTY' : status === 'degraded' ? 'DEGRADADO' : status.toUpperCase();
    const cls = status === 'ready' || status === 'empty' ? 'ld2-ul-diag-good' : 'ld2-ul-diag-warn';
    const hits = Math.max(0, Number(knowledge?.hit_count || 0));
    const vector = Math.max(0, Number(knowledge?.vector_hits || 0));
    const keyword = Math.max(0, Number(knowledge?.keyword_only_hits || 0));
    const sources = Array.isArray(knowledge?.citations) ? knowledge.citations.length : 0;
    return `<span class="${cls}">${esc(label)}</span> · ${hits} hit(s) · ${vector} vector · ${keyword} keyword · ${sources} fonte(s)`;
  }

  async function openIntelligence() {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld2-cloud-card';
    card.innerHTML = '<div class="ld2-modal-head"><div><small>DECRYPTER INTELLIGENCE</small><h2>Intelligence Core</h2><p>O Decrypter decide; o provider executa.</p></div><button class="ld2-close" type="button" data-b15-close>×</button></div><div class="ld2-modal-body"><p class="ld2-help">Carregando decisão mais recente…</p></div>';
    $('[data-b15-close]', card).onclick = () => modal.classList.remove('open');

    try {
      const s = await state();
      const last = s.last || {};
      const model = String(s.settings?.gemini?.model || '').replace(/^models\//, '') || 'provider atual';
      const intent = String(last?.intent?.primary || 'nenhuma execução registrada').toUpperCase();
      const secondary = Array.isArray(last?.intent?.secondary) ? last.intent.secondary.join(', ') : '—';
      const risk = String(last?.risk?.level || '—').toUpperCase();
      const tools = Array.isArray(last?.tool_route?.recommended) ? last.tool_route.recommended.join(' · ') : 'github_repository';
      const skills = Array.isArray(last?.skills?.slugs) && last.skills.slugs.length ? last.skills.slugs.join(' · ') : 'nenhuma registrada';
      const knowledge = last?.knowledge || { active: false, status: 'degraded', hit_count: 0, citations: [] };
      $('.ld2-modal-body', card).innerHTML = `<div class="ld2-kv">
        <div>Core</div><div><span class="ld2-ul-diag-good">ATIVA</span> · ld-intelligence/1</div>
        <div>Última intenção</div><div>${esc(intent)}</div>
        <div>Intenções secundárias</div><div>${esc(secondary)}</div>
        <div>Risco</div><div>${esc(risk)}</div>
        <div>Estratégia</div><div>${esc(last?.strategy || 'aguardando execução')}</div>
        <div>Tool route</div><div>${esc(tools)} · advisory</div>
        <div>Skills</div><div>${esc(skills)}</div>
        <div>Validação</div><div>${last?.validation?.allowed === false ? '<span class="ld2-ul-diag-bad">BLOQUEADA</span>' : '<span class="ld2-ul-diag-good">ATIVA</span>'}</div>
        <div>Provider atual</div><div>${esc(model)} · executor técnico</div>
        <div>Decrypter Knowledge / RAG</div><div>${knowledgeStatusMarkup(knowledge)}</div>
        <div>Model Gateway</div><div><span class="ld2-ul-diag-warn">BUILD 17 · INATIVO</span></div>
        <div>Histórico local</div><div>${Number(s.history?.length || 0)} decisão(ões)</div>
      </div><p class="ld2-help" style="margin-top:12px">O Execution Brief é criado antes da chamada do provider e define objetivo, intenção, risco, constraints, tool route e validações. O Knowledge é evidência somente-leitura e nunca substitui o pedido do usuário, Project Rules, Scope Lock, checkpoints, Queue ou autoridade de commit.</p>`;
    } catch (error) {
      $('.ld2-modal-body', card).textContent = error?.message || String(error);
    }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#ld2-root .ld2-unified-shell [data-ul-action="intelligence-core"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openIntelligence();
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[LAST_KEY] || changes[HISTORY_KEY])) reconcile();
  });

  window.LovableDecrypterBuild15 = Object.freeze({
    build: 15,
    schema: 'ld-intelligence/1',
    reconcile,
    open: openIntelligence,
    async snapshot() { return state(); }
  });

  window.addEventListener('ld2:unified-launcher-ready', reconcile);
  window.addEventListener('ld2:ui-mounted', reconcile);
  let attempts = 0;
  const bounded = () => {
    Promise.resolve(reconcile()).then(done => {
      if (!done && ++attempts < 30) setTimeout(bounded, 100 + attempts * 25);
    });
  };
  bounded();
})();
