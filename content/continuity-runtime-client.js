(() => {
  'use strict';
  if (window.__LD67_CONTINUITY_CLIENT__) return;
  window.__LD67_CONTINUITY_CLIENT__ = true;

  const PORT_NAME = 'ld2-continuity-runtime';
  const DEFAULT_TIMEOUT = 30000;

  function request(action, payload = {}, timeoutMs = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const cleanup = () => { try { port.disconnect(); } catch (_) {} };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`Continuity Runtime timeout: ${action}`);
        error.code = 'CONTINUITY_RUNTIME_TIMEOUT';
        reject(error);
      }, Math.max(5000, Math.min(120000, Number(timeoutMs || DEFAULT_TIMEOUT))));

      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (message.ok) resolve(message.data);
        else {
          const error = new Error(message?.error || 'CONTINUITY_RUNTIME_FAILED');
          error.code = message?.code || 'CONTINUITY_RUNTIME_FAILED';
          error.details = message?.details || null;
          reject(error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(chrome.runtime.lastError?.message || 'Continuity Runtime desconectado.');
        error.code = 'CONTINUITY_RUNTIME_DISCONNECTED';
        reject(error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  window.LovableDecrypterContinuity = Object.freeze({
    build: 67,
    schema: 'ld-continuity-task/1',
    status() { return request('status'); },
    create(payload = {}) { return request('create', payload); },
    defineSteps(taskId, steps = []) { return request('define_steps', { taskId, steps }); },
    claim(payload = {}) { return request('claim', payload); },
    completeStep(payload = {}) { return request('complete_step', payload); },
    failStep(payload = {}) { return request('fail_step', payload); },
    resolveWrite(payload = {}) { return request('resolve_write', payload); },
    resume(taskId) { return request('resume', { taskId }); },
    cancel(taskId) { return request('cancel', { taskId }); },
    list(filters = {}) { return request('list', filters); },
    get(taskId) { return request('get', { taskId }); },
    next(taskId) { return request('next', { taskId }); },
    checkpoint(payload = {}) { return request('checkpoint', payload); },
    recover(reason = 'manual-recovery') { return request('recover', { reason }); }
  });
})();
