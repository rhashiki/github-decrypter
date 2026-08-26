(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__) return;
  window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__ = true;

  const state = { running: false, scheduled: false, stopped: false };
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
    if (!el) return; el.textContent = text; el.dataset.kind = kind;
  }
  function sameProject(item, ctx) {
    if (item?.project_id && String(item.project_id) !== ctx.projectId) return false;
    if (item?.github_owner && String(item.github_owner) !== String(ctx.github.owner || '')) return false;
    if (item?.github_repo && String(item.github_repo) !== String(ctx.github.repo || '')) return false;
    if (item?.github_branch && String(item.github_branch) !== String(ctx.github.branch || 'main')) return false;
    return true;
  }
  async function finish(ctx, item, status, resultSummary = null, errorCode = null) {
    return cloud(ctx, 'ld-queue', { action: 'finish', item_id: item.id, status, result_summary: resultSummary, error_code: errorCode, project_id: ctx.projectId });
  }
  async function executeItem(ctx, item) {
    if (!sameProject(item, ctx)) {
      await finish(ctx, item, 'blocked', null, 'PROJECT_CONTEXT_MISMATCH');
      throw new Error('PROJECT_CONTEXT_MISMATCH');
    }
    const command = String(item.command_text || '').trim();
    const skills = Array.isArray(item.skill_slugs) ? item.skill_slugs.map(String).filter(Boolean).slice(0, 12) : [];
    if (!command) {
      await finish(ctx, item, 'blocked', null, 'EMPTY_QUEUE_COMMAND');
      throw new Error('EMPTY_QUEUE_COMMAND');
    }
    const requestId = crypto.randomUUID();
    const common = {
      command,
      projectId: ctx.projectId,
      requestId,
      skillSlugs: skills,
      source: 'queue',
      queueItemId: item.id,
      commandId: item.command_id
    };
    setBridgeStatus(`Fila #${item.queue_position || item.batch_position} · ${skills.length ? `${skills.length} Skill(s) · ` : ''}${item.mode === 'plan' ? 'planejando' : 'construindo'}…`, 'active');
    if (item.mode === 'plan') {
      const bundle = await runtime({ type: 'LD2_PLAN_ONLY', ...common });
      const summary = String(bundle?.plan?.summary || 'Plano concluído.').slice(0, 3500);
      await finish(ctx, item, 'completed', summary, null);
      setBridgeStatus(`Fila #${item.queue_position || item.batch_position} · plano concluído`, 'success');
      return;
    }
    const out = await runtime({ type: 'LD2_BUILD_EXECUTE', ...common });
    const commit = String(out?.result?.commitSha || '').slice(0, 12);
    const summary = [String(out?.bundle?.plan?.summary || out?.result?.summary || 'Build concluída.'), commit ? `commit ${commit}` : ''].filter(Boolean).join(' · ').slice(0, 3500);
    await finish(ctx, item, 'completed', summary, null);
    setBridgeStatus(commit ? `Fila · commit ${commit}` : 'Fila · item concluído', 'success');
  }

  async function run() {
    state.scheduled = false;
    if (state.running || state.stopped || document.visibilityState === 'hidden') return;
    const ctx = await activeContext().catch(() => null); if (!ctx) return;
    state.running = true;
    try {
      while (!state.stopped && document.visibilityState !== 'hidden') {
        let claimed;
        try {
          claimed = await cloud(ctx, 'ld-queue', { action: 'claim_next', project_id: ctx.projectId, github_owner: String(ctx.github.owner || ''), github_repo: String(ctx.github.repo || ''), github_branch: String(ctx.github.branch || 'main') });
        } catch (error) {
          if (String(error?.message || error) === 'QUEUE_ALREADY_RUNNING') return;
          throw error;
        }
        if (claimed?.empty || !claimed?.item) { setBridgeStatus('Fila pronta', ''); return; }
        const item = claimed.item;
        try {
          await executeItem(ctx, item);
          window.dispatchEvent(new CustomEvent('ld2:queue-changed', { detail: { projectId: ctx.projectId, completedItem: item.id } }));
        } catch (error) {
          const code = String(error?.message || error || 'QUEUE_EXECUTION_FAILED').slice(0, 150);
          try { if (code !== 'PROJECT_CONTEXT_MISMATCH' && code !== 'EMPTY_QUEUE_COMMAND') await finish(ctx, item, 'failed', null, code); } catch (_) {}
          setBridgeStatus(`Fila pausada · ${code}`, 'error');
          return;
        }
      }
    } catch (error) { setBridgeStatus(`Fila · ${error?.message || String(error)}`, 'error'); }
    finally { state.running = false; }
  }
  function kick(delay = 180) {
    if (state.scheduled || state.running || state.stopped) return;
    state.scheduled = true; setTimeout(run, delay);
  }
  window.LovableDecrypterQueueExecutor = { kick: () => kick(50), stop: () => { state.stopped = true; }, start: () => { state.stopped = false; kick(50); }, get running() { return state.running; } };
  window.addEventListener('ld2:queue-changed', () => kick(80));
  window.addEventListener('ld2:project', () => kick(350));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(250); });
  document.addEventListener('click', event => { if (event.target.closest?.('[data-queue-control="resume"],[data-queue-retry]')) setTimeout(() => kick(700), 700); }, true);
  kick(1200);
})();