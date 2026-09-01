(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__) return;
  window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__ = true;

  const JOURNAL_PREFIX = 'ld2_queue_journal_v1_';
  const RECOVERY_MIN_AGE_MS = 180_000;
  const RECOVERY_STALE_PROGRESS_MS = 90_000;
  const state = {
    running: false,
    scheduled: false,
    stopped: false,
    rescheduleMs: 0,
    requestToItem: new Map()
  };
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  async function settings() { return runtime({ type: 'LD2_SETTINGS_GET' }); }
  async function activeContext() {
    const cfg = await settings();
    const projectId = String(window.LovableDecrypterV2?.getProjectId?.() || '');
    if (!projectId) return null;
    const mapping = cfg?.projectMappings?.[projectId] || {};
    const github = { ...(cfg?.github || {}), ...mapping };
    if (!github.owner || !github.repo) return null;
    return { cfg, projectId, github };
  }

  async function cloud(ctx, slug, body = {}) {
    const base = String(ctx.cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(ctx.cfg?.auth?.licenseKey || '');
    const device = String(ctx.cfg?.auth?.deviceId || '');
    if (!base || !key || !device) throw new Error('LICENSE_OR_DEVICE_NOT_READY');
    const res = await fetch(`${base}/${slug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-license-key': key, 'x-device-id': device },
      body: JSON.stringify(body)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }

  function setBridgeStatus(text, kind = '') {
    const el = document.querySelector('.ld2-native-bridge [data-ld2-bridge-status]');
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function sameProject(item, ctx) {
    if (item?.project_id && String(item.project_id) !== ctx.projectId) return false;
    if (item?.github_owner && String(item.github_owner) !== String(ctx.github.owner || '')) return false;
    if (item?.github_repo && String(item.github_repo) !== String(ctx.github.repo || '')) return false;
    if (item?.github_branch && String(item.github_branch) !== String(ctx.github.branch || 'main')) return false;
    return true;
  }

  const journalKey = itemId => `${JOURNAL_PREFIX}${String(itemId || '')}`;
  async function journalGet(itemId) {
    const key = journalKey(itemId);
    const data = await chrome.storage.local.get(key);
    return data[key] || null;
  }
  async function journalSet(itemId, patch) {
    const key = journalKey(itemId);
    const prev = await journalGet(itemId);
    const next = { ...(prev || {}), ...patch, itemId: String(itemId || ''), updatedAt: Date.now() };
    await chrome.storage.local.set({ [key]: next });
    if (next.requestId) state.requestToItem.set(String(next.requestId), String(itemId));
    return next;
  }
  async function journalClear(itemId) {
    const prev = await journalGet(itemId);
    if (prev?.requestId) state.requestToItem.delete(String(prev.requestId));
    await chrome.storage.local.remove(journalKey(itemId));
  }
  async function hydrateJournalMap() {
    const all = await chrome.storage.local.get(null);
    for (const [key, value] of Object.entries(all || {})) {
      if (!key.startsWith(JOURNAL_PREFIX) || !value?.requestId) continue;
      state.requestToItem.set(String(value.requestId), String(value.itemId || key.slice(JOURNAL_PREFIX.length)));
    }
  }

  function parseCommit(detail = '') {
    return String(detail || '').match(/\bCommit\s+([0-9a-f]{7,40})\b/i)?.[1] || '';
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'LD2_PROGRESS' || !message?.requestId) return;
    const itemId = state.requestToItem.get(String(message.requestId));
    if (!itemId) return;
    const detail = String(message.detail || message.label || '').slice(0, 3500);
    const commitSha = parseCommit(detail);
    const done = message.stage === 'done' && message.status === 'done';
    journalSet(itemId, {
      lastProgressAt: Date.now(),
      lastStage: String(message.stage || ''),
      lastStatus: String(message.status || ''),
      lastDetail: detail,
      ...(commitSha ? { commitSha } : {}),
      ...(done ? { status: 'completed', resultSummary: detail || 'Execução concluída.' } : {})
    }).catch(() => {});
  });

  async function finish(ctx, item, status, resultSummary = null, errorCode = null) {
    return cloud(ctx, 'ld-queue', {
      action: 'finish',
      item_id: item.id,
      status,
      result_summary: resultSummary,
      error_code: errorCode,
      project_id: ctx.projectId
    });
  }

  async function queueList(ctx) {
    return cloud(ctx, 'ld-queue', {
      action: 'list',
      limit: 200,
      project_id: ctx.projectId,
      github_owner: String(ctx.github.owner || ''),
      github_repo: String(ctx.github.repo || ''),
      github_branch: String(ctx.github.branch || 'main')
    });
  }

  async function currentHead() {
    try {
      const out = await runtime({ type: 'LD2_REPO_CACHE_WARM', projectId: String(window.LovableDecrypterV2?.getProjectId?.() || '') });
      return String(out?.headSha || '');
    } catch (_) {
      return '';
    }
  }

  async function refreshExecutionContext() {
    await window.LovableDecrypterProjectIntelligence?.syncBrain?.().catch(() => null);
    await window.LovableDecrypterProjectRulesCache?.refresh?.().catch(() => null);
  }

  async function reconcileRunning(ctx) {
    const out = await queueList(ctx);
    const running = (Array.isArray(out?.items) ? out.items : []).find(item => item?.status === 'running');
    if (!running) return { resolved: true, waiting: false };
    if (!sameProject(running, ctx)) return { resolved: false, waiting: true };

    const journal = await journalGet(running.id);
    if (journal?.requestId) state.requestToItem.set(String(journal.requestId), String(running.id));

    if (journal?.status === 'completed') {
      const summary = String(journal.resultSummary || journal.lastDetail || 'Execução recuperada após reload.').slice(0, 3500);
      await finish(ctx, running, 'completed', summary, null);
      await journalClear(running.id);
      window.dispatchEvent(new CustomEvent('ld2:queue-changed', { detail: { projectId: ctx.projectId, recoveredItem: running.id } }));
      setBridgeStatus('Fila · execução recuperada após reload', 'success');
      return { resolved: true, waiting: false };
    }

    if (journal?.status === 'failed') {
      const code = String(journal.errorCode || 'RECOVERED_EXECUTION_FAILED').slice(0, 150);
      await finish(ctx, running, 'failed', String(journal.resultSummary || '').slice(0, 3500) || null, code);
      await journalClear(running.id);
      setBridgeStatus(`Fila pausada · ${code}`, 'error');
      return { resolved: false, waiting: false };
    }

    const now = Date.now();
    const startedAt = Number(journal?.startedAt || Date.parse(running.started_at || '') || now);
    const lastProgressAt = Number(journal?.lastProgressAt || startedAt);
    const age = now - startedAt;
    const idle = now - lastProgressAt;

    if (journal && (age < RECOVERY_MIN_AGE_MS || idle < RECOVERY_STALE_PROGRESS_MS)) {
      setBridgeStatus(`Fila · recuperando item em execução · ${journal.lastStage || 'aguardando progresso'}`, 'active');
      return { resolved: false, waiting: true, retryMs: 1500 };
    }

    const headNow = await currentHead();
    const headBefore = String(journal?.headBefore || '');
    if (headBefore && headNow && headNow !== headBefore) {
      await finish(
        ctx,
        running,
        'blocked',
        'Recovery detectou mudança de HEAD após interrupção. O item foi bloqueado para evitar commit duplicado; revise o projeto e use Ignorar ou Tentar novamente.',
        'RECOVERY_HEAD_CHANGED'
      );
      await journalClear(running.id);
      setBridgeStatus('Fila bloqueada · recovery detectou HEAD alterado', 'error');
      return { resolved: false, waiting: false };
    }

    if (age >= RECOVERY_MIN_AGE_MS) {
      await finish(
        ctx,
        running,
        'failed',
        'A execução foi interrompida e não houve mudança detectável no HEAD. O item pode ser tentado novamente com segurança.',
        journal ? 'RECOVERY_INTERRUPTED' : 'RECOVERY_JOURNAL_MISSING'
      );
      await journalClear(running.id);
      setBridgeStatus('Fila pausada · execução interrompida recuperada', 'error');
      return { resolved: false, waiting: false };
    }

    return { resolved: false, waiting: true, retryMs: 1500 };
  }

  async function executeItem(ctx, item) {
    if (!sameProject(item, ctx)) {
      await finish(ctx, item, 'blocked', null, 'PROJECT_CONTEXT_MISMATCH');
      throw new Error('PROJECT_CONTEXT_MISMATCH');
    }
    const command = String(item.command_text || '').trim();
    if (!command) {
      await finish(ctx, item, 'blocked', null, 'EMPTY_QUEUE_COMMAND');
      throw new Error('EMPTY_QUEUE_COMMAND');
    }

    await refreshExecutionContext();
    const headBefore = await currentHead();
    const requestId = crypto.randomUUID();
    await journalSet(item.id, {
      status: 'running',
      requestId,
      commandId: String(item.command_id || ''),
      mode: item.mode === 'plan' ? 'plan' : 'build',
      projectId: ctx.projectId,
      headBefore,
      startedAt: Date.now(),
      lastProgressAt: Date.now(),
      initialSkillHints: Array.isArray(item.skill_slugs) ? item.skill_slugs.map(String).filter(Boolean).slice(0, 12) : []
    });

    // Skills are intentionally NOT passed as explicit skillSlugs here.
    // The Build 8 Skill Router recalculates pinned + Auto Skills at execution time.
    const common = {
      command,
      projectId: ctx.projectId,
      requestId,
      source: 'queue',
      queueItemId: item.id,
      commandId: item.command_id
    };

    setBridgeStatus(`Fila #${item.queue_position || item.batch_position} · recalculando Brain/Rules/Skills/HEAD…`, 'active');
    try {
      if (item.mode === 'plan') {
        const bundle = await runtime({ type: 'LD2_PLAN_ONLY', ...common });
        const routed = window.LovableDecrypterSkillRouter?.get?.(requestId);
        const summary = [
          String(bundle?.plan?.summary || 'Plano concluído.'),
          routed?.slugs?.length ? `Skills ${routed.slugs.join(', ')}` : ''
        ].filter(Boolean).join(' · ').slice(0, 3500);
        await journalSet(item.id, { status: 'completed', resultSummary: summary, completedAt: Date.now() });
        await finish(ctx, item, 'completed', summary, null);
        await journalClear(item.id);
        setBridgeStatus(`Fila #${item.queue_position || item.batch_position} · plano concluído`, 'success');
        return;
      }

      const out = await runtime({ type: 'LD2_BUILD_EXECUTE', ...common });
      const routed = window.LovableDecrypterSkillRouter?.get?.(requestId);
      const commit = String(out?.result?.commitSha || '').slice(0, 40);
      const summary = [
        String(out?.bundle?.plan?.summary || out?.result?.summary || 'Build concluída.'),
        commit ? `commit ${commit.slice(0, 12)}` : '',
        routed?.slugs?.length ? `Skills ${routed.slugs.join(', ')}` : ''
      ].filter(Boolean).join(' · ').slice(0, 3500);
      await journalSet(item.id, { status: 'completed', resultSummary: summary, commitSha: commit, completedAt: Date.now() });
      await finish(ctx, item, 'completed', summary, null);
      await journalClear(item.id);
      setBridgeStatus(commit ? `Fila · commit ${commit.slice(0, 12)}` : 'Fila · item concluído', 'success');
    } catch (error) {
      const code = String(error?.message || error || 'QUEUE_EXECUTION_FAILED').slice(0, 150);
      await journalSet(item.id, { status: 'failed', errorCode: code, resultSummary: String(error?.message || '').slice(0, 3500), completedAt: Date.now() }).catch(() => {});
      throw error;
    }
  }

  async function run() {
    state.scheduled = false;
    state.rescheduleMs = 0;
    if (state.running || state.stopped || document.visibilityState === 'hidden') return;
    const ctx = await activeContext().catch(() => null);
    if (!ctx) return;
    state.running = true;
    try {
      const recovery = await reconcileRunning(ctx);
      if (recovery?.waiting) {
        state.rescheduleMs = recovery.retryMs || 1500;
        return;
      }
      if (recovery && !recovery.resolved) return;

      while (!state.stopped && document.visibilityState !== 'hidden') {
        let claimed;
        try {
          claimed = await cloud(ctx, 'ld-queue', {
            action: 'claim_next',
            project_id: ctx.projectId,
            github_owner: String(ctx.github.owner || ''),
            github_repo: String(ctx.github.repo || ''),
            github_branch: String(ctx.github.branch || 'main')
          });
        } catch (error) {
          if (String(error?.message || error) === 'QUEUE_ALREADY_RUNNING') {
            state.rescheduleMs = 1500;
            return;
          }
          throw error;
        }

        if (claimed?.empty || !claimed?.item) {
          setBridgeStatus('Fila pronta', '');
          return;
        }

        const item = claimed.item;
        try {
          await executeItem(ctx, item);
          window.dispatchEvent(new CustomEvent('ld2:queue-changed', { detail: { projectId: ctx.projectId, completedItem: item.id } }));
        } catch (error) {
          const code = String(error?.message || error || 'QUEUE_EXECUTION_FAILED').slice(0, 150);
          try {
            if (code !== 'PROJECT_CONTEXT_MISMATCH' && code !== 'EMPTY_QUEUE_COMMAND') {
              await finish(ctx, item, 'failed', null, code);
            }
          } catch (_) {}
          await journalClear(item.id).catch(() => {});
          setBridgeStatus(`Fila pausada · ${code}`, 'error');
          return;
        }
      }
    } catch (error) {
      setBridgeStatus(`Fila · ${error?.message || String(error)}`, 'error');
    } finally {
      state.running = false;
      if (state.rescheduleMs && !state.stopped) {
        const delay = state.rescheduleMs;
        state.rescheduleMs = 0;
        setTimeout(() => kick(20), delay);
      }
    }
  }

  function kick(delay = 180) {
    if (state.scheduled || state.running || state.stopped) return;
    state.scheduled = true;
    setTimeout(run, delay);
  }

  hydrateJournalMap().catch(() => {});
  window.LovableDecrypterQueueExecutor = {
    kick: () => kick(50),
    stop: () => { state.stopped = true; },
    start: () => { state.stopped = false; kick(50); },
    recover: () => { state.stopped = false; kick(50); },
    get running() { return state.running; },
    get stopped() { return state.stopped; }
  };
  window.addEventListener('ld2:queue-changed', () => kick(80));
  window.addEventListener('ld2:project', () => kick(350));
  window.addEventListener('ld2:project-rules-synced', () => kick(120));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(250); });
  kick(1200);
})();