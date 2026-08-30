(() => {
  'use strict';
  if (window.__LD61_TOOL_RUNTIME_CLIENT__) return;
  window.__LD61_TOOL_RUNTIME_CLIENT__ = true;

  const PORT_NAME = 'ld2-tool-runtime';
  const DEFAULT_TIMEOUT = 120000;

  function request(action, payload = {}, timeoutMs = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const cleanup = () => {
        try { port.disconnect(); } catch (_) {}
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`Tool Runtime timeout: ${action}`);
        error.code = 'TOOL_RUNTIME_TIMEOUT';
        reject(error);
      }, Math.max(5000, Math.min(180000, Number(timeoutMs || DEFAULT_TIMEOUT))));

      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (message.ok) resolve(message.data);
        else {
          const error = new Error(message?.error || 'TOOL_RUNTIME_FAILED');
          error.code = message?.code || 'TOOL_RUNTIME_FAILED';
          error.operationId = message?.operationId || '';
          reject(error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(chrome.runtime.lastError?.message || 'Tool Runtime desconectado.');
        error.code = 'TOOL_RUNTIME_DISCONNECTED';
        reject(error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  window.LovableDecrypterTools = Object.freeze({
    build: 61,
    schema: 'ld-tool-runtime/1',
    list(projectId = '') {
      return request('list', { projectId });
    },
    invoke(tool, input = {}, options = {}) {
      return request('invoke', {
        tool,
        input,
        projectId: options.projectId || '',
        taskId: options.taskId || '',
        parentOperationId: options.parentOperationId || '',
        origin: options.origin || 'tool',
        transactionId: options.transactionId || '',
        authorization: options.transactionId ? { transactionId: options.transactionId } : {}
      }, options.timeoutMs || DEFAULT_TIMEOUT);
    },
    journal(filters = {}) {
      return request('journal', { filters }, 30000);
    }
  });
})();
