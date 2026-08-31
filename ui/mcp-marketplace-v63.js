(() => {
  'use strict';
  if (window.__LD63_MCP_MARKETPLACE_UI__) return;
  window.__LD63_MCP_MARKETPLACE_UI__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const categoryLabel = {github:'GitHub',supabase:'Supabase',code:'Código',memory:'Memória',security:'Segurança',observability:'Observabilidade'};
  const availabilityLabel = {direct:'Instalação direta','endpoint-required':'Endpoint regional','bridge-required':'Bridge local necessário'};
  let overlay = null;
  let catalog = [];
  let installs = {};
  let filter = 'all';
  let query = '';
  let busy = new Set();

  const root = () => document.getElementById(ROOT_ID);
  const api = () => window.LovableDecrypterMCPMarketplace;

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = message;
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3500);
  }

  function installed(item) { return installs?.[item.id]?.status === 'installed'; }
  function categories() { return ['all', ...new Set(catalog.map(item => item.category))]; }
  function filtered() {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    return catalog.filter(item => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (!q) return true;
      return `${item.title} ${item.publisher} ${item.description} ${item.category} ${(item.capabilities || []).join(' ')}`.toLocaleLowerCase('pt-BR').includes(q);
    });
  }

  function riskText(risk) { return risk === 'low' ? 'baixo' : risk === 'high' ? 'alto' : 'médio'; }

  function card(item) {
    const active = installed(item);
    const loading = busy.has(item.id);
    const bridge = item.availability === 'bridge-required';
    return `<article class="ld63-card" data-mcp-item="${esc(item.id)}" data-installed="${active ? '1' : '0'}">
      <div class="ld63-card-top"><span class="ld63-icon">${esc(item.badge)}</span><div><span class="ld63-official">CURADO</span><small>${esc(item.publisher)}</small></div></div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.description)}</p>
      <div class="ld63-tags"><span>${esc(categoryLabel[item.category] || item.category)}</span><span>risco ${esc(riskText(item.risk))}</span><span>${esc(availabilityLabel[item.availability] || item.availability)}</span></div>
      <div class="ld63-card-actions">
        <button type="button" data-mcp-details>Detalhes</button>
        ${bridge ? '<button type="button" disabled>Bridge necessário</button>' : `<button type="button" class="${active ? 'danger' : 'primary'}" data-mcp-toggle ${loading ? 'disabled' : ''}>${loading ? 'Aguarde…' : active ? 'Revogar' : 'Instalar'}</button>`}
      </div>
    </article>`;
  }

  function render() {
    if (!overlay) return;
    const grid = $('[data-mcp-grid]', overlay);
    const list = filtered();
    grid.innerHTML = list.length ? list.map(card).join('') : '<div class="ld63-empty">Nenhum MCP encontrado.</div>';
    $('[data-mcp-count]', overlay).textContent = `${catalog.length} curados · ${Object.values(installs || {}).filter(x => x?.status === 'installed').length} instalado(s)`;
    const filters = $('[data-mcp-filters]', overlay);
    filters.innerHTML = categories().map(name => `<button type="button" data-mcp-filter="${esc(name)}" class="${name === filter ? 'active' : ''}">${esc(name === 'all' ? 'Todos' : categoryLabel[name] || name)}</button>`).join('');
  }

  function installForm(item) {
    if (item.id === 'supabase-official-remote') {
      return `<div class="ld63-config">
        <label>Project ref <input data-cfg-project placeholder="opcional, mas recomendado"></label>
        <label class="check"><input type="checkbox" data-cfg-readonly checked> Read-only</label>
        <label>Features <input data-cfg-features value="docs,database,debugging" placeholder="docs,database,debugging"></label>
        <small>Sem project_ref, o servidor pode enxergar mais de um projeto conforme a conta autenticada. O marketplace mantém read-only ligado por padrão.</small>
      </div>`;
    }
    if (item.id === 'datadog-official-observability') {
      return `<div class="ld63-config">
        <label>Endpoint regional <input data-cfg-endpoint placeholder="https://...datadoghq.com/.../mcp"></label>
        <label>Toolsets <input data-cfg-toolsets placeholder="apm,llmobs"></label>
        <small>Use somente o endpoint exibido pela documentação da sua região Datadog.</small>
      </div>`;
    }
    return '';
  }

  function detail(item) {
    const panel = $('[data-mcp-detail]', overlay);
    const active = installed(item);
    const bridge = item.availability === 'bridge-required';
    panel.hidden = false;
    panel.innerHTML = `<header><div><span>${esc(item.badge)} · ${esc(item.publisher)}</span><h3>${esc(item.title)}</h3></div><button type="button" data-mcp-detail-close aria-label="Fechar">×</button></header>
      <p>${esc(item.description)}</p>
      <section class="ld63-facts">
        <div><b>Trust</b><span>${esc(item.trustLevel)}</span></div>
        <div><b>Transporte</b><span>${esc(item.transport)}</span></div>
        <div><b>Disponibilidade</b><span>${esc(availabilityLabel[item.availability] || item.availability)}</span></div>
        <div><b>Writes</b><span>Nunca habilitados automaticamente</span></div>
      </section>
      <section><b>Capacidades</b><div class="ld63-capabilities">${(item.capabilities || []).map(x => `<span>${esc(x)}</span>`).join('')}</div></section>
      <section><b>Proveniência</b><div>${esc(item.provenance?.sourceKind || '')} · ${esc(item.provenance?.verifiedDomain || '')} · revisado ${esc(item.provenance?.reviewedAt || '')}</div><small>${esc(item.provenance?.sourceUrl || '')}</small></section>
      ${installForm(item)}
      <footer>
        <span>${bridge ? 'Item curado, aguardando suporte a bridge/local MCP.' : active ? 'Servidor instalado e submetido ao Trust Gateway.' : 'A instalação registra o servidor, mas nenhuma ferramenta de escrita é liberada.'}</span>
        ${bridge ? '' : `<button type="button" class="${active ? 'danger' : 'primary'}" data-mcp-detail-toggle>${active ? 'Revogar MCP' : 'Instalar MCP'}</button>`}
      </footer>`;
    $('[data-mcp-detail-close]', panel).onclick = () => { panel.hidden = true; };
    const toggle = $('[data-mcp-detail-toggle]', panel);
    if (toggle) toggle.onclick = async () => { await toggleItem(item, panel); };
  }

  function configurationFrom(container, item) {
    if (item.id === 'supabase-official-remote') {
      return {
        project_ref: $('[data-cfg-project]', container)?.value?.trim() || '',
        read_only: $('[data-cfg-readonly]', container)?.checked !== false,
        features: ($('[data-cfg-features]', container)?.value || '').split(',').map(x => x.trim()).filter(Boolean)
      };
    }
    if (item.id === 'datadog-official-observability') {
      return {
        endpoint: $('[data-cfg-endpoint]', container)?.value?.trim() || '',
        toolsets: $('[data-cfg-toolsets]', container)?.value?.trim() || ''
      };
    }
    return {};
  }

  async function refreshState() {
    const service = api();
    if (!service) throw new Error('MCP Marketplace runtime indisponível.');
    const [catalogResult, installResult] = await Promise.all([service.catalog(), service.reconcile()]);
    catalog = Array.isArray(catalogResult?.catalog) ? catalogResult.catalog : [];
    installs = installResult?.installs || {};
    render();
  }

  async function toggleItem(item, detailContainer = null) {
    if (!item || busy.has(item.id)) return;
    busy.add(item.id); render();
    try {
      const service = api();
      if (installed(item)) {
        await service.revoke(item.id, 'user_revoked_from_marketplace');
        toast(`${item.title} revogado.`);
      } else {
        const config = configurationFrom(detailContainer || overlay, item);
        const result = await service.install(item.id, config);
        if (result?.server?.id && result?.permission?.granted !== true) {
          const permission = await service.requestHostPermission(result.server.id);
          if (!permission?.granted) toast('MCP instalado, mas a permissão de rede não foi concedida.', true);
        }
        toast(`${item.title} instalado.`);
      }
      await refreshState();
      if (detailContainer?.isConnected) detail(item);
    } catch (error) {
      toast(error?.message || String(error), true);
    } finally {
      busy.delete(item.id); render();
    }
  }

  function markup() {
    return `<div class="ld63-backdrop" data-mcp-close></div><section class="ld63-shell" role="dialog" aria-modal="true" aria-label="Curated MCP Marketplace">
      <header><div><span>TRUSTED CONNECTORS</span><h2>Curated MCP Marketplace</h2><small data-mcp-count>Carregando…</small></div><button type="button" data-mcp-close aria-label="Fechar">×</button></header>
      <div class="ld63-toolbar"><label><input type="search" data-mcp-search placeholder="Buscar MCP, publisher ou capacidade…"></label><div class="ld63-filters" data-mcp-filters></div></div>
      <main data-mcp-grid></main>
      <aside class="ld63-detail" data-mcp-detail hidden></aside>
      <footer><span>Catálogo embutido e versionado. Sem catálogo remoto arbitrário, sem código remoto e sem writes automáticos.</span></footer>
    </section>`;
  }

  async function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    const r = root(); if (!r) return null;
    overlay = document.createElement('div');
    overlay.className = 'ld63-overlay';
    overlay.innerHTML = markup();
    r.appendChild(overlay);
    $('[data-mcp-search]', overlay).addEventListener('input', event => { query = event.target.value || ''; render(); });
    overlay.addEventListener('click', async event => {
      if (event.target.closest('[data-mcp-close]')) { close(); return; }
      const filterButton = event.target.closest('[data-mcp-filter]');
      if (filterButton) { filter = filterButton.dataset.mcpFilter || 'all'; render(); return; }
      const cardNode = event.target.closest('[data-mcp-item]');
      const item = cardNode && catalog.find(x => x.id === cardNode.dataset.mcpItem);
      if (item && event.target.closest('[data-mcp-details]')) { detail(item); return; }
      if (item && event.target.closest('[data-mcp-toggle]')) { detail(item); return; }
    });
    return overlay;
  }

  async function open() {
    const shell = await ensureOverlay(); if (!shell) return;
    shell.classList.add('open');
    filter = 'all'; query = '';
    const search = $('[data-mcp-search]', shell); if (search) search.value = '';
    try { await refreshState(); } catch (error) { toast(error?.message || String(error), true); }
    requestAnimationFrame(() => search?.focus());
  }
  function close() { overlay?.classList.remove('open'); }

  function installRailButton() {
    const list = root()?.querySelector('.ld3-rail-list');
    if (!list) return false;
    if (list.querySelector('[data-ld63-mcp-marketplace]')) return true;
    const marketplace = list.querySelector('[data-ld42-marketplace]');
    const branding = list.querySelector('[data-ld41-branding]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ld3-rail-btn ld63-mcp-rail';
    button.dataset.ld63McpMarketplace = '1';
    button.setAttribute('aria-label', 'Curated MCP Marketplace');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8v4h3v6h-3v3H8v-3H5v-6h3Z"/><path d="M10 10h4v4h-4Z"/></svg><span class="ld3-rail-tip">MCPs</span>';
    button.addEventListener('click', event => { event.preventDefault(); open(); });
    const anchor = marketplace || branding;
    if (anchor?.nextSibling) list.insertBefore(button, anchor.nextSibling); else list.appendChild(button);
    return true;
  }

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); event.stopPropagation(); open(); }
    else if (event.key === 'Escape' && overlay?.classList.contains('open')) close();
  }, true);

  const delivery = window.LovableDecrypterDeliveryScheduler;
  if (delivery?.register) delivery.register('build63:mcp-marketplace-rail', () => installRailButton(), { interval:100, maxAttempts:120 });
  else queueMicrotask(installRailButton);
  window.addEventListener('ld3:design-system-ready', installRailButton);

  window.LovableDecrypterMCPMarketplaceUI = Object.freeze({ build:63, open, close, refresh:refreshState });
})();
