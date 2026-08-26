(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BATCH_MODE__) return;
  window.__LOVABLE_DECRYPTER_BATCH_MODE__ = true;

  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  let refreshTimer = null;
  let refreshing = false;

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  async function context() {
    const settings = await runtime({ type: 'LD2_SETTINGS_GET' });
    const pid = projectId();
    if (!pid) throw new Error('Projeto Lovable não identificado.');
    const mapping = settings?.projectMappings?.[pid] || {};
    const github = { ...(settings?.github || {}), ...mapping };
    if (!github.owner || !github.repo) throw new Error('Configure o GitHub deste projeto antes de usar o Batch.');
    const backendBase = String(settings?.auth?.backendBase || '').replace(/\/+$/, '');
    const licenseKey = String(settings?.auth?.licenseKey || '');
    const deviceId = String(settings?.auth?.deviceId || '');
    if (!backendBase || !licenseKey || !deviceId) throw new Error('Licença/dispositivo ainda não estão prontos.');
    return {
      settings,
      projectId: pid,
      github: { owner: String(github.owner), repo: String(github.repo), branch: String(github.branch || 'main') },
      backendBase,
      licenseKey,
      deviceId
    };
  }

  async function queueCall(ctx, body = {}) {
    const res = await fetch(`${ctx.backendBase}/ld-queue`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': ctx.licenseKey,
        'x-device-id': ctx.deviceId
      },
      body: JSON.stringify({
        ...body,
        project_id: ctx.projectId,
        github_owner: ctx.github.owner,
        github_repo: ctx.github.repo,
        github_branch: ctx.github.branch
      })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }

  async function loadQueue(ctx) {
    return queueCall(ctx, { action: 'list', limit: 150 });
  }

  function statusLabel(status) {
    return ({ queued:'Aguardando', running:'Executando', paused:'Pausado', blocked:'Bloqueado', completed:'Concluído', failed:'Falhou', cancelled:'Cancelado' })[status] || status || '—';
  }

  function toast(message, error = false) {
    const root = document.getElementById(ROOT_ID);
    const wrap = root?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function batchStatus(batch, items) {
    if (batch?.status) return statusLabel(batch.status);
    if (items.some(x => x.status === 'failed' || x.status === 'blocked')) return 'Falhou';
    if (items.some(x => x.status === 'running')) return 'Executando';
    if (items.some(x => x.status === 'paused')) return 'Pausado';
    if (items.every(x => x.status === 'completed')) return 'Concluído';
    return 'Aguardando';
  }

  function queueRow(item) {
    const cancellable = ['queued','paused'].includes(item.status);
    const retryable = ['failed','blocked'].includes(item.status);
    return `<article class="ld2-queue-row status-${esc(item.status)}">
      <div class="ld2-queue-pos">${Number(item.batch_position || item.queue_position || 0)}</div>
      <div class="ld2-queue-copy">
        <div><b>${esc(statusLabel(item.status))}</b><em>${esc(item.mode || 'build')}</em></div>
        <p>${esc(item.command_text || '')}</p>
        ${Array.isArray(item.skill_slugs) && item.skill_slugs.length ? `<small>Skills: ${esc(item.skill_slugs.join(', '))}</small>` : ''}
        ${item.result_summary ? `<small>${esc(item.result_summary)}</small>` : ''}
        ${item.error_code ? `<small class="error">${esc(item.error_code)}</small>` : ''}
      </div>
      <div class="ld2-queue-actions">
        ${cancellable ? `<button type="button" data-batch-cancel="${esc(item.id)}" title="Cancelar">×</button>` : ''}
        ${retryable ? `<button type="button" data-batch-retry="${esc(item.id)}" title="Tentar novamente">↻</button>` : ''}
      </div>
    </article>`;
  }

  function batchGroups(out) {
    const items = Array.isArray(out?.items) ? out.items : [];
    const batches = new Map((Array.isArray(out?.batches) ? out.batches : []).map(batch => [String(batch.id), batch]));
    const grouped = new Map();
    for (const item of items) {
      const id = String(item.batch_id || 'sem-batch');
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(item);
    }
    return [...grouped.entries()].map(([id, batchItems]) => ({ id, batch: batches.get(id) || null, items: batchItems }));
  }

  async function renderQueue(card, ctx, out) {
    const counts = out?.counts || {};
    const groups = batchGroups(out);
    const pending = Number(counts.queued || 0) + Number(counts.running || 0) + Number(counts.paused || 0);
    card.innerHTML = `
      <div class="ld2-cloud-head"><div><small>BATCH MODE · ${esc(ctx.projectId)}</small><h2>Fila do projeto</h2><p>${esc(ctx.github.owner)}/${esc(ctx.github.repo)} · ${esc(ctx.github.branch)}</p></div><button type="button" data-batch-close>×</button></div>
      <div class="ld2-queue-counts">
        <span><b>${Number(counts.running || 0)}</b> executando</span>
        <span><b>${Number(counts.queued || 0)}</b> aguardando</span>
        <span><b>${Number(counts.paused || 0)}</b> pausados</span>
        <span><b>${Number(counts.failed || 0) + Number(counts.blocked || 0)}</b> falhas</span>
      </div>
      <div class="ld2-queue-controls">
        <button type="button" data-batch-control="pause">Pausar</button>
        <button type="button" data-batch-control="resume">Continuar</button>
        <button type="button" class="danger" data-batch-control="cancel_pending">Cancelar pendentes</button>
        <button type="button" data-batch-refresh>Atualizar</button>
      </div>
      <p class="ld2-help">Execução estritamente sequencial. Cada Build passa novamente por Project Rules, Skill Router, Scope Lock, Shadow Build, Regression Sentinel, Validation Gate e Checkpoint. Uma falha pausa os itens seguintes deste projeto.</p>
      <div class="ld2-queue-list">${groups.length ? groups.map(group => `
        <section class="ld2-list-item" data-batch-id="${esc(group.id)}">
          <div><b>Batch ${esc(group.id.slice(0,8))}</b> <small>${esc(batchStatus(group.batch, group.items))} · ${group.items.length} item(ns)</small></div>
          <div class="ld2-queue-list">${group.items.map(queueRow).join('')}</div>
        </section>`).join('') : '<div class="ld2-cloud-empty">Nenhum comando deste projeto está na fila.</div>'}</div>
      <div class="ld2-help">${pending ? `${pending} item(ns) ainda exigem processamento.` : 'Fila deste projeto concluída ou vazia.'}</div>`;

    card.querySelector('[data-batch-close]').onclick = () => card.closest('.ld2-modal')?.classList.remove('open');
    card.querySelector('[data-batch-refresh]').onclick = async () => renderQueue(card, ctx, await loadQueue(ctx));
    $$('[data-batch-control]', card).forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await queueCall(ctx, { action: 'control', operation: button.dataset.batchControl });
        if (button.dataset.batchControl === 'resume') window.LovableDecrypterQueueExecutor?.start?.();
        await renderQueue(card, ctx, await loadQueue(ctx));
        await refreshScopedCount();
      } catch (error) {
        toast(error?.message || String(error), true);
        button.disabled = false;
      }
    });
    $$('[data-batch-cancel]', card).forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await queueCall(ctx, { action: 'cancel_item', item_id: button.dataset.batchCancel });
        await renderQueue(card, ctx, await loadQueue(ctx));
        await refreshScopedCount();
      } catch (error) { toast(error?.message || String(error), true); button.disabled = false; }
    });
    $$('[data-batch-retry]', card).forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await queueCall(ctx, { action: 'retry_failed', item_id: button.dataset.batchRetry });
        window.LovableDecrypterQueueExecutor?.start?.();
        await renderQueue(card, ctx, await loadQueue(ctx));
        await refreshScopedCount();
      } catch (error) { toast(error?.message || String(error), true); button.disabled = false; }
    });
  }

  async function openQueue() {
    const root = document.getElementById(ROOT_ID);
    const modal = root?.querySelector('.ld2-modal');
    const card = modal?.querySelector('.ld2-card');
    if (!modal || !card) throw new Error('Control Center ainda não está pronto.');
    card.className = 'ld2-card ld2-cloud-card queue';
    card.innerHTML = '<div class="ld2-cloud-loading">Carregando Batch do projeto…</div>';
    modal.classList.add('open');
    try {
      const ctx = await context();
      await renderQueue(card, ctx, await loadQueue(ctx));
    } catch (error) {
      card.innerHTML = `<div class="ld2-cloud-head"><div><small>BATCH MODE</small><h2>Fila indisponível</h2><p>${esc(error?.message || String(error))}</p></div><button type="button" data-batch-close>×</button></div>`;
      card.querySelector('[data-batch-close]').onclick = () => modal.classList.remove('open');
    }
  }

  async function refreshScopedCount() {
    if (refreshing || document.visibilityState === 'hidden') return;
    refreshing = true;
    try {
      const ctx = await context();
      const out = await loadQueue(ctx);
      const counts = out?.counts || {};
      const pending = Number(counts.queued || 0) + Number(counts.running || 0) + Number(counts.paused || 0) + Number(counts.failed || 0) + Number(counts.blocked || 0);
      $$('.ld2-native-bridge [data-cloud-queue]').forEach(button => { button.textContent = pending ? `☷ Batch ${pending}` : '☷ Batch'; });
      const root = document.getElementById(ROOT_ID);
      const queueCard = root?.querySelector('[data-cc-future="queue"]');
      if (queueCard) {
        queueCard.classList.remove('future');
        queueCard.querySelector('em')?.remove();
        const title = queueCard.querySelector('b'); if (title) title.textContent = 'Batch';
        const small = queueCard.querySelector('small'); if (small) small.textContent = pending ? `${pending} pendente(s) neste projeto` : 'Fila sequencial do projeto';
      }
      const health = root?.querySelector('.ld2-cc-health>div:nth-child(3)');
      if (health) {
        health.querySelector('.ld2-cc-dot')?.classList.add('ready');
        const label = health.querySelector('small'); if (label) label.textContent = 'Batch';
        const value = health.querySelector('b'); if (value) value.textContent = pending ? `${pending} pendente(s)` : 'Pronto';
      }
    } catch (_) {}
    finally { refreshing = false; }
  }

  function interceptQueueOpen(event) {
    const target = event.target.closest?.('#ld2-root [data-cloud-queue], #ld2-root [data-cc-future="queue"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openQueue().catch(error => toast(error?.message || String(error), true));
  }

  document.addEventListener('click', interceptQueueOpen, true);
  window.addEventListener('ld2:queue-changed', () => setTimeout(refreshScopedCount, 120));
  window.addEventListener('ld2:project', () => setTimeout(refreshScopedCount, 250));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshScopedCount(); });
  new MutationObserver(() => refreshScopedCount()).observe(document.documentElement, { childList: true, subtree: true });
  refreshTimer = setInterval(refreshScopedCount, 5000);
  addEventListener('beforeunload', () => clearInterval(refreshTimer), { once: true });
  setTimeout(refreshScopedCount, 700);

  window.LovableDecrypterBatchMode = { open: openQueue, refresh: refreshScopedCount };
})();
