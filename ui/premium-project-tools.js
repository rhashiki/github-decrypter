(() => {
  'use strict';
  if (window.__LD39_PREMIUM_PROJECT_TOOLS__) return;
  window.__LD39_PREMIUM_PROJECT_TOOLS__ = true;

  const ROOT_ID = 'ld2-root';
  const VERSION = chrome.runtime.getManifest().version;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const TOOLS = Object.freeze({
    brain: {
      label: 'Project Brain',
      short: 'Brain',
      action: 'openBrain',
      detail: 'Memória técnica persistente do projeto.'
    },
    rules: {
      label: 'Project Rules',
      short: 'Rules',
      action: 'openRules',
      detail: 'Regras permanentes aplicadas antes da execução.'
    },
    impact: {
      label: 'Impact Map',
      short: 'Impact',
      action: 'openImpacts',
      detail: 'Arquivos, dependências e risco antes da mudança.'
    },
    explain: {
      label: 'Explain Project',
      short: 'Explain',
      action: 'openExplain',
      detail: 'Arquitetura, regras e riscos sem nova chamada Gemini.'
    }
  });

  let rootObserver = null;
  let latestRisk = '';
  let reconcileQueued = false;

  function root() {
    return document.getElementById(ROOT_ID);
  }

  function intelligence() {
    return window.LovableDecrypterProjectIntelligence || null;
  }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const item = document.createElement('div');
    item.className = `ld2-toast${error ? ' error' : ''}`;
    item.textContent = message;
    wrap.appendChild(item);
    setTimeout(() => item.remove(), 3600);
  }

  function riskLabel(value) {
    const risk = String(value || '').toLowerCase();
    return ({ low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL' })[risk] || '';
  }

  function currentToolFromTitle(title) {
    const value = String(title || '').trim().toLowerCase();
    if (value.includes('brain')) return 'brain';
    if (value.includes('rule')) return 'rules';
    if (value.includes('impact')) return 'impact';
    if (value.includes('explain')) return 'explain';
    return '';
  }

  function openTool(key) {
    const tool = TOOLS[key];
    const api = intelligence();
    if (!tool || typeof api?.[tool.action] !== 'function') {
      toast('Project Intelligence ainda não terminou de inicializar.', true);
      return;
    }
    api[tool.action]();
    requestAnimationFrame(() => requestAnimationFrame(reconcile));
  }

  function toolButton(key, tool) {
    const risk = key === 'impact' && latestRisk ? `<em data-ld39-risk="${latestRisk}">${riskLabel(latestRisk)}</em>` : '';
    return `<button type="button" data-ld39-open="${key}" aria-label="Abrir ${tool.label}" title="${tool.detail}"><span>${tool.short}</span>${risk}</button>`;
  }

  function buildToolstrip(section) {
    if (!section || $('[data-ld39-toolstrip]', section)) return;
    const strip = document.createElement('nav');
    strip.className = 'ld39-project-tools';
    strip.dataset.ld39Toolstrip = '1';
    strip.setAttribute('aria-label', 'Project Intelligence');
    strip.innerHTML = `
      <div class="ld39-project-tools-copy">
        <small>PROJECT INTELLIGENCE</small>
        <b>Ferramentas do projeto</b>
        <span>Contexto, regras e impacto sem sair do projeto atual.</span>
      </div>
      <div class="ld39-project-tools-actions">
        ${Object.entries(TOOLS).map(([key, tool]) => toolButton(key, tool)).join('')}
      </div>`;
    strip.addEventListener('click', event => {
      const button = event.target.closest('[data-ld39-open]');
      if (!button) return;
      openTool(button.dataset.ld39Open || '');
    });
    section.appendChild(strip);
  }

  function updateImpactBadge(scope = root()) {
    const button = scope?.querySelector('[data-ld39-open="impact"]');
    if (!button) return;
    let badge = button.querySelector('[data-ld39-risk]');
    if (!latestRisk) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('em');
      badge.dataset.ld39Risk = latestRisk;
      button.appendChild(badge);
    }
    badge.dataset.ld39Risk = latestRisk;
    badge.textContent = riskLabel(latestRisk);
  }

  function decorateContext(r) {
    const section = $('[data-ld2-project-context]', r);
    if (!section) return;
    section.dataset.ld39PremiumProject = '1';
    buildToolstrip(section);
    updateImpactBadge(section);
  }

  function decorateControlCenterCards(r) {
    const map = [
      ['[data-cc-action="train"]', 'brain'],
      ['[data-cc-intel="rules"]', 'rules'],
      ['[data-cc-intel="impact"]', 'impact'],
      ['[data-cc-intel="explain"]', 'explain']
    ];
    for (const [selector, key] of map) {
      const button = $(selector, r);
      if (!button) continue;
      button.dataset.ld39ProjectTool = key;
      button.setAttribute('aria-label', `Abrir ${TOOLS[key].label}`);
    }
  }

  function modalToolbar(activeKey) {
    return `
      <nav class="ld39-project-modal-tabs" data-ld39-modal-tabs aria-label="Project Intelligence">
        ${Object.entries(TOOLS).map(([key, tool]) => `<button type="button" data-ld39-modal-open="${key}" data-active="${key === activeKey ? '1' : '0'}">${tool.short}</button>`).join('')}
      </nav>`;
  }

  function decorateModal(r) {
    const card = $('.ld2-card.project-intelligence', r);
    if (!card) return;
    const title = $('.ld2-cloud-head h2', card)?.textContent || '';
    const activeKey = currentToolFromTitle(title);
    card.dataset.ld39ProjectModal = activeKey || 'project';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const head = $('.ld2-cloud-head', card);
    if (head) {
      const small = $('small', head);
      if (small) small.textContent = 'PROJECT INTELLIGENCE · PREMIUM TOOLS';
      const close = $('[data-intel-close]', head);
      if (close) close.setAttribute('aria-label', 'Fechar Project Intelligence');
    }

    let tabs = $('[data-ld39-modal-tabs]', card);
    if (!tabs) {
      const holder = document.createElement('div');
      holder.innerHTML = modalToolbar(activeKey);
      tabs = holder.firstElementChild;
      head?.insertAdjacentElement('afterend', tabs);
      tabs?.addEventListener('click', event => {
        const button = event.target.closest('[data-ld39-modal-open]');
        if (!button) return;
        openTool(button.dataset.ld39ModalOpen || '');
      });
    } else {
      $$('[data-ld39-modal-open]', tabs).forEach(button => {
        button.dataset.active = button.dataset.ld39ModalOpen === activeKey ? '1' : '0';
      });
    }

    if (activeKey && !card.querySelector('[data-ld39-modal-meta]')) {
      const meta = document.createElement('div');
      meta.className = 'ld39-project-modal-meta';
      meta.dataset.ld39ModalMeta = '1';
      meta.innerHTML = `<span>PROJETO ATUAL</span><b>${TOOLS[activeKey].detail}</b><em>v${VERSION}</em>`;
      tabs?.insertAdjacentElement('afterend', meta);
    }
  }

  function reconcile() {
    reconcileQueued = false;
    const r = root();
    if (!r) return;
    decorateContext(r);
    decorateControlCenterCards(r);
    decorateModal(r);
  }

  function queueReconcile() {
    if (reconcileQueued) return;
    reconcileQueued = true;
    requestAnimationFrame(reconcile);
  }

  function mount(r) {
    if (!r || r.dataset.ld39ProjectToolsMounted === '1') return;
    r.dataset.ld39ProjectToolsMounted = '1';
    reconcile();
    rootObserver = new MutationObserver(queueReconcile);
    rootObserver.observe(r, { childList: true, subtree: true });
  }

  window.addEventListener('ld2:project-context', queueReconcile);
  window.addEventListener('ld2:project', queueReconcile);
  window.addEventListener('ld2:control-center-ready', queueReconcile);
  window.addEventListener('ld2:dom-reconcile', queueReconcile);
  window.addEventListener('ld2:impact-recorded', event => {
    latestRisk = String(event.detail?.risk || '').toLowerCase();
    updateImpactBadge();
    queueReconcile();
  });

  window.LovableDecrypterPremiumProjectTools = Object.freeze({
    open: openTool,
    reconcile,
    build: 39
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const r = root();
    if (r) {
      clearInterval(timer);
      mount(r);
    } else if (attempts >= 120) {
      clearInterval(timer);
    }
  }, 250);
})();
