(() => {
  'use strict';
  if (window.__LD2_GITHUB_AUTOSYNC_UI__) return;
  window.__LD2_GITHUB_AUTOSYNC_UI__ = true;

  const PORT_NAME = 'ld2-github-autosync';
  const MIN_RECHECK_MS = 60000;
  let lastSignature = '';
  let lastCheckAt = 0;
  let activePromise = null;

  function call(action, payload = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => finish(reject, new Error('GitHub AutoSync não respondeu.')), 35000);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else finish(reject, new Error(message.error || 'Falha no GitHub AutoSync.'));
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) finish(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function rowFor(root) {
    const grid = root?.querySelector?.('[data-pctx-grid]');
    if (!grid) return null;
    let row = grid.querySelector('[data-pctx-github-app]');
    if (!row) {
      row = document.createElement('div');
      row.dataset.pctxGithubApp = '1';
      row.innerHTML = '<span class="ld2-project-context-dot unknown"></span><small>GITHUB APP</small><b>Verificando…</b>';
      row.addEventListener('click', () => {
        if (row.dataset.actionable === '1') document.querySelector('#ld2-root [data-cc-github]')?.click();
      });
      grid.appendChild(row);
    }
    return row;
  }

  function label(status = {}) {
    switch (status.state) {
      case 'linked': return `${status.fullName || status.detectedRepo} · ${status.branch || 'main'} · AutoSync`;
      case 'no_gitsync': return 'GitSync não conectado';
      case 'app_not_configured': return 'GitHub App não configurado';
      case 'authorization_required': return 'Autorize o GitHub';
      case 'repository_not_authorized': return `${status.detectedRepo || 'Repositório'} não autorizado`;
      case 'github_status_error': return 'GitHub indisponível';
      default: return 'Aguardando GitSync';
    }
  }

  function render(status) {
    const root = document.getElementById('ld2-root');
    const row = rowFor(root);
    if (!row) return;
    const dot = row.querySelector('.ld2-project-context-dot');
    const value = row.querySelector('b');
    const linked = !!status?.linked;
    const unknown = !status || ['no_project', 'no_gitsync'].includes(status.state);
    if (dot) dot.className = `ld2-project-context-dot ${unknown ? 'unknown' : linked ? 'ready' : 'off'}`;
    if (value) value.textContent = label(status || {});
    const actionable = !!status && ['app_not_configured', 'authorization_required', 'repository_not_authorized', 'github_status_error'].includes(status.state);
    row.dataset.actionable = actionable ? '1' : '0';
    row.style.cursor = actionable ? 'pointer' : '';
    row.title = actionable ? 'Abrir integração GitHub' : '';
    window.dispatchEvent(new CustomEvent('ld2:github-autosync', { detail: status || null }));
  }

  async function reconcile(context, force = false) {
    if (!context?.projectId) {
      render({ state: 'no_project', linked: false });
      return null;
    }
    const signature = `${context.projectId}|${context.gitSync?.fullName || ''}|${context.gitSync?.branch || ''}`;
    const now = Date.now();
    if (!force && signature === lastSignature && now - lastCheckAt < MIN_RECHECK_MS) return null;
    if (activePromise) return activePromise;
    lastSignature = signature;
    lastCheckAt = now;
    activePromise = call('reconcile', { context })
      .then(status => { render(status); return status; })
      .catch(error => {
        render({ state: 'github_status_error', linked: false, error: error?.message || String(error) });
        return null;
      })
      .finally(() => { activePromise = null; });
    return activePromise;
  }

  async function loadStored() {
    const context = window.LovableDecrypterProjectRuntime?.getContext?.();
    const projectId = context?.projectId || window.LovableDecrypterV2?.getProjectId?.() || '';
    if (!projectId) return render({ state: 'no_project', linked: false });
    try {
      const status = await call('get', { projectId });
      if (status) render(status);
      if (context) reconcile(context, !status).catch(() => {});
    } catch (_) {
      if (context) reconcile(context, true).catch(() => {});
    }
  }

  window.addEventListener('ld2:project-context', event => reconcile(event.detail).catch(() => {}));
  window.addEventListener('ld2:project', () => setTimeout(loadStored, 120));
  window.addEventListener('ld2:github-connected', () => {
    const context = window.LovableDecrypterProjectRuntime?.getContext?.();
    if (context) reconcile(context, true).catch(() => {});
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const root = document.getElementById('ld2-root');
    if (root?.querySelector?.('[data-pctx-grid]')) {
      clearInterval(timer);
      loadStored();
    } else if (attempts >= 120) clearInterval(timer);
  }, 500);
})();
