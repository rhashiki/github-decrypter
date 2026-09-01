(() => {
  'use strict';
  if (window.__LD2_PROJECT_CONTEXT_UI__) return;
  window.__LD2_PROJECT_CONTEXT_UI__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function projectRuntime(action, payload = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const port = chrome.runtime.connect({ name: 'ld2-project-runtime' });
      const id = crypto.randomUUID();
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('Project Runtime não respondeu.')), 6000);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else done(reject, new Error(message.error || 'Falha no Project Runtime.'));
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function backendLabel(backend = {}) {
    if (backend.type === 'lovable_cloud') return 'Lovable Cloud';
    if (backend.type === 'supabase') return backend.supabaseRef ? `Supabase · ${backend.supabaseRef}` : 'Supabase';
    if (backend.type === 'none') return 'Sem backend';
    return 'Não identificado';
  }

  function statusClass(ok, unknown = false) {
    return unknown ? 'unknown' : (ok ? 'ready' : 'off');
  }

  function shell() {
    const section = document.createElement('section');
    section.className = 'ld2-project-context';
    section.dataset.ld2ProjectContext = '1';
    section.innerHTML = `
      <div class="ld2-project-context-head">
        <div><small>PROJETO LOVABLE</small><h3 data-pctx-title>Detectando projeto…</h3></div>
        <button type="button" data-pctx-refresh title="Atualizar diagnóstico" aria-label="Atualizar diagnóstico">↻</button>
      </div>
      <div class="ld2-project-context-grid" data-pctx-grid>
        <div><span class="ld2-project-context-dot unknown"></span><small>Runtime</small><b>Coletando…</b></div>
      </div>
      <div class="ld2-project-context-note" data-pctx-note>O contexto é identificado automaticamente; nenhuma credencial Lovable é armazenada.</div>`;
    return section;
  }

  function ensureMounted() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return null;
    let section = $('[data-ld2-project-context]', root);
    if (section) return section;
    section = shell();
    const health = $('.ld2-cc-health', root);
    const panel = $('.ld2-panel', root) || root;
    if (health?.parentNode) health.parentNode.insertBefore(section, health);
    else panel.prepend(section);
    $('[data-pctx-refresh]', section)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.classList.add('busy');
      try {
        const fresh = await window.LovableDecrypterProjectRuntime?.refresh?.(true);
        if (fresh) render(fresh);
      } finally {
        button.disabled = false;
        button.classList.remove('busy');
      }
    });
    return section;
  }

  function render(ctx) {
    const section = ensureMounted();
    if (!section) return;
    const title = $('[data-pctx-title]', section);
    const grid = $('[data-pctx-grid]', section);
    const note = $('[data-pctx-note]', section);
    if (!ctx?.detected) {
      if (title) title.textContent = 'Nenhum projeto aberto';
      if (grid) grid.innerHTML = `<div><span class="ld2-project-context-dot unknown"></span><small>Runtime</small><b>Abra um projeto</b></div>`;
      if (note) note.textContent = 'Abra um projeto no Lovable para identificar automaticamente workspace, GitSync, backend e preview.';
      return;
    }

    const projectName = ctx.project?.name || `Projeto ${String(ctx.projectId || '').slice(0, 8)}`;
    const framework = ctx.project?.framework || 'Desconhecido';
    const workspace = ctx.workspace?.name || ctx.workspace?.id || 'Não identificado';
    const git = ctx.gitSync?.connected ? `${ctx.gitSync.fullName} · ${ctx.gitSync.branch || 'main'}` : 'Não conectado';
    const backend = backendLabel(ctx.backend);
    const preview = ctx.preview?.state === 'ready' ? 'Pronto' : ctx.preview?.state === 'loading' ? 'Carregando' : 'Não identificado';
    const partial = !!ctx.diagnostics?.partial;

    if (title) title.textContent = projectName;
    if (grid) grid.innerHTML = `
      <div><span class="ld2-project-context-dot ${statusClass(!!ctx.auth?.sessionAvailable)}"></span><small>SESSÃO</small><b>${ctx.auth?.sessionAvailable ? 'Lovable conectada' : 'Indisponível'}</b></div>
      <div><span class="ld2-project-context-dot ${statusClass(framework !== 'Desconhecido', framework === 'Desconhecido')}"></span><small>FRAMEWORK</small><b>${esc(framework)}</b></div>
      <div><span class="ld2-project-context-dot ${statusClass(workspace !== 'Não identificado', workspace === 'Não identificado')}"></span><small>WORKSPACE</small><b>${esc(workspace)}</b></div>
      <div><span class="ld2-project-context-dot ${statusClass(!!ctx.gitSync?.connected)}"></span><small>GITSYNC</small><b>${esc(git)}</b></div>
      <div><span class="ld2-project-context-dot ${statusClass(ctx.backend?.type !== 'unknown', ctx.backend?.type === 'unknown')}"></span><small>BACKEND</small><b>${esc(backend)}</b></div>
      <div><span class="ld2-project-context-dot ${statusClass(ctx.preview?.state === 'ready', ctx.preview?.state === 'unknown')}"></span><small>PREVIEW</small><b>${esc(preview)}</b></div>`;
    if (note) {
      const probes = Number(ctx.diagnostics?.successfulProbes || 0);
      note.textContent = partial
        ? `Diagnóstico parcial (${probes}/5 fontes internas responderam). Nenhuma credencial Lovable foi persistida.`
        : 'Contexto identificado automaticamente. Nenhuma credencial Lovable foi persistida.';
    }
  }

  async function loadStored() {
    const projectId = window.LovableDecrypterV2?.getProjectId?.() || '';
    const direct = window.LovableDecrypterProjectRuntime?.getContext?.();
    if (direct) { render(direct); return; }
    try { render(await projectRuntime('get', { projectId })); } catch (_) {}
  }

  window.addEventListener('ld2:project-context', event => render(event.detail));
  window.addEventListener('ld2:project', () => setTimeout(loadStored, 80));

  let attempts = 0;
  const mountTimer = setInterval(() => {
    attempts += 1;
    if (ensureMounted()) {
      clearInterval(mountTimer);
      loadStored();
    } else if (attempts >= 120) {
      clearInterval(mountTimer);
    }
  }, 500);
})();
