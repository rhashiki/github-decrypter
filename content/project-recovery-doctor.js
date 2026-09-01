(() => {
  'use strict';
  if (window.__LD2_PROJECT_RECOVERY_DOCTOR__) return;
  window.__LD2_PROJECT_RECOVERY_DOCTOR__ = true;

  const REPORT_SCHEMA = 'ld-project-recovery-report/1';
  const SESSION_LAST_KEY = 'ld2_project_recovery_report_last';
  const SESSION_PREFIX = 'ld2_project_recovery_report_';
  const CACHE_TTL_MS = 30000;
  const MAX_ANALYZED_FILES = 1400;
  const MAX_FILE_BYTES = 512 * 1024;
  const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
  const READ_CONCURRENCY = 6;
  const TEXT_PATH = /\.(?:[cm]?[jt]sx?|css|scss|sass|less|html?|json|md|toml|ya?ml|sql|svg|txt)$/i;
  const SKIP_PATH = /(^|\/)(?:node_modules|dist|build|coverage|\.git)(\/|$)|(?:package-lock|pnpm-lock|yarn\.lock|bun\.lockb)$/i;

  let cache = null;
  let inflight = null;
  let uiAttempts = 0;
  const text = value => String(value ?? '').trim();
  const core = () => window.LovableDecrypterProjectRecoveryDoctorCore;
  const graphApi = () => window.LovableDecrypterProjectStateGraph;
  const workspaceApi = () => window.LovableDecrypterWorkspaceDeepRead;
  const projectId = () => text(window.LovableDecrypterV2?.getProjectId?.());

  function reportKey(id) {
    return `${SESSION_PREFIX}${text(id).replace(/[^a-z0-9-]/gi, '').slice(0, 80)}`;
  }

  function isAnalyzable(file) {
    const path = text(file?.path);
    const size = Number(file?.size);
    return !!path &&
      !file?.binary &&
      !file?.sensitive &&
      TEXT_PATH.test(path) &&
      !SKIP_PATH.test(path) &&
      (!Number.isFinite(size) || size <= MAX_FILE_BYTES);
  }

  async function collectWorkspaceContents(snapshot) {
    const api = workspaceApi();
    if (!api?.readFile) throw new Error('WORKSPACE_DEEP_READ_UNAVAILABLE');
    const candidates = (snapshot?.files || []).filter(isAnalyzable).slice(0, MAX_ANALYZED_FILES);
    const contents = {};
    const failures = [];
    let bytes = 0;
    let budgetReached = false;

    for (let start = 0; start < candidates.length; start += READ_CONCURRENCY) {
      const batch = candidates.slice(start, start + READ_CONCURRENCY);
      const results = await Promise.all(batch.map(async file => {
        const declared = Number(file?.size);
        if (Number.isFinite(declared) && bytes + declared > MAX_TOTAL_BYTES) return { file, skipped: 'total_budget' };
        try {
          const result = await api.readFile(file.path, {
            ref: snapshot.ref,
            allowSensitive: false,
            asBytes: false
          });
          if (typeof result?.text !== 'string') throw new Error('TEXT_UNAVAILABLE');
          const actual = new TextEncoder().encode(result.text).byteLength;
          return { file, content: result.text, bytes: actual };
        } catch (error) {
          return { file, error: error?.message || String(error) };
        }
      }));

      for (const result of results) {
        if (result.skipped) {
          budgetReached = true;
          continue;
        }
        if (result.error) {
          failures.push({ path: result.file.path, error: result.error });
          continue;
        }
        if (bytes + result.bytes > MAX_TOTAL_BYTES) {
          budgetReached = true;
          continue;
        }
        contents[result.file.path] = result.content;
        bytes += result.bytes;
      }
      if (budgetReached && bytes >= MAX_TOTAL_BYTES) break;
    }

    return {
      contents,
      diagnostics: {
        candidateFiles: candidates.length,
        analyzedFiles: Object.keys(contents).length,
        bytes,
        failures: failures.slice(0, 100),
        failuresTruncated: failures.length > 100,
        fileLimitReached: (snapshot?.files || []).filter(isAnalyzable).length > candidates.length,
        byteLimitReached: budgetReached
      }
    };
  }

  async function projectStateInspect(projectRef) {
    if (!projectRef) return null;
    return new Promise((resolve, reject) => {
      let settled = false;
      const port = chrome.runtime.connect({ name: 'ld2-project-state' });
      const id = crypto.randomUUID();
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('PROJECT_STATE_TIMEOUT')), 65000);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else done(reject, new Error(message.error || 'PROJECT_STATE_FAILED'));
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action: 'inspect', payload: { project_ref: projectRef } });
    });
  }

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function compactReport(report) {
    return {
      schema: report.schema,
      projectId: report.projectId,
      generatedAt: report.generatedAt,
      hash: report.hash,
      status: report.status,
      counts: report.counts,
      summary: report.summary,
      portability: report.portability,
      issues: (report.issues || []).slice(0, 300),
      issuesTruncated: (report.issues || []).length > 300,
      plan: report.plan,
      diagnostics: report.diagnostics,
      guarantees: report.guarantees
    };
  }

  async function buildReport({ force = false } = {}) {
    const analyzer = core();
    if (!analyzer?.analyze) throw new Error('RECOVERY_DOCTOR_CORE_UNAVAILABLE');
    const id = projectId();
    if (!id) throw new Error('LOVABLE_PROJECT_UNAVAILABLE');

    const graph = await graphApi()?.getGraph?.({ force, deepCompare: true });
    if (!graph) throw new Error('PROJECT_STATE_GRAPH_UNAVAILABLE');

    const snapshot = await workspaceApi()?.getSnapshot?.({ force });
    if (!snapshot) throw new Error('WORKSPACE_SNAPSHOT_UNAVAILABLE');

    const collected = await collectWorkspaceContents(snapshot);
    const inspectedRef = text(graph.sources?.supabase?.projectRef || graph.backend?.inspectedRef || graph.backend?.mappedRef || graph.backend?.lovableRef);
    const projectState = inspectedRef
      ? await projectStateInspect(inspectedRef).catch(() => null)
      : null;
    const analysisGraph = projectState ? {
      ...graph,
      storage: projectState.storage || { buckets: [], objects: [] },
      auth: projectState.auth || graph.auth,
      secretNames: Array.isArray(projectState.secrets) ? projectState.secrets : graph.secretNames,
      database: projectState.database ? {
        ...(graph.database || {}),
        relations: projectState.database.relations || graph.database?.relations || [],
        columns: projectState.database.columns || graph.database?.columns || [],
        policies: projectState.database.policies || graph.database?.policies || [],
        routines: projectState.database.routines || graph.database?.routines || [],
        triggers: projectState.database.triggers || graph.database?.triggers || []
      } : graph.database,
      edgeFunctions: projectState.edgeFunctions ? {
        ...(graph.edgeFunctions || {}),
        deployed: projectState.edgeFunctions
      } : graph.edgeFunctions
    } : { ...graph, storage: { buckets: [], objects: [] } };
    const report = analyzer.analyze({
      files: snapshot.files || [],
      contents: collected.contents,
      graph: analysisGraph
    });
    report.projectId = id;
    report.workspace = {
      ref: snapshot.ref,
      revision: snapshot.revision,
      complete: !!snapshot.complete,
      fileCount: snapshot.stats?.fileCount ?? snapshot.files?.length ?? 0
    };
    report.projectState = {
      hash: graph.hash,
      status: graph.status,
      backend: graph.backend,
      sourceAvailability: graph.sources
    };
    report.diagnostics = {
      ...collected.diagnostics,
      graphStatus: graph.status,
      workspaceComplete: !!snapshot.complete,
      githubComplete: !!graph.sources?.github?.complete,
      supabaseAvailable: !!graph.sources?.supabase?.available,
      storageMetadataOnly: true,
      note: 'O Doctor não lê valores de secrets nem baixa assets remotos arbitrários.'
    };
    report.hash = await sha256Hex({
      projectId: id,
      graphHash: graph.hash,
      counts: report.counts,
      issues: report.issues.map(item => ({ id: item.id, severity: item.severity })),
      portability: report.portability
    });

    cache = { at: Date.now(), report };
    const compact = compactReport(report);
    await chrome.storage.session.set({
      [SESSION_LAST_KEY]: compact,
      [reportKey(id)]: compact
    });
    window.dispatchEvent(new CustomEvent('ld2:project-recovery-report', { detail: structuredClone(compact) }));
    return structuredClone(report);
  }

  async function getReport(options = {}) {
    if (!options.force && cache?.report?.projectId === projectId() && Date.now() - cache.at < CACHE_TTL_MS) {
      return structuredClone(cache.report);
    }
    if (inflight) return inflight;
    inflight = buildReport({ force: !!options.force }).finally(() => { inflight = null; });
    return inflight;
  }

  async function getStored(id = projectId()) {
    const key = id ? reportKey(id) : SESSION_LAST_KEY;
    const stored = await chrome.storage.session.get(key);
    return stored[key] || null;
  }

  function invalidate() {
    cache = null;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function root() {
    return document.getElementById('ld2-root');
  }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function openModal(html) {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return null;
    card.innerHTML = html;
    modal.classList.add('open');
    return { modal, card };
  }

  function closeModal() {
    root()?.querySelector('.ld2-modal')?.classList.remove('open');
  }

  function severityLabel(value) {
    return ({ critical: 'CRÍTICO', high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' })[value] || String(value || '').toUpperCase();
  }

  function statusLabel(value) {
    return ({ broken: 'QUEBRADO', degraded: 'DEGRADADO', warning: 'ATENÇÃO', healthy: 'SAUDÁVEL' })[value] || String(value || '').toUpperCase();
  }

  function renderIssues(report, category = '') {
    const rows = (report.issues || []).filter(item => !category || item.category === category);
    if (!rows.length) return '<div class="ld2-rd-empty">Nenhum problema detectado nesta área.</div>';
    return rows.slice(0, 80).map(item => `
      <article class="ld2-rd-issue" data-severity="${esc(item.severity)}">
        <header><b>${esc(item.title)}</b><span>${esc(severityLabel(item.severity))}</span></header>
        <p>${esc(item.detail)}</p>
        ${item.recoverable ? '<small>↻ Candidato de recuperação encontrado</small>' : ''}
      </article>`).join('');
  }

  function reportShell(report) {
    const a = report.portability?.assetCounts || {};
    const tabs = [
      ['overview', 'Visão geral'],
      ['routes_imports', 'Rotas/Imports'],
      ['database', 'Banco'],
      ['oauth', 'OAuth'],
      ['mercado_pago', 'Mercado Pago'],
      ['assets', 'Assets']
    ];
    return `
      <div class="ld2-rd">
        <header class="ld2-rd-head">
          <div><span class="ld2-rd-mark">DR</span><div><small>PROJECT RECOVERY DOCTOR</small><h2>Diagnóstico de recuperação</h2></div></div>
          <button type="button" data-rd-close aria-label="Fechar">×</button>
        </header>
        <section class="ld2-rd-status" data-state="${esc(report.status)}">
          <div><small>ESTADO</small><b>${esc(statusLabel(report.status))}</b></div>
          <div><small>CRÍTICOS</small><b>${Number(report.counts?.critical || 0)}</b></div>
          <div><small>ALTOS</small><b>${Number(report.counts?.high || 0)}</b></div>
          <div><small>ASSETS AUSENTES</small><b>${Number(a.missing || 0)}</b></div>
          <div><small>ZIP PORTÁVEL</small><b>${report.portability?.portable ? 'SIM' : 'NÃO'}</b></div>
        </section>
        <nav class="ld2-rd-tabs">${tabs.map(([key, label]) => `<button type="button" data-rd-tab="${key}"${key === 'overview' ? ' class="active"' : ''}>${label}</button>`).join('')}</nav>
        <main class="ld2-rd-body">
          <section data-rd-panel="overview">
            <div class="ld2-rd-grid">
              <div><small>Arquivos analisados</small><b>${Number(report.summary?.analyzedFiles || 0)}</b></div>
              <div><small>Rotas detectadas</small><b>${Number(report.summary?.routes || 0)}</b></div>
              <div><small>Tabelas usadas</small><b>${Number(report.summary?.tablesUsed || 0)}</b></div>
              <div><small>Edge Functions chamadas</small><b>${Number(report.summary?.edgeFunctionsInvoked || 0)}</b></div>
              <div><small>Google OAuth</small><b>${report.summary?.googleOAuthDetected ? 'DETECTADO' : '—'}</b></div>
              <div><small>Mercado Pago</small><b>${report.summary?.mercadoPagoDetected ? 'DETECTADO' : '—'}</b></div>
            </div>
            <div class="ld2-rd-portability">
              <h3>Portabilidade do projeto</h3>
              <p>${report.portability?.portable ? 'O código analisado não possui dependências locais quebradas nem assets presos ao Lovable.' : esc((report.portability?.reasons || []).join(' · ') || 'Existem dependências que impedem considerar o ZIP completamente portável.')}</p>
              <div class="ld2-rd-assets-line">
                <span>✓ ${Number(a.present || 0)} presentes</span>
                <span>❌ ${Number(a.missing || 0)} ausentes</span>
                <span>↻ ${Number(a.recoverable || 0)} recuperáveis/candidatos</span>
                <span>☁ ${Number(a.remoteLovable || 0)} no Lovable</span>
              </div>
            </div>
            <div class="ld2-rd-plan"><h3>Plano de recuperação</h3>${(report.plan || []).map(step => `<div><b>${step.order}.</b><span>${esc(step.action)}</span></div>`).join('')}</div>
          </section>
          <section data-rd-panel="routes_imports" hidden>${renderIssues(report, 'routes_imports')}</section>
          <section data-rd-panel="database" hidden>${renderIssues(report, 'database')}${renderIssues(report, 'migrations')}${renderIssues(report, 'edge_functions')}${renderIssues(report, 'storage')}</section>
          <section data-rd-panel="oauth" hidden>${renderIssues(report, 'oauth')}</section>
          <section data-rd-panel="mercado_pago" hidden>${renderIssues(report, 'mercado_pago')}</section>
          <section data-rd-panel="assets" hidden>${renderIssues(report, 'assets')}</section>
        </main>
        <footer class="ld2-rd-actions">
          <button type="button" data-rd-export>Exportar relatório JSON</button>
          <button type="button" data-rd-refresh>Reanalisar</button>
          <button type="button" class="primary" disabled title="A execução controlada entra na Build 30.">Auto Repair · Build 30</button>
        </footer>
        <div class="ld2-rd-footnote">Somente leitura · nenhum secret é revelado · nenhum reparo é executado nesta Build.</div>
      </div>`;
  }

  function bindReportView(view, report) {
    if (!view?.card) return;
    view.card.querySelector('[data-rd-close]')?.addEventListener('click', closeModal);
    view.card.querySelectorAll('[data-rd-tab]').forEach(button => {
      button.addEventListener('click', () => {
        view.card.querySelectorAll('[data-rd-tab]').forEach(b => b.classList.toggle('active', b === button));
        view.card.querySelectorAll('[data-rd-panel]').forEach(panel => {
          panel.hidden = panel.dataset.rdPanel !== button.dataset.rdTab;
        });
      });
    });
    view.card.querySelector('[data-rd-refresh]')?.addEventListener('click', () => openDoctor(true));
    view.card.querySelector('[data-rd-export]')?.addEventListener('click', () => {
      const safe = structuredClone(report);
      const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `lovable-decrypter-recovery-${report.projectId || 'project'}.json`;
        anchor.style.display = 'none';
        document.documentElement.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    });
  }

  async function openDoctor(force = false) {
    const loading = openModal(`
      <div class="ld2-rd"><header class="ld2-rd-head"><div><span class="ld2-rd-mark">DR</span><div><small>PROJECT RECOVERY DOCTOR</small><h2>Analisando projeto…</h2></div></div><button type="button" data-rd-close>×</button></header>
      <div class="ld2-rd-loading"><i></i><b>Reconstruindo dependências do Workspace, GitHub e Supabase…</b><small>Rotas, banco, OAuth, Mercado Pago e assets.</small></div></div>`);
    loading?.card.querySelector('[data-rd-close]')?.addEventListener('click', closeModal);
    try {
      const report = await getReport({ force });
      const view = openModal(reportShell(report));
      bindReportView(view, report);
    } catch (error) {
      const view = openModal(`<div class="ld2-rd"><header class="ld2-rd-head"><div><span class="ld2-rd-mark">DR</span><div><small>PROJECT RECOVERY DOCTOR</small><h2>Falha no diagnóstico</h2></div></div><button type="button" data-rd-close>×</button></header><div class="ld2-rd-error">${esc(error?.message || String(error))}</div><footer class="ld2-rd-actions"><button type="button" class="primary" data-rd-refresh>Tentar novamente</button></footer></div>`);
      view?.card.querySelector('[data-rd-close]')?.addEventListener('click', closeModal);
      view?.card.querySelector('[data-rd-refresh]')?.addEventListener('click', () => openDoctor(true));
    }
  }

  function addDoctorCard() {
    const grid = root()?.querySelector('.ld2-cc-section .ld2-cc-grid');
    if (!grid || grid.querySelector('[data-cc-recovery-doctor]')) return false;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ld2-cc-card';
    button.dataset.ccRecoveryDoctor = '1';
    button.innerHTML = '<span>DR</span><div><b>Recovery Doctor</b><small>Rotas, banco, OAuth, Mercado Pago e assets</small></div>';
    grid.appendChild(button);
    return true;
  }

  function reconcileUi() {
    if (addDoctorCard()) uiAttempts = 0;
    else if (!root()?.querySelector('[data-cc-recovery-doctor]') && uiAttempts++ < 24) {
      setTimeout(reconcileUi, 120 + uiAttempts * 35);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#ld2-root [data-cc-recovery-doctor]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDoctor(false);
  }, true);

  window.LovableDecrypterRecoveryDoctor = Object.freeze({
    schema: REPORT_SCHEMA,
    getReport,
    getStored,
    open: openDoctor,
    invalidate
  });

  addEventListener('ld2:project', () => { invalidate(); reconcileUi(); });
  addEventListener('ld2:project-state-graph', invalidate);
  addEventListener('ld2:dom-reconcile', reconcileUi);
  addEventListener('ld2:control-center-ready', reconcileUi);
  addEventListener('hashchange', invalidate);
  addEventListener('popstate', invalidate);
  reconcileUi();
})();