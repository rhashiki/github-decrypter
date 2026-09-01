(() => {
  'use strict';
  if (window.__LD2_CAPABILITY_REGISTRY__) return;
  window.__LD2_CAPABILITY_REGISTRY__ = true;

  const ROUTING_KEY = 'ld2_native_routing_enabled';
  const SESSION_KEY = 'ld2_capability_registry_last_v1';
  const core = () => window.LovableDecrypterHardeningCore;
  let last = null;
  let inflight = null;

  const capability = (id, required, status, reason = '', build = 0) => ({ id, required, status, reason, build });

  async function routingEnabled() {
    try {
      const stored = await chrome.storage.local.get(ROUTING_KEY);
      return stored[ROUTING_KEY] !== false;
    } catch (_) {
      return true;
    }
  }

  function probe(enabled) {
    const deep = window.LovableDecrypterWorkspaceDeepRead;
    const graph = window.LovableDecrypterProjectStateGraph;
    const doctor = window.LovableDecrypterRecoveryDoctor;
    const chat = window.LovableDecrypterChat;
    const approval = window.LovableDecrypterApproval;
    let chatState = null;
    try { chatState = chat?.snapshot?.() || null; } catch (_) {}

    return [
      capability('workspace.tree', true, typeof deep?.getSnapshot === 'function' ? 'ready' : 'unavailable', 'Lovable workspace tree reader', 26),
      capability('workspace.file', true, typeof deep?.readFile === 'function' ? 'ready' : 'unavailable', 'Lovable workspace file reader', 26),
      capability('workspace.metadata', true, typeof deep?.getSnapshot === 'function' ? 'ready' : 'unavailable', 'Workspace metadata snapshot', 26),
      capability('workspace.download', false, typeof deep?.downloadWorkspaceZip === 'function' ? 'ready' : 'unavailable', 'Portable workspace ZIP', 26),
      capability('project.state_graph', true, typeof graph?.getGraph === 'function' ? 'ready' : 'unavailable', 'Unified Project State Graph', 27),
      capability('recovery.scan', false, typeof doctor?.getReport === 'function' ? 'ready' : 'unavailable', 'Project Recovery Doctor', 28),
      capability('composer.mount', true, typeof chat?.mount === 'function' ? 'ready' : 'unavailable', 'Decrypter Chat mount API', 29),
      capability(
        'chat.host',
        enabled,
        !enabled ? 'inactive' : !chat ? 'unavailable' : (chatState?.mounted && ['READY', 'BUSY'].includes(String(chatState?.phase || '').toUpperCase()) ? 'ready' : 'degraded'),
        !enabled ? 'native_mode' : String(chatState?.reason || 'chat_host_not_ready'),
        29
      ),
      capability('plan.surface', true, typeof approval?.executeFrozen === 'function' ? 'ready' : 'unavailable', 'Approve/Skip plan surface', 30),
      capability('approval.transaction', true, approval?.guarantees?.scopeLock === true && approval?.guarantees?.guardedCommit === true ? 'ready' : 'unavailable', 'Frozen approval transaction', 30)
    ];
  }

  async function refresh(reason = 'manual') {
    if (inflight) return inflight;
    inflight = (async () => {
      const enabled = await routingEnabled();
      const capabilities = probe(enabled);
      const summary = core()?.summarizeCapabilities?.(capabilities, { routingEnabled: enabled }) || null;
      const snapshot = Object.freeze({
        schema: 'ld-capability-registry/1',
        build: 31,
        collectedAt: new Date().toISOString(),
        reason: String(reason || 'manual').slice(0, 80),
        routingEnabled: enabled,
        summary,
        capabilities: summary?.capabilities || capabilities
      });
      last = snapshot;
      try { await chrome.storage.session.set({ [SESSION_KEY]: snapshot }); } catch (_) {}
      window.dispatchEvent(new CustomEvent('ld2:capability-registry', { detail: snapshot }));
      return snapshot;
    })().finally(() => { inflight = null; });
    return inflight;
  }

  async function getLast() {
    if (last) return last;
    try {
      const stored = await chrome.storage.session.get(SESSION_KEY);
      return stored[SESSION_KEY] || null;
    } catch (_) {
      return null;
    }
  }

  window.LovableDecrypterCapabilities = Object.freeze({
    build: 31,
    schema: 'ld-capability-registry/1',
    refresh,
    getLast,
    list: () => last?.capabilities || []
  });

  refresh('boot').catch(() => {});
})();