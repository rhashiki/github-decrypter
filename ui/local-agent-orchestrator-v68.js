(() => {
  'use strict';
  if (window.__LD68_LOCAL_AGENT_UI__) return;
  window.__LD68_LOCAL_AGENT_UI__ = true;

  const ROOT_ID = 'ld2-root';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const ephemeralResults = new Map();
  let selectedTaskId = '';
  let busy = false;

  function root() { return document.getElementById(ROOT_ID); }
  function api() { return window.LovableDecrypterLocalAgent; }
  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || location.pathname.match(/(?:projects?|project)\/([a-z0-9-]{6,})/i)?.[1] || '');
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
  function statusLabel(status) {
    return ({running:'EXECUTANDO',waiting_approval:'AGUARDA APROVAÇÃO',completed:'CONCLUÍDA',stopped:'PARADA',iteration_limit:'LIMITE',cancelled:'CANCELADA',interrupted:'INTERROMPIDA',verification_required:'VERIFICAR WRITE',created:'PRONTA'})[status] || String(status || '—').toUpperCase();
  }
  function statusClass(status) {
    if (status === 'completed') return 'good';
    if (status === 'running') return 'live';
    if (['waiting_approval','interrupted','verification_required'].includes(status)) return 'warn';
    return 'bad';
  }
  function installCard() {
    const grid = root()?.querySelector('.ld2-unified-shell [data-ul-section="principal"] .ld2-ul-grid');
    if (!grid) return false;
    let button = grid.querySelector('[data-local-agent-open]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ld2-ul-card ld68-agent-entry';
      button.dataset.localAgentOpen = '1';
      button.innerHTML = '<span>⌁</span><div><b>Local Agent</b><small>Qwen local · tools · continuidade</small></div><em data-local-agent-badge>LOCAL</em>';
      grid.appendChild(button);
      button.addEventListener('click', open);
    }
    refreshBadge();
    return true;
  }
  async function refreshBadge() {
    const badge = root()?.querySelector('[data-local-agent-badge]');
    if (!badge) return;
    try {
      const health = await api()?.health?.();
      badge.textContent = health?.ok ? 'LOCAL ✓' : 'OFF';
      badge.dataset.state = health?.ok ? 'good' : 'warn';
    } catch (_) { badge.textContent = 'OFF'; badge.dataset.state = 'warn'; }
  }
  function runtimeMarkup(status, health) {
    const permission = status?.permission?.granted === true;
    const token = status?.tokenConfigured === true;
    const healthy = health?.ok === true;
    const models = health?.models || [];
    return `<div class="ld68-runtime">
      <div class="ld68-runtime-top"><i class="ld68-dot ${healthy ? 'good' : 'bad'}"></i><b>decrypter-local ${healthy ? 'online' : 'offline'}</b></div>
      <p>${esc(status?.endpoint || 'http://127.0.0.1:8000')} · permissão ${permission ? 'OK' : 'necessária'} · token ${token ? 'em sessão' : 'não configurado'}</p>
      <div class="ld68-models">${models.length ? models.map(model => `<span class="ld68-model">${esc(model)}</span>`).join('') : '<span class="ld68-model">nenhum modelo detectado</span>'}</div>
      <div class="ld68-token"><input type="password" autocomplete="off" data-local-token placeholder="RUNTIME_TOKEN (somente nesta sessão)"><button type="button" data-local-token-save class="primary">Salvar token</button></div>
      <div class="ld68-actions" style="margin-top:8px"><button type="button" data-local-permission>${permission ? 'Permissão concedida' : 'Permitir localhost'}</button><button type="button" data-local-health>Testar runtime</button><button type="button" data-local-token-clear>Limpar token</button></div>
    </div>`;
  }
  function runMarkup(run) {
    return `<button type="button" class="ld68-run ${run.taskId === selectedTaskId ? 'selected' : ''}" data-local-run="${esc(run.taskId)}"><div><span class="ld68-state ${statusClass(run.status)}">${esc(statusLabel(run.status))}</span><time>${esc(run.updatedAt ? new Date(run.updatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '')}</time></div><b>${esc(run.repo || run.projectId || run.taskId)}</b><small>iteração ${Number(run.iteration||0)}/${Number(run.maxIterations||0)} · ${esc(run.routeHistory?.at(-1)?.model || 'sem rota')}</small></button>`;
  }
  function planMarkup(plan) {
    if (!plan) return '';
    return `<div class="ld68-section"><small>PLANO LOCAL</small><div class="ld68-plan"><h3>${esc(plan.summary || 'Plano')}</h3>${Array.isArray(plan.plan) ? `<ol>${plan.plan.map(item => `<li>${esc(item)}</li>`).join('')}</ol>` : ''}${Array.isArray(plan.files) && plan.files.length ? `<div class="ld68-models">${plan.files.map(file => `<span class="ld68-model">${esc(file.path)}</span>`).join('')}</div>` : ''}</div></div>`;
  }
  function proposalMarkup(result) {
    if (result?.status !== 'waiting_approval' || !result?.proposal) return '';
    const proposal = result.proposal;
    const normalized = proposal.normalized || {};
    const paths = proposal.paths || [];
    const preview = JSON.stringify(normalized, null, 2).slice(0, 30000);
    return `<div class="ld68-approval"><h3>Write aguardando sua aprovação</h3><p><b>${esc(proposal.tool)}</b> · ${paths.map(esc).join(', ') || 'sem path'} · digest ${esc(String(proposal.digest||'').slice(0,16))}</p><p>${esc(proposal.reason || 'A IA local propôs esta alteração.')}</p><div class="ld68-code">${esc(preview)}</div><div class="ld68-overrides">${paths.map(path => `<label><input type="checkbox" data-human-override value="${esc(path)}"> Autorizar explicitamente sobrescrita de intenção manual em <b>${esc(path)}</b>, se necessária</label>`).join('')}</div><div class="ld68-actions"><button type="button" class="primary" data-local-approve="${esc(proposal.digest)}">Aprovar exatamente esta proposta</button><button type="button" data-local-reject>Não executar write</button></div></div>`;
  }
  function resultMarkup(result) {
    if (!result) return '<div class="ld68-empty">Inicie uma tarefa local ou selecione uma execução anterior.</div>';
    if (result.status === 'completed') return `<div class="ld68-result"><h3>Tarefa concluída localmente</h3><p>${esc(result.result?.summary || 'Concluída.')}</p>${result.result?.verification ? `<p><b>Verificação:</b> ${esc(result.result.verification)}</p>` : ''}<p>Fallback pago/remoto: <b>NÃO</b></p></div>`;
    if (result.status === 'stopped') return `<div class="ld68-empty">Agente parou: ${esc(result.reason || 'sem motivo informado')}</div>`;
    if (result.status === 'iteration_limit') return `<div class="ld68-empty">Limite de iterações atingido. O agente não continuou indefinidamente.</div>`;
    return '';
  }
  function detailMarkup(run, result) {
    if (!run) return '<div class="ld68-empty">Selecione ou inicie uma tarefa.</div>';
    const routes = run.routeHistory || [];
    return `<div class="ld68-policy"><div><b>Local-only</b><span>Sem fallback pago/remoto silencioso</span></div><div><b>Human Intent</b><span>Write passa por Scope Intelligence v2</span></div><div><b>Continuity</b><span>Idempotência e retomada de passos</span></div></div>
      <div class="ld68-section"><small>EXECUÇÃO</small><div class="ld68-plan"><h3><span class="ld68-state ${statusClass(run.status)}">${esc(statusLabel(run.status))}</span> ${esc(run.repo || '')}</h3><div class="ld68-models">${routes.length ? routes.map(route => `<span class="ld68-model">${esc(route.tier)} · ${esc(route.model)}${route.degraded ? ' ↓' : ''}</span>`).join('') : '<span class="ld68-model">rota ainda não escolhida</span>'}</div><p style="font-size:12px;opacity:.7">Task ${esc(run.taskId.slice(0,12))} · iteração ${Number(run.iteration||0)}/${Number(run.maxIterations||0)}</p></div></div>
      ${planMarkup(result?.plan)}${proposalMarkup(result)}${resultMarkup(result)}
      <div class="ld68-run-actions">${['interrupted','verification_required'].includes(run.status) ? '<button type="button" data-local-resume>Retomar usando o comando acima</button>' : ''}${!['completed','cancelled'].includes(run.status) ? '<button type="button" class="danger" data-local-cancel>Cancelar execução</button>' : ''}</div>`;
  }

  async function snapshot() {
    const [runtime, health, runs] = await Promise.all([
      api().runtimeStatus().catch(error => ({ error })),
      api().health().catch(error => ({ ok:false, code:error.code || error.message })),
      api().list({ projectId: projectId(), limit: 40 }).catch(() => ({ runs: [] }))
    ]);
    return { runtime, health, runs: runs?.runs || [] };
  }
  async function render() {
    const card = root()?.querySelector('.ld68-card');
    if (!card) return;
    try {
      const snap = await snapshot();
      const runs = snap.runs;
      if (!selectedTaskId && runs.length) selectedTaskId = runs[0].taskId;
      const selected = runs.find(item => item.taskId === selectedTaskId) || null;
      const result = selectedTaskId ? ephemeralResults.get(selectedTaskId) : null;
      const sideRuntime = card.querySelector('[data-local-runtime]');
      const list = card.querySelector('[data-local-runs]');
      const detail = card.querySelector('[data-local-detail]');
      if (sideRuntime) sideRuntime.innerHTML = runtimeMarkup(snap.runtime, snap.health);
      if (list) list.innerHTML = runs.length ? runs.map(runMarkup).join('') : '<div class="ld68-empty">Nenhuma execução local ainda.</div>';
      if (detail) detail.innerHTML = detailMarkup(selected, result);
      bindDynamic(card);
      refreshBadge();
    } catch (error) { toast(error.message, true); }
  }
  async function runAction(fn, success = '') {
    if (busy) return null;
    busy = true;
    const card = root()?.querySelector('.ld68-card');
    const start = card?.querySelector('[data-local-start]');
    if (start) { start.disabled = true; start.innerHTML = '<span class="ld68-spinner"></span> Executando localmente'; }
    try {
      const result = await fn();
      if (result?.run?.taskId) {
        selectedTaskId = result.run.taskId;
        ephemeralResults.set(selectedTaskId, result);
      }
      if (success) toast(success);
      return result;
    } catch (error) { toast(`${error.code ? `${error.code}: ` : ''}${error.message}`, true); throw error; }
    finally { busy = false; await render(); }
  }
  function commandValue(card) { return String(card.querySelector('[data-local-command]')?.value || '').trim(); }
  function bindDynamic(card) {
    const permission = card.querySelector('[data-local-permission]');
    if (permission) permission.onclick = async () => { try { await api().requestRuntimePermission(); toast('Permissão de localhost atualizada.'); render(); } catch (error) { toast(error.message, true); } };
    const health = card.querySelector('[data-local-health]');
    if (health) health.onclick = async () => { try { const out = await api().health(); toast(out.ok ? `Runtime local OK · ${(out.models||[]).length} modelo(s)` : `Runtime indisponível: ${out.code}`, !out.ok); render(); } catch (error) { toast(error.message, true); } };
    const save = card.querySelector('[data-local-token-save]');
    if (save) save.onclick = async () => { const token = card.querySelector('[data-local-token]')?.value || ''; if (!token) return toast('Informe o RUNTIME_TOKEN.', true); try { await api().setRuntimeToken(token); card.querySelector('[data-local-token]').value=''; toast('Token mantido somente nesta sessão.'); render(); } catch (error) { toast(error.message, true); } };
    const clear = card.querySelector('[data-local-token-clear]');
    if (clear) clear.onclick = async () => { await api().clearRuntimeToken().catch(()=>null); toast('Token local removido da sessão.'); render(); };
    card.querySelectorAll('[data-local-run]').forEach(button => button.onclick = () => { selectedTaskId = button.dataset.localRun; render(); });
    const approve = card.querySelector('[data-local-approve]');
    if (approve) approve.onclick = async () => {
      const overrides = [...card.querySelectorAll('[data-human-override]:checked')].map(input => input.value);
      const digest = approve.dataset.localApprove;
      await runAction(() => api().approveWrite(selectedTaskId, digest, { humanIntentOverrides: overrides }), 'Proposta aprovada e enviada ao runtime protegido.').catch(()=>null);
    };
    const reject = card.querySelector('[data-local-reject]');
    if (reject) reject.onclick = async () => { if (!window.confirm('Não executar esta proposta e cancelar a tarefa local?')) return; await api().cancel(selectedTaskId).catch(error=>toast(error.message,true)); ephemeralResults.delete(selectedTaskId); render(); };
    const resume = card.querySelector('[data-local-resume]');
    if (resume) resume.onclick = async () => { const command = commandValue(card); if (!command) return toast('Cole novamente o pedido original para reidratar sem persistir o prompt.', true); await runAction(() => api().resume(selectedTaskId, { command }), 'Tarefa retomada.').catch(()=>null); };
    const cancel = card.querySelector('[data-local-cancel]');
    if (cancel) cancel.onclick = async () => { if (!window.confirm('Cancelar esta execução local? Commits já concluídos não serão revertidos.')) return; await api().cancel(selectedTaskId).catch(error=>toast(error.message,true)); ephemeralResults.delete(selectedTaskId); render(); };
  }
  async function open() {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return;
    modal.classList.add('open');
    card.className = 'ld2-card ld68-card';
    card.innerHTML = `<div class="ld68-head"><div><small>BUILD 68 · LOCAL AGENT ORCHESTRATOR</small><h2>Decrypter Local Agent</h2><p>Qwen local → Context Engine → Tools → Human Intent → Continuity.</p></div><button type="button" data-local-close>×</button></div><div class="ld68-grid"><aside class="ld68-side"><div data-local-runtime></div><div class="ld68-command"><textarea data-local-command placeholder="Descreva a tarefa para o agente local..."></textarea></div><div class="ld68-actions"><button type="button" class="primary" data-local-start>Executar com IA local</button></div><div class="ld68-runs"><small>EXECUÇÕES</small><div data-local-runs></div></div></aside><main class="ld68-main" data-local-detail></main></div>`;
    card.querySelector('[data-local-close]').onclick = () => modal.classList.remove('open');
    card.querySelector('[data-local-start]').onclick = async () => {
      const command = commandValue(card);
      if (!command) return toast('Descreva a tarefa.', true);
      await runAction(() => api().start(command, { projectId: projectId() })).catch(()=>null);
    };
    await render();
  }

  window.addEventListener('ld2:unified-launcher-ready', installCard);
  document.addEventListener('DOMContentLoaded', () => { installCard(); refreshBadge(); }, { once:true });
  setTimeout(() => { installCard(); refreshBadge(); }, 1900);
})();
