(() => {
  'use strict';
  if (window.__LD52_PROJECT_TOOLS__) return;
  window.__LD52_PROJECT_TOOLS__ = true;

  const BUILD = 52;
  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r?.querySelector?.(s) || null;
  const $$ = (s, r = document) => [...(r?.querySelectorAll?.(s) || [])];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const projectId = () => String(window.LovableDecrypterV2?.getProjectId?.() || '');

  let overlay = null;
  let generation = 0;
  let downloading = false;

  function root() { return document.getElementById(ROOT_ID); }

  function toast(message, error = false) {
    const wrap = $('.ld2-toast-wrap', root());
    if (!wrap) return;
    const item = document.createElement('div');
    item.className = `ld2-toast${error ? ' error' : ''}`;
    item.textContent = String(message || '');
    wrap.appendChild(item);
    setTimeout(() => item.remove(), 3800);
  }

  function safeFilename(value) {
    return String(value || 'lovable-project')
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'lovable-project';
  }

  function formatBytes(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function projectSnapshot() {
    const settings = await runtime({ type:'LD2_SETTINGS_GET' }).catch(() => ({}));
    const id = projectId();
    const mapping = id ? settings?.projectMappings?.[id] || {} : {};
    const github = { ...(settings?.github || {}), ...mapping };
    let context = null;
    try {
      context = window.LovableDecrypterProjectRuntime?.getContext?.() || null;
      if (!context) context = await window.LovableDecrypterProjectRuntime?.refresh?.(false);
    } catch (_) {}
    return {
      id,
      settings,
      github,
      context,
      ready: !!(github?.owner && github?.repo),
      fullName: github?.owner && github?.repo ? `${github.owner}/${github.repo}` : ''
    };
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    const host = root();
    if (!host) return null;
    overlay = document.createElement('div');
    overlay.className = 'ld52-overlay';
    overlay.innerHTML = `
      <section class="ld52-shell" role="dialog" aria-modal="true" aria-label="Project Tools">
        <header class="ld52-head">
          <div class="ld52-title"><span class="ld52-mark">⇩</span><div><small>PROJECT TOOLS · BUILD ${BUILD}</small><h2>Projeto e ZIP Export</h2><p>Workspace, origem GitHub e exportação do projeto em uma superfície segura.</p></div></div>
          <div class="ld52-head-actions"><span>v${esc(VERSION)}</span><button type="button" data-ld52-close aria-label="Fechar">×</button></div>
        </header>
        <main class="ld52-body" data-ld52-body></main>
      </section>`;
    host.appendChild(overlay);
    $('[data-ld52-close]', overlay).onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay?.classList.contains('open')) close();
    }, true);
    return overlay;
  }

  function close() {
    generation += 1;
    if (!downloading) overlay?.classList.remove('open');
  }

  function loading(text = 'Carregando contexto do projeto…') {
    const body = $('[data-ld52-body]', overlay);
    if (body) body.innerHTML = `<div class="ld52-loading"><i></i><b>${esc(text)}</b><span>Nenhuma alteração é feita no projeto durante esta leitura.</span></div>`;
  }

  function statusCard(label, value, state = '') {
    const tone = /connected|ready|ok|main|master/i.test(`${value} ${state}`) ? 'ok' : /not|missing|error|locked/i.test(`${value} ${state}`) ? 'bad' : 'neutral';
    return `<article class="ld52-stat" data-tone="${tone}"><small>${esc(label)}</small><b>${esc(value || '—')}</b><span>${esc(state || '')}</span></article>`;
  }

  async function open() {
    const node = ensureOverlay();
    if (!node) return false;
    node.classList.add('open');
    const token = ++generation;
    loading();
    try {
      const snapshot = await projectSnapshot();
      if (token !== generation) return false;
      render(snapshot);
      return true;
    } catch (error) {
      if (token !== generation) return false;
      const body = $('[data-ld52-body]', overlay);
      if (body) body.innerHTML = `<div class="ld52-error"><b>Não foi possível carregar Project Tools</b><span>${esc(error?.message || String(error))}</span><button type="button" data-ld52-retry>Tentar novamente</button></div>`;
      $('[data-ld52-retry]', body)?.addEventListener('click', open);
      return false;
    }
  }

  function render(snapshot) {
    const body = $('[data-ld52-body]', overlay);
    const ctx = snapshot.context || {};
    const github = snapshot.github || {};
    const projectName = ctx?.project?.name || ctx?.name || snapshot.id || 'Projeto Lovable';
    const backend = ctx?.backend?.type || (ctx?.backend?.managedByLovable ? 'lovable_cloud' : '—');
    body.innerHTML = `
      <section class="ld52-stats">
        ${statusCard('PROJETO', projectName, snapshot.id ? 'READY' : 'ID não detectado')}
        ${statusCard('GITHUB', snapshot.fullName || 'Não configurado', snapshot.ready ? 'CONNECTED' : 'Configure a integração')}
        ${statusCard('BRANCH', github.branch || 'main', snapshot.ready ? 'Fonte do ZIP' : '')}
        ${statusCard('BACKEND', backend, ctx?.backend?.supabaseRef || '')}
      </section>

      <section class="ld52-grid">
        <article class="ld52-card ld52-export-card">
          <header><div><small>ZIP EXPORT</small><h3>Baixar projeto completo</h3></div><span class="ld52-badge">GITHUB ARCHIVE</span></header>
          <div class="ld52-export-visual"><span>⇩</span><div><b>${esc(snapshot.fullName || 'Repositório não configurado')}</b><small>${esc(github.branch || 'main')}</small></div></div>
          <p>O ZIP é gerado a partir da branch GitHub vinculada ao projeto. Nenhum arquivo é alterado e nenhum commit é criado.</p>
          <div class="ld52-download-state" data-ld52-download-state>${snapshot.ready ? 'Pronto para exportar.' : 'Conecte um repositório GitHub antes de exportar.'}</div>
          <button class="ld52-primary" type="button" data-ld52-download ${snapshot.ready ? '' : 'disabled'}>Baixar ZIP do projeto</button>
        </article>

        <article class="ld52-card">
          <header><div><small>PROJECT ACTIONS</small><h3>Ferramentas do projeto</h3></div></header>
          <div class="ld52-actions">
            <button type="button" data-ld52-action="workspace"><span>▰</span><div><b>Workspace</b><small>Explorar arquivos e contexto.</small></div></button>
            <button type="button" data-ld52-action="github-sync"><span>GH</span><div><b>GitHub Sync</b><small>Conta, repo e sincronização.</small></div></button>
            <button type="button" data-ld52-action="cloud-migrator"><span>⇄</span><div><b>Migrar Cloud</b><small>Lovable Cloud → Supabase.</small></div></button>
            <button type="button" data-ld52-action="lovable-new-project"><span>＋</span><div><b>Novo projeto</b><small>Criar projeto Lovable vazio.</small></div></button>
          </div>
          <div class="ld52-note"><b>Fonte autoritativa do ZIP</b><span>${esc(snapshot.fullName || 'GitHub não configurado')} · ${esc(github.branch || 'main')}</span></div>
        </article>
      </section>`;

    $('[data-ld52-download]', body)?.addEventListener('click', () => downloadZip(snapshot));
    $$('[data-ld52-action]', body).forEach(button => button.addEventListener('click', () => runAction(button.dataset.ld52Action)));
  }

  async function runAction(id) {
    if (!id) return;
    if (id === 'workspace') {
      close();
      const api = window.LovableDecrypterWorkspace;
      if (api?.open) return api.open();
      return toast('Workspace ainda não está disponível.', true);
    }
    close();
    try { await window.LovableDecrypterUIActions?.run?.(id, { source:'project-tools-v52' }); }
    catch (error) { toast(error?.message || String(error), true); }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.documentElement.appendChild(anchor);
    anchor.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window }));
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function downloadZip(snapshot = null) {
    if (downloading) return false;
    downloading = true;
    const body = $('[data-ld52-body]', overlay);
    const button = $('[data-ld52-download]', body);
    const state = $('[data-ld52-download-state]', body);
    if (button) { button.disabled = true; button.textContent = 'Preparando ZIP…'; }
    if (state) state.textContent = 'Lendo o archive da branch configurada no GitHub…';
    try {
      const data = await runtime({ type:'LD2_GITHUB_ZIP_BYTES', projectId:projectId() });
      const bytes = Array.isArray(data?.bytes) ? data.bytes : data?.bytes ? Array.from(data.bytes) : [];
      if (!bytes.length) throw new Error('O GitHub retornou um ZIP vazio.');
      const repo = safeFilename(data?.repo || snapshot?.github?.repo || 'lovable-project');
      const branch = safeFilename(data?.branch || snapshot?.github?.branch || 'main');
      const blob = new Blob([new Uint8Array(bytes)], { type:'application/zip' });
      const filename = `${repo}-${branch}.zip`;
      triggerDownload(blob, filename);
      if (state) state.textContent = `${filename} · ${formatBytes(blob.size)} · download iniciado.`;
      if (button) button.textContent = 'Baixar novamente';
      toast('Download do ZIP iniciado.');
      window.dispatchEvent(new CustomEvent('ld52:zip-exported', { detail:{ repo, branch, size:blob.size } }));
      return true;
    } catch (error) {
      if (state) state.textContent = error?.message || String(error);
      if (button) button.textContent = 'Tentar novamente';
      toast(error?.message || String(error), true);
      return false;
    } finally {
      downloading = false;
      if (button) button.disabled = false;
    }
  }

  function installProvider() {
    const registry = window.LovableDecrypterUIActions;
    if (!registry?.register) return false;
    registry.register('zip', open, { build:BUILD, suite:'project-tools', source:'github-archive' });
    return true;
  }

  window.LovableDecrypterProjectTools = Object.freeze({
    build: BUILD,
    version: VERSION,
    open,
    close,
    downloadZip,
    snapshot: projectSnapshot
  });

  installProvider();
  window.addEventListener('ld2:ui-mounted', installProvider);
  window.addEventListener('ld2:dom-reconcile', installProvider);
  window.addEventListener('ld48:action-registered', installProvider);
})();