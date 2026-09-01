(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_ACTIVITY_CENTER__) return;
  window.__LOVABLE_DECRYPTER_ACTIVITY_CENTER__ = true;

  const ROOT_ID = 'ld2-root';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtMs = value => {
    const ms = Math.max(0, Number(value || 0));
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
    const min = Math.floor(ms / 60000), sec = Math.round((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  };
  const fmtTime = value => value ? new Date(Number(value)).toLocaleString('pt-BR') : '—';
  let filter = 'all';
  let selectedId = '';
  let renderTimer = 0;

  function root() { return document.getElementById(ROOT_ID); }
  function api() { return window.LovableDecrypterLiveOperations; }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function installCard() {
    const r = root();
    const grid = r?.querySelector('.ld2-unified-shell [data-ul-section="principal"] .ld2-ul-grid');
    if (!grid) return false;
    let button = grid.querySelector('[data-activity-open]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ld2-ul-card ld2-activity-entry';
      button.dataset.activityOpen = '1';
      button.innerHTML = '<span>◉</span><div><b>Activity Center</b><small>Operações, Knowledge, arquivos e commits reais</small></div><em data-activity-badge>0</em>';
      grid.appendChild(button);
      button.addEventListener('click', open);
    } else {
      const small = button.querySelector('small');
      if (small && small.textContent !== 'Operações, Knowledge, arquivos e commits reais') small.textContent = 'Operações, Knowledge, arquivos e commits reais';
    }
    updateBadge();
    return true;
  }

  function updateBadge() {
    const snap = api()?.snapshot?.();
    const badge = root()?.querySelector('[data-activity-badge]');
    if (!badge || !snap) return;
    const running = snap.active?.filter(item => item.status === 'running').length || 0;
    const prepared = snap.active?.filter(item => item.status === 'prepared').length || 0;
    badge.textContent = running ? `${running} LIVE` : prepared ? `${prepared} READY` : String(snap.count || 0);
    badge.dataset.state = running ? 'live' : prepared ? 'prepared' : 'idle';
  }

  function statusLabel(status) {
    return ({ running: 'EXECUTANDO', prepared: 'AGUARDANDO APPLY', completed: 'CONCLUÍDA', failed: 'FALHOU', interrupted: 'INTERROMPIDA' })[status] || String(status || '—').toUpperCase();
  }

  function statusClass(status) {
    if (status === 'completed') return 'good';
    if (status === 'failed' || status === 'interrupted') return 'bad';
    if (status === 'prepared') return 'warn';
    return 'live';
  }

  function filtered(items) {
    if (filter === 'active') return items.filter(item => ['running', 'prepared'].includes(item.status));
    if (filter === 'failed') return items.filter(item => ['failed', 'interrupted'].includes(item.status));
    if (filter === 'completed') return items.filter(item => item.status === 'completed');
    return items;
  }

  function listMarkup(items) {
    if (!items.length) return '<div class="ld2-activity-empty">Nenhuma operação registrada neste filtro.</div>';
    return items.map(item => {
      const files = Array.isArray(item.files) ? item.files.length : 0;
      const skills = Array.isArray(item.skills) ? item.skills.length : 0;
      const hits = Math.max(0, Number(item?.rag?.hitCount || 0));
      const rag = item?.rag?.consulted ? ` · RAG ${hits}` : '';
      const commit = item.commit?.sha ? ` · ${esc(String(item.commit.sha).slice(0, 8))}` : '';
      return `<button type="button" class="ld2-activity-row ${selectedId === item.id ? 'selected' : ''}" data-activity-id="${esc(item.id)}">
        <div class="ld2-activity-row-top"><span class="ld2-activity-state ${statusClass(item.status)}">${statusLabel(item.status)}</span><time>${esc(fmtTime(item.startedAt))}</time></div>
        <b>${esc(item.command || `${item.mode || 'operação'} sem texto`)}</b>
        <small>${esc(String(item.mode || 'operation').toUpperCase())} · ${esc(item.model || 'modelo não informado')} · ${files} arquivo(s) · ${skills} Skill(s)${rag} · ${esc(fmtMs(item.durationMs))}${commit}</small>
      </button>`;
    }).join('');
  }

  function stageMarkup(stages = []) {
    if (!stages.length) return '<div class="ld2-activity-empty compact">Nenhuma etapa emitida pelo runtime.</div>';
    return stages.map(stage => `<div class="ld2-activity-stage"><i class="${stage.status === 'done' ? 'done' : 'active'}"></i><div><b>${esc(stage.label || stage.stage)}</b><small>${esc(stage.detail || '')}</small></div><time>${esc(fmtMs(stage.elapsedMs))}</time></div>`).join('');
  }

  function fileMarkup(files = []) {
    if (!files.length) return '<span class="ld2-activity-muted">Nenhum arquivo retornado ainda.</span>';
    return files.map(file => `<span class="ld2-activity-file"><em>${esc(String(file.action || 'file').toUpperCase())}</em><b>${esc(file.path)}</b></span>`).join('');
  }

  function telemetryMarkup(operation) {
    const t = operation.telemetry || {};
    if (!t.reported) return '<span class="ld2-activity-muted">Tokens/custo não foram reportados pelo provider nesta operação. O Activity Center não estima valores.</span>';
    const tokenBits = [
      t.inputTokens != null ? `entrada ${Number(t.inputTokens).toLocaleString('pt-BR')}` : '',
      t.outputTokens != null ? `saída ${Number(t.outputTokens).toLocaleString('pt-BR')}` : '',
      t.totalTokens != null ? `total ${Number(t.totalTokens).toLocaleString('pt-BR')}` : ''
    ].filter(Boolean).join(' · ');
    const cost = t.cost != null ? `${t.currency || ''} ${Number(t.cost).toLocaleString('pt-BR', { maximumFractionDigits: 6 })}`.trim() : 'não reportado';
    return `<span>${esc(tokenBits || 'tokens reportados sem detalhamento')} · custo ${esc(cost)}</span>`;
  }

  function ragLabel(rag = {}) {
    if (!rag.consulted) return 'AGUARDANDO';
    if (rag.active === false || String(rag.status) === 'degraded') return 'DEGRADADO';
    const hits = Math.max(0, Number(rag.hitCount || 0));
    const vector = Math.max(0, Number(rag.vectorHits || 0));
    const keyword = Math.max(0, Number(rag.keywordOnlyHits || 0));
    return `${hits} hits · ${vector} vector · ${keyword} keyword`;
  }

  function knowledgeMarkup(rag = {}) {
    const citations = Array.isArray(rag.citations) ? rag.citations : [];
    if (!rag.consulted) return '<span class="ld2-activity-muted">A consulta ao Decrypter Knowledge ainda não terminou.</span>';
    const summary = `<p class="ld2-activity-warning">${esc(ragLabel(rag))} · ${esc(rag.embeddingModel || 'gte-small')} · ${esc(rag.retrieval || 'hybrid-vector-keyword')}</p>`;
    if (!citations.length) return `${summary}<span class="ld2-activity-muted">Nenhuma fonte atingiu o limiar desta operação.</span>`;
    return `${summary}<div class="ld2-activity-files">${citations.map((source, index) => `<span class="ld2-activity-file"><em>${esc(String(source.category || 'DOC').toUpperCase())}</em><b>${esc(source.title || `Fonte ${index + 1}`)}</b><button type="button" data-activity-open-source="${esc(source.url)}">Abrir fonte</button></span>`).join('')}</div>`;
  }

  function detailMarkup(operation) {
    if (!operation) return '<div class="ld2-activity-detail-empty"><b>Selecione uma operação</b><span>O detalhe mostra somente eventos observados de verdade pelo runtime.</span></div>';
    const warnings = Array.isArray(operation.warnings) ? operation.warnings : [];
    const dependencies = Array.isArray(operation.dependencies) ? operation.dependencies : [];
    const skills = Array.isArray(operation.skills) ? operation.skills : [];
    const rag = operation.rag || {};
    return `<div class="ld2-activity-detail-head">
      <div><span class="ld2-activity-state ${statusClass(operation.status)}">${statusLabel(operation.status)}</span><h3>${esc(operation.command || 'Operação')}</h3><p>${esc(operation.repo || 'repositório não identificado')} · ${esc(operation.branch || 'main')}</p></div>
      <strong>${esc(fmtMs(operation.durationMs))}</strong>
    </div>
    <div class="ld2-activity-facts">
      <div><small>MODO</small><b>${esc(String(operation.mode || 'operation').toUpperCase())}</b></div>
      <div><small>MODELO</small><b>${esc(operation.model || 'não informado')}</b></div>
      <div><small>PROJECT RULES</small><b>${operation.rulesCount == null ? 'não informado' : Number(operation.rulesCount)}</b></div>
      <div><small>SKILLS</small><b>${skills.length}</b></div>
      <div><small>RAG</small><b>${esc(ragLabel(rag))}</b></div>
      <div><small>REQUEST ID</small><b title="${esc(operation.requestId || '')}">${esc(String(operation.requestId || '').slice(0, 12) || '—')}</b></div>
    </div>
    <section><small>SKILLS SELECIONADAS</small><div class="ld2-activity-tags">${skills.length ? skills.map(skill => `<span>${esc(skill)}</span>`).join('') : '<span class="muted">Nenhuma</span>'}</div>${operation.skillWarning ? `<p class="ld2-activity-warning">${esc(operation.skillWarning)}</p>` : ''}</section>
    <section><small>DECRYPTER KNOWLEDGE / FONTES</small><div class="ld2-activity-telemetry">${knowledgeMarkup(rag)}</div></section>
    <section><small>ARQUIVOS</small><div class="ld2-activity-files">${fileMarkup(operation.files)}</div></section>
    <section><small>TIMELINE REAL</small><div class="ld2-activity-timeline">${stageMarkup(operation.stages)}</div></section>
    <section><small>TELEMETRIA DO MODELO</small><div class="ld2-activity-telemetry">${telemetryMarkup(operation)}</div></section>
    ${dependencies.length ? `<section><small>DEPENDÊNCIAS</small><div class="ld2-activity-tags">${dependencies.map(dep => `<span>${esc(dep)}</span>`).join('')}</div></section>` : ''}
    ${warnings.length ? `<section><small>WARNINGS</small><div class="ld2-activity-warnings">${warnings.map(w => `<p>${esc(w)}</p>`).join('')}</div></section>` : ''}
    ${operation.commit?.sha ? `<section><small>COMMIT</small><div class="ld2-activity-commit"><b>${esc(operation.commit.sha)}</b><span>${esc(operation.commit.branch || '')}</span>${operation.commit.url ? `<button type="button" data-activity-open-commit="${esc(operation.commit.url)}">Abrir commit</button>` : ''}</div></section>` : ''}
    ${operation.error ? `<section><small>ERRO</small><div class="ld2-activity-error">${esc(operation.error)}</div></section>` : ''}`;
  }

  function modalParts() {
    const r = root();
    return { modal: r?.querySelector('.ld2-modal'), card: r?.querySelector('.ld2-card') };
  }

  async function open() {
    await api()?.list?.();
    const { modal, card } = modalParts();
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld2-activity-card';
    card.innerHTML = `<div class="ld2-activity-head"><div><small>BUILD 16 · LIVE OPERATIONS + KNOWLEDGE</small><h2>Activity Center</h2><p>Sem progresso fake: eventos reais, Knowledge consultado e resultados confirmados.</p></div><button type="button" data-activity-close>×</button></div>
      <div class="ld2-activity-toolbar"><div><button data-activity-filter="all">Todas</button><button data-activity-filter="active">Ativas</button><button data-activity-filter="completed">Concluídas</button><button data-activity-filter="failed">Falhas</button></div><button data-activity-clear>Limpar concluídas</button></div>
      <div class="ld2-activity-layout"><aside data-activity-list></aside><main data-activity-detail></main></div>`;
    card.querySelector('[data-activity-close]').onclick = () => modal.classList.remove('open');
    card.querySelectorAll('[data-activity-filter]').forEach(button => button.onclick = () => { filter = button.dataset.activityFilter; selectedId = ''; render(); });
    card.querySelector('[data-activity-clear]').onclick = async () => {
      await api()?.clearCompleted?.();
      selectedId = '';
      toast('Histórico concluído removido. Operações ativas/preparadas foram preservadas.');
      render();
    };
    card.addEventListener('click', event => {
      const row = event.target.closest?.('[data-activity-id]');
      if (row) { selectedId = row.dataset.activityId; render(); return; }
      const source = event.target.closest?.('[data-activity-open-source]');
      if (source) { window.open(source.dataset.activityOpenSource, '_blank', 'noopener,noreferrer'); return; }
      const commit = event.target.closest?.('[data-activity-open-commit]');
      if (commit) window.open(commit.dataset.activityOpenCommit, '_blank', 'noopener,noreferrer');
    });
    render();
  }

  function render() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      updateBadge();
      const card = root()?.querySelector('.ld2-activity-card');
      if (!card) return;
      const all = api()?.snapshot?.().history || [];
      const items = filtered(all);
      if (!selectedId && items.length) selectedId = items[0].id;
      if (selectedId && !all.some(item => item.id === selectedId)) selectedId = items[0]?.id || '';
      card.querySelectorAll('[data-activity-filter]').forEach(button => button.classList.toggle('active', button.dataset.activityFilter === filter));
      const list = card.querySelector('[data-activity-list]');
      const detail = card.querySelector('[data-activity-detail]');
      if (list) list.innerHTML = listMarkup(items);
      if (detail) detail.innerHTML = detailMarkup(all.find(item => item.id === selectedId));
    }, 20);
  }

  window.addEventListener('ld2:activity-operation', render);
  window.addEventListener('ld2:activity-history', () => { updateBadge(); render(); });
  window.addEventListener('ld2:unified-launcher-ready', installCard);
  window.addEventListener('ld2:ui-mounted', installCard);

  let attempts = 0;
  const bounded = () => {
    if (installCard()) return;
    if (++attempts < 36) setTimeout(bounded, 100 + attempts * 25);
  };
  bounded();

  window.LovableDecrypterActivityCenter = Object.freeze({ open, render, install: installCard, build: 16 });
})();
