(() => {
  'use strict';
  if (window.__LD42_DECRYPTER_MARKETPLACE__) return;
  window.__LD42_DECRYPTER_MARKETPLACE__ = true;

  const ROOT_ID = 'ld2-root';
  const INSTALLS_KEY = 'ld42_marketplace_installs';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const CATALOG = Object.freeze([
    {
      id:'ui-quality-gate', version:1, category:'Frontend', title:'UI/UX Quality Gate', badge:'UI', risk:'low',
      description:'Revisão consistente de responsividade, acessibilidade, hierarquia e regressões visuais.',
      useWhen:'Use when o pedido alterar layout, componentes, navegação, modais, formulários ou responsividade.',
      avoidWhen:'Evite quando a tarefa for exclusivamente backend, SQL ou infraestrutura sem interface.',
      definition:'Antes de concluir mudanças de UI, valide mobile e desktop, foco por teclado, contraste, estados vazios/erro/loading, overflow, hierarquia visual e consistência com o design system existente. Preserve funcionalidades atuais e prefira mudanças incrementais. Não crie funcionalidades que não foram solicitadas.'
    },
    {
      id:'accessibility-review', version:1, category:'Frontend', title:'Accessibility Review', badge:'A11Y', risk:'low',
      description:'Checklist de teclado, semântica, labels, foco e reduced-motion para interfaces.',
      useWhen:'Use when houver criação ou alteração de controles, overlays, menus, formulários ou navegação.',
      avoidWhen:'Evite em tarefas que não tenham qualquer superfície de interface.',
      definition:'Audite semântica HTML, nome acessível de controles, ordem e visibilidade de foco, navegação por teclado, aria somente quando necessário, reduced-motion e estados disabled/expanded/selected. Não esconda conteúdo essencial de leitores de tela e não substitua elementos nativos por divs clicáveis sem necessidade.'
    },
    {
      id:'supabase-migration-guard', version:1, category:'Backend', title:'Supabase Migration Guard', badge:'DB', risk:'low',
      description:'Guardrails para migrations, RLS, SECURITY DEFINER e mudanças de schema.',
      useWhen:'Use when a tarefa envolver Supabase, PostgreSQL, migrations, RLS, RPCs, triggers ou policies.',
      avoidWhen:'Evite quando não houver mudança ou análise de banco de dados.',
      definition:'Trate migrations como mudanças versionadas e reprodutíveis. Preserve dados por padrão. Em SECURITY DEFINER use search_path restritivo e referências qualificadas. Verifique RLS, grants e autoridade do backend. Mudanças destrutivas exigem justificativa e aprovação explícita. Não exponha service_role, tokens ou segredos ao cliente.'
    },
    {
      id:'github-change-discipline', version:1, category:'Engineering', title:'GitHub Change Discipline', badge:'GIT', risk:'low',
      description:'Patches mínimos, histórico legível, CI e proteção contra regressão cumulativa.',
      useWhen:'Use when a tarefa envolver alterações de código, branches, commits, CI ou releases.',
      avoidWhen:'Evite em tarefas puramente explicativas sem alteração no repositório.',
      definition:'Faça mudanças mínimas e relacionadas ao escopo. Preserve garantias cumulativas. Antes de promover uma branch, confirme CI verde e que a branch está apenas à frente da base; use fast-forward sem force. Não publique release, tag ou OTA sem autorização específica. Não misture builds independentes no mesmo commit lógico.'
    },
    {
      id:'security-browser-extension', version:1, category:'Security', title:'Browser Extension Security', badge:'SEC', risk:'low',
      description:'Regras de isolamento para content scripts, eventos, credenciais e observação de DOM.',
      useWhen:'Use when a tarefa alterar content scripts, comunicação com página, credenciais, permissões ou monitoramento do DOM.',
      avoidWhen:'Evite quando a mudança não tocar runtime da extensão ou superfícies de segurança.',
      definition:'Prefira listeners e observers estritamente escopados. Não aplique monkeypatch global de fetch, XMLHttpRequest ou sendBeacon. Minimize permissões do manifest. Não exponha tokens no page world. Preserve fail-closed nos caminhos de execução e valide eventos, origem e escopo antes de confiar em dados da página.'
    },
    {
      id:'performance-budget', version:1, category:'Quality', title:'Performance Budget', badge:'PERF', risk:'low',
      description:'Evita observers amplos, loops infinitos e trabalho repetitivo desnecessário no browser.',
      useWhen:'Use when a mudança adicionar listeners, timers, observers, reconciliação de UI ou processamento frequente.',
      avoidWhen:'Evite em alterações estáticas sem impacto de runtime.',
      definition:'Mantenha reconciliações bounded, idempotentes e escopadas. Evite polling permanente quando eventos existentes resolvem o problema. Não observe document/body globalmente sem necessidade. Limite listas renderizadas, debounces e caches. Meça custo antes de adicionar processamento frequente.'
    },
    {
      id:'release-readiness', version:1, category:'Operations', title:'Release Readiness', badge:'REL', risk:'low',
      description:'Checklist pré-release de versão, manifest, CI, artefato e rollback.',
      useWhen:'Use when a tarefa preparar versão, tag, artefato, release, OTA ou publicação.',
      avoidWhen:'Evite durante implementação comum que ainda não está sendo preparada para release.',
      definition:'Antes de uma release, valide versão e version_name, CI cumulativo, wiring do manifest, permissões, artefato reproduzível, checksum e caminho de rollback. Separe merge em main de publicação. Não crie release oficial, tag ou OTA sem autorização explícita.'
    },
    {
      id:'pwa-production-check', version:1, category:'Quality', title:'PWA Production Check', badge:'PWA', risk:'low',
      description:'Revisão de instalação, offline, cache, mobile e atualizações em projetos PWA.',
      useWhen:'Use when o projeto for PWA ou a tarefa alterar service worker, manifest web, instalação ou cache.',
      avoidWhen:'Evite em projetos que não sejam PWA e não usem service worker.',
      definition:'Valide manifest web, ícones, display, escopo, service worker, estratégia de atualização, cache de assets e comportamento offline. Teste mobile e desktop. Evite cachear respostas sensíveis e garanta que uma atualização não mantenha bundles incompatíveis indefinidamente.'
    }
  ]);

  let overlay = null;
  let filter = 'Todos';
  let query = '';
  let installs = {};
  let busy = new Set();
  let attempts = 0;

  const root = () => document.getElementById(ROOT_ID);
  const router = () => window.LovableDecrypterSkillRouter;

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = message;
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  async function loadInstalls() {
    try {
      const data = await chrome.storage.local.get(INSTALLS_KEY);
      installs = data[INSTALLS_KEY] && typeof data[INSTALLS_KEY] === 'object' ? data[INSTALLS_KEY] : {};
    } catch (_) { installs = {}; }
    return installs;
  }

  async function persistInstalls() {
    await chrome.storage.local.set({ [INSTALLS_KEY]: installs });
  }

  async function reconcileInstalls() {
    await loadInstalls();
    const api = router();
    if (!api?.list) return;
    try {
      const catalog = await api.list(true);
      const slugs = new Set((catalog?.custom || []).map(skill => String(skill.slug || '')));
      let changed = false;
      for (const [id, meta] of Object.entries(installs)) {
        if (!meta?.slug || !slugs.has(String(meta.slug))) { delete installs[id]; changed = true; }
      }
      if (changed) await persistInstalls();
    } catch (_) {}
  }

  function categories() { return ['Todos', ...new Set(CATALOG.map(item => item.category))]; }

  function card(item) {
    const installed = Boolean(installs[item.id]);
    const loading = busy.has(item.id);
    return `<article class="ld42-card" data-market-item="${item.id}" data-installed="${installed ? '1' : '0'}">
      <div class="ld42-card-top"><span class="ld42-card-icon">${esc(item.badge)}</span><span class="ld42-official">OFICIAL</span></div>
      <h3>${esc(item.title)}</h3><p>${esc(item.description)}</p>
      <div class="ld42-meta"><span>${esc(item.category)}</span><span>v${item.version}</span><span>baixo risco</span></div>
      <div class="ld42-card-actions"><button type="button" data-market-details>Detalhes</button><button type="button" class="${installed ? 'installed' : 'primary'}" data-market-toggle ${loading ? 'disabled' : ''}>${loading ? 'Aguarde…' : installed ? 'Desinstalar' : 'Instalar'}</button></div>
    </article>`;
  }

  function filteredCatalog() {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    return CATALOG.filter(item => {
      if (filter !== 'Todos' && item.category !== filter) return false;
      if (!q) return true;
      return `${item.title} ${item.description} ${item.category} ${item.badge}`.toLocaleLowerCase('pt-BR').includes(q);
    });
  }

  function render() {
    if (!overlay) return;
    const grid = $('[data-market-grid]', overlay);
    const list = filteredCatalog();
    grid.innerHTML = list.length ? list.map(card).join('') : '<div class="ld42-empty">Nenhum item encontrado.</div>';
    $('[data-market-count]', overlay).textContent = `${CATALOG.length} oficiais · ${Object.keys(installs).length} instalado(s)`;
    $$('[data-market-filter]', overlay).forEach(btn => btn.classList.toggle('active', btn.dataset.marketFilter === filter));
  }

  function detail(item) {
    const panel = $('[data-market-detail]', overlay);
    const installed = Boolean(installs[item.id]);
    panel.hidden = false;
    panel.innerHTML = `<header><div><span>${esc(item.badge)} · ${esc(item.category)}</span><h3>${esc(item.title)}</h3></div><button type="button" data-market-detail-close aria-label="Fechar">×</button></header><p>${esc(item.description)}</p><section><b>Ativa quando</b><div>${esc(item.useWhen)}</div></section><section><b>Evita quando</b><div>${esc(item.avoidWhen)}</div></section><section><b>Playbook</b><div>${esc(item.definition)}</div></section><footer><span>Conteúdo embutido nesta versão da extensão · sem código remoto</span><button type="button" class="${installed ? 'installed' : 'primary'}" data-market-detail-toggle>${installed ? 'Desinstalar' : 'Instalar Skill'}</button></footer>`;
    $('[data-market-detail-close]', panel).onclick = () => { panel.hidden = true; };
    $('[data-market-detail-toggle]', panel).onclick = async () => { await toggle(item); if (panel.isConnected) detail(item); };
  }

  async function install(item) {
    const api = router();
    if (!api?.createCustom) throw new Error('Skills Engine ainda não foi carregado.');
    if (installs[item.id]) return;
    const skill = await api.createCustom({
      display_name:item.title,
      use_when:item.useWhen,
      avoid_when:item.avoidWhen,
      definition:`Marketplace ID: ${item.id}\nMarketplace Version: ${item.version}\n\n${item.definition}`,
      enabled:true,
      auto_activation:true
    });
    const slug = String(skill?.slug || '');
    if (!slug) throw new Error('A Skill foi criada sem identificador válido.');
    installs[item.id] = { slug, version:item.version, installed_at:new Date().toISOString() };
    await persistInstalls();
    window.dispatchEvent(new CustomEvent('ld42:marketplace-installed', { detail:{ id:item.id, slug, version:item.version } }));
  }

  async function uninstall(item) {
    const meta = installs[item.id];
    if (!meta) return;
    const api = router();
    if (!api?.deleteCustom) throw new Error('Skills Engine ainda não foi carregado.');
    await api.deleteCustom(meta.slug);
    delete installs[item.id];
    await persistInstalls();
    window.dispatchEvent(new CustomEvent('ld42:marketplace-uninstalled', { detail:{ id:item.id } }));
  }

  async function toggle(item) {
    if (!item || busy.has(item.id)) return;
    busy.add(item.id); render();
    try {
      if (installs[item.id]) { await uninstall(item); toast(`${item.title} removida.`); }
      else { await install(item); toast(`${item.title} instalada.`); }
    } catch (error) { toast(error?.message || String(error), true); }
    finally { busy.delete(item.id); render(); }
  }

  function markup() {
    return `<div class="ld42-backdrop" data-market-close></div><section class="ld42-shell" role="dialog" aria-modal="true" aria-label="Decrypter Marketplace">
      <header><div><span>CURATED SKILLS</span><h2>Decrypter Marketplace</h2><small data-market-count>Carregando catálogo…</small></div><button type="button" data-market-close aria-label="Fechar">×</button></header>
      <div class="ld42-toolbar"><label><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input type="search" data-market-search placeholder="Buscar Skill oficial…"></label><div class="ld42-filters">${categories().map((name, i) => `<button type="button" data-market-filter="${esc(name)}" class="${i === 0 ? 'active' : ''}">${esc(name)}</button>`).join('')}</div></div>
      <main data-market-grid></main>
      <aside class="ld42-detail" data-market-detail hidden></aside>
      <footer><span>Marketplace seguro: catálogo embutido, versionado e sem execução de código remoto.</span><button type="button" data-market-open-skills>Abrir minhas Skills</button></footer>
    </section>`;
  }

  async function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    const r = root(); if (!r) return null;
    overlay = document.createElement('div');
    overlay.className = 'ld42-overlay';
    overlay.innerHTML = markup();
    r.appendChild(overlay);
    $('[data-market-search]', overlay).addEventListener('input', event => { query = event.target.value || ''; render(); });
    overlay.addEventListener('click', async event => {
      if (event.target.closest('[data-market-close]')) { close(); return; }
      const filterButton = event.target.closest('[data-market-filter]');
      if (filterButton) { filter = filterButton.dataset.marketFilter; render(); return; }
      const cardNode = event.target.closest('[data-market-item]');
      const item = cardNode && CATALOG.find(x => x.id === cardNode.dataset.marketItem);
      if (item && event.target.closest('[data-market-details]')) { detail(item); return; }
      if (item && event.target.closest('[data-market-toggle]')) { await toggle(item); return; }
      if (event.target.closest('[data-market-open-skills]')) { close(); root()?.querySelector('[data-action="skills"],[data-cc-action="skills"]')?.click(); }
    });
    return overlay;
  }

  async function open() {
    const shell = await ensureOverlay(); if (!shell) return;
    shell.classList.add('open');
    filter = 'Todos'; query = '';
    const search = $('[data-market-search]', shell); if (search) search.value = '';
    await reconcileInstalls(); render();
    requestAnimationFrame(() => search?.focus());
  }

  function close() { overlay?.classList.remove('open'); }

  function installRailButton() {
    const list = root()?.querySelector('.ld3-rail-list');
    if (!list) return false;
    if (list.querySelector('[data-ld42-marketplace]')) return true;
    const branding = list.querySelector('[data-ld41-branding]');
    const community = list.querySelector('[data-rail-id="community"]');
    const settings = list.querySelector('[data-rail-id="settings"]');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ld3-rail-btn ld42-market-rail'; button.dataset.ld42Marketplace = '1';
    button.setAttribute('aria-label','Decrypter Marketplace');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v12H4Z"/><path d="M7 8V5h10v3"/><path d="M4 12h16"/><path d="M9 12v2h6v-2"/></svg><span class="ld3-rail-tip">Marketplace</span>';
    button.addEventListener('click', event => { event.preventDefault(); open(); });
    const anchor = branding || community || settings;
    if (anchor) list.insertBefore(button, anchor); else list.appendChild(button);
    return true;
  }

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') { event.preventDefault(); event.stopPropagation(); open(); }
    else if (event.key === 'Escape' && overlay?.classList.contains('open')) close();
  }, true);

  const timer = setInterval(() => { attempts += 1; if (installRailButton() || attempts >= 120) clearInterval(timer); }, 100);
  window.addEventListener('ld3:design-system-ready', installRailButton);
  window.addEventListener('ld41:branding-changed', installRailButton);

  window.LovableDecrypterMarketplace = Object.freeze({
    build:42,
    open,
    catalog:CATALOG.map(({id,version,category,title,description}) => ({id,version,category,title,description})),
    installed:() => ({ ...installs })
  });
})();