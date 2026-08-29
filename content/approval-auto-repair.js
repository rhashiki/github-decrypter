(() => {
  'use strict';
  if (window.__LD2_APPROVAL_AUTO_REPAIR__) return;
  window.__LD2_APPROVAL_AUTO_REPAIR__ = true;

  const PORT = 'ld2-approval-transaction';
  const HOST_ID = 'ld2-decrypter-chat-host';
  const DECORATE_MS = 650;
  const running = new Set();
  const text = value => String(value ?? '').trim();
  const api = () => window.LovableDecrypterV2;
  const core = () => window.LovableDecrypterChatCore;
  const projectId = () => text(api()?.getProjectId?.());

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function portCall(action, payload = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT });
      const id = crypto.randomUUID();
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('APPROVAL_TRANSACTION_TIMEOUT')), 240000);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.event === 'progress') { onProgress?.(message); return; }
        if (message.ok) done(resolve, message.data);
        else done(reject, new Error(message.error || 'APPROVAL_TRANSACTION_FAILED'));
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  async function currentGraph(force = true) {
    const graph = await window.LovableDecrypterProjectStateGraph?.getGraph?.({ force, deepCompare: false });
    if (!graph?.hash) throw new Error('Project State indisponível; a transação foi bloqueada.');
    return graph;
  }

  async function skillContext(command) {
    const router = window.LovableDecrypterSkillRouter;
    if (!router?.route) return { slugs: [], context: '' };
    try {
      const selected = await router.route(command);
      const slugs = Array.isArray(selected?.slugs) ? selected.slugs.slice(0, 8) : [];
      const catalog = await router.list?.().catch?.(() => null);
      const all = Array.isArray(catalog?.all) ? catalog.all : [];
      let used = 0;
      const chunks = [];
      for (const slug of slugs) {
        const skill = all.find(item => String(item?.slug) === String(slug));
        const body = String(skill?.content_md || '').trim();
        if (!body) continue;
        const room = 70000 - used;
        if (room <= 0) break;
        const part = body.slice(0, room);
        chunks.push(`SKILL ${slug}\n${part}`);
        used += part.length;
      }
      return { slugs, context: chunks.join('\n\n---\n\n') };
    } catch (_) { return { slugs: [], context: '' }; }
  }

  function historyKey() {
    return core()?.historyKey?.(projectId()) || '';
  }

  async function history() {
    const key = historyKey();
    if (!key) return [];
    const stored = await chrome.storage.local.get(key);
    return core()?.sanitizeHistory?.(stored[key] || []) || [];
  }

  function contextForMessage(items, messageId) {
    const index = items.findIndex(item => item.id === messageId);
    if (index < 0) return null;
    const assistant = items[index];
    let user = null;
    for (let i = index - 1; i >= 0; i--) {
      if (items[i]?.role === 'user') { user = items[i]; break; }
    }
    if (!user) return null;
    return { user, assistant };
  }

  function planFromMessage(message) {
    return {
      summary: text(message?.content || 'Plano aprovado.'),
      plan: Array.isArray(message?.steps) ? message.steps : [],
      files: (Array.isArray(message?.files) ? message.files : []).map(file => ({ path: text(file?.path), reason: text(file?.reason) })),
      warnings: Array.isArray(message?.warnings) ? message.warnings : []
    };
  }

  function injectChatStyle(shadow) {
    if (!shadow || shadow.getElementById?.('ld30-approval-style')) return;
    const style = document.createElement('style');
    style.id = 'ld30-approval-style';
    style.textContent = `.ld30-actions{display:flex;gap:6px;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid rgba(90,255,155,.14)}.ld30-actions button{border:1px solid rgba(87,255,151,.3);background:rgba(39,185,91,.1);color:#87ffb1;border-radius:7px;padding:6px 9px;font:10px Arial,sans-serif;cursor:pointer}.ld30-actions button.primary{background:rgba(42,210,101,.2);color:#d9ffe5}.ld30-actions button.skip{border-color:rgba(255,198,96,.3);color:#ffd180;background:rgba(255,190,70,.06)}.ld30-actions button:disabled{opacity:.45;cursor:not-allowed}.ld30-tx{font:9px/1.4 Arial,sans-serif;color:#78a88a;margin-left:auto}.ld30-result{margin-top:8px;padding:7px;border:1px solid rgba(69,255,150,.2);border-radius:8px;color:#aaffc5;font-size:10px}.ld30-result.error{border-color:rgba(255,102,102,.28);color:#ffaaaa}`;
    shadow.appendChild(style);
  }

  function setRowStatus(actions, label, error = false) {
    let result = actions.querySelector('.ld30-result');
    if (!result) {
      result = document.createElement('div');
      result.className = 'ld30-result';
      actions.parentElement?.appendChild(result);
    }
    result.classList.toggle('error', !!error);
    result.textContent = label;
  }

  async function executeFrozen({ command, plan, decision, source = 'decrypter-chat', attachments = [], onProgress = null }) {
    if (!projectId()) throw new Error('Abra um projeto Lovable antes de executar.');
    if (!plan?.files?.length) throw new Error('O plano não possui arquivos autorizáveis.');
    await window.LovableDecrypterProjectRulesCache?.refresh?.().catch?.(() => null);
    const [graph, skills] = await Promise.all([currentGraph(true), skillContext(command)]);
    const frozen = await portCall('freeze', {
      projectId: projectId(), command, plan, decision, source,
      stateRevision: graph.hash,
      skillSlugs: skills.slugs
    }, onProgress);
    const prepared = await portCall('prepare', {
      transactionId: frozen.id,
      currentStateRevision: graph.hash,
      attachments,
      skillContext: skills.context
    }, onProgress);
    const current = await currentGraph(true);
    const applied = await portCall('apply', {
      transactionId: frozen.id,
      currentStateRevision: current.hash
    }, onProgress);
    let sync = null;
    const commitSha = text(applied?.result?.commitSha);
    if (commitSha && window.LovableDecrypterSyncVerifier?.verify) {
      sync = await window.LovableDecrypterSyncVerifier.verify({ projectId: projectId(), commitSha }).catch(() => null);
    }
    return { frozen, prepared, applied, sync };
  }

  async function executeChatMessage(messageId, decision, actions) {
    if (running.has(messageId)) return;
    running.add(messageId);
    actions.querySelectorAll('button').forEach(button => button.disabled = true);
    try {
      const items = await history();
      const ctx = contextForMessage(items, messageId);
      if (!ctx) throw new Error('Não foi possível reconstruir o plano e o comando deste chat.');
      if (ctx.user.attachments?.length) throw new Error('Este plano dependeu de anexos cujos bytes não são persistidos. Regere a execução sem anexos ou reanexe os arquivos.');
      const plan = planFromMessage(ctx.assistant);
      const result = await executeFrozen({
        command: ctx.user.content,
        plan,
        decision,
        source: `decrypter-chat-${ctx.assistant.mode}`,
        onProgress: progress => setRowStatus(actions, `${progress.label || progress.stage}${progress.detail ? ` · ${progress.detail}` : ''}`)
      });
      const sha = text(result?.applied?.result?.commitSha);
      const syncText = result?.sync?.verified ? ' · GitSync Lovable confirmado' : ' · GitHub confirmado';
      setRowStatus(actions, `✓ Commit ${sha.slice(0, 8)}${syncText}`);
      actions.dataset.ld30Done = '1';
      actions.querySelector('.ld30-tx').textContent = decision === 'skip' ? 'PULOU APROVAÇÃO · PROTEÇÕES OK' : 'APROVADO · PROTEÇÕES OK';
    } catch (error) {
      setRowStatus(actions, `Bloqueado: ${error?.message || String(error)}`, true);
      actions.querySelectorAll('button').forEach(button => button.disabled = false);
    } finally { running.delete(messageId); }
  }

  function decorateChat() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return;
    injectChatStyle(shadow);
    shadow.querySelectorAll('.ldc-msg.assistant').forEach(row => {
      if (row.querySelector('.ld30-actions')) return;
      const mode = text(row.querySelector('.ldc-msg-meta span')?.textContent).toLowerCase();
      if (!['plan', 'build'].includes(mode)) return;
      const messageId = text(row.dataset.messageId);
      if (!messageId) return;
      const bubble = row.querySelector('.ldc-bubble');
      if (!bubble) return;
      const actions = document.createElement('div');
      actions.className = 'ld30-actions';
      actions.innerHTML = '<button type="button" class="primary" data-ld30-decision="approve">Aprovar</button><button type="button" class="skip" data-ld30-decision="skip">Pular</button><span class="ld30-tx">Pular aprovação, não proteções.</span>';
      actions.querySelectorAll('[data-ld30-decision]').forEach(button => button.onclick = event => {
        event.preventDefault(); event.stopPropagation();
        executeChatMessage(messageId, button.dataset.ld30Decision, actions).catch(() => {});
      });
      bubble.appendChild(actions);
    });
  }

  function safeRepairCommand(report) {
    const issues = (Array.isArray(report?.issues) ? report.issues : []).slice(0, 120).map(item => ({
      id: text(item?.id), category: text(item?.category), severity: text(item?.severity), title: text(item?.title), detail: text(item?.detail).slice(0, 1500), recoverable: item?.recoverable === true
    }));
    const plan = (Array.isArray(report?.plan) ? report.plan : []).slice(0, 30).map(item => ({ order: item?.order, area: text(item?.area), action: text(item?.action).slice(0, 1500) }));
    return [
      'AUTO REPAIR CONTROLADO DO PROJECT RECOVERY DOCTOR.',
      'Corrija SOMENTE inconsistências comprovadas pelo relatório abaixo e pelo estado atual do projeto.',
      'Use mudanças mínimas e idempotentes. Preserve UI, funcionalidades e estrutura não relacionadas.',
      'Para migrations, crie somente correções incrementais/idempotentes; nunca recrie o banco inteiro nem repita migrations cegamente.',
      'Não invente valores de secrets, tokens, client secrets ou credenciais. Se uma credencial estiver ausente, não tente fabricá-la: deixe a correção dependente de reautorização/configuração humana.',
      'Não crie placeholders para logos/imagens/assets ausentes. Só corrija assets quando a origem real estiver disponível no projeto; caso contrário deixe como warning.',
      'Não baixe assets de URLs arbitrárias e não remova funcionalidades apenas para silenciar erro.',
      'Não altere arquivos fora do necessário para resolver os itens diagnosticados.',
      '',
      `RECOVERY REPORT HASH: ${text(report?.hash)}`,
      `PROJECT STATE HASH: ${text(report?.projectState?.hash)}`,
      `STATUS: ${text(report?.status)}`,
      `ISSUES: ${JSON.stringify(issues)}`,
      `RECOVERY PLAN: ${JSON.stringify(plan)}`
    ].join('\n').slice(0, 50000);
  }

  function doctorCard() { return document.querySelector('#ld2-root .ld2-card'); }

  function renderDoctorPlan(card, report, command, result) {
    const plan = result?.plan || {};
    card.innerHTML = `<div class="ld2-rd"><header class="ld2-rd-head"><div><span class="ld2-rd-mark">AR</span><div><small>AUTO REPAIR · BUILD 30</small><h2>Plano congelável</h2></div></div><button type="button" data-ld30-close>×</button></header><main class="ld2-rd-body"><div class="ld2-rd-portability"><h3>${esc(plan.summary || 'Plano de reparo')}</h3><p>O reparo ainda não escreveu nada. Aprovar/Pular executam Shadow Build + Validation Gate + Guarded Commit.</p></div><div class="ld2-rd-plan"><h3>Etapas</h3>${(plan.plan || []).map((step, index) => `<div><b>${index + 1}.</b><span>${esc(step)}</span></div>`).join('')}</div><div class="ld2-rd-plan"><h3>Arquivos autorizáveis</h3>${(plan.files || []).map(file => `<div><b>•</b><span>${esc(file.path)}${file.reason ? ` · ${esc(file.reason)}` : ''}</span></div>`).join('')}</div><div data-ld30-doctor-status class="ld2-rd-footnote">ZERO WRITE · relatório ${esc(String(report.hash || '').slice(0, 10))}</div></main><footer class="ld2-rd-actions"><button type="button" data-ld30-close>Cancelar</button><button type="button" data-ld30-doctor-decision="skip">Pular</button><button type="button" class="primary" data-ld30-doctor-decision="approve">Aprovar</button></footer></div>`;
    const modal = document.querySelector('#ld2-root .ld2-modal');
    card.querySelectorAll('[data-ld30-close]').forEach(button => button.onclick = () => modal?.classList.remove('open'));
    card.querySelectorAll('[data-ld30-doctor-decision]').forEach(button => button.onclick = async () => {
      card.querySelectorAll('button').forEach(item => item.disabled = true);
      const status = card.querySelector('[data-ld30-doctor-status]');
      try {
        const outcome = await executeFrozen({
          command,
          plan,
          decision: button.dataset.ld30DoctorDecision,
          source: 'project-recovery-doctor',
          onProgress: progress => { if (status) status.textContent = `${progress.label || progress.stage}${progress.detail ? ` · ${progress.detail}` : ''}`; }
        });
        const sha = text(outcome?.applied?.result?.commitSha);
        if (status) status.textContent = `✓ Auto Repair aplicado · commit ${sha.slice(0, 8)}${outcome?.sync?.verified ? ' · GitSync confirmado' : ''}`;
      } catch (error) {
        if (status) status.textContent = `Bloqueado: ${error?.message || String(error)}`;
        card.querySelectorAll('button').forEach(item => item.disabled = false);
      }
    });
  }

  async function startAutoRepair(button) {
    const card = doctorCard();
    if (!card) return;
    button.disabled = true;
    const report = await window.LovableDecrypterRecoveryDoctor?.getReport?.({ force: true });
    if (!report) throw new Error('Recovery Report indisponível.');
    if (report.status === 'healthy' || !(report.issues || []).length) throw new Error('Nenhum reparo automático é necessário.');
    const command = safeRepairCommand(report);
    card.innerHTML = '<div class="ld2-rd"><header class="ld2-rd-head"><div><span class="ld2-rd-mark">AR</span><div><small>AUTO REPAIR · BUILD 30</small><h2>Gerando plano seguro…</h2></div></div></header><div class="ld2-rd-loading"><i></i><b>Project State → Intelligence → Plan</b><small>Nenhuma escrita ocorre nesta etapa.</small></div></div>';
    await window.LovableDecrypterProjectRulesCache?.refresh?.().catch?.(() => null);
    const result = await api().runtime({ type: 'LD2_PLAN_ONLY', command, projectId: projectId(), source: 'recovery-doctor-auto-repair' });
    if (!result?.plan?.files?.length) throw new Error('O Auto Repair não encontrou alterações de arquivo seguras para aplicar.');
    renderDoctorPlan(card, report, command, result);
  }

  function decorateDoctor() {
    const card = doctorCard();
    if (!card) return;
    const buttons = [...card.querySelectorAll('.ld2-rd-actions button')];
    const auto = buttons.find(button => /Auto Repair/i.test(text(button.textContent)));
    if (!auto || auto.dataset.ld30AutoRepair) return;
    auto.dataset.ld30AutoRepair = '1';
    auto.disabled = false;
    auto.removeAttribute('title');
    auto.textContent = 'Auto Repair';
    auto.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      startAutoRepair(auto).catch(error => {
        const status = doctorCard()?.querySelector('.ld2-rd-loading small') || doctorCard()?.querySelector('.ld2-rd-footnote');
        if (status) status.textContent = error?.message || String(error);
        auto.disabled = false;
      });
    }, true);
  }

  function reconcile() {
    decorateChat();
    decorateDoctor();
  }

  const timer = setInterval(reconcile, DECORATE_MS);
  window.addEventListener('ld2:project', reconcile);
  window.addEventListener('ld2:project-recovery-report', reconcile);
  addEventListener('beforeunload', () => clearInterval(timer), { once: true });

  window.LovableDecrypterApproval = Object.freeze({
    build: 30,
    schema: 'ld-approval-transaction/1',
    executeFrozen,
    autoRepair: async () => {
      const report = await window.LovableDecrypterRecoveryDoctor?.getReport?.({ force: true });
      if (!report) throw new Error('Recovery Report indisponível.');
      return { report, command: safeRepairCommand(report) };
    },
    guarantees: Object.freeze({ skipHumanApprovalOnly: true, scopeWhitelist: true, shadowBuild: true, validationGate: true, scopeLock: true, guardedCommit: true, trustProtocol: '2.4.21', secretRecovery: false, arbitraryAssetFetch: false })
  });
  reconcile();
})();
