(() => {
  'use strict';
  if (window.LovableDecrypterAccountIntegrationGate) return;

  const PORT_NAME = 'ld2-account-integration-readiness';

  function call(action, payload = {}, timeout = 35000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name:PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('ACCOUNT_INTEGRATION_STATUS_TIMEOUT')), timeout);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else {
          const error = new Error(message.error || message.code || 'ACCOUNT_INTEGRATION_STATUS_FAILED');
          error.code = message.code || '';
          error.readiness = message.readiness || null;
          done(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  const projectId = () => String(window.LovableDecrypterV2?.getProjectId?.() || '');
  window.LovableDecrypterAccountIntegrationGate = Object.freeze({
    build:70,
    schema:'ld-account-integration-readiness/1',
    status: id => call('status', { projectId:String(id || projectId()) }),
    assert: id => call('assert', { projectId:String(id || projectId()) })
  });
})();
