(() => {
  'use strict';
  if (window.__LD66_REVERSIBLE_OPERATIONS_CLIENT__) return;
  window.__LD66_REVERSIBLE_OPERATIONS_CLIENT__ = true;

  const PORT = 'ld2-reversible-operations';

  function request(action, payload = {}, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT });
      const id = crypto.randomUUID();
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => {
        const error = new Error(`REVERSAL_RUNTIME_TIMEOUT:${action}`);
        error.code = 'REVERSAL_RUNTIME_TIMEOUT';
        finish(reject, error);
      }, Math.max(10000, Math.min(240000, Number(timeoutMs || 180000))));

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'REVERSAL_FAILED');
          error.code = message?.code || 'REVERSAL_FAILED';
          error.plan = message?.plan || null;
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) {
          const error = new Error(chrome.runtime.lastError?.message || 'REVERSAL_RUNTIME_DISCONNECTED');
          error.code = 'REVERSAL_RUNTIME_DISCONNECTED';
          finish(reject, error);
        }
      });
      port.postMessage({ id, action, payload });
    });
  }

  window.LovableDecrypterReversibleOperations = Object.freeze({
    schema: 'ld-reversible-operation/1',
    status() { return request('status', {}, 30000); },
    list(projectId = '', limit = 30) { return request('list', { projectId, limit }, 60000); },
    preview(operationId, { projectId = '', direction = 'undo', strategy = 'preserve' } = {}) {
      return request('preview', { projectId, operationId, direction, strategy }, 180000);
    },
    apply(previewId, { confirmDestructive = false } = {}) {
      // Must only be called from an explicit user confirmation event.
      return request('apply', { previewId, humanDecision: true, confirmDestructive: confirmDestructive === true }, 180000);
    },
    undo(operationId, options = {}) { return this.preview(operationId, { ...options, direction: 'undo' }); },
    redo(operationId, options = {}) { return this.preview(operationId, { ...options, direction: 'redo' }); }
  });
})();
