(() => {
  'use strict';
  if (window.__LD67_CONTINUITY_UI__) return;
  window.__LD67_CONTINUITY_UI__ = true;

  const ROOT_ID = 'ld2-root';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  let selectedTaskId = '';
  let renderTimer = 0;

  function root() { return document.getElementById(ROOT_ID); }
  function api() { return window.LovableDecrypterContinuity; }
  function projectId() {
    const match = location.pathname.match(/(?:projects?|project)\/([a-z0-9-]{6,})/i);
    return match?.[1] || document.querySelector('[data-project-id]')?.getAttribute('data-project-id') || '';
  }
  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
  function statusLabel(status) {
    return ({created:'PRONTA',running:'EXECUTANDO',interrupted:'INTERROMPIDA',verification_required:'VERIFICAR WRITE',completed:'CONCLUÍDA',failed:'FALHOU',cancelled:'CANCELADA'})[status] || String(status || '—').toUpperCase();
  }
  function statusClass(status) {
    if (status === 'completed') return 'good';
    if (status === 'running') return 'live';
    if (status === 'created') return 'idle';
    if (status === 'verification_required') return 'danger';
    if (status === 'interrupted') return 'warn';
    return 'bad';
  }
  function installCard() {
    const grid = root()?.querySelector('.ld2-unified-shell [data-ul-section="principal"] .ld2-ul-grid');
    if (!grid) return false;
    let button = grid.querySelector('[data-continuity-open]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ld2-ul-card ld67-continuity-entry';
      button.dataset.continuityOpen = '1';
      button.innerHTML = '<span>↻</span><div><b>Continuity Engine</b><small>Retomar tarefas após crash ou reinício</small></div><em data-continuity-badge>0</em>';
      grid.appendChild(button);
      button.addEventListener('click', open);
    }
    refreshBadge();
    return true;
  }
  async function refreshBadge() {
    try {
      const response = await api()?.list?.({ projectId: projectId(), limit: 50 });
      const tasks = response?.tasks || [];
      const attention = tasks.filter(task => task.needsAttention || ['interrupted','verification_required'].includes(task.status)).length;
      const badge = root()?.querySelector('[data-continuity-badge]');
      if (badge) { badge.textContent = attention ? String(attention) : 'OK'; badge.dataset.state = attention ? 'warn' : 'good'; }
    } catch (_) {}
  }
  function modalParts() {
    const r = root();
    return { modal: r?.querySelector('.ld2-modal'), card: r?.querySelector('.ld2-card') };
  }
  function stepMarkup(step) {
    const ref = step.commitSha ? ` · commit ${esc(step.commitSha.slice(0,8))}` : step.operationId ? ` · op ${esc(step.operationId.slice(0,8))}` : '';
    const checkpoint = step.checkpoint?.reference ? ` · checkpoint ${esc(String(step.checkpoint.reference).slice(0,8))}` : '';
    return `<div class="ld67-step"><i class="${statusClass(step.status)}"></i><div><b>${esc(step.label)}</b><small>${esc(step.kind)} · ${esc(step.mode)} · tentativa ${Number(step.attempts||0)}/${Number(step.maxAttempts||0)}${ref}${checkpoint}</small>${step.verificationReason ? `<p>${esc(step.verificationReason)}</p>` : ''}</div><span>${esc(statusLabel(step.status))}</span></div>`;
  }
  function detailMarkup(task) {
    if (!task) return '<div class="ld67-empty">Selecione uma tarefa para ver checkpoints e retomada.</div>';
    const verify = task.steps.find(step => step.status === 'verification_required');
    return `<div class="ld67-detail-head"><div><span class="ld67-state ${statusClass(task.status)}">${esc(statusLabel(task.status))}</span><h3>${esc(task.repo || 'Tarefa Decrypter')}</h3><p>${esc(task.branch || 'main')} · ${esc(task.id.slice(0,12))}</p></div><strong>${Number(task.resumeCount||0)} retomada(s)</strong></div>
      <div class="ld67-policy"><b>Continuidade fail-closed</b><span>Writes ambíguos nunca são repetidos. O Decrypter verifica Operation Journal + HEAD pré-write antes de liberar retry.</span></div>
      <div class="ld67-actions">
        ${verify ? `<button type="button" data-continuity-verify="${esc(verify.id)}">Verificar write ambíguo</button>` : ''}
        ${['interrupted','failed'].includes(task.status) ? '<button type="button" data-continuity-resume>Retomar do último passo verificado</button>' : ''}
        ${!['completed','cancelled'].includes(task.status) ? '<button type="button" class="danger" data-continuity-cancel>Cancelar tarefa</button>' : ''}
      </div>
      <section><small>PASSOS DURÁVEIS</small><div class="ld67-steps">${task.steps.length ? task.steps.map(stepMarkup).join('') : '<span class="ld67-muted">Nenhum passo definido.</span>'}</div></section>
      <section><small>ESTADO COMPACTO</small><div class="ld67-facts"><span>Command digest <b>${esc((task.commandDigest||'—').slice(0,12))}</b></span><span>Context digest <b>${esc((task.contextDigest||'—').slice(0,12))}</b></span><span>Conteúdo bruto persistido <b>NÃO</b></span></div></section>`;
  }
  function listMarkup(tasks) {
    if (!tasks.length) return '<div class="ld67-empty">Nenhuma tarefa de continuidade neste projeto.</div>';
    return tasks.map(task => `<button type="button" class="ld67-task ${task.id === selectedTaskId ? 'selected' : ''}" data-continuity-task="${esc(task.id)}"><div><span class="ld67-state ${statusClass(task.status)}">${esc(statusLabel(task.status))}</span><time>${esc(task.updatedAt ? new Date(task.updatedAt).toLocaleString('pt-BR') : '—')}</time></div><b>${esc(task.repo || task.projectId || 'Tarefa')}</b><small>${task.steps.filter(step => step.status === 'completed').length}/${task.steps.length} passo(s) verificados · ${Number(task.resumeCount||0)} retomada(s)</small></button>`).join('');
  }
  async function load() {
    const response = await api()?.list?.({ projectId: projectId(), limit: 60 });
    return response?.tasks || [];
  }
  async function render() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      const card = root()?.querySelector('.ld67-card');
      if (!card) return;
      try {
        const tasks = await load();
        if (!selectedTaskId && tasks.length) selectedTaskId = tasks[0].id;
        if (selectedTaskId && !tasks.some(task => task.id === selectedTaskId)) selectedTaskId = tasks[0]?.id || '';
        const list = card.querySelector('[data-continuity-list]');
        const detail = card.querySelector('[data-continuity-detail]');
        if (list) list.innerHTML = listMarkup(tasks);
        if (detail) detail.innerHTML = detailMarkup(tasks.find(task => task.id === selectedTaskId));
        refreshBadge();
      } catch (error) { toast(error.message, true); }
    }, 20);
  }
  async function open() {
    const { modal, card } = modalParts();
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld67-card';
    card.innerHTML = `<div class="ld67-head"><div><small>BUILD 67 · CONTINUITY ENGINE</small><h2>Continuity Engine</h2><p>Tarefas duráveis, leases, idempotência e recuperação após crash.</p></div><button type="button" data-continuity-close>×</button></div><div class="ld67-layout"><aside data-continuity-list></aside><main data-continuity-detail></main></div>`;
    card.querySelector('[data-continuity-close]').onclick = () => modal.classList.remove('open');
    card.addEventListener('click', async event => {
      const row = event.target.closest?.('[data-continuity-task]');
      if (row) { selectedTaskId = row.dataset.continuityTask; render(); return; }
      const verify = event.target.closest?.('[data-continuity-verify]');
      if (verify) {
        try { const out = await api().verifyWrite(selectedTaskId, verify.dataset.continuityVerify); toast(out.action === 'verified-no-write-safe-to-retry' ? 'Write não ocorreu. Retry liberado.' : 'Write localizado no Journal e marcado como concluído.'); render(); } catch (error) { toast(`Verificação bloqueada: ${error.message}`, true); }
        return;
      }
      if (event.target.closest?.('[data-continuity-resume]')) {
        try { await api().resume(selectedTaskId); toast('Tarefa liberada para retomar do próximo passo verificado.'); render(); } catch (error) { toast(error.message, true); }
        return;
      }
      if (event.target.closest?.('[data-continuity-cancel]')) {
        if (!window.confirm('Cancelar esta tarefa durável? Passos já concluídos e commits não serão revertidos.')) return;
        try { await api().cancel(selectedTaskId); toast('Tarefa cancelada.'); render(); } catch (error) { toast(error.message, true); }
      }
    });
    render();
  }

  window.addEventListener('ld2:unified-launcher-ready', installCard);
  document.addEventListener('DOMContentLoaded', () => { installCard(); refreshBadge(); }, { once:true });
  setTimeout(() => { installCard(); refreshBadge(); }, 1800);
})();
