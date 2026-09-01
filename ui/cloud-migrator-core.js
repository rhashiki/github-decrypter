(() => {
  'use strict';
  if (window.__LD2_CLOUD_MIGRATOR_UI__) return;
  window.__LD2_CLOUD_MIGRATOR_UI__ = true;

  const PORT_NAME = 'ld2-cloud-migration';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let running = false;
  let cancelRequested = false;
  let activeJobId = '';

  function broker(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { try { port.disconnect(); } catch (_) {} reject(new Error('O Cloud Migrator não respondeu dentro do tempo limite.')); }, 75000);
      let done = false;
      const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); try { port.disconnect(); } catch (_) {} fn(value); };
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else finish(reject, new Error(message.error || 'Falha no Cloud Migrator.'));
      });
      port.onDisconnect.addListener(() => { if (!done && chrome.runtime.lastError) finish(reject, new Error(chrome.runtime.lastError.message)); });
      port.postMessage({ id, action, payload });
    });
  }
  function rootParts() {
    const root = document.getElementById('ld2-root');
    return { root, modal: root && $('.ld2-modal', root), card: root && $('.ld2-card', root) };
  }
  function close() { rootParts().modal?.classList.remove('open'); }
  function open(html) {
    const { modal, card } = rootParts();
    if (!modal || !card) throw new Error('Control Center ainda não está pronto.');
    card.innerHTML = html; modal.classList.add('open');
    $('[data-cm-close]', card)?.addEventListener('click', close);
    return card;
  }
  function toast(text, error = false) {
    const { root } = rootParts(); const wrap = root && $('.ld2-toast-wrap', root); if (!wrap) return;
    const el = document.createElement('div'); el.className = `ld2-toast${error ? ' error' : ''}`; el.textContent = text; wrap.appendChild(el); setTimeout(() => el.remove(), 4000);
  }
  function context() { return window.LovableDecrypterProjectRuntime?.getContext?.() || null; }
  async function settings() { return window.LovableDecrypterV2?.runtime?.({ type: 'LD2_SETTINGS_GET' }) || {}; }
  function targetFor(settings, projectId) {
    const mapped = settings?.supabaseMappings?.[projectId] || {};
    const global = settings?.supabase || {};
    return {
      projectRef: String(mapped.projectRef || mapped.ref || global.projectRef || ''),
      projectName: String(mapped.projectName || mapped.name || global.projectName || ''),
      organizationSlug: String(mapped.organizationSlug || global.organizationSlug || '')
    };
  }
  function shell(body) {
    return `<div class="ld2-cm"><header class="ld2-cm-head"><div><small>LOVABLE CLOUD → SUPABASE</small><h2>Cloud Migrator</h2><p>Build 6 · schema, dados, RLS e Auth</p></div><button type="button" data-cm-close>×</button></header><div class="ld2-cm-body">${body}</div></div>`;
  }
  function phaseLabel(phase) {
    return ({ prepare:'PREPARAR', inspect:'DIAGNÓSTICO', schema:'SCHEMA', data:'DADOS', rls:'RLS', auth:'AUTH', verify:'VERIFICAR', done:'CONCLUÍDO' })[phase] || String(phase || '').toUpperCase();
  }
  function progressHtml(job) {
    const p = job?.progress || {}; const inv = job?.inventory || {};
    const phases = ['schema','data','rls','auth','verify'];
    const current = String(job?.phase || 'prepare');
    const index = phases.indexOf(current);
    const doneAll = current === 'done' || job?.status === 'completed';
    const pills = phases.map((ph, i) => `<span class="${doneAll || i < index ? 'done' : ph === current ? 'active' : ''}">${ph.toUpperCase()}</span>`).join('');
    const rowsDone = Number(p.data_rows_done || 0); const rowsTotal = Number(p.data_rows_total || inv.totalRows || 0);
    const pct = rowsTotal ? Math.min(100, Math.round(rowsDone * 100 / rowsTotal)) : (current === 'data' ? 0 : 100);
    return `<div class="ld2-cm-phases">${pills}</div><div class="ld2-cm-progress"><div style="width:${current === 'data' ? pct : doneAll ? 100 : Math.max(5, (Math.max(0,index)+1)*18)}%"></div></div><div class="ld2-cm-current"><b>${esc(phaseLabel(current))}</b><span>${esc(p.current || '')}</span>${rowsTotal ? `<em>${rowsDone.toLocaleString('pt-BR')} / ${rowsTotal.toLocaleString('pt-BR')} linhas public</em>` : ''}</div>`;
  }
  function inventoryHtml(job) {
    const inv = job?.inventory || {}; const auth = inv.auth || [];
    const authUsers = auth.find(x => x.table === 'users'); const authIds = auth.find(x => x.table === 'identities');
    return `<div class="ld2-cm-grid"><div><small>TABELAS</small><b>${Number(inv.tables?.length || 0)}</b></div><div><small>LINHAS</small><b>${Number(inv.totalRows || 0).toLocaleString('pt-BR')}</b></div><div><small>POLICIES</small><b>${Number(inv.policies?.length || 0)}</b></div><div><small>AUTH USERS</small><b>${Number(authUsers?.rows || 0).toLocaleString('pt-BR')}</b></div><div><small>IDENTITIES</small><b>${Number(authIds?.rows || 0).toLocaleString('pt-BR')}</b></div><div><small>FUNÇÕES</small><b>${Number(inv.functions?.length || 0)}</b></div></div>`;
  }
  function warningsHtml(warnings) {
    const list = Array.isArray(warnings) ? warnings : [];
    return list.length ? `<div class="ld2-cm-warnings"><b>⚠ Limites desta Build</b>${list.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';
  }
  async function cleanupHelper(ctx) {
    const runtime = window.LovableDecrypterCloudMigratorContent;
    if (!runtime || !ctx) return { ok: false, error: 'Runtime do helper indisponível.' };
    try { return await runtime.cleanup(ctx, runtime.helperSpec(ctx)); }
    catch (error) { return { ok: false, error: error?.message || String(error) }; }
  }
  async function showInitial() {
    let ctx = context();
    if (!ctx) ctx = await window.LovableDecrypterProjectRuntime?.refresh?.(true);
    const cfg = await settings();
    const target = targetFor(cfg, ctx?.projectId || '');
    const sourceOk = ctx?.backend?.type === 'lovable_cloud' || ctx?.backend?.managedByLovable === true;
    const targetOk = /^[a-z0-9]{8,32}$/i.test(target.projectRef);
    const same = targetOk && ctx?.backend?.supabaseRef && target.projectRef === ctx.backend.supabaseRef;
    const active = ctx?.projectId ? await broker('active', { lovable_project_id: ctx.projectId }).catch(() => null) : null;
    if (active?.job) return renderJob(active.job, ctx, true);
    const card = open(shell(`
      <div class="ld2-cm-pair"><div><small>ORIGEM</small><b>${esc(ctx?.project?.name || 'Projeto Lovable')}</b><span>${sourceOk ? 'Lovable Cloud detectado' : 'Lovable Cloud não detectado'}</span><em>${esc(ctx?.backend?.supabaseRef || 'ref gerenciado não exposto')}</em></div><i>→</i><div><small>DESTINO</small><b>${esc(target.projectName || target.projectRef || 'Não selecionado')}</b><span>${targetOk ? 'Supabase autorizado via OAuth' : 'Selecione um Supabase no Control Center'}</span><em>${esc(target.projectRef || '—')}</em></div></div>
      ${!sourceOk ? '<div class="ld2-cm-block">Este projeto não foi identificado como Lovable Cloud. A migração foi bloqueada.</div>' : ''}
      ${!targetOk ? '<div class="ld2-cm-block">Nenhum projeto Supabase está vinculado a este projeto Lovable.</div>' : ''}
      ${same ? '<div class="ld2-cm-block">Origem e destino apontam para o mesmo projeto. A migração foi bloqueada.</div>' : ''}
      <div class="ld2-cm-scope"><b>O que a Build 6 migra</b><span>Schema public · dados public · PK/UK/FK/check · funções/views/triggers · RLS/policies/grants · auth.users · auth.identities.</span><small>Não migra Storage, Edge Functions, Secrets, Cron, MFA/sessões ou configuração de provedores Auth nesta Build.</small></div>
      <label class="ld2-cm-check"><input type="checkbox" data-cm-confirm ${sourceOk && targetOk && !same ? '' : 'disabled'}><span>Entendi que esta operação escreve no Supabase destino e que o projeto de origem não deve receber alterações de dados durante a cópia.</span></label>
      <div class="ld2-cm-actions"><button type="button" class="primary" data-cm-start disabled>Preparar migração</button></div>`));
    const check = $('[data-cm-confirm]', card); const start = $('[data-cm-start]', card);
    if (check && start) check.onchange = () => { start.disabled = !check.checked; };
    start?.addEventListener('click', () => prepare(ctx, target, card));
  }
  async function prepare(ctx, target, card) {
    const start = $('[data-cm-start]', card); if (start) start.disabled = true;
    const runtime = window.LovableDecrypterCloudMigratorContent;
    if (!runtime) return toast('Runtime do helper não carregou.', true);
    try {
      card.querySelector('.ld2-cm-body').innerHTML = '<div class="ld2-cm-loading"><span></span><b>Preparando job e helper temporário…</b><small>Nenhuma credencial da origem será devolvida ao navegador.</small></div>';
      const spec = runtime.helperSpec(ctx);
      const prepared = await broker('prepare', {
        lovable_project_id: ctx.projectId,
        lovable_project_name: ctx.project?.name || '', framework: ctx.project?.framework || '',
        source_project_ref: ctx.backend?.supabaseRef || '', destination_project_ref: target.projectRef,
        destination_project_name: target.projectName || target.projectRef, helper_path: spec.path, helper_url: spec.url
      });
      activeJobId = prepared.job.id;
      const installed = await runtime.installAndHandoff({ context: ctx, job: prepared.job, handoffToken: prepared.handoff_token, brokerUrl: prepared.broker_handoff_url });
      const status = await broker('status', { job_id: activeJobId });
      if (status.job?.status !== 'helper_ready') throw new Error('O helper foi publicado, mas o broker não confirmou o handoff da origem.');
      const inspected = await broker('inspect', { job_id: activeJobId });
      await renderJob(inspected.job, ctx, false, installed);
    } catch (error) {
      if (activeJobId) await broker('cancel', { job_id: activeJobId }).catch(() => {});
      await cleanupHelper(ctx).catch(() => {});
      toast(error?.message || String(error), true);
      await showInitial();
    }
  }
  async function renderJob(job, ctx, resumed = false, installed = null) {
    activeJobId = job.id;
    const isPrepared = job.status === 'prepared';
    const terminal = ['completed','cancelled','failed'].includes(job.status);
    const card = open(shell(`
      <div class="ld2-cm-job"><small>JOB ${esc(String(job.id).slice(0,8))}</small><b>${esc(job.lovable_project_name || ctx?.project?.name || 'Projeto')}</b><span>${esc(job.source_project_ref || 'Lovable Cloud')} → ${esc(job.destination_project_name || job.destination_project_ref)}</span></div>
      ${job.inventory && Object.keys(job.inventory).length ? inventoryHtml(job) : ''}
      ${progressHtml(job)}
      ${warningsHtml(job.warnings)}
      ${isPrepared && resumed ? '<div class="ld2-cm-block">Este job foi recarregado antes do handoff do helper. Por segurança, cancele e prepare novamente.</div>' : ''}
      <div class="ld2-cm-actions">
        ${!terminal && !isPrepared ? '<button type="button" class="primary" data-cm-run>Iniciar / Retomar</button>' : ''}
        ${!terminal ? '<button type="button" class="danger" data-cm-cancel>Cancelar</button>' : ''}
        ${isPrepared && resumed ? '<button type="button" data-cm-restart>Cancelar e preparar novamente</button>' : ''}
        ${job.status === 'completed' ? '<button type="button" data-cm-close-done>Fechar</button>' : ''}
      </div>
      <div class="ld2-cm-log">${(job.logs || []).slice(-12).reverse().map(x => `<div><small>${esc((x.at || '').slice(11,19))}</small><span>${esc(x.message)}</span></div>`).join('')}</div>`));
    $('[data-cm-run]', card)?.addEventListener('click', () => runLoop(job.id, ctx, installed));
    $('[data-cm-cancel]', card)?.addEventListener('click', () => cancel(job.id, ctx));
    $('[data-cm-restart]', card)?.addEventListener('click', async () => { await cancel(job.id, ctx); await showInitial(); });
    $('[data-cm-close-done]', card)?.addEventListener('click', close);
  }
  async function runLoop(jobId, ctx, installed) {
    if (running) return; running = true; cancelRequested = false;
    try {
      for (let i = 0; i < 10000; i++) {
        if (cancelRequested) return;
        const result = await broker('run_next', { job_id: jobId }); const job = result.job;
        await renderJob(job, ctx, false, installed);
        if (job.status === 'completed') {
          const clean = await cleanupHelper(ctx);
          if (!clean.ok) toast(`Migração concluída, mas o helper precisa ser removido manualmente: ${clean.error}`, true);
          else toast('Migração concluída e helper temporário removido.');
          return;
        }
        if (['failed','cancelled'].includes(job.status)) return;
        await sleep(180);
      }
      throw new Error('Limite de unidades do migrador atingido. Reabra o painel e retome o job.');
    } catch (error) { toast(error?.message || String(error), true); const status = await broker('status', { job_id: jobId }).catch(() => null); if (status?.job) await renderJob(status.job, ctx, true, installed); }
    finally { running = false; }
  }
  async function cancel(jobId, ctx) {
    if (!confirm('Cancelar esta migração? O destino não será revertido automaticamente.')) return;
    cancelRequested = true;
    try {
      const result = await broker('cancel', { job_id: jobId });
      const clean = await cleanupHelper(ctx);
      toast(clean.ok ? 'Migração cancelada e helper removido.' : 'Migração cancelada; verifique a remoção do helper.', !clean.ok);
      await renderJob(result.job, ctx, false);
    } catch (error) { toast(error?.message || String(error), true); }
  }
  function installButton() {
    const root = document.getElementById('ld2-root'); if (!root) return false;
    if (root.querySelector('[data-cc-action="cloud-migrate"]')) return true;
    const migrations = root.querySelector('[data-cc-action="migrate"]'); if (!migrations) return false;
    const button = document.createElement('button');
    button.className = 'ld2-cc-card accent'; button.type = 'button'; button.dataset.ccAction = 'cloud-migrate';
    button.innerHTML = '<span>☁</span><div><b>Migrar Cloud</b><small>Lovable Cloud → Supabase com checkpoint</small></div>';
    migrations.parentNode.insertBefore(button, migrations);
    migrations.querySelector('b') && (migrations.querySelector('b').textContent = 'Aplicar Migrations');
    migrations.querySelector('small') && (migrations.querySelector('small').textContent = 'GitHub → migrations SQL → Supabase');
    return true;
  }
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('#ld2-root [data-cc-action="cloud-migrate"]') : null;
    if (!target) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    showInitial().catch(error => toast(error?.message || String(error), true));
  }, true);
  for (let i = 0; i < 24; i++) setTimeout(() => installButton(), 150 + i * 250);
  addEventListener('ld2:project-context', () => installButton());
})();
