(() => {
  'use strict';
  if (window.__LD3_PREMIUM_WORKSPACE__) return;
  window.__LD3_PREMIUM_WORKSPACE__ = true;

  const ROOT_ID = 'ld2-root';
  const VERSION = chrome.runtime.getManifest().version;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const text = value => String(value ?? '').trim();
  let modalCard = null;
  let snapshot = null;
  let context = null;
  let selectedPath = '';
  let selectedCategory = 'all';
  let query = '';
  let loading = false;

  function root() { return document.getElementById(ROOT_ID); }
  function deepRead() { return window.LovableDecrypterWorkspaceDeepRead; }
  function projectRuntime() { return window.LovableDecrypterProjectRuntime; }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function humanBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n)) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function backendLabel(backend = {}) {
    if (backend.type === 'supabase') return backend.supabaseRef ? `Supabase · ${backend.supabaseRef}` : 'Supabase';
    if (backend.type === 'lovable_cloud') return 'Lovable Cloud';
    if (backend.type === 'none') return 'Sem backend';
    return 'Não identificado';
  }

  function statusTone(ok, unknown = false) { return unknown ? 'warn' : ok ? 'good' : 'bad'; }

  function openLegacy(selector) {
    const target = root()?.querySelector(selector);
    if (!target) { toast('O módulo ainda não terminou de inicializar.', true); return; }
    close();
    setTimeout(() => target.click(), 20);
  }

  function categoryFor(path) {
    if (/^supabase\/migrations\//i.test(path)) return 'migrations';
    if (/^supabase\/functions\//i.test(path)) return 'edgeFunctions';
    if (/^supabase\//i.test(path)) return 'supabase';
    if (/(^|\/)(api|server|backend|functions)\//i.test(path)) return 'backend';
    if (/^(src|app|pages|components|routes|public)\//i.test(path)) return 'frontend';
    if (/(^|\/)(package\.json|vite\.config\.|tsconfig|config\.|\.config\.|toml$|ya?ml$|json$)/i.test(path)) return 'config';
    return 'other';
  }

  function categoryLabel(key) {
    return ({
      all:'Todos', frontend:'Frontend', backend:'Backend', supabase:'Supabase', migrations:'Migrations', edgeFunctions:'Edge Functions', config:'Config', other:'Outros'
    })[key] || key;
  }

  function projectName() {
    return text(context?.project?.name) || (text(context?.projectId) ? `Projeto ${text(context.projectId).slice(0, 8)}` : 'Workspace Lovable');
  }

  function shellMarkup() {
    return `
      <div class="ld3-ws-shell">
        <header class="ld3-ws-head">
          <div class="ld3-ws-title"><span class="ld3-ws-kicker">WORKSPACE</span><h2 data-ws-title>Workspace Lovable</h2><p data-ws-subtitle>Carregando contexto do projeto…</p></div>
          <div class="ld3-ws-head-actions"><span class="ld3-ws-version">v${esc(VERSION)}</span><button type="button" data-ws-refresh title="Atualizar Workspace" aria-label="Atualizar Workspace">↻</button><button type="button" data-ws-close aria-label="Fechar">×</button></div>
        </header>
        <div class="ld3-ws-body">
          <section class="ld3-ws-overview">
            <div class="ld3-ws-health" data-ws-health></div>
            <div class="ld3-ws-stats" data-ws-stats></div>
          </section>
          <section class="ld3-ws-browser">
            <aside class="ld3-ws-sidebar">
              <div class="ld3-ws-search"><input type="search" data-ws-search placeholder="Buscar arquivo…" autocomplete="off"></div>
              <div class="ld3-ws-filters" data-ws-filters></div>
              <div class="ld3-ws-files" data-ws-files><div class="ld3-ws-empty">Carregando arquivos…</div></div>
            </aside>
            <main class="ld3-ws-preview" data-ws-preview>
              <div class="ld3-ws-preview-empty"><span>⌁</span><b>Selecione um arquivo</b><small>O preview é somente leitura. Arquivos sensíveis permanecem protegidos.</small></div>
            </main>
          </section>
        </div>
        <footer class="ld3-ws-footer">
          <div class="ld3-ws-source"><i></i><span data-ws-source>Fonte: Lovable Workspace</span></div>
          <div class="ld3-ws-actions">
            <button type="button" data-ws-new-project>Novo projeto</button>
            <button type="button" data-ws-github>GitHub</button>
            <button type="button" data-ws-supabase>Supabase</button>
            <button type="button" class="primary" data-ws-zip>Baixar ZIP</button>
          </div>
        </footer>
      </div>`;
  }

  function ensureModal() {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return null;
    card.className = 'ld2-card ld3-ws-card';
    card.innerHTML = shellMarkup();
    modal.classList.add('open');
    modalCard = card;
    bind(card);
    return card;
  }

  function close() {
    const r = root();
    r?.querySelector('.ld2-modal')?.classList.remove('open');
    const card = r?.querySelector('.ld2-card');
    if (card) card.className = 'ld2-card';
    modalCard = null;
    selectedPath = '';
  }

  function renderHealth() {
    const host = modalCard?.querySelector('[data-ws-health]');
    if (!host) return;
    const framework = text(context?.project?.framework) || 'Desconhecido';
    const workspace = text(context?.workspace?.name || context?.workspace?.id) || 'Não identificado';
    const git = context?.gitSync?.connected ? `${text(context.gitSync.fullName)} · ${text(context.gitSync.branch) || 'main'}` : 'Não conectado';
    const backend = backendLabel(context?.backend || {});
    const preview = context?.preview?.state === 'ready' ? 'Pronto' : context?.preview?.state === 'loading' ? 'Carregando' : 'Não identificado';
    const items = [
      ['Sessão', context?.auth?.sessionAvailable ? 'Conectada' : 'Indisponível', statusTone(!!context?.auth?.sessionAvailable)],
      ['Framework', framework, statusTone(framework !== 'Desconhecido', framework === 'Desconhecido')],
      ['Workspace', workspace, statusTone(workspace !== 'Não identificado', workspace === 'Não identificado')],
      ['GitSync', git, statusTone(!!context?.gitSync?.connected)],
      ['Backend', backend, statusTone(context?.backend?.type && context.backend.type !== 'unknown', !context?.backend?.type || context.backend.type === 'unknown')],
      ['Preview', preview, statusTone(context?.preview?.state === 'ready', context?.preview?.state === 'unknown')]
    ];
    host.innerHTML = items.map(([label, value, tone]) => `<div class="ld3-ws-health-item" data-tone="${tone}"><i></i><small>${esc(label)}</small><b title="${esc(value)}">${esc(value)}</b></div>`).join('');
  }

  function renderStats() {
    const host = modalCard?.querySelector('[data-ws-stats]');
    if (!host) return;
    const stats = snapshot?.stats || {};
    const categories = stats.categories || {};
    const rows = [
      ['Arquivos', stats.fileCount ?? '—'],
      ['Tamanho', humanBytes(stats.totalBytes)],
      ['Frontend', categories.frontend ?? '—'],
      ['Backend', categories.backend ?? '—'],
      ['Supabase', (Number(categories.supabase || 0) + Number(categories.migrations || 0) + Number(categories.edgeFunctions || 0)) || 0],
      ['Protegidos', stats.sensitiveFiles ?? '—']
    ];
    host.innerHTML = rows.map(([label, value]) => `<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('');
  }

  function renderFilters() {
    const host = modalCard?.querySelector('[data-ws-filters]');
    if (!host) return;
    const counts = snapshot?.stats?.categories || {};
    const categories = ['all','frontend','backend','supabase','migrations','edgeFunctions','config','other'];
    host.innerHTML = categories.map(key => {
      const count = key === 'all' ? Number(snapshot?.stats?.fileCount || 0) : Number(counts[key] || 0);
      return `<button type="button" data-ws-filter="${key}" data-active="${selectedCategory === key ? '1' : '0'}"><span>${esc(categoryLabel(key))}</span><em>${count}</em></button>`;
    }).join('');
    $$('[data-ws-filter]', host).forEach(btn => btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.wsFilter || 'all';
      renderFilters();
      renderFiles();
    }));
  }

  function filteredFiles() {
    const files = Array.isArray(snapshot?.files) ? snapshot.files : [];
    return files.filter(file => {
      const category = categoryFor(file.path);
      if (selectedCategory !== 'all' && category !== selectedCategory) return false;
      if (query && !file.path.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }

  function renderFiles() {
    const host = modalCard?.querySelector('[data-ws-files]');
    if (!host) return;
    const files = filteredFiles();
    if (!files.length) {
      host.innerHTML = `<div class="ld3-ws-empty">Nenhum arquivo corresponde ao filtro.</div>`;
      return;
    }
    host.innerHTML = files.slice(0, 3000).map(file => `<button type="button" class="ld3-ws-file" data-ws-file="${esc(file.path)}" data-selected="${selectedPath === file.path ? '1' : '0'}"><span>${file.sensitive ? '◈' : file.binary ? '◇' : '⌁'}</span><div><b title="${esc(file.path)}">${esc(file.path)}</b><small>${esc(categoryLabel(categoryFor(file.path)))} · ${humanBytes(file.size)}</small></div></button>`).join('');
    $$('[data-ws-file]', host).forEach(btn => btn.addEventListener('click', () => previewFile(btn.dataset.wsFile || '')));
  }

  function previewMessage(icon, title, detail) {
    const host = modalCard?.querySelector('[data-ws-preview]');
    if (host) host.innerHTML = `<div class="ld3-ws-preview-empty"><span>${icon}</span><b>${esc(title)}</b><small>${esc(detail)}</small></div>`;
  }

  async function previewFile(path) {
    if (!path || !deepRead()?.readFile) return;
    selectedPath = path;
    renderFiles();
    const file = snapshot?.files?.find(row => row.path === path);
    if (file?.sensitive) {
      previewMessage('◈', 'Arquivo protegido', 'O conteúdo de arquivos sensíveis não é exibido no Workspace Premium.');
      return;
    }
    if (file?.binary) {
      previewMessage('◇', 'Arquivo binário', `${path} · ${humanBytes(file.size)}. Use o ZIP para obter o arquivo original.`);
      return;
    }
    previewMessage('…', 'Carregando preview', path);
    try {
      const result = await deepRead().readFile(path, { ref:snapshot?.ref || 'HEAD', allowSensitive:false, asBytes:false });
      if (result?.redacted) {
        previewMessage('◈', 'Arquivo protegido', 'O conteúdo foi redigido pela política de segurança do Workspace.');
        return;
      }
      const content = String(result?.text ?? '');
      const clipped = content.length > 240000;
      const shown = clipped ? content.slice(0, 240000) : content;
      const host = modalCard?.querySelector('[data-ws-preview]');
      if (!host) return;
      host.innerHTML = `<header><div><small>PREVIEW · SOMENTE LEITURA</small><b title="${esc(path)}">${esc(path)}</b></div><span>${humanBytes(new Blob([content]).size)}</span></header><pre><code>${esc(shown)}</code></pre>${clipped ? '<div class="ld3-ws-clipped">Preview limitado aos primeiros 240 KB para preservar performance.</div>' : ''}`;
    } catch (error) {
      previewMessage('!', 'Não foi possível abrir o arquivo', text(error?.message || error));
    }
  }

  async function refresh(force = true) {
    if (loading || !modalCard) return;
    loading = true;
    modalCard.dataset.loading = '1';
    const refreshButton = modalCard.querySelector('[data-ws-refresh]');
    if (refreshButton) refreshButton.disabled = true;
    try {
      context = projectRuntime()?.getContext?.() || null;
      if (force && projectRuntime()?.refresh) {
        try { context = await projectRuntime().refresh(true) || context; } catch (_) {}
      }
      const title = modalCard.querySelector('[data-ws-title]');
      const subtitle = modalCard.querySelector('[data-ws-subtitle]');
      if (title) title.textContent = projectName();
      if (subtitle) subtitle.textContent = context?.detected
        ? `${text(context?.project?.framework) || 'Projeto Lovable'} · ${text(context?.workspace?.name || context?.workspace?.id) || 'workspace detectado'}`
        : 'Abra um projeto no Lovable para carregar o Workspace.';
      renderHealth();

      if (!deepRead()?.getSnapshot) throw new Error('Workspace Deep Read ainda não está disponível.');
      snapshot = await deepRead().getSnapshot({ force });
      const source = modalCard.querySelector('[data-ws-source]');
      if (source) source.textContent = `Fonte: Lovable Workspace · ${snapshot.ref} · ${snapshot.stats.fileCount} arquivo(s)`;
      renderStats();
      renderFilters();
      renderFiles();
      if (selectedPath && snapshot.files.some(row => row.path === selectedPath)) previewFile(selectedPath);
    } catch (error) {
      snapshot = null;
      renderStats();
      renderFilters();
      const files = modalCard.querySelector('[data-ws-files]');
      if (files) files.innerHTML = `<div class="ld3-ws-empty error">${esc(text(error?.message || error))}</div>`;
      previewMessage('!', 'Workspace indisponível', 'Confirme que um projeto Lovable está aberto e que a sessão está ativa.');
      toast(`Workspace: ${text(error?.message || error)}`, true);
    } finally {
      loading = false;
      if (modalCard) modalCard.dataset.loading = '0';
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  async function downloadZip() {
    if (!deepRead()?.downloadWorkspaceZip) return toast('Download ZIP ainda não está disponível.', true);
    const button = modalCard?.querySelector('[data-ws-zip]');
    if (button) { button.disabled = true; button.textContent = 'Preparando…'; }
    try {
      const result = await deepRead().downloadWorkspaceZip({ force:true, autoDownload:true });
      toast(`ZIP preparado · ${result.fileCount} arquivo(s).`);
      window.LovableDecrypterVoice?.speak?.('zip_success');
    } catch (error) {
      toast(text(error?.message || error), true);
      window.LovableDecrypterVoice?.speak?.('zip_failure');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Baixar ZIP'; }
    }
  }

  function bind(card) {
    $('[data-ws-close]', card).addEventListener('click', close);
    $('[data-ws-refresh]', card).addEventListener('click', () => refresh(true));
    $('[data-ws-search]', card).addEventListener('input', event => { query = event.currentTarget.value || ''; renderFiles(); });
    $('[data-ws-zip]', card).addEventListener('click', downloadZip);
    $('[data-ws-github]', card).addEventListener('click', () => openLegacy('[data-cc-github]'));
    $('[data-ws-supabase]', card).addEventListener('click', () => openLegacy('[data-cc-supabase]'));
    $('[data-ws-new-project]', card).addEventListener('click', () => openLegacy('[data-cc-new-project]'));
  }

  async function open() {
    if (!ensureModal()) return false;
    selectedCategory = 'all';
    query = '';
    await refresh(false);
    window.dispatchEvent(new CustomEvent('ld3:workspace-opened', { detail:{ build:37, version:VERSION } }));
    return true;
  }

  function workspaceDetailIsActive() {
    const r = root();
    return !!r?.querySelector('.ld3-flyout .ld3-menu-item[data-item="workspace"][data-active="1"]');
  }

  document.addEventListener('click', event => {
    const openButton = event.target?.closest?.('#ld2-root .ld3-detail [data-detail-open]');
    if (!openButton || !workspaceDetailIsActive()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    window.LovableDecrypterDesignSystem?.closeMenus?.();
    open();
  }, true);

  window.addEventListener('ld3:workspace-open', () => open());
  window.LovableDecrypterWorkspaceUI = Object.freeze({ build:37, version:VERSION, open, close, refresh });
})();