(() => {
  'use strict';
  if (window.__LD2_PROJECT_MIGRATION_UI__) return;
  window.__LD2_PROJECT_MIGRATION_UI__ = true;

  const PORT_NAME = 'ld2-project-migration';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  let lastAnalysis = null;

  function currentProjectId() {
    return window.LovableDecrypterV2?.getProjectId?.() || '';
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  function request(action, payload = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        try { port.disconnect(); } catch (_) {}
        reject(new Error('A migração não respondeu dentro do tempo limite.'));
      }, action === 'apply' ? 240000 : 60000);
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      port.onMessage.addListener(message => {
        if (String(message?.id || '') !== id) return;
        if (message?.progress) {
          onProgress?.(message.progress);
          return;
        }
        if (!message?.ok) {
          const error = new Error(message?.error || 'Falha na migração.');
          error.migrationResults = message?.migrationResults || null;
          finish(reject, error);
          return;
        }
        if (message?.data) finish(resolve, message.data);
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) finish(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, ...payload });
    });
  }

  function modalParts() {
    const root = document.getElementById('ld2-root');
    const modal = root && $('.ld2-modal', root);
    const card = modal && $('.ld2-card', modal);
    return { root, modal, card };
  }

  function closeModal() {
    const { modal } = modalParts();
    modal?.classList.remove('open');
  }

  function renderShell() {
    const { modal, card } = modalParts();
    if (!modal || !card) throw new Error('Interface do Decrypter ainda não está pronta.');
    card.innerHTML = `
      <div class="ld2-pm-head">
        <div><small>GITHUB → SUPABASE</small><h2>Migrar Projeto</h2><p>Aplica no Supabase as migrations versionadas do repositório GitHub selecionado.</p></div>
        <button class="ld2-icon-btn" type="button" data-pm-close aria-label="Fechar">×</button>
      </div>
      <div class="ld2-pm-body">
        <div class="ld2-pm-state" data-pm-state>Pronto para analisar o backend versionado.</div>
        <div class="ld2-actions"><button class="ld2-btn primary" type="button" data-pm-analyze>Analisar projeto</button></div>
        <div data-pm-result></div>
      </div>`;
    modal.classList.add('open');
    $('[data-pm-close]', card).onclick = closeModal;
    $('[data-pm-analyze]', card).onclick = () => analyze(card);
    return card;
  }

  function migrationRow(item, index) {
    const risks = Array.isArray(item.risk) && item.risk.length
      ? `<span class="ld2-pm-risk">${item.risk.map(esc).join(' · ')}</span>`
      : '<span class="ld2-pm-safe">SEM ALERTA ESTÁTICO</span>';
    return `<div class="ld2-pm-row" data-pm-row="${index}"><span class="ld2-pm-index">${String(index + 1).padStart(2, '0')}</span><div><b>${esc(item.path)}</b><small>${formatBytes(item.bytes)} · SHA ${esc(String(item.sha || '').slice(0, 10))}</small>${risks}</div><em data-pm-row-state>PRONTO</em></div>`;
  }

  function combinedSql(data) {
    return (data.migrations || []).map(item => `-- FILE: ${item.path}\n${item.sql || ''}`).join('\n\n-- ========================================\n\n');
  }

  async function analyze(card) {
    const state = $('[data-pm-state]', card);
    const button = $('[data-pm-analyze]', card);
    const result = $('[data-pm-result]', card);
    button.disabled = true;
    state.textContent = 'Validando GitHub, Supabase e HEAD da branch…';
    result.innerHTML = '';
    lastAnalysis = null;
    try {
      const data = await request('analyze', { projectId: currentProjectId() });
      lastAnalysis = data;
      const warnings = Array.isArray(data.warnings) ? data.warnings : [];
      const detectedFunctions = data.detected?.edgeFunctions || [];
      const sql = combinedSql(data);
      const previewLimit = 120000;
      const preview = sql.length > previewLimit ? `${sql.slice(0, previewLimit)}\n\n-- PREVIEW TRUNCADO NA UI. A aplicação usa o conteúdo integral validado pelo SHA.` : sql;
      state.textContent = `Análise concluída · ${data.migrations.length} migration(s) · ${formatBytes(data.totalBytes)}`;
      result.innerHTML = `
        <section class="ld2-pm-summary">
          <div><small>ORIGEM</small><b>${esc(data.source.repo)}</b><span>${esc(data.source.branch)} · ${esc(String(data.source.headSha || '').slice(0, 12))}</span></div>
          <div><small>DESTINO</small><b>${esc(data.target.name)}</b><span>${esc(data.target.projectRef)}${data.target.status ? ` · ${esc(data.target.status)}` : ''}</span></div>
          <div><small>BANCO</small><b>${data.target.databaseAccess ? 'ACESSO VALIDADO' : 'NÃO VALIDADO'}</b><span>OAuth Supabase</span></div>
        </section>
        ${warnings.length ? `<div class="ld2-pm-warning"><b>⚠ Revisão necessária</b><span>${warnings.length} alerta(s) estático(s) encontrados. Eles não bloqueiam a migração, mas exigem conferência do SQL.</span></div>` : '<div class="ld2-pm-ok"><b>✓ Nenhum padrão destrutivo óbvio detectado</b><span>A revisão manual continua obrigatória.</span></div>'}
        <div class="ld2-pm-section"><small>MIGRATIONS</small><h3>Ordem de aplicação</h3></div>
        <div class="ld2-pm-list">${data.migrations.map(migrationRow).join('')}</div>
        <details class="ld2-pm-sql"><summary>Revisar SQL</summary><textarea readonly>${esc(preview)}</textarea></details>
        <div class="ld2-pm-detected">
          <div><small>Edge Functions detectadas</small><b>${detectedFunctions.length}</b><span>${detectedFunctions.length ? esc(detectedFunctions.join(', ')) : 'Nenhuma'}</span></div>
          <div><small>seed.sql</small><b>${data.detected?.seedSql ? 'DETECTADO' : '—'}</b><span>Não é executado automaticamente nesta etapa.</span></div>
          <div><small>config.toml</small><b>${data.detected?.configToml ? 'DETECTADO' : '—'}</b><span>Somente inventariado nesta etapa.</span></div>
        </div>
        <label class="ld2-pm-approve"><input type="checkbox" data-pm-approve> <span>Revisei o destino, a ordem e o SQL. Autorizar aplicação no Supabase selecionado.</span></label>
        <div class="ld2-actions"><button class="ld2-btn primary" type="button" data-pm-apply disabled>Aplicar migrations no Supabase</button></div>
        <p class="ld2-help">Proteção ativa: se o HEAD do GitHub ou o projeto Supabase mudar depois desta análise, a execução é bloqueada e uma nova análise será exigida.</p>`;
      const approve = $('[data-pm-approve]', result);
      const apply = $('[data-pm-apply]', result);
      approve.onchange = () => { apply.disabled = !approve.checked; };
      apply.onclick = () => applyPlan(card, data.planId);
    } catch (error) {
      state.textContent = `Falha na análise: ${error?.message || String(error)}`;
      result.innerHTML = '<p class="ld2-help">Nada foi alterado no Supabase.</p>';
    } finally {
      button.disabled = false;
      button.textContent = 'Analisar novamente';
    }
  }

  function updateRow(card, progress) {
    const row = $(`[data-pm-row="${Number(progress.index)}"]`, card);
    const label = row && $('[data-pm-row-state]', row);
    if (!row || !label) return;
    row.classList.remove('running', 'done', 'failed');
    if (progress.phase === 'applying') { row.classList.add('running'); label.textContent = 'APLICANDO'; }
    if (progress.phase === 'applied') { row.classList.add('done'); label.textContent = 'OK'; }
    if (progress.phase === 'failed') { row.classList.add('failed'); label.textContent = 'FALHOU'; }
  }

  async function applyPlan(card, planId) {
    const state = $('[data-pm-state]', card);
    const apply = $('[data-pm-apply]', card);
    const approve = $('[data-pm-approve]', card);
    if (!lastAnalysis || !planId || planId !== lastAnalysis.planId) return;
    if (!approve?.checked) return;
    if (!confirm(`Aplicar ${lastAnalysis.migrations.length} migration(s) em ${lastAnalysis.target.name} (${lastAnalysis.target.projectRef})?`)) return;
    apply.disabled = true;
    approve.disabled = true;
    state.textContent = 'Aplicando migrations em ordem…';
    try {
      const result = await request('apply', { planId }, progress => {
        updateRow(card, progress);
        if (progress.phase === 'applying') state.textContent = `Aplicando ${progress.index + 1}/${progress.total}: ${progress.path}`;
        if (progress.phase === 'applied') state.textContent = `Concluída ${progress.index + 1}/${progress.total}: ${progress.path}`;
        if (progress.phase === 'failed') state.textContent = `Falha em ${progress.path}`;
      });
      state.textContent = `Migração concluída · ${result.applied.length} migration(s) aplicadas no Supabase.`;
      apply.textContent = 'Migração concluída';
      apply.disabled = true;
      lastAnalysis = null;
    } catch (error) {
      state.textContent = `Migração interrompida: ${error?.message || String(error)}`;
      apply.disabled = false;
      approve.disabled = false;
      apply.textContent = 'Tentar novamente após corrigir';
    }
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('#ld2-root [data-cc-action="migrate"], #ld2-root .ld2-nav [data-action="migrate"]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    try { renderShell(); } catch (error) { console.error('Lovable Decrypter migration UI', error); }
  }, true);
})();
