(() => {
  'use strict';
  if (window.__LD51_ENGINEERING_SUITE__) return;
  window.__LD51_ENGINEERING_SUITE__ = true;

  const BUILD = 51;
  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r?.querySelector?.(s) || null;
  const $$ = (s, r = document) => [...(r?.querySelectorAll?.(s) || [])];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const projectId = () => String(window.LovableDecrypterV2?.getProjectId?.() || '');
  let overlay = null;
  let activeTab = 'overview';
  let renderGeneration = 0;
  let refreshTimer = 0;

  const TABS = Object.freeze([
    ['overview', 'Cockpit'],
    ['chat', 'Chat / Plan / Build'],
    ['pipeline', 'Pipeline'],
    ['state', 'Project State'],
    ['recovery', 'Recovery'],
    ['migrator', 'Cloud Migrator']
  ]);

  function root() { return document.getElementById(ROOT_ID); }

  function notify(text, error = false) {
    const wrap = $('.ld2-toast-wrap', root());
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = String(text || '');
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3800);
  }

  function safeState(value, fallback = '—') {
    const text = String(value || '').trim();
    return text || fallback;
  }

  function tone(value) {
    const state = String(value || '').toLowerCase();
    if (/(healthy|ready|valid|connected|completed|ok|active)/.test(state)) return 'ok';
    if (/(broken|failed|invalid|locked|error|critical)/.test(state)) return 'bad';
    if (/(warning|degraded|busy|waiting|partial)/.test(state)) return 'warn';
    return 'neutral';
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    const host = root();
    if (!host) return null;
    overlay = document.createElement('div');
    overlay.className = 'ld51-overlay';
    overlay.innerHTML = `
      <section class="ld51-shell" role="dialog" aria-modal="true" aria-label="Engineering Suite">
        <header class="ld51-head">
          <div class="ld51-brand"><span>◇</span><div><small>ENGINEERING SUITE · BUILD ${BUILD}</small><h2>Engineering Cockpit</h2><p>Chat, pipeline, estado, recovery e migração em uma superfície.</p></div></div>
          <div class="ld51-head-actions"><span class="ld51-version">v${esc(VERSION)}</span><button type="button" data-ld51-close aria-label="Fechar">×</button></div>
        </header>
        <nav class="ld51-tabs" aria-label="Engineering Suite">${TABS.map(([id, label]) => `<button type="button" data-ld51-tab="${id}">${esc(label)}</button>`).join('')}</nav>
        <main class="ld51-body" data-ld51-body></main>
      </section>`;
    host.appendChild(overlay);
    $('[data-ld51-close]', overlay).addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    $$('.ld51-tabs [data-ld51-tab]', overlay).forEach(button => {
      button.addEventListener('click', () => select(button.dataset.ld51Tab));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay?.classList.contains('open')) close();
    }, true);
    return overlay;
  }

  function close() {
    clearTimeout(refreshTimer);
    renderGeneration += 1;
    overlay?.classList.remove('open');
  }

  function setActiveTab(tab) {
    activeTab = TABS.some(([id]) => id === tab) ? tab : 'overview';
    $$('.ld51-tabs [data-ld51-tab]', overlay).forEach(button => button.classList.toggle('active', button.dataset.ld51Tab === activeTab));
  }

  function loading(label = 'Reconciliando engenharia…') {
    const body = $('[data-ld51-body]', overlay);
    if (body) body.innerHTML = `<div class="ld51-loading"><i></i><b>${esc(label)}</b><span>Os motores existentes permanecem autoritativos.</span></div>`;
  }

  async function collectSnapshot(options = {}) {
    const graphApi = window.LovableDecrypterProjectStateGraph;
    const doctorApi = window.LovableDecrypterRecoveryDoctor;
    const chatApi = window.LovableDecrypterChat;
    const graphPromise = options.deepGraph
      ? graphApi?.getGraph?.({ force: !!options.force, deepCompare: true })
      : graphApi?.getStored?.(projectId());
    const doctorPromise = options.doctor
      ? doctorApi?.getReport?.({ force: !!options.force })
      : doctorApi?.getStored?.(projectId());

    const [graphResult, doctorResult, licenseResult, intelligenceResult] = await Promise.allSettled([
      Promise.resolve(graphPromise),
      Promise.resolve(doctorPromise),
      Promise.resolve(runtime({ type: 'LD2_LICENSE_STATUS' })),
      Promise.resolve(runtime({ type: 'LD2_INTELLIGENCE_STATUS' }))
    ]);

    let context = null;
    try {
      context = window.LovableDecrypterProjectRuntime?.getContext?.() || null;
      if (!context && options.context) context = await window.LovableDecrypterProjectRuntime?.refresh?.(false);
    } catch (_) {}

    return {
      chat: chatApi?.snapshot?.() || null,
      graph: graphResult.status === 'fulfilled' ? graphResult.value : null,
      doctor: doctorResult.status === 'fulfilled' ? doctorResult.value : null,
      license: licenseResult.status === 'fulfilled' ? licenseResult.value : null,
      intelligence: intelligenceResult.status === 'fulfilled' ? intelligenceResult.value : null,
      context
    };
  }

  function kpi(label, value, state = '') {
    return `<article class="ld51-kpi" data-tone="${tone(state || value)}"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(state || '')}</span></article>`;
  }

  function sourceLine(label, source) {
    const available = !!source && source.available !== false;
    const detail = label === 'GitHub'
      ? [source?.repo, source?.branch, source?.revision ? String(source.revision).slice(0, 8) : ''].filter(Boolean).join(' · ')
      : label === 'Supabase'
        ? [source?.projectRef, source?.status].filter(Boolean).join(' · ')
        : [source?.source, source?.revision].filter(Boolean).join(' · ');
    return `<div class="ld51-source"><i data-tone="${available ? 'ok' : 'bad'}"></i><b>${esc(label)}</b><span>${esc(detail || (available ? 'Disponível' : source?.reason || 'Indisponível'))}</span></div>`;
  }

  function consoleRows(snapshot) {
    const graph = snapshot.graph;
    const chat = snapshot.chat;
    const license = snapshot.license;
    return [
      ['state.graph', graph ? `${safeState(graph.status, 'cached')} · ${String(graph.hash || '').slice(0, 10) || 'sem hash'}` : 'aguardando reconciliação'],
      ['decrypter.chat', chat ? `${safeState(chat.phase)} · ${safeState(chat.mode)}` : 'runtime indisponível'],
      ['scope.lock', 'preservado pelo pipeline autoritativo'],
      ['shadow.build', 'ZERO APPLY antes de aprovação'],
      ['regression.sentinel', 'ativo no fluxo de Build'],
      ['validation.gate', 'obrigatório antes de commit'],
      ['trust', license?.valid ? 'licença válida · fail-closed' : 'bloqueado / não validado']
    ].map(([name, value]) => `<div><code>${esc(name)}</code><span>${esc(value)}</span></div>`).join('');
  }

  async function renderOverview(generation) {
    const snapshot = await collectSnapshot({ context: true });
    if (generation !== renderGeneration) return;
    const graph = snapshot.graph;
    const doctor = snapshot.doctor;
    const chat = snapshot.chat;
    const sources = graph?.sources || {};
    const body = $('[data-ld51-body]', overlay);
    body.innerHTML = `
      <section class="ld51-kpis">
        ${kpi('PROJECT', snapshot.context?.project?.name || projectId() || 'Lovable', projectId() ? 'READY' : 'DEGRADED')}
        ${kpi('GITHUB', sources.github?.available ? 'CONNECTED' : 'UNKNOWN', sources.github?.repo || '')}
        ${kpi('SUPABASE', sources.supabase?.available ? 'CONNECTED' : 'OPTIONAL', sources.supabase?.projectRef || '')}
        ${kpi('STATE GRAPH', safeState(graph?.status, 'CACHE EMPTY'), graph?.hash ? String(graph.hash).slice(0, 10) : '')}
        ${kpi('DOCTOR', safeState(doctor?.status, 'NOT RUN'), doctor?.counts?.critical ? `${doctor.counts.critical} crítico(s)` : '')}
        ${kpi('TRUST', snapshot.license?.valid ? 'VALID' : 'LOCKED', window.LovableDecrypterChat?.capabilities?.failClosed ? 'FAIL-CLOSED' : 'guarded')}
      </section>
      <section class="ld51-grid">
        <article class="ld51-card">
          <header><div><small>UNIFIED PROJECT STATE</small><h3>Fontes reconciliadas</h3></div><button type="button" data-ld51-state-refresh>Reconciliar</button></header>
          <div class="ld51-sources">
            ${sourceLine('Lovable', sources.lovable)}
            ${sourceLine('GitHub', sources.github)}
            ${sourceLine('Supabase', sources.supabase)}
          </div>
        </article>
        <article class="ld51-card">
          <header><div><small>ENGINEERING TRANSACTION</small><h3>Chat / Plan / Build</h3></div><span class="ld51-badge" data-tone="${tone(chat?.phase)}">${esc(safeState(chat?.phase, 'READY'))}</span></header>
          <div class="ld51-mode-row">
            <button type="button" data-ld51-chat-mode="chat">CHAT</button>
            <button type="button" data-ld51-chat-mode="plan">PLAN</button>
            <button type="button" data-ld51-chat-mode="build">BUILD</button>
          </div>
          <p>O modo Build continua usando Shadow Build, aprovação e Validation Gate; nenhuma ação deste cockpit ignora o pipeline existente.</p>
        </article>
        <article class="ld51-card ld51-wide">
          <header><div><small>RUNTIME CONSOLE</small><h3>Garantias e estado técnico</h3></div><span class="ld51-live"><i></i> LIVE</span></header>
          <div class="ld51-console">${consoleRows(snapshot)}</div>
        </article>
      </section>`;
    $('[data-ld51-state-refresh]', body).onclick = () => select('state', { force: true });
    $$('[data-ld51-chat-mode]', body).forEach(button => button.onclick = () => focusChat(button.dataset.ld51ChatMode));
  }

  async function focusChat(mode = 'chat') {
    const chat = window.LovableDecrypterChat;
    if (!chat?.mount) return notify('Decrypter Chat não está disponível.', true);
    close();
    try { await chat.mount(); } catch (_) {}
    await wait(160);
    const host = document.getElementById('ld2-decrypter-chat-host');
    const shadow = host?.shadowRoot;
    const modeButton = shadow?.querySelector(`[data-ldc-mode="${CSS.escape(mode)}"]`);
    modeButton?.click();
    const input = shadow?.querySelector('[data-ldc-input]');
    if (input) input.focus();
    else notify('O chat está protegido porque a área nativa do Lovable não foi localizada.', true);
  }

  async function renderChat(generation) {
    const snapshot = await collectSnapshot();
    if (generation !== renderGeneration) return;
    const chat = snapshot.chat;
    const caps = window.LovableDecrypterChat?.capabilities || {};
    const body = $('[data-ld51-body]', overlay);
    body.innerHTML = `
      <section class="ld51-hero">
        <div><small>ENGINEERING CHAT</small><h3>Uma transação, três modos.</h3><p>Chat consulta contexto; Plan congela escopo sem escrita; Build prepara Shadow Build e segue o pipeline protegido.</p></div>
        <span class="ld51-badge" data-tone="${tone(chat?.phase)}">${esc(safeState(chat?.phase, 'NOT MOUNTED'))}</span>
      </section>
      <section class="ld51-mode-cards">
        ${['chat','plan','build'].map(mode => `<button type="button" data-ld51-chat-mode="${mode}" class="${chat?.mode === mode ? 'active' : ''}"><small>${mode === 'chat' ? 'CONTEXTUAL' : mode === 'plan' ? 'ZERO WRITE' : 'SHADOW BUILD'}</small><b>${mode.toUpperCase()}</b><span>${mode === 'chat' ? 'Perguntar e investigar o projeto.' : mode === 'plan' ? 'Gerar plano e fileset autorizado.' : 'Preparar mudanças sem pular aprovação.'}</span></button>`).join('')}
      </section>
      <section class="ld51-card">
        <header><div><small>TRANSACTION INSPECTOR</small><h3>Estado atual</h3></div></header>
        <div class="ld51-facts">
          <div><span>Projeto</span><b>${esc(chat?.projectId || projectId() || '—')}</b></div>
          <div><span>Histórico</span><b>${Number(chat?.historyCount || 0)}</b></div>
          <div><span>Anexos</span><b>${Number(chat?.attachments || 0)}</b></div>
          <div><span>Composer próprio</span><b>${caps.ownComposer ? 'SIM' : '—'}</b></div>
          <div><span>Fail-closed</span><b>${caps.failClosed ? 'SIM' : '—'}</b></div>
          <div><span>Auto apply</span><b>${caps.automaticApply ? 'SIM' : 'NÃO'}</b></div>
        </div>
      </section>`;
    $$('[data-ld51-chat-mode]', body).forEach(button => button.onclick = () => focusChat(button.dataset.ld51ChatMode));
  }

  async function renderPipeline(generation) {
    const snapshot = await collectSnapshot();
    if (generation !== renderGeneration) return;
    const chat = snapshot.chat;
    const body = $('[data-ld51-body]', overlay);
    body.innerHTML = `
      <section class="ld51-hero">
        <div><small>PROTECTED PIPELINE</small><h3>Do escopo ao commit, sem atalhos.</h3><p>As garantias abaixo permanecem separadas dos controles visuais; este cockpit não substitui nenhum gate autoritativo.</p></div>
        <span class="ld51-badge" data-tone="${tone(chat?.phase)}">${esc(safeState(chat?.phase, 'READY'))}</span>
      </section>
      <section class="ld51-pipeline">
        ${[
          ['1','Scope Lock','Congela fileset e intenção autorizada.'],
          ['2','Shadow Build','Prepara a mudança fora do código efetivo.'],
          ['3','Regression Sentinel','Bloqueia regressões antes de promover.'],
          ['4','Validation Gate','Exige validação antes do commit.'],
          ['5','Checkpoint','Mantém ponto seguro para rollback/reentrada.']
        ].map(([n,t,d]) => `<article><span>${n}</span><div><b>${esc(t)}</b><small>${esc(d)}</small></div></article>`).join('<i>›</i>')}
      </section>
      <section class="ld51-actions-panel">
        <button type="button" data-ld51-plan><b>Planejar</b><span>Abrir Chat em PLAN</span></button>
        <button type="button" data-ld51-build><b>Preparar Build</b><span>Abrir Chat em BUILD</span></button>
        <button type="button" data-ld51-queue><b>Queue / Batch</b><span>Execução sequencial e pausa em falha</span></button>
      </section>`;
    $('[data-ld51-plan]', body).onclick = () => focusChat('plan');
    $('[data-ld51-build]', body).onclick = () => focusChat('build');
    $('[data-ld51-queue]', body).onclick = () => {
      close();
      const queue = window.LovableDecrypterBatchMode;
      if (queue?.open) queue.open();
      else notify('Queue ainda não está disponível.', true);
    };
  }

  function graphStatusBlock(graph) {
    if (!graph) return `<div class="ld51-empty"><b>Project State ainda não foi reconciliado.</b><span>Use “Reconciliar agora” para comparar Lovable, GitHub e Supabase.</span></div>`;
    const counts = graph.files?.counts || {};
    return `
      <section class="ld51-kpis compact">
        ${kpi('STATUS', safeState(graph.status), graph.hash ? String(graph.hash).slice(0, 10) : '')}
        ${kpi('FILES MATCHED', Number(counts.matched || 0), 'GitHub ↔ Lovable')}
        ${kpi('LOCAL ONLY', Number(counts.lovableOnly || counts.localOnly || 0), 'workspace')}
        ${kpi('REMOTE ONLY', Number(counts.githubOnly || counts.remoteOnly || 0), 'repository')}
        ${kpi('MIGRATIONS', Number(graph.migrations?.matched?.length || 0), 'matched')}
        ${kpi('EDGE FUNCTIONS', Number(graph.edgeFunctions?.matched?.length || 0), 'matched')}
      </section>
      <section class="ld51-card">
        <header><div><small>SOURCES</small><h3>Autoridade por fonte</h3></div></header>
        <div class="ld51-sources">
          ${sourceLine('Lovable', graph.sources?.lovable)}
          ${sourceLine('GitHub', graph.sources?.github)}
          ${sourceLine('Supabase', graph.sources?.supabase)}
        </div>
        <div class="ld51-note">Secret values nunca fazem parte do State Graph. Apenas nomes e metadados sanitizados podem aparecer na reconciliação.</div>
      </section>`;
  }

  async function renderState(generation, force = false) {
    const body = $('[data-ld51-body]', overlay);
    body.innerHTML = `<div class="ld51-loading"><i></i><b>Reconciliando Lovable ↔ GitHub ↔ Supabase…</b><span>Deep compare protegido, sem escrita.</span></div>`;
    let graph = null;
    try { graph = await window.LovableDecrypterProjectStateGraph?.getGraph?.({ force, deepCompare: true }); }
    catch (error) {
      if (generation !== renderGeneration) return;
      body.innerHTML = `<div class="ld51-error"><b>Falha ao reconciliar Project State</b><span>${esc(error?.message || String(error))}</span><button type="button" data-retry>Tentar novamente</button></div>`;
      $('[data-retry]', body).onclick = () => select('state', { force: true });
      return;
    }
    if (generation !== renderGeneration) return;
    body.innerHTML = `
      <section class="ld51-hero"><div><small>UNIFIED PROJECT STATE</small><h3>Uma visão consistente do projeto.</h3><p>Workspace Lovable, HEAD do GitHub e infraestrutura Supabase são comparados sem expor secrets.</p></div><button type="button" data-ld51-refresh>Reconciliar agora</button></section>
      ${graphStatusBlock(graph)}`;
    $('[data-ld51-refresh]', body).onclick = () => select('state', { force: true });
  }

  function recoveryBody(report) {
    if (!report) return `<div class="ld51-empty"><b>Nenhum diagnóstico armazenado.</b><span>Execute o Recovery Doctor para gerar um relatório somente leitura.</span><button type="button" data-ld51-doctor-run>Analisar projeto</button></div>`;
    const counts = report.counts || {};
    const assets = report.portability?.assetCounts || {};
    return `
      <section class="ld51-kpis compact">
        ${kpi('STATUS', safeState(report.status), report.portability?.portable ? 'portable' : 'review')}
        ${kpi('CRITICAL', Number(counts.critical || 0), 'issues')}
        ${kpi('HIGH', Number(counts.high || 0), 'issues')}
        ${kpi('MISSING ASSETS', Number(assets.missing || 0), `${Number(assets.recoverable || 0)} recoverable`)}
        ${kpi('ROUTES', Number(report.summary?.routes || 0), 'detected')}
        ${kpi('EDGE FUNCTIONS', Number(report.summary?.edgeFunctionsInvoked || 0), 'invoked')}
      </section>
      <section class="ld51-card">
        <header><div><small>RECOVERY PLAN</small><h3>Próximos passos detectados</h3></div><button type="button" data-ld51-doctor-open>Abrir Doctor completo</button></header>
        <div class="ld51-plan">${(report.plan || []).slice(0, 8).map(step => `<div><b>${Number(step.order || 0)}.</b><span>${esc(step.action || '')}</span></div>`).join('') || '<span>Nenhum reparo necessário.</span>'}</div>
      </section>`;
  }

  async function renderRecovery(generation, force = false) {
    const body = $('[data-ld51-body]', overlay);
    if (force) body.innerHTML = `<div class="ld51-loading"><i></i><b>Recovery Doctor analisando projeto…</b><span>Rotas, imports, banco, OAuth, assets e integrações.</span></div>`;
    let report = null;
    try {
      report = force
        ? await window.LovableDecrypterRecoveryDoctor?.getReport?.({ force: true })
        : await window.LovableDecrypterRecoveryDoctor?.getStored?.(projectId());
    } catch (error) {
      if (generation !== renderGeneration) return;
      body.innerHTML = `<div class="ld51-error"><b>Recovery Doctor falhou</b><span>${esc(error?.message || String(error))}</span><button type="button" data-retry>Tentar novamente</button></div>`;
      $('[data-retry]', body).onclick = () => select('recovery', { force: true });
      return;
    }
    if (generation !== renderGeneration) return;
    body.innerHTML = `
      <section class="ld51-hero"><div><small>RECOVERY DOCTOR</small><h3>Diagnóstico antes de reparo.</h3><p>O relatório continua sanitizado e nenhuma correção é executada silenciosamente.</p></div><button type="button" data-ld51-doctor-run>Reanalisar</button></section>
      ${recoveryBody(report)}`;
    $$('[data-ld51-doctor-run]', body).forEach(button => button.onclick = () => select('recovery', { force: true }));
    $('[data-ld51-doctor-open]', body)?.addEventListener('click', () => {
      close();
      window.LovableDecrypterRecoveryDoctor?.open?.(false);
    });
  }

  async function migrationContext() {
    let ctx = window.LovableDecrypterProjectRuntime?.getContext?.() || null;
    if (!ctx) {
      try { ctx = await window.LovableDecrypterProjectRuntime?.refresh?.(false); } catch (_) {}
    }
    let settings = {};
    try { settings = await runtime({ type: 'LD2_SETTINGS_GET' }) || {}; } catch (_) {}
    const mapping = settings.supabaseMappings?.[ctx?.projectId || projectId()] || {};
    const global = settings.supabase || {};
    return {
      ctx,
      destination: {
        ref: String(mapping.projectRef || mapping.ref || global.projectRef || ''),
        name: String(mapping.projectName || mapping.name || global.projectName || '')
      }
    };
  }

  async function renderMigrator(generation) {
    const data = await migrationContext();
    if (generation !== renderGeneration) return;
    const ctx = data.ctx;
    const dest = data.destination;
    const sourceOk = ctx?.backend?.type === 'lovable_cloud' || ctx?.backend?.managedByLovable === true;
    const destOk = /^[a-z0-9]{8,32}$/i.test(dest.ref);
    const body = $('[data-ld51-body]', overlay);
    body.innerHTML = `
      <section class="ld51-hero"><div><small>CLOUD MIGRATOR</small><h3>Lovable Cloud → Supabase.</h3><p>O cockpit só prepara a entrada. A migração real continua no fluxo existente, com confirmação explícita do destino.</p></div><span class="ld51-badge" data-tone="${sourceOk && destOk ? 'ok' : 'warn'}">${sourceOk && destOk ? 'READY' : 'SETUP REQUIRED'}</span></section>
      <section class="ld51-migration">
        <article><small>ORIGEM</small><b>${esc(ctx?.project?.name || 'Projeto Lovable')}</b><span>${esc(ctx?.backend?.supabaseRef || (sourceOk ? 'Lovable Cloud gerenciado' : 'Origem não confirmada'))}</span></article>
        <i>→</i>
        <article><small>DESTINO</small><b>${esc(dest.name || dest.ref || 'Não selecionado')}</b><span>${esc(dest.ref || 'Configure um Supabase nas Integrações')}</span></article>
      </section>
      <section class="ld51-scope">
        <b>Escopo protegido</b>
        <span>Schema · dados · RLS · Auth · Storage · Realtime · Edge Functions · config suportada.</span>
        <small>Secrets não são exibidos. Credenciais externas, sessões e senhas não são inventadas ou copiadas.</small>
      </section>
      <div class="ld51-primary-row"><button type="button" data-ld51-migrate ${sourceOk && destOk ? '' : 'disabled'}>Abrir fluxo de migração</button><button type="button" data-ld51-supabase>Configurar Supabase</button></div>`;
    $('[data-ld51-migrate]', body).onclick = launchCloudMigrator;
    $('[data-ld51-supabase]', body).onclick = () => {
      close();
      window.LovableDecrypterUIActions?.run?.('supabase', { source: 'engineering-suite' }).catch(error => notify(error?.message || String(error), true));
    };
  }

  async function launchCloudMigrator() {
    close();
    await wait(20);
    const legacyButton = root()?.querySelector('[data-cc-action="cloud-migrate"]');
    if (legacyButton) {
      legacyButton.click();
      return;
    }
    notify('Cloud Migrator ainda não foi montado. Reabra o Control Center e tente novamente.', true);
  }

  async function select(tab, options = {}) {
    if (!ensureOverlay()) return false;
    setActiveTab(tab);
    const generation = ++renderGeneration;
    loading(tab === 'state' ? 'Reconciliando Project State…' : tab === 'recovery' ? 'Carregando Recovery Doctor…' : 'Carregando Engineering Suite…');
    try {
      if (activeTab === 'overview') await renderOverview(generation);
      else if (activeTab === 'chat') await renderChat(generation);
      else if (activeTab === 'pipeline') await renderPipeline(generation);
      else if (activeTab === 'state') await renderState(generation, !!options.force);
      else if (activeTab === 'recovery') await renderRecovery(generation, !!options.force);
      else if (activeTab === 'migrator') await renderMigrator(generation);
    } catch (error) {
      if (generation !== renderGeneration) return false;
      const body = $('[data-ld51-body]', overlay);
      if (body) body.innerHTML = `<div class="ld51-error"><b>Engineering Suite indisponível</b><span>${esc(error?.message || String(error))}</span></div>`;
    }
    return true;
  }

  async function open(tab = 'overview') {
    const node = ensureOverlay();
    if (!node) return false;
    node.classList.add('open');
    await select(tab);
    return true;
  }

  function installProviders() {
    const registry = window.LovableDecrypterUIActions;
    if (!registry?.register) return false;
    registry.register('decrypter-chat', () => open('chat'), { build: BUILD, suite: 'engineering' });
    registry.register('editor', () => open('pipeline'), { build: BUILD, suite: 'engineering' });
    registry.register('queue', () => open('pipeline'), { build: BUILD, suite: 'engineering' });
    registry.register('diagnostics', () => open('recovery'), { build: BUILD, suite: 'engineering' });
    registry.register('cloud-migrator', () => open('migrator'), { build: BUILD, suite: 'engineering' });
    return true;
  }

  function refreshIfVisible() {
    if (!overlay?.classList.contains('open') || activeTab !== 'overview') return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => select('overview'), 120);
  }

  window.LovableDecrypterEngineeringSuite = Object.freeze({
    build: BUILD,
    version: VERSION,
    open,
    close,
    select,
    snapshot: () => collectSnapshot({ context: true }),
    focusChat
  });

  if (!installProviders()) window.addEventListener('ld48:action-registered', installProviders);
  for (const event of ['ld2:ui-mounted', 'ld2:dom-reconcile']) window.addEventListener(event, installProviders);
  for (const event of ['ld2:project-state-graph', 'ld2:decrypter-chat-state', 'ld2:project']) window.addEventListener(event, refreshIfVisible);
})();