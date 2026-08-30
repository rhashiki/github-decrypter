(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_V2_CONTENT__) return;
  window.__LOVABLE_DECRYPTER_V2_CONTENT__ = true;

  const MONITOR_KEY = 'ld2_monitor_enabled';
  const state = { projectId: '', url: location.href, monitorEnabled: true };
  let announceQueued = false;

  function extractProjectId() {
    const path = `${location.pathname}${location.hash}`;
    const uuid = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    if (uuid) return uuid[0];
    const project = path.match(/\/projects?\/([^/?#]+)/i);
    return project?.[1] || '';
  }

  async function announce() {
    announceQueued = false;
    if (!state.monitorEnabled) return;
    const next = extractProjectId();
    if (next === state.projectId && state.url === location.href) return;
    state.projectId = next;
    state.url = location.href;
    try { await chrome.runtime.sendMessage({ type: 'LD2_PROJECT_SEEN', projectId: next, url: location.href }); } catch (_) {}
    window.dispatchEvent(new CustomEvent('ld2:project', { detail: { ...state } }));
  }

  function scheduleAnnounce() {
    if (!state.monitorEnabled || announceQueued) return;
    announceQueued = true;
    queueMicrotask(announce);
  }

  async function runtime(message) {
    const guard = window.LovableDecrypterCredentialGuard;
    const prepared = guard?.prepareMessage ? await guard.prepareMessage(message) : message;
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(prepared, res => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res?.ok) return reject(new Error(res?.error || 'Falha na extensão.'));
        resolve(res.data);
      });
    });
  }

  async function initMonitor() {
    try {
      const stored = await chrome.storage.local.get(MONITOR_KEY);
      state.monitorEnabled = stored[MONITOR_KEY] !== false;
    } catch (_) {
      state.monitorEnabled = true;
    }
    scheduleAnnounce();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[MONITOR_KEY]) return;
    state.monitorEnabled = changes[MONITOR_KEY].newValue !== false;
    window.dispatchEvent(new CustomEvent('ld2:monitor-state', { detail: { enabled: state.monitorEnabled } }));
    scheduleAnnounce();
  });

  window.LovableDecrypterV2 = {
    version: chrome.runtime.getManifest().version,
    state,
    runtime,
    getProjectId: () => state.projectId,
    getMonitorEnabled: () => state.monitorEnabled,
    plan: (command, attachments = []) => runtime({ type: 'LD2_PLAN_ONLY', command, attachments, projectId: state.projectId }),
    build: (command, attachments = []) => runtime({ type: 'LD2_BUILD_EXECUTE', command, attachments, projectId: state.projectId }),
    prepare: command => runtime({ type: 'LD2_PLAN_PREPARE', command, projectId: state.projectId }),
    apply: id => runtime({ type: 'LD2_PLAN_APPLY', id }),
    settings: () => runtime({ type: 'LD2_SETTINGS_GET' })
  };

  initMonitor();
  addEventListener('popstate', scheduleAnnounce);
  addEventListener('hashchange', scheduleAnnounce);
  addEventListener('pageshow', scheduleAnnounce);
  addEventListener('focus', scheduleAnnounce);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleAnnounce(); });
  try { window.navigation?.addEventListener?.('navigate', scheduleAnnounce); } catch (_) {}
})();
