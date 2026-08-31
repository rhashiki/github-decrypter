(() => {
  'use strict';
  if (window.__LD64_CONTEXT_ENGINE_CLIENT__) return;
  window.__LD64_CONTEXT_ENGINE_CLIENT__ = true;

  const PORT_NAME = 'ld2-context-engine';

  function call(action, payload = {}, { timeoutMs = 120000, onProgress = null } = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const cleanup = () => { try { port.disconnect(); } catch (_) {} };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`Context Engine timeout: ${action}`);
        error.code = 'CONTEXT_ENGINE_TIMEOUT';
        reject(error);
      }, Math.max(5000, Math.min(180000, Number(timeoutMs || 120000))));

      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        if (message?.event === 'progress') {
          try { onProgress?.({ stage: message.stage || '', detail: message.detail || '' }); } catch (_) {}
          return;
        }
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (message?.ok) resolve(message.data);
        else {
          const error = new Error(message?.error || 'CONTEXT_ENGINE_FAILED');
          error.code = message?.code || 'CONTEXT_ENGINE_FAILED';
          reject(error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(chrome.runtime.lastError?.message || 'Context Engine desconectado.');
        error.code = 'CONTEXT_ENGINE_DISCONNECTED';
        reject(error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  window.LovableDecrypterContext = Object.freeze({
    build: 64,
    schema: 'ld-context-pack/2',
    status() { return call('status', {}, { timeoutMs: 30000 }); },
    userEdits(limit = 24) { return call('user_edits', { projectId: projectId(), limit }, { timeoutMs: 30000 }); },
    build(task, options = {}) {
      return call('build', {
        task: String(task || ''),
        projectId: options.projectId || projectId(),
        explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
        skills: Array.isArray(options.skills) ? options.skills : [],
        projectState: options.projectState && typeof options.projectState === 'object' ? options.projectState : {},
        diagnostics: options.diagnostics && typeof options.diagnostics === 'object' ? options.diagnostics : {},
        includeKnowledge: options.includeKnowledge !== false,
        maxFiles: options.maxFiles,
        maxContextBytes: options.maxContextBytes,
        maxCodeBytes: options.maxCodeBytes
      }, { timeoutMs: options.timeoutMs || 120000, onProgress: options.onProgress });
    }
  });
})();
