(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_V2_CONTENT__) return;
  window.__LOVABLE_DECRYPTER_V2_CONTENT__ = true;

  const state = { projectId: '', url: location.href };

  function extractProjectId() {
    const path = `${location.pathname}${location.hash}`;
    const uuid = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    if (uuid) return uuid[0];
    const project = path.match(/\/projects?\/([^/?#]+)/i);
    return project?.[1] || '';
  }

  async function announce() {
    const next = extractProjectId();
    if (next === state.projectId && state.url === location.href) return;
    state.projectId = next;
    state.url = location.href;
    try { await chrome.runtime.sendMessage({ type: 'LD2_PROJECT_SEEN', projectId: next, url: location.href }); } catch (_) {}
    window.dispatchEvent(new CustomEvent('ld2:project', { detail: { ...state } }));
  }

  function runtime(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, res => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res?.ok) return reject(new Error(res?.error || 'Falha na extensão.'));
        resolve(res.data);
      });
    });
  }

  window.LovableDecrypterV2 = {
    version: '2.0.10',
    state,
    runtime,
    getProjectId: () => state.projectId,
    plan: (command, attachments = []) => runtime({ type: 'LD2_PLAN_ONLY', command, attachments, projectId: state.projectId }),
    build: (command, attachments = []) => runtime({ type: 'LD2_BUILD_EXECUTE', command, attachments, projectId: state.projectId }),
    prepare: command => runtime({ type: 'LD2_PLAN_PREPARE', command, projectId: state.projectId }),
    apply: id => runtime({ type: 'LD2_PLAN_APPLY', id }),
    settings: () => runtime({ type: 'LD2_SETTINGS_GET' })
  };

  announce();
  setInterval(announce, 1200);
  addEventListener('popstate', announce);
  addEventListener('hashchange', announce);
})();
